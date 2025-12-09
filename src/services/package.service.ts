// Package Service
// Handles CRUD operations for class packages (admin)

import { getSupabaseAdminClient, TABLES, isSupabaseError, SUPABASE_ERRORS } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import type {
  Package,
  CreatePackageRequest,
  UpdatePackageRequest,
  PackageResponse,
  PackageListResponse,
  PackageListQuery,
} from '@/api/schemas'

// Extended package with sales statistics
export interface PackageWithStats extends Package {
  salesCount: number;
  revenue: number;
}

export interface PackageListWithStatsResponse {
  packages: PackageWithStats[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Create a new package (admin only)
export async function createPackage(data: CreatePackageRequest): Promise<PackageResponse> {
  const supabase = getSupabaseAdminClient();
  const { data: pkg, error } = await supabase
    .from(TABLES.PACKAGES)
    .insert({
      name: data.name,
      description: data.description || null,
      token_count: data.tokenCount,
      price_cents: data.priceCents,
      currency: data.currency || 'USD',
      validity_days: data.validityDays,
      class_types: data.classTypes || ['all'],
      is_active: data.isActive !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    if (isSupabaseError(error, SUPABASE_ERRORS.UNIQUE_VIOLATION)) {
      throw new ApiError('CONFLICT_ERROR', 'A package with this name already exists', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to create package', 500, error)
  }

  return {
    package: mapPackageToSchema(pkg),
  }
}

// Get a single package by ID
export async function getPackage(packageId: string): Promise<PackageResponse> {
  const supabase = getSupabaseAdminClient();
  const { data: pkg, error } = await supabase
    .from(TABLES.PACKAGES)
    .select('*')
    .eq('id', packageId)
    .single()

  if (error || !pkg) {
    throw new ApiError('NOT_FOUND_ERROR', 'Package not found', 404)
  }

  return {
    package: mapPackageToSchema(pkg),
  }
}

// List packages with filtering and pagination
export async function listPackages(query: PackageListQuery): Promise<PackageListResponse> {
  const supabase = getSupabaseAdminClient();
  const { page = 1, pageSize = 20, isActive, classType } = query

  let dbQuery = supabase
    .from(TABLES.PACKAGES)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (isActive !== undefined) {
    dbQuery = dbQuery.eq('is_active', isActive)
  }

  if (classType) {
    dbQuery = dbQuery.contains('class_types', [classType])
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  dbQuery = dbQuery.range(from, to)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch packages', 500, error)
  }

  return {
    packages: (data || []).map(mapPackageToSchema),
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > page * pageSize,
  }
}

// List packages with sales statistics
export async function listPackagesWithStats(query: PackageListQuery): Promise<PackageListWithStatsResponse> {
  const supabase = getSupabaseAdminClient();
  const { page = 1, pageSize = 20, isActive, classType } = query

  let dbQuery = supabase
    .from(TABLES.PACKAGES)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (isActive !== undefined) {
    dbQuery = dbQuery.eq('is_active', isActive)
  }

  if (classType) {
    dbQuery = dbQuery.contains('class_types', [classType])
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  dbQuery = dbQuery.range(from, to)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch packages', 500, error)
  }

  const packages = data || [];
  
  // Get sales stats
  const { data: salesData } = await supabase
    .from(TABLES.USER_PACKAGES)
    .select('package_id');
  
  const salesCounts: Record<string, number> = {};
  (salesData || []).forEach((sale: { package_id: string | null }) => {
    if (sale.package_id) {
      salesCounts[sale.package_id] = (salesCounts[sale.package_id] || 0) + 1;
    }
  });

  // Get revenue stats from payments
  const { data: paymentsData } = await supabase
    .from(TABLES.PAYMENTS)
    .select('package_id, amount_cents, status')
    .eq('status', 'succeeded');
  
  const revenueByPackage: Record<string, number> = {};
  (paymentsData || []).forEach((payment: { package_id: string | null; amount_cents: number }) => {
    if (payment.package_id) {
      revenueByPackage[payment.package_id] = 
        (revenueByPackage[payment.package_id] || 0) + (payment.amount_cents / 100);
    }
  });

  const packagesWithStats: PackageWithStats[] = packages.map(pkg => ({
    ...mapPackageToSchema(pkg),
    salesCount: salesCounts[pkg.id] || 0,
    revenue: revenueByPackage[pkg.id] || 0,
  }));

  return {
    packages: packagesWithStats,
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > page * pageSize,
  }
}

// Update a package (admin only)
export async function updatePackage(
  packageId: string,
  data: UpdatePackageRequest
): Promise<PackageResponse> {
  const supabase = getSupabaseAdminClient();
  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.tokenCount !== undefined) updateData.token_count = data.tokenCount
  if (data.priceCents !== undefined) updateData.price_cents = data.priceCents
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.validityDays !== undefined) updateData.validity_days = data.validityDays
  if (data.classTypes !== undefined) updateData.class_types = data.classTypes
  if (data.isActive !== undefined) updateData.is_active = data.isActive

  const { data: pkg, error } = await supabase
    .from(TABLES.PACKAGES)
    .update(updateData)
    .eq('id', packageId)
    .select()
    .single()

  if (error) {
    if (isSupabaseError(error, SUPABASE_ERRORS.UNIQUE_VIOLATION)) {
      throw new ApiError('CONFLICT_ERROR', 'A package with this name already exists', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to update package', 500, error)
  }

  if (!pkg) {
    throw new ApiError('NOT_FOUND_ERROR', 'Package not found', 404)
  }

  return {
    package: mapPackageToSchema(pkg),
  }
}

// Deactivate a package (soft delete - admin only)
export async function deactivatePackage(packageId: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from(TABLES.PACKAGES)
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', packageId)

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to deactivate package', 500, error)
  }

  return {
    success: true,
    message: 'Package deactivated successfully',
  }
}

// Get active packages for purchase (public)
export async function getActivePackages(): Promise<PackageListResponse> {
  const supabase = getSupabaseAdminClient();
  const { data, error, count } = await supabase
    .from(TABLES.PACKAGES)
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('price_cents', { ascending: true })

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch packages', 500, error)
  }

  return {
    packages: (data || []).map(mapPackageToSchema),
    total: count || 0,
    page: 1,
    pageSize: 100,
    hasMore: false,
  }
}

// Helper: Map database row to schema
function mapPackageToSchema(row: Record<string, unknown>): Package {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    tokenCount: row.token_count as number,
    priceCents: row.price_cents as number,
    currency: row.currency as string,
    validityDays: row.validity_days as number,
    classTypes: row.class_types as ('zumba' | 'yoga' | 'pilates' | 'hiit' | 'spinning' | 'boxing' | 'dance' | 'strength' | 'cardio' | 'all')[],
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
