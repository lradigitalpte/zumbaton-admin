/**
 * Fix Parent Class Scheduled Dates
 * 
 * This script updates all parent/template classes to have a far future scheduled_at date
 * so they don't appear in date-based queries (like today's attendance).
 * 
 * Parent classes are templates for recurring classes and should never appear in daily views.
 */

import { getSupabaseAdminClient } from '../src/lib/supabase'

async function fixParentClassDates() {
  console.log('Starting parent class date fix...')
  
  const supabase = getSupabaseAdminClient()
  
  // Find all parent classes (parent_class_id IS NULL and recurrence_type != 'single')
  const { data: parentClasses, error: fetchError } = await supabase
    .from('classes')
    .select('id, title, scheduled_at, recurrence_type, parent_class_id')
    .is('parent_class_id', null)
    .neq('recurrence_type', 'single')
  
  if (fetchError) {
    console.error('Error fetching parent classes:', fetchError)
    return
  }
  
  if (!parentClasses || parentClasses.length === 0) {
    console.log('No parent classes found to update.')
    return
  }
  
  console.log(`Found ${parentClasses.length} parent classes to update:`)
  parentClasses.forEach(cls => {
    console.log(`  - ${cls.title} (ID: ${cls.id}, Current date: ${cls.scheduled_at})`)
  })
  
  // Update all parent classes to have scheduled_at = 2099-12-31
  const templateDate = new Date('2099-12-31T00:00:00Z').toISOString()
  
  const { data: updated, error: updateError } = await supabase
    .from('classes')
    .update({ scheduled_at: templateDate })
    .is('parent_class_id', null)
    .neq('recurrence_type', 'single')
    .select('id, title')
  
  if (updateError) {
    console.error('Error updating parent classes:', updateError)
    return
  }
  
  console.log(`\nSuccessfully updated ${updated?.length || 0} parent classes!`)
  updated?.forEach(cls => {
    console.log(`  ✓ ${cls.title}`)
  })
  
  console.log('\nParent classes will no longer appear in daily attendance views.')
}

fixParentClassDates()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
