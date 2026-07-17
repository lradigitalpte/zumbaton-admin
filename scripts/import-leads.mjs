import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local')
const supabase = createClient(url, key, { auth: { persistSession: false } })

function parseCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"' && quoted && text[i + 1] === '"') { value += '"'; i++ }
    else if (c === '"') quoted = !quoted
    else if (c === ',' && !quoted) { row.push(value); value = '' }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = '' }
    else value += c
  }
  if (value || row.length) { row.push(value); rows.push(row) }
  const headers = rows.shift()?.map((h) => h.trim()) || []
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() || ''])))
}
const text = (v) => String(v || '').trim() || null
const phone = (v) => { const d = String(v || '').replace(/\D/g, ''); return d ? (d.length === 8 ? `65${d}` : d.replace(/^00/, '')) : null }
const email = (v) => text(v)?.toLowerCase() || null
function map(row, filename) {
  const isTikTok = Boolean(row['TikTok Lead ID'])
  const platform = text(row.platform)?.toLowerCase()
  const source = isTikTok ? 'tiktok' : platform === 'fb' ? 'facebook' : platform === 'ig' ? 'instagram' : 'google_sheets'
  const rawPhone = text(row.phone_number || row['Phone number'] || row.Number)
  const rawEmail = text(row.email || row.Email)
  return {
    external_id: text(row.id || row['TikTok Lead ID']), source, platform: platform || source,
    name: text(row.full_name || row.Name) || '', phone: rawPhone, normalized_phone: phone(rawPhone),
    email: rawEmail, normalized_email: email(rawEmail), status: 'new', campaign_id: text(row.campaign_id),
    campaign_name: text(row.campaign_name), adset_id: text(row.adset_id), adset_name: text(row.adset_name),
    ad_id: text(row.ad_id), ad_name: text(row.ad_name), form_id: text(row.form_id), form_name: text(row.form_name),
    click_id: text(row['Click ID']), submitted_at: row.created_time && !Number.isNaN(Date.parse(row.created_time)) ? new Date(row.created_time).toISOString() : null,
    raw_form_data: row, imported_from: filename,
  }
}

const dataDir = path.resolve(process.argv[2] || 'leaddata')
const files = fs.readdirSync(dataDir).filter((name) => name.toLowerCase().endsWith('.csv'))
let received = 0; let inserted = 0
for (const filename of files) {
  const records = parseCsv(fs.readFileSync(path.join(dataDir, filename), 'utf8')).map((row) => map(row, filename))
  received += records.length
  const { data, error } = await supabase.from('marketing_leads').upsert(records, { onConflict: 'source,external_id', ignoreDuplicates: true }).select('id')
  if (error) throw new Error(`${filename}: ${error.message}`)
  inserted += data?.length || 0
  if (data?.length) await supabase.from('lead_activities').insert(data.map(({ id }) => ({ lead_id: id, activity_type: 'imported', note: `Imported from ${filename}` })))
  console.log(`${filename}: ${records.length} read, ${data?.length || 0} inserted`)
}
console.log(`Complete: ${received} read, ${inserted} inserted, ${received - inserted} existing/duplicate external IDs`)
