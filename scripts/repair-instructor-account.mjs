/**
 * Repair an instructor who exists in Supabase Auth but cannot sign in
 * (missing user_profiles row, wrong role, inactive, or no password).
 *
 * Usage (from zumbaton-admin folder, with .env.local present):
 *   INSTRUCTOR_EMAIL=magaiswari.tamilarasan@gmail.com INSTRUCTOR_PASSWORD='YourTempPass123!' node scripts/repair-instructor-account.mjs
 *
 * Optional:
 *   INSTRUCTOR_NAME="Micky"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const instructorEmail = (process.env.INSTRUCTOR_EMAIL || 'magaiswari.tamilarasan@gmail.com').trim().toLowerCase()
const instructorPassword = process.env.INSTRUCTOR_PASSWORD
const instructorName = process.env.INSTRUCTOR_NAME || 'Micky'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

if (!instructorPassword || instructorPassword.length < 8) {
  console.error('Set INSTRUCTOR_PASSWORD (min 8 characters) for the instructor to sign in.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findAuthUserByEmail(email) {
  let page = 1
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) break
    page++
  }
  return null
}

async function main() {
  console.log('\n=== Repair instructor account ===\n')
  console.log(`Email: ${instructorEmail}`)
  console.log(`Name:  ${instructorName}\n`)

  let authUser = await findAuthUserByEmail(instructorEmail)
  if (!authUser) {
    console.log('No auth user — creating one...')
    const { data, error } = await supabase.auth.admin.createUser({
      email: instructorEmail,
      password: instructorPassword,
      email_confirm: true,
      user_metadata: { name: instructorName, role: 'instructor', signup_source: 'admin' },
      app_metadata: { role: 'instructor' },
    })
    if (error) throw error
    authUser = data.user
  } else {
    console.log(`Found auth user: ${authUser.id}`)
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: instructorPassword,
      email_confirm: true,
      user_metadata: {
        ...authUser.user_metadata,
        name: instructorName,
        role: 'instructor',
        signup_source: authUser.user_metadata?.signup_source || 'admin',
      },
      app_metadata: {
        ...authUser.app_metadata,
        role: 'instructor',
      },
    })
    if (updateAuthError) throw updateAuthError
    console.log('✓ Auth user updated (password, role, email confirmed)')
  }

  const userId = authUser.id

  const { data: profile, error: profileReadError } = await supabase
    .from('user_profiles')
    .select('id, email, name, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (profileReadError) throw profileReadError

  if (profile) {
    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({
        email: instructorEmail,
        name: instructorName,
        role: 'instructor',
        is_active: true,
        signup_source: 'admin',
      })
      .eq('id', userId)
    if (profileUpdateError) throw profileUpdateError
    console.log('✓ user_profiles updated (instructor, active)')
  } else {
    const { error: profileInsertError } = await supabase.from('user_profiles').insert({
      id: userId,
      email: instructorEmail,
      name: instructorName,
      role: 'instructor',
      is_active: true,
      signup_source: 'admin',
      early_bird_eligible: false,
    })
    if (profileInsertError) throw profileInsertError
    console.log('✓ user_profiles created (instructor, active)')
  }

  await supabase.from('user_notification_preferences').upsert(
    { user_id: userId, email_enabled: true, push_enabled: true },
    { onConflict: 'user_id' }
  )
  await supabase.from('user_stats').upsert({ user_id: userId }, { onConflict: 'user_id' })

  console.log('\n✅ Instructor account repaired.')
  console.log('\nSign in at the ADMIN app (not the public member site):')
  console.log('  /signin  →  redirects to /tutor for instructors')
  console.log(`  Email:    ${instructorEmail}`)
  console.log('  Password: (the INSTRUCTOR_PASSWORD you set)')
  console.log('\nAsk Micky to change her password after first login (Staff profile → Reset password).\n')
}

main().catch((err) => {
  console.error('\n❌ Repair failed:', err.message || err)
  process.exit(1)
})
