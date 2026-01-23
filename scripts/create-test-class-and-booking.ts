/**
 * Script to create a test class available now and book it for a user
 * Run with: npx tsx scripts/create-test-class-and-booking.ts <userId>
 */

import { getSupabaseAdminClient, TABLES } from '../src/lib/supabase'

const userId = process.argv[2] || 'b3e50c65-d845-40d1-8e0d-d00c5ad2b928'

async function createTestClassAndBooking() {
  const adminClient = getSupabaseAdminClient()

  console.log('Creating test class and booking for user:', userId)

  // 1. Check if user exists
  const { data: userProfile, error: userError } = await adminClient
    .from('user_profiles')
    .select('id, name, email')
    .eq('id', userId)
    .single()

  if (userError || !userProfile) {
    console.error('User not found:', userError)
    process.exit(1)
  }

  console.log('User found:', userProfile.name, userProfile.email)

  // 2. Check if user has an active package with tokens
  const { data: userPackages } = await adminClient
    .from(TABLES.USER_PACKAGES)
    .select('id, tokens_remaining, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('tokens_remaining', 0)
    .order('created_at', { ascending: false })
    .limit(1)

  let userPackageId: string | null = null
  if (!userPackages || userPackages.length === 0) {
    console.log('No active package found. Creating one...')
    
    // Create a test package with 10 tokens
    const { data: newPackage, error: pkgError } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .insert({
        user_id: userId,
        package_id: null, // Manual adjustment package
        tokens_remaining: 10,
        tokens_held: 0,
        status: 'active',
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (pkgError || !newPackage) {
      console.error('Failed to create package:', pkgError)
      process.exit(1)
    }

    userPackageId = newPackage.id
    console.log('Created test package with 10 tokens:', userPackageId)
  } else {
    userPackageId = userPackages[0].id
    console.log('Using existing package:', userPackageId, 'Tokens:', userPackages[0].tokens_remaining)
  }

  // 3. Create a class scheduled for 15 minutes from now (within check-in window)
  const now = new Date()
  const classTime = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes from now

  const { data: newClass, error: classError } = await adminClient
    .from(TABLES.CLASSES)
    .insert({
      title: 'Test Zumba Class - QR Check-in',
      description: 'Test class for QR code check-in functionality',
      class_type: 'zumba',
      level: 'all_levels',
      instructor_id: null,
      instructor_name: 'Test Instructor',
      scheduled_at: classTime.toISOString(),
      duration_minutes: 60,
      capacity: 20,
      token_cost: 1,
      location: 'Main Studio',
      status: 'scheduled',
      allow_drop_in: true,
      drop_in_token_cost: 1,
    })
    .select()
    .single()

  if (classError || !newClass) {
    console.error('Failed to create class:', classError)
    process.exit(1)
  }

  console.log('Created class:', newClass.id, newClass.title)
  console.log('Class scheduled at:', newClass.scheduled_at)

  // 4. Create booking for the user
  const { data: booking, error: bookingError } = await adminClient
    .from(TABLES.BOOKINGS)
    .insert({
      user_id: userId,
      class_id: newClass.id,
      user_package_id: userPackageId,
      tokens_used: 1,
      status: 'confirmed',
      booked_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (bookingError) {
    console.error('Failed to create booking:', bookingError)
    // Try to delete the class we just created
    await adminClient.from(TABLES.CLASSES).delete().eq('id', newClass.id)
    process.exit(1)
  }

  console.log('Created booking:', booking.id)
  console.log('\n✅ Success!')
  console.log('Class ID:', newClass.id)
  console.log('Class Title:', newClass.title)
  console.log('Scheduled At:', newClass.scheduled_at)
  console.log('Booking ID:', booking.id)
  console.log('\nYou can now test QR code check-in for this class!')
}

createTestClassAndBooking()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
