/**
 * Revenue Reports API
 * GET /api/reports/revenue - Get detailed revenue analytics
 *
 * Revenue = succeeded payments by payment date (SGT).
 * Package vs class fees split by package_id on the payment row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import {
  getMonthBoundsSgt,
  getSgtMonthNumber,
  getSgtYmd,
  getYearBoundsSgt,
  initMonthBuckets,
} from '@/lib/reports-utils'

type PaymentRow = {
  id?: string
  amount_cents?: number | null
  package_id?: string | null
  user_id?: string | null
  is_trial_booking?: boolean | null
  payment_method?: string | null
  created_at?: string
  metadata?: Record<string, string> | null
  packages?: { id?: string; name?: string; token_count?: number } | { id?: string; name?: string; token_count?: number }[] | null
}

function getPackageFromPayment(payment: PaymentRow) {
  const packagesData = payment.packages
  return Array.isArray(packagesData) ? packagesData[0] : packagesData
}

function splitPaymentAmount(payment: PaymentRow) {
  const amount = (payment.amount_cents || 0) / 100
  if (payment.package_id) {
    return { packages: amount, classes: 0, total: amount }
  }
  return { packages: 0, classes: amount, total: amount }
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

    const periodLength = rangeEnd.getTime() - rangeStart.getTime()
    const prevRangeStart = new Date(rangeStart.getTime() - periodLength)
    const prevRangeEnd = rangeStart

    const [monthlyRevenue, packageSales, topCustomers, recentTransactions, prevPeriodRevenue] =
      await Promise.all([
        getMonthlyRevenue(supabase, year),
        getPackageSales(supabase, rangeStartIso, rangeEndIso),
        getTopCustomers(supabase, rangeStartIso, rangeEndIso),
        getRecentTransactions(supabase, rangeStartIso, rangeEndIso),
        getPeriodRevenueTotal(supabase, prevRangeStart.toISOString(), prevRangeEnd.toISOString()),
      ])

    const periodMonths = selectedMonth
      ? monthlyRevenue.filter(m => m.monthNumber === selectedMonth)
      : monthlyRevenue

    const totalRevenue = periodMonths.reduce((sum, m) => sum + m.total, 0)
    const totalTransactions = periodMonths.reduce((sum, m) => sum + m.transactions, 0)
    const monthsWithRevenue = periodMonths.filter(m => m.transactions > 0).length
    const avgMonthlyRevenue =
      monthsWithRevenue > 0 ? Math.round(totalRevenue / monthsWithRevenue) : 0

    const selectedMonthRow = selectedMonth
      ? monthlyRevenue.find(m => m.monthNumber === selectedMonth)
      : monthlyRevenue[monthlyRevenue.length - 1]
    const prevMonthRow = selectedMonth
      ? monthlyRevenue.find(m => m.monthNumber === selectedMonth - 1)
      : monthlyRevenue[monthlyRevenue.length - 2]

    let growth = 0
    if (prevPeriodRevenue > 0) {
      growth = ((totalRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100
      growth = Math.min(growth, 1000)
    } else if (totalRevenue > 0) {
      growth = 100
    }

    return NextResponse.json({
      success: true,
      data: {
        periodLabel,
        year,
        month: selectedMonth,
        summary: {
          totalRevenue,
          totalTransactions,
          avgMonthlyRevenue,
          growth: Number(growth.toFixed(1)),
          thisMonth: selectedMonthRow?.total || 0,
          lastMonth: prevMonthRow?.total || 0,
          prevPeriodRevenue: Math.round(prevPeriodRevenue),
          avgOrderValue: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0,
          packageRevenue: periodMonths.reduce((sum, m) => sum + m.packages, 0),
          classRevenue: periodMonths.reduce((sum, m) => sum + m.classes, 0),
        },
        monthlyRevenue,
        packageSales,
        topCustomers,
        recentTransactions,
      },
    })
  } catch (error) {
    console.error('[Revenue Reports API] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch revenue reports' } },
      { status: 500 }
    )
  }
}

async function getPeriodRevenueTotal(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStartIso: string,
  rangeEndIso: string
) {
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select('amount_cents')
    .gte('created_at', rangeStartIso)
    .lt('created_at', rangeEndIso)
    .eq('status', 'succeeded')

  return (payments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
}

async function getMonthlyRevenue(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  year: number
) {
  const { rangeStart, rangeEnd } = getYearBoundsSgt(year)
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select('amount_cents, package_id, created_at')
    .gte('created_at', rangeStart.toISOString())
    .lt('created_at', rangeEnd.toISOString())
    .eq('status', 'succeeded')

  const monthPackages = initMonthBuckets(() => 0)
  const monthClasses = initMonthBuckets(() => 0)
  const monthTransactions = initMonthBuckets(() => 0)

  for (const payment of (payments || []) as PaymentRow[]) {
    const idx = getSgtMonthNumber(payment.created_at as string) - 1
    if (idx < 0 || idx >= 12) continue
    const split = splitPaymentAmount(payment)
    monthPackages[idx] += split.packages
    monthClasses[idx] += split.classes
    monthTransactions[idx]++
  }

  const months = []
  for (let monthNumber = 1; monthNumber <= 12; monthNumber++) {
    const { monthName } = getMonthBoundsSgt(year, monthNumber)
    const idx = monthNumber - 1
    const total = monthPackages[idx] + monthClasses[idx]
    const transactions = monthTransactions[idx]
    months.push({
      month: `${monthName.slice(0, 3)} ${year}`,
      monthNumber,
      year,
      packages: Math.round(monthPackages[idx]),
      classes: Math.round(monthClasses[idx]),
      total: Math.round(total),
      transactions,
      avgOrder: transactions > 0 ? Math.round(total / transactions) : 0,
    })
  }

  return months
}

async function getPackageSales(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStartIso: string,
  rangeEndIso: string
) {
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select(`
      id,
      amount_cents,
      package_id,
      packages (
        id,
        name,
        token_count
      )
    `)
    .gte('created_at', rangeStartIso)
    .lt('created_at', rangeEndIso)
    .eq('status', 'succeeded')
    .not('package_id', 'is', null)

  const packageStats: Record<string, { name: string; sales: number; revenue: number }> = {}

  for (const payment of (payments || []) as PaymentRow[]) {
    const pkg = getPackageFromPayment(payment)
    if (pkg?.id) {
      if (!packageStats[pkg.id]) {
        packageStats[pkg.id] = { name: pkg.name || 'Package', sales: 0, revenue: 0 }
      }
      packageStats[pkg.id].sales++
      packageStats[pkg.id].revenue += (payment.amount_cents || 0) / 100
    }
  }

  const totalRevenue = Object.values(packageStats).reduce((sum, p) => sum + p.revenue, 0)

  return Object.values(packageStats)
    .map(pkg => ({
      name: pkg.name,
      sales: pkg.sales,
      revenue: Math.round(pkg.revenue),
      percentage: totalRevenue > 0 ? Number((pkg.revenue / totalRevenue * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

async function getTopCustomers(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStartIso: string,
  rangeEndIso: string
) {
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select('user_id, amount_cents, package_id, is_trial_booking, metadata, packages(token_count)')
    .gte('created_at', rangeStartIso)
    .lt('created_at', rangeEndIso)
    .eq('status', 'succeeded')

  const userStats: Record<string, {
    spent: number
    purchases: number
    tokens: number
    guestName?: string
    guestEmail?: string
  }> = {}

  for (const payment of (payments || []) as PaymentRow[]) {
    const userId = payment.user_id
    const isTrial = payment.is_trial_booking
    const meta = payment.metadata || {}
    const pkg = getPackageFromPayment(payment)
    const tokenCount = payment.package_id ? (pkg?.token_count || 0) : 0

    if (userId) {
      if (!userStats[userId]) {
        userStats[userId] = { spent: 0, purchases: 0, tokens: 0 }
      }
      userStats[userId].spent += (payment.amount_cents || 0) / 100
      userStats[userId].purchases++
      userStats[userId].tokens += tokenCount
    } else {
      const guestKey = meta.guest_email
        ? `guest:${meta.guest_email}`
        : `guest:${meta.parent_name || meta.guest_name || meta.child_name || payment.id}`
      if (!userStats[guestKey]) {
        userStats[guestKey] = {
          spent: 0,
          purchases: 0,
          tokens: 0,
          guestName: meta.parent_name || meta.guest_name || meta.child_name,
          guestEmail: meta.guest_email,
        }
      }
      userStats[guestKey].spent += (payment.amount_cents || 0) / 100
      userStats[guestKey].purchases++
      if (isTrial) userStats[guestKey].tokens += 0
    }
  }

  const topKeys = Object.entries(userStats)
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 5)
    .map(([id]) => id)

  if (topKeys.length === 0) return []

  const realUserIds = topKeys.filter(k => !k.startsWith('guest:'))
  const { data: profiles } = realUserIds.length > 0
    ? await supabase
        .from(TABLES.USER_PROFILES)
        .select('id, name, email')
        .in('id', realUserIds)
        .eq('role', 'user')
    : { data: [] }

  const profileMap: Record<string, { name: string; email: string }> = {}
  for (const p of profiles || []) {
    profileMap[p.id] = { name: p.name, email: p.email }
  }

  return topKeys
    .filter(key => profileMap[key] || key.startsWith('guest:'))
    .map(key => {
      const stats = userStats[key]
      if (key.startsWith('guest:')) {
        return {
          name: stats.guestName || 'Guest',
          email: stats.guestEmail || key.replace('guest:', ''),
          spent: Math.round(stats.spent),
          purchases: stats.purchases,
          tokens: stats.tokens,
        }
      }
      return {
        name: profileMap[key]?.name || 'Unknown',
        email: profileMap[key]?.email || 'unknown@email.com',
        spent: Math.round(stats.spent),
        purchases: stats.purchases,
        tokens: stats.tokens,
      }
    })
}

async function getRecentTransactions(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStartIso: string,
  rangeEndIso: string
) {
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select(`
      id,
      user_id,
      amount_cents,
      payment_method,
      created_at,
      is_trial_booking,
      metadata,
      packages (
        name
      )
    `)
    .eq('status', 'succeeded')
    .gte('created_at', rangeStartIso)
    .lt('created_at', rangeEndIso)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!payments || payments.length === 0) return []

  const userIds = payments.map(p => p.user_id).filter(Boolean)
  const { data: profiles } = userIds.length > 0
    ? await supabase.from(TABLES.USER_PROFILES).select('id, name').in('id', userIds)
    : { data: [] }

  const profileMap: Record<string, string> = {}
  for (const p of profiles || []) {
    profileMap[p.id] = p.name
  }

  return payments.map((payment, index) => {
    const pkg = getPackageFromPayment(payment as PaymentRow)
    const meta = (payment.metadata as Record<string, string> | null) || {}
    let userName = profileMap[payment.user_id] || 'Unknown'
    if (!payment.user_id || userName === 'Unknown') {
      userName = meta.parent_name || meta.guest_name || meta.child_name || userName
    }
    const isTrial = payment.is_trial_booking
    const isZumFamilia = meta.flow_type === 'zumfamilia'

    let paymentLabel = pkg?.name || 'Package'
    if (isTrial) {
      if (isZumFamilia) {
        const scheduleLabel = meta.custom_schedule || meta.class_title || 'Custom Schedule'
        const packageLabel = meta.package_label || 'ZumFamilia'
        paymentLabel = `${packageLabel} (${scheduleLabel})`
      } else {
        paymentLabel = meta.class_title || 'Trial Class'
      }
    }

    return {
      id: payment.id || `TXN-${900 - index}`,
      user: userName,
      package: paymentLabel,
      amount: Math.round((payment.amount_cents || 0) / 100),
      date: payment.created_at,
      method: formatPaymentMethod(payment.payment_method),
    }
  })
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return 'Card'
  const methodMap: Record<string, string> = {
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    paypal: 'PayPal',
    bank_transfer: 'Bank Transfer',
    card: 'Card',
  }
  return methodMap[method.toLowerCase()] || method
}
