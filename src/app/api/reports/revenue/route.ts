/**
 * Revenue Reports API
 * GET /api/reports/revenue - Get detailed revenue analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    
    const range = searchParams.get('range') || 'month' // week, month, quarter, year
    
    // Calculate date ranges
    const now = new Date()
    
    // Get range for comparison
    let rangeStart: Date
    let monthsToShow = 7
    switch (range) {
      case 'week':
        rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        monthsToShow = 1
        break
      case 'quarter':
        rangeStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        monthsToShow = 3
        break
      case 'year':
        rangeStart = new Date(now.getFullYear(), 0, 1)
        monthsToShow = 12
        break
      default: // month
        rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        monthsToShow = 7
    }

    // Get monthly revenue data (pass range to filter properly)
    const monthlyRevenue = await getMonthlyRevenue(supabase, range, rangeStart, now)
    
    // Get package sales breakdown
    const packageSales = await getPackageSales(supabase, rangeStart)
    
    // Get top customers
    const topCustomers = await getTopCustomers(supabase, rangeStart)
    
    // Get recent transactions
    const recentTransactions = await getRecentTransactions(supabase)

    // Calculate totals (only for periods in the selected range)
    const totalRevenue = monthlyRevenue.reduce((sum, m) => sum + m.total, 0)
    const totalTransactions = monthlyRevenue.reduce((sum, m) => sum + m.transactions, 0)
    // For week range, calculate average per day; for others, average per month
    const avgMonthlyRevenue = monthlyRevenue.length > 0 ? Math.round(totalRevenue / monthlyRevenue.length) : 0
    
    // Calculate growth (handle edge cases properly)
    const lastMonth = monthlyRevenue[monthlyRevenue.length - 1]
    const prevMonth = monthlyRevenue[monthlyRevenue.length - 2]
    let growth = 0
    if (prevMonth && prevMonth.total > 0 && lastMonth) {
      growth = ((lastMonth.total - prevMonth.total) / prevMonth.total) * 100
      // Cap at reasonable values
      growth = Math.min(growth, 1000)
    } else if (lastMonth && lastMonth.total > 0 && (!prevMonth || prevMonth.total === 0)) {
      // If previous was 0 but current has revenue, show 100% growth
      growth = 100
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalTransactions,
          avgMonthlyRevenue,
          growth: Number(growth),
          thisMonth: lastMonth?.total || 0,
          lastMonth: prevMonth?.total || 0,
          avgOrderValue: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0,
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

async function getMonthlyRevenue(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  range: string,
  rangeStart: Date,
  now: Date
) {
  const months = []
  
  // Determine which months to show based on range
  let monthsToShow: Array<{ month: number; year: number }> = []
  
  if (range === 'week') {
    // For week, show daily breakdown for the last 7 days
    // We'll return daily data instead of monthly
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
      
      // Only include if within range
      if (dayStart >= rangeStart) {
        // Get payments for this day
        const { data: payments } = await supabase
          .from(TABLES.PAYMENTS)
          .select('id, amount_cents, package_id')
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString())
          .eq('status', 'succeeded')
        
        const total = (payments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
        const transactions = (payments || []).length
        
        let packagesRevenue = 0
        let classesRevenue = 0
        
        for (const payment of payments || []) {
          const amount = (payment.amount_cents || 0) / 100
          if (payment.package_id) {
            packagesRevenue += amount
          } else {
            classesRevenue += amount
          }
        }
        
        const dayName = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        days.push({
          month: dayName,
          packages: Math.round(packagesRevenue),
          classes: Math.round(classesRevenue),
          total: Math.round(total),
          transactions,
          avgOrder: transactions > 0 ? Math.round(total / transactions) : 0,
        })
      }
    }
    return days
  } else if (range === 'quarter') {
    // For quarter, show the 3 months in the quarter
    const quarterStart = Math.floor(now.getMonth() / 3) * 3
    for (let i = 0; i < 3; i++) {
      monthsToShow.push({ month: quarterStart + i, year: now.getFullYear() })
    }
  } else if (range === 'year') {
    // For year, show all 12 months
    for (let i = 0; i < 12; i++) {
      monthsToShow.push({ month: i, year: now.getFullYear() })
    }
  } else {
    // For month, show last 7 months for context
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthsToShow.push({ month: date.getMonth(), year: date.getFullYear() })
    }
  }
  
  for (const { month, year } of monthsToShow) {
    const date = new Date(year, month, 1)
    const nextMonth = new Date(year, month + 1, 1)
    const monthEnd = nextMonth > now ? now : nextMonth
    
    // Only include data if it's within the selected range
    if (date < rangeStart && nextMonth <= rangeStart) {
      // Skip months completely before the range
      continue
    }
    
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    
    // Calculate the actual date range for this month within the selected range
    const monthStartDate = date >= rangeStart ? date : rangeStart
    const monthEndDate = monthEnd
    
    // Get payments for this month (within range)
    const { data: payments } = await supabase
      .from(TABLES.PAYMENTS)
      .select('id, amount_cents, package_id')
      .gte('created_at', monthStartDate.toISOString())
      .lt('created_at', monthEndDate.toISOString())
      .eq('status', 'succeeded')
    
    const total = (payments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const transactions = (payments || []).length
    
    // Get actual package vs class revenue from payment data
    // For now, estimate based on package_id presence
    // If package_id exists, it's package revenue, otherwise class fee
    let packagesRevenue = 0
    let classesRevenue = 0
    
    for (const payment of payments || []) {
      const amount = (payment.amount_cents || 0) / 100
      if (payment.package_id) {
        packagesRevenue += amount
      } else {
        classesRevenue += amount
      }
    }
    
    // If no package_id data, use estimation
    if (packagesRevenue === 0 && classesRevenue === 0 && total > 0) {
      packagesRevenue = Math.round(total * 0.9)
      classesRevenue = Math.round(total * 0.1)
    }
    
    months.push({
      month: monthName,
      packages: Math.round(packagesRevenue),
      classes: Math.round(classesRevenue),
      total: Math.round(total),
      transactions,
      avgOrder: transactions > 0 ? Math.round(total / transactions) : 0,
    })
  }
  
  return months
}

async function getPackageSales(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStart: Date
) {
  // Get all payments with package info
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
    .gte('created_at', rangeStart.toISOString())
    .eq('status', 'succeeded')
  
  // Group by package
  const packageStats: Record<string, { name: string; sales: number; revenue: number }> = {}
  
  for (const payment of payments || []) {
    const packagesData = payment.packages as { id: string; name: string; token_count: number }[] | { id: string; name: string; token_count: number } | null
    const pkg = Array.isArray(packagesData) ? packagesData[0] : packagesData
    if (pkg) {
      if (!packageStats[pkg.id]) {
        packageStats[pkg.id] = { name: pkg.name, sales: 0, revenue: 0 }
      }
      packageStats[pkg.id].sales++
      packageStats[pkg.id].revenue += (payment.amount_cents || 0) / 100
    }
  }
  
  const totalRevenue = Object.values(packageStats).reduce((sum, p) => sum + p.revenue, 0)
  
  // Convert to array with percentages
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
  rangeStart: Date
) {
  // Get payments grouped by user
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select('user_id, amount_cents, package_id')
    .gte('created_at', rangeStart.toISOString())
    .eq('status', 'succeeded')
  
  // Group by user
  const userStats: Record<string, { spent: number; purchases: number; tokens: number }> = {}
  
  for (const payment of payments || []) {
    const userId = payment.user_id
    if (userId) {
      if (!userStats[userId]) {
        userStats[userId] = { spent: 0, purchases: 0, tokens: 0 }
      }
      userStats[userId].spent += (payment.amount_cents || 0) / 100
      userStats[userId].purchases++
      userStats[userId].tokens += 10 // Estimate
    }
  }
  
  // Get top user IDs
  const topUserIds = Object.entries(userStats)
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 5)
    .map(([id]) => id)
  
  if (topUserIds.length === 0) {
    return []
  }
  
  // Fetch user profiles (only customers, filter out staff)
  const { data: profiles } = await supabase
    .from(TABLES.USER_PROFILES)
    .select('id, name, email')
    .in('id', topUserIds)
    .eq('role', 'user')
  
  const profileMap: Record<string, { name: string; email: string }> = {}
  for (const p of profiles || []) {
    profileMap[p.id] = { name: p.name, email: p.email }
  }
  
  // Only return users that are customers
  return topUserIds
    .filter(userId => profileMap[userId])
    .map(userId => ({
    name: profileMap[userId]?.name || 'Unknown',
    email: profileMap[userId]?.email || 'unknown@email.com',
    spent: Math.round(userStats[userId].spent),
    purchases: userStats[userId].purchases,
    tokens: userStats[userId].tokens,
  }))
}

async function getRecentTransactions(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select(`
      id,
      user_id,
      amount_cents,
      payment_method,
      created_at,
      packages (
        name
      )
    `)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (!payments || payments.length === 0) {
    return []
  }
  
  // Get user profiles
  const userIds = payments.map(p => p.user_id).filter(Boolean)
  const { data: profiles } = userIds.length > 0
    ? await supabase.from(TABLES.USER_PROFILES).select('id, name').in('id', userIds)
    : { data: [] }
  
  const profileMap: Record<string, string> = {}
  for (const p of profiles || []) {
    profileMap[p.id] = p.name
  }
  
  return payments.map((payment, index) => {
    const packagesData = payment.packages as { name: string }[] | { name: string } | null
    const pkg = Array.isArray(packagesData) ? packagesData[0] : packagesData
    return {
      id: `TXN-${900 - index}`,
      user: profileMap[payment.user_id] || 'Unknown',
      package: pkg?.name || 'Package',
      amount: Math.round((payment.amount_cents || 0) / 100),
      date: payment.created_at,
      method: formatPaymentMethod(payment.payment_method),
    }
  })
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return 'Card'
  const methodMap: Record<string, string> = {
    'credit_card': 'Credit Card',
    'debit_card': 'Debit Card',
    'paypal': 'PayPal',
    'bank_transfer': 'Bank Transfer',
    'card': 'Card',
  }
  return methodMap[method.toLowerCase()] || method
}
