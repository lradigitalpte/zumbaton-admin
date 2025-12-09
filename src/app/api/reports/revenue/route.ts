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

    // Get monthly revenue data
    const monthlyRevenue = await getMonthlyRevenue(supabase, monthsToShow)
    
    // Get package sales breakdown
    const packageSales = await getPackageSales(supabase, rangeStart)
    
    // Get top customers
    const topCustomers = await getTopCustomers(supabase, rangeStart)
    
    // Get recent transactions
    const recentTransactions = await getRecentTransactions(supabase)

    // Calculate totals
    const totalRevenue = monthlyRevenue.reduce((sum, m) => sum + m.total, 0)
    const totalTransactions = monthlyRevenue.reduce((sum, m) => sum + m.transactions, 0)
    const avgMonthlyRevenue = monthsToShow > 0 ? Math.round(totalRevenue / monthsToShow) : 0
    
    // Calculate growth
    const lastMonth = monthlyRevenue[monthlyRevenue.length - 1]
    const prevMonth = monthlyRevenue[monthlyRevenue.length - 2]
    const growth = prevMonth && prevMonth.total > 0
      ? ((lastMonth.total - prevMonth.total) / prevMonth.total * 100).toFixed(1)
      : '0'

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
  monthsToShow: number
) {
  const months = []
  const now = new Date()
  
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    
    // Get payments for this month
    const { data: payments } = await supabase
      .from(TABLES.PAYMENTS)
      .select('id, amount_cents, package_id')
      .gte('created_at', date.toISOString())
      .lt('created_at', nextMonth.toISOString())
      .eq('status', 'succeeded')
    
    const total = (payments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const transactions = (payments || []).length
    
    // Estimate package vs class revenue (could be more sophisticated)
    const packagesRevenue = Math.round(total * 0.9) // 90% from packages
    const classesRevenue = Math.round(total * 0.1) // 10% from drop-in classes
    
    months.push({
      month: monthName,
      packages: packagesRevenue,
      classes: classesRevenue,
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
