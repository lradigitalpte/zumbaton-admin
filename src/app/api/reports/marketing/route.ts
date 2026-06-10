/**
 * Marketing Demographics API
 * GET /api/reports/marketing
 *
 * Trials: each trial booking row (guest DOB on booking; gender from payment metadata or booking form notes)
 * Members: all registered member accounts in period (profile + registration form fallback)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import {
  fetchInBatches,
  getMonthBoundsSgt,
  getSgtMonthNumber,
  getSgtYmd,
  getYearBoundsSgt,
  initMonthBuckets,
} from '@/lib/reports-utils'

const TRIAL_STATUSES = ['draft', 'confirmed', 'attended', 'no-show'] as const

const AGE_GROUPS = [
  { key: 'kids', label: 'Kids (under 13)', min: 0, max: 12 },
  { key: 'teens', label: 'Teens (13–17)', min: 13, max: 17 },
  { key: 'young_adult', label: 'Young adults (18–34)', min: 18, max: 34 },
  { key: 'adult', label: 'Adults (35–49)', min: 35, max: 49 },
  { key: 'senior', label: '50+', min: 50, max: 200 },
  { key: 'unknown', label: 'Unknown', min: -1, max: -1 },
] as const

const GENDER_LABELS = ['Female', 'Male', 'Other', 'Prefer not to say', 'Unknown'] as const

type GenderLabel = (typeof GENDER_LABELS)[number]
type AgeGroupKey = (typeof AGE_GROUPS)[number]['key']

type PersonRecord = {
  key: string
  gender: GenderLabel
  ageGroup: AgeGroupKey
  age: number | null
}

function normalizeGender(raw: string | null | undefined): GenderLabel {
  if (!raw) return 'Unknown'
  const value = raw.trim().toLowerCase().replace(/_/g, ' ')
  if (value === 'male' || value === 'm') return 'Male'
  if (value === 'female' || value === 'f') return 'Female'
  if (value === 'other') return 'Other'
  if (value === 'prefer not to say' || value === 'not sure' || value === 'unsure') return 'Prefer not to say'
  return 'Unknown'
}

function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 && age < 120 ? age : null
}

function getAgeGroup(age: number | null): AgeGroupKey {
  if (age === null) return 'unknown'
  for (const group of AGE_GROUPS) {
    if (group.key === 'unknown') continue
    if (age >= group.min && age <= group.max) return group.key
  }
  return 'unknown'
}

function parseGenderFromReason(text: string | null | undefined): GenderLabel | null {
  if (!text) return null
  const match = text.match(/Gender:\s*([^|]+)/i)
  if (match?.[1]) {
    const parsed = normalizeGender(match[1].trim())
    return parsed !== 'Unknown' ? parsed : null
  }
  return null
}

function extractTrialGender(
  cancellationReason: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined
): GenderLabel {
  const candidates: (string | null | undefined)[] = []

  if (metadata) {
    candidates.push(
      typeof metadata.gender === 'string' ? metadata.gender : null,
      typeof metadata.child_gender === 'string' ? metadata.child_gender : null,
    )
    const p1 = metadata.participant1 as { gender?: string } | undefined
    const p2 = metadata.participant2 as { gender?: string } | undefined
    if (p1?.gender) candidates.push(p1.gender)
    if (p2?.gender) candidates.push(p2.gender)

    if (Array.isArray(metadata.participants)) {
      for (const p of metadata.participants) {
        if (p && typeof p === 'object' && 'gender' in p && typeof (p as { gender?: string }).gender === 'string') {
          candidates.push((p as { gender: string }).gender)
        }
      }
    }
  }

  const fromReason = parseGenderFromReason(cancellationReason)
  if (fromReason) candidates.unshift(fromReason)

  for (const raw of candidates) {
    const normalized = normalizeGender(raw)
    if (normalized !== 'Unknown') return normalized
  }

  return 'Unknown'
}

function extractTrialDateOfBirth(
  bookingDob: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  guestName?: string | null
): string | null {
  if (bookingDob) return bookingDob

  if (!metadata) return null

  const flow = metadata.flow_type
  const childDob = typeof metadata.child_date_of_birth === 'string' ? metadata.child_date_of_birth : null
  const guestMetaDob = typeof metadata.guest_date_of_birth === 'string' ? metadata.guest_date_of_birth : null

  if (flow === 'zumfamilia' && childDob) return childDob

  if (guestMetaDob) return guestMetaDob

  const p1 = metadata.participant1 as { dateOfBirth?: string; name?: string } | undefined
  const p2 = metadata.participant2 as { dateOfBirth?: string; name?: string } | undefined

  if (guestName && p1?.name && guestName.includes(p1.name) && p1.dateOfBirth) return p1.dateOfBirth
  if (guestName && p2?.name && guestName.includes(p2.name) && p2.dateOfBirth) return p2.dateOfBirth
  if (p1?.dateOfBirth) return p1.dateOfBirth

  return childDob
}

function buildBreakdown(people: PersonRecord[], segment: 'trial' | 'member') {
  const gender: Record<GenderLabel, number> = {
    Female: 0,
    Male: 0,
    Other: 0,
    'Prefer not to say': 0,
    Unknown: 0,
  }
  const ageGroups: Record<AgeGroupKey, number> = {
    kids: 0,
    teens: 0,
    young_adult: 0,
    adult: 0,
    senior: 0,
    unknown: 0,
  }
  let withGender = 0
  let withAge = 0
  const ages: number[] = []

  for (const person of people) {
    if (person.gender !== 'Unknown') withGender++
    if (person.ageGroup !== 'unknown') {
      withAge++
      if (person.age !== null) ages.push(person.age)
    }
    gender[person.gender]++
    ageGroups[person.ageGroup]++
  }

  const sortedAges = [...ages].sort((a, b) => a - b)
  const avgAge = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null
  const medianAge =
    sortedAges.length > 0
      ? sortedAges.length % 2 === 0
        ? Math.round((sortedAges[sortedAges.length / 2 - 1] + sortedAges[sortedAges.length / 2]) / 2)
        : sortedAges[Math.floor(sortedAges.length / 2)]
      : null

  const kidsUnder13 = ages.filter(a => a < 13).length
  const minorsUnder18 = ages.filter(a => a < 18).length
  const adults18Plus = ages.filter(a => a >= 18).length

  return {
    segment,
    total: people.length,
    withGender,
    withAge,
    genderCoverage: people.length > 0 ? Math.round((withGender / people.length) * 100) : 0,
    ageCoverage: people.length > 0 ? Math.round((withAge / people.length) * 100) : 0,
    avgAge,
    medianAge,
    kidsUnder13,
    minorsUnder18,
    adults18Plus,
    kidsPct: withAge > 0 ? Math.round((kidsUnder13 / withAge) * 100) : 0,
    minorsPct: withAge > 0 ? Math.round((minorsUnder18 / withAge) * 100) : 0,
    gender: GENDER_LABELS.map(label => ({
      label,
      count: gender[label],
      percentage: people.length > 0 ? Number(((gender[label] / people.length) * 100).toFixed(1)) : 0,
    })).filter(g => g.count > 0 || g.label !== 'Unknown'),
    ageGroups: AGE_GROUPS.map(group => ({
      key: group.key,
      label: group.label,
      count: ageGroups[group.key],
      percentage: people.length > 0 ? Number(((ageGroups[group.key] / people.length) * 100).toFixed(1)) : 0,
    })).filter(g => g.count > 0 || g.key === 'unknown'),
  }
}

async function enrichMembersFromRegistrationForms(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  profiles: Array<{ id: string; gender: string | null; date_of_birth: string | null }>
) {
  const userIds = profiles.map(p => p.id)
  if (userIds.length === 0) return profiles

  const needsForm = profiles.filter(p => !p.gender || !p.date_of_birth)
  if (needsForm.length === 0) return profiles

  const formByUser: Record<string, { gender: string | null; date_of_birth: string | null }> = {}
  const formRows = await fetchInBatches(needsForm.map(p => p.id), async (batch) => {
    const { data } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .select('user_id, gender, date_of_birth, status, created_at')
      .in('user_id', batch)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
    return data || []
  })

  for (const form of formRows) {
    if (!form.user_id || formByUser[form.user_id]) continue
    formByUser[form.user_id] = {
      gender: form.gender as string | null,
      date_of_birth: form.date_of_birth as string | null,
    }
  }

  return profiles.map(profile => {
    const form = formByUser[profile.id]
    return {
      ...profile,
      gender: profile.gender || form?.gender || null,
      date_of_birth: profile.date_of_birth || form?.date_of_birth || null,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)

    const now = new Date()
    const { year: currentYear } = getSgtYmd(now)
    const year = parseInt(searchParams.get('year') || String(currentYear), 10)
    const monthRaw = searchParams.get('month')
    const selectedMonth =
      monthRaw && monthRaw !== 'all' ? parseInt(monthRaw, 10) : null

    let rangeStart: Date
    let rangeEnd: Date
    let periodLabel: string

    if (selectedMonth && selectedMonth >= 1 && selectedMonth <= 12) {
      const bounds = getMonthBoundsSgt(year, selectedMonth)
      rangeStart = bounds.rangeStart
      rangeEnd = bounds.rangeEnd
      periodLabel = `${bounds.monthName} ${year}`
    } else {
      const bounds = getYearBoundsSgt(year)
      rangeStart = bounds.rangeStart
      rangeEnd = bounds.rangeEnd
      periodLabel = `${year}`
    }

    const rangeStartIso = rangeStart.toISOString()
    const rangeEndIso = rangeEnd.toISOString()

    const yearBounds = getYearBoundsSgt(year)
    const yearStartIso = yearBounds.rangeStart.toISOString()
    const yearEndIso = yearBounds.rangeEnd.toISOString()

    const [trialBookingsResult, membersResult, yearTrialTrendRes, yearMembersTrendRes] = await Promise.all([
      supabase
        .from(TABLES.BOOKINGS)
        .select(`
          id,
          guest_name,
          guest_email,
          guest_date_of_birth,
          cancellation_reason,
          payment_id,
          payment:payments ( metadata )
        `)
        .eq('is_trial_booking', true)
        .gte('booked_at', rangeStartIso)
        .lt('booked_at', rangeEndIso)
        .in('status', [...TRIAL_STATUSES]),

      supabase
        .from(TABLES.USER_PROFILES)
        .select('id, gender, date_of_birth')
        .eq('role', 'user')
        .gte('created_at', rangeStartIso)
        .lt('created_at', rangeEndIso),

      // Full-year rows for trend chart (single query each, aggregate in memory)
      supabase
        .from(TABLES.BOOKINGS)
        .select('booked_at')
        .eq('is_trial_booking', true)
        .gte('booked_at', yearStartIso)
        .lt('booked_at', yearEndIso)
        .in('status', [...TRIAL_STATUSES]),

      supabase
        .from(TABLES.USER_PROFILES)
        .select('created_at')
        .eq('role', 'user')
        .gte('created_at', yearStartIso)
        .lt('created_at', yearEndIso),
    ])

    if (trialBookingsResult.error) throw trialBookingsResult.error
    if (membersResult.error) throw membersResult.error

    const trialBookings = trialBookingsResult.data || []

    const trialPeople: PersonRecord[] = trialBookings.map(booking => {
      const payment = booking.payment as { metadata?: Record<string, unknown> } | { metadata?: Record<string, unknown> }[] | null
      const paymentData = Array.isArray(payment) ? payment[0] : payment
      const metadata = paymentData?.metadata
      const dob = extractTrialDateOfBirth(
        booking.guest_date_of_birth as string | null,
        metadata,
        booking.guest_name as string | null
      )
      const age = calculateAge(dob)

      return {
        key: booking.id as string,
        gender: extractTrialGender(booking.cancellation_reason as string | null, metadata),
        age,
        ageGroup: getAgeGroup(age),
      }
    })

    const enrichedMembers = await enrichMembersFromRegistrationForms(
      supabase,
      (membersResult.data || []) as Array<{ id: string; gender: string | null; date_of_birth: string | null }>
    )

    const memberPeople: PersonRecord[] = enrichedMembers.map(profile => {
      const age = calculateAge(profile.date_of_birth)
      return {
        key: profile.id,
        gender: normalizeGender(profile.gender),
        age,
        ageGroup: getAgeGroup(age),
      }
    })

    const trialBreakdown = buildBreakdown(trialPeople, 'trial')
    const memberBreakdown = buildBreakdown(memberPeople, 'member')

    const trialAgeMap = Object.fromEntries(
      trialBreakdown.ageGroups.map(g => [g.key, g])
    ) as Record<string, { count: number; percentage: number; label: string; key?: string }>
    const memberAgeMap = Object.fromEntries(
      memberBreakdown.ageGroups.map(g => [g.key, g])
    ) as Record<string, { count: number; percentage: number; label: string; key?: string }>

    const combinedAgeGroups = AGE_GROUPS.filter(g => g.key !== 'unknown').map(group => {
      const trial = trialAgeMap[group.key]?.count || 0
      const members = memberAgeMap[group.key]?.count || 0
      return {
        key: group.key,
        label: group.label,
        shortLabel: group.label.replace(/ \(.*\)/, ''),
        trial,
        members,
        total: trial + members,
        trialPct: trialBreakdown.withAge > 0
          ? Number(((trial / trialBreakdown.withAge) * 100).toFixed(1))
          : 0,
        membersPct: memberBreakdown.withAge > 0
          ? Number(((members / memberBreakdown.withAge) * 100).toFixed(1))
          : 0,
      }
    })

    const trialByMonth = initMonthBuckets(() => 0)
    const membersByMonth = initMonthBuckets(() => 0)
    for (const row of yearTrialTrendRes.data || []) {
      const idx = getSgtMonthNumber(row.booked_at as string) - 1
      if (idx >= 0 && idx < 12) trialByMonth[idx]++
    }
    for (const row of yearMembersTrendRes.data || []) {
      const idx = getSgtMonthNumber(row.created_at as string) - 1
      if (idx >= 0 && idx < 12) membersByMonth[idx]++
    }

    const monthlyTrend = []
    for (let monthNumber = 1; monthNumber <= 12; monthNumber++) {
      const { monthName } = getMonthBoundsSgt(year, monthNumber)
      monthlyTrend.push({
        month: monthName.slice(0, 3),
        monthNumber,
        year,
        trialBookings: trialByMonth[monthNumber - 1],
        newMembers: membersByMonth[monthNumber - 1],
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        periodLabel,
        year,
        month: selectedMonth,
        summary: {
          trialUsers: trialBreakdown.total,
          members: memberBreakdown.total,
          trialAgeCoverage: trialBreakdown.ageCoverage,
          memberAgeCoverage: memberBreakdown.ageCoverage,
          trialAvgAge: trialBreakdown.avgAge,
          memberAvgAge: memberBreakdown.avgAge,
          trialMedianAge: trialBreakdown.medianAge,
          memberMedianAge: memberBreakdown.medianAge,
          trialKidsPct: trialBreakdown.kidsPct,
          memberKidsPct: memberBreakdown.kidsPct,
        },
        trial: trialBreakdown,
        members: memberBreakdown,
        combinedAgeGroups,
        monthlyTrend,
        dataNotes: [
          'Trial users = each guest trial booking in period (one row per person who booked a trial).',
          'Members = all registered member accounts created in period.',
          'Age is calculated from date of birth on the trial booking form or member profile.',
          'Kids = under 13 · Teens = 13–17 · Young adults = 18–34 · Adults = 35–49 · 50+ = 50 and above.',
        ],
      },
    })
  } catch (error) {
    console.error('[Marketing Reports API] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch marketing report' } },
      { status: 500 }
    )
  }
}
