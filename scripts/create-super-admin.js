/**
 * Script to create the first super_admin user
 * 
 * Usage:
 *   node scripts/create-super-admin.js
 * 
 * Or with custom values:
 *   ADMIN_EMAIL=admin@zumbaton.com ADMIN_PASSWORD=SecurePass123! ADMIN_NAME="Super Admin" node scripts/create-super-admin.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createSuperAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@zumbaton.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345!'
  const adminName = process.env.ADMIN_NAME || 'Super Admin'

  console.log('\n=== Creating Super Admin User ===\n')
  console.log(`Email: ${adminEmail}`)
  console.log(`Name: ${adminName}\n`)

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === adminEmail)

    let userId

    if (existingUser) {
      console.log(`User with email ${adminEmail} already exists. Updating role...`)
      userId = existingUser.id
    } else {
      // Create new auth user
      console.log('Creating new auth user...')
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          name: adminName,
          role: 'super_admin'
        }
      })

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`)
      }

      userId = authData.user.id
      console.log(`✓ Auth user created with ID: ${userId}`)
    }

    // Wait a moment for trigger to potentially create profile
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check if profile exists and update/create it
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      // Update existing profile to super_admin
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          role: 'super_admin',
          name: adminName,
          email: adminEmail,
          is_active: true
        })
        .eq('id', userId)

      if (updateError) {
        throw new Error(`Failed to update profile: ${updateError.message}`)
      }
      console.log('✓ User profile updated to super_admin role')
    } else {
      // Create new profile with super_admin role
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: adminEmail,
          name: adminName,
          role: 'super_admin',
          is_active: true
        })

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`)
      }
      console.log('✓ User profile created with super_admin role')
    }

    // Create notification preferences
    const { error: prefError } = await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: userId,
        email_enabled: true,
        push_enabled: true
      }, {
        onConflict: 'user_id'
      })

    if (prefError) {
      console.warn(`Warning: Could not create notification preferences: ${prefError.message}`)
    } else {
      console.log('✓ Notification preferences created')
    }

    // Create user stats
    const { error: statsError } = await supabase
      .from('user_stats')
      .upsert({
        user_id: userId
      }, {
        onConflict: 'user_id'
      })

    if (statsError) {
      console.warn(`Warning: Could not create user stats: ${statsError.message}`)
    } else {
      console.log('✓ User stats created')
    }

    console.log('\n✅ Super Admin created successfully!')
    console.log(`\nYou can now sign in at:`)
    console.log(`  Email: ${adminEmail}`)
    console.log(`  Password: ${adminPassword}`)
    console.log(`\n⚠️  IMPORTANT: Change the password after first login!\n`)

  } catch (error) {
    console.error('\n❌ Error creating super admin:', error.message)
    console.error(error)
    process.exit(1)
  }
}

createSuperAdmin()

