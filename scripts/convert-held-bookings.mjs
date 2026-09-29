/**
 * One-off switch-over to "tokens are consumed at booking time".
 *
 * Before the switch, a booked class only HELD a token (user_packages.tokens_held) until
 * check-in / no-show. After the switch, every booking is paid for when it is made.
 * This converts each still-confirmed booking's hold into a real charge:
 *   tokens_remaining -= held, tokens_held = 0, plus one 'booking-consume' ledger row per booking.
 *
 * Run right after deploying the consume-on-book code (and after the 20260929 migration).
 * Safe to re-run: bookings that already have a 'booking-consume' row are skipped, and each
 * package update only applies if its balance is unchanged since it was read.
 *
 * Usage (from zumbaton-admin folder, with .env.local present):
 *   node scripts/convert-held-bookings.mjs            # dry run, prints the plan
 *   node scripts/convert-held-bookings.mjs --apply    # writes
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    if (process.env[key]) continue
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

loadEnvLocal()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  const { data: packages, error: pkgError } = await supabase
    .from('user_packages')
    .select('id, user_id, tokens_remaining, tokens_held, status, expires_at')
  if (pkgError) throw pkgError

  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, user_package_id, tokens_used, class:classes(title, scheduled_at)')
    .eq('status', 'confirmed')
    .not('user_package_id', 'is', null)
  if (bookingError) throw bookingError

  const { data: consumed, error: txError } = await supabase
    .from('token_transactions')
    .select('booking_id')
    .eq('transaction_type', 'booking-consume')
  if (txError) throw txError
  const alreadyCharged = new Set((consumed || []).map((t) => t.booking_id))

  let converted = 0
  let skipped = 0

  for (const pkg of packages || []) {
    const pending = (bookings || []).filter((b) => b.user_package_id === pkg.id && !alreadyCharged.has(b.id))
    const held = pkg.tokens_held || 0
    if (held === 0 && pending.length === 0) continue

    const owed = pending.reduce((sum, b) => sum + (b.tokens_used || 0), 0)
    const label = `package ${pkg.id.slice(0, 8)} (user ${pkg.user_id.slice(0, 8)}): ${pkg.tokens_remaining} left / ${held} held, ${pending.length} uncharged booking(s) = ${owed} token(s)`

    if (held !== owed) {
      // Held tokens don't match the bookings they should cover — needs a human look
      console.log(`SKIP  ${label}  -> held != bookings, check manually`)
      for (const b of pending) console.log(`        booking ${b.id.slice(0, 8)} ${b.class?.title} @ ${b.class?.scheduled_at}`)
      skipped++
      continue
    }

    const newRemaining = pkg.tokens_remaining - owed
    console.log(`${APPLY ? 'APPLY' : 'PLAN '} ${label}  -> ${newRemaining} left / 0 held`)
    if (!APPLY) continue

    const { data: updated, error: updateError } = await supabase
      .from('user_packages')
      .update({
        tokens_remaining: newRemaining,
        tokens_held: 0,
        status: newRemaining <= 0 && pkg.status === 'active' ? 'depleted' : pkg.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pkg.id)
      .eq('tokens_remaining', pkg.tokens_remaining)
      .eq('tokens_held', held)
      .select('id')

    if (updateError || !updated?.length) {
      console.log(`        !! not applied (balance changed or error): ${updateError?.message || 'changed'}`)
      skipped++
      continue
    }

    let balance = pkg.tokens_remaining
    const rows = pending.map((b) => {
      const row = {
        user_id: b.user_id,
        user_package_id: pkg.id,
        booking_id: b.id,
        transaction_type: 'booking-consume',
        tokens_change: -b.tokens_used,
        tokens_before: balance,
        tokens_after: balance - b.tokens_used,
        description: `Switch-over: token charged at booking (was held) - ${b.class?.title || 'class'}`,
      }
      balance -= b.tokens_used
      return row
    })
    const { error: insertError } = await supabase.from('token_transactions').insert(rows)
    if (insertError) console.log(`        !! balance converted but ledger rows failed: ${insertError.message}`)
    converted++
  }

  console.log(`\n${APPLY ? 'Converted' : 'Would convert'} ${APPLY ? converted : '(see PLAN lines)'} package(s); ${skipped} need a manual look.`)
  if (!APPLY) console.log('Dry run only. Re-run with --apply to write.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
