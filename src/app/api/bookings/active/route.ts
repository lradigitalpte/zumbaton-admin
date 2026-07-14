import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 10))
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const admin = getSupabaseAdminClient()

    let query = admin
      .from(TABLES.BOOKINGS)
      .select('id, user_id, class_id, status, booked_at, tokens_used, guest_name, guest_email')
      .order('booked_at', { ascending: false })

    if (startDate) query = query.gte('booked_at', startDate)
    if (endDate) query = query.lte('booked_at', endDate)

    const { data: bookings, error } = await query

    if (error) throw error

    const userIds = [...new Set((bookings || []).map(b => b.user_id).filter(Boolean))] as string[]
    const classIds = [...new Set((bookings || []).map(b => b.class_id).filter(Boolean))] as string[]
    const [{ data: profiles }, { data: classes }] = await Promise.all([
      userIds.length
        ? admin.from(TABLES.USER_PROFILES).select('id, name, email, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] }),
      classIds.length
        ? admin.from(TABLES.CLASSES).select('id, title, scheduled_at, location').in('id', classIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))
    const classMap = new Map((classes || []).map(c => [c.id, c]))
    let rows = (bookings || []).map(booking => {
      const profile = booking.user_id ? profileMap.get(booking.user_id) : null
      const classInfo = classMap.get(booking.class_id)
      return {
        id: booking.id,
        userId: booking.user_id,
        userName: profile?.name || booking.guest_name || 'Unknown User',
        userEmail: profile?.email || booking.guest_email || '',
        userAvatar: profile?.avatar_url || null,
        classTitle: classInfo?.title || 'Unknown Class',
        classStartsAt: classInfo?.scheduled_at || null,
        location: classInfo?.location || null,
        status: booking.status,
        tokensUsed: booking.tokens_used,
        bookedAt: booking.booked_at,
      }
    })

    if (search) {
      rows = rows.filter(row =>
        row.userName.toLowerCase().includes(search) ||
        row.userEmail.toLowerCase().includes(search) ||
        row.classTitle.toLowerCase().includes(search)
      )
    }

    const total = rows.length
    const start = (page - 1) * pageSize
    return NextResponse.json({
      success: true,
      data: { bookings: rows.slice(start, start + pageSize), total, page, pageSize },
    })
  } catch (error) {
    console.error('[API /bookings/active]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to load active bookings' } }, { status: 500 })
  }
}
