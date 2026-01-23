/**
 * Cron Job: Auto-Generate Future Class Occurrences
 * 
 * Runs daily at 2 AM to check all recurring parent classes and generate
 * more occurrences if needed (hybrid auto-generation approach).
 * 
 * Logic:
 * - Find all active recurring parent classes
 * - For each parent, check the last generated occurrence
 * - If last occurrence is within 2 weeks, generate 4 more weeks
 * - Keeps ~8-12 weeks of instances in database at any time
 */

import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { generateFutureOccurrences } from '@/services/class.service'

export async function autoGenerateFutureClasses() {
  console.log('[Cron: Auto-Generate Classes] Starting...')
  
  const supabase = getSupabaseAdminClient()
  
  try {
    // Find all active recurring parent classes
    // Parent classes have: parent_class_id IS NULL, recurrence_type = 'recurring', status != 'cancelled'
    const { data: parentClasses, error: fetchError } = await supabase
      .from(TABLES.CLASSES)
      .select('id, title, scheduled_at')
      .is('parent_class_id', null)
      .eq('recurrence_type', 'recurring')
      .neq('status', 'cancelled')
    
    if (fetchError) {
      console.error('[Cron: Auto-Generate Classes] Error fetching parent classes:', fetchError)
      return { success: false, error: fetchError }
    }
    
    if (!parentClasses || parentClasses.length === 0) {
      console.log('[Cron: Auto-Generate Classes] No active recurring classes found')
      return { success: true, message: 'No active recurring classes' }
    }
    
    console.log(`[Cron: Auto-Generate Classes] Found ${parentClasses.length} active recurring classes`)
    
    let totalGenerated = 0
    const results: Array<{ parentId: string; title: string; generated: number; error?: string }> = []
    
    // Check each parent class
    for (const parent of parentClasses) {
      try {
        // Get the last occurrence for this parent
        const { data: lastOccurrence } = await supabase
          .from(TABLES.CLASSES)
          .select('scheduled_at')
          .eq('parent_class_id', parent.id)
          .order('scheduled_at', { ascending: false })
          .limit(1)
          .single()
        
        if (!lastOccurrence) {
          console.log(`[Cron: Auto-Generate Classes] No occurrences found for ${parent.title}, skipping`)
          results.push({ parentId: parent.id, title: parent.title, generated: 0, error: 'No occurrences' })
          continue
        }
        
        // Check if last occurrence is within 2 weeks
        const lastDate = new Date(lastOccurrence.scheduled_at)
        const now = new Date()
        const daysUntilLast = Math.floor((lastDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        console.log(`[Cron: Auto-Generate Classes] ${parent.title}: Last occurrence in ${daysUntilLast} days`)
        
        // If last occurrence is more than 14 days away, skip
        if (daysUntilLast > 14) {
          console.log(`[Cron: Auto-Generate Classes] ${parent.title}: Still has ${daysUntilLast} days, skipping`)
          results.push({ parentId: parent.id, title: parent.title, generated: 0 })
          continue
        }
        
        // Generate 4 more weeks
        console.log(`[Cron: Auto-Generate Classes] ${parent.title}: Generating 4 more weeks...`)
        const generated = await generateFutureOccurrences(parent.id, 4)
        totalGenerated += generated
        
        results.push({ parentId: parent.id, title: parent.title, generated })
        console.log(`[Cron: Auto-Generate Classes] ${parent.title}: Generated ${generated} new occurrences`)
        
      } catch (error) {
        console.error(`[Cron: Auto-Generate Classes] Error processing ${parent.title}:`, error)
        results.push({ 
          parentId: parent.id, 
          title: parent.title, 
          generated: 0, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }
    
    console.log(`[Cron: Auto-Generate Classes] Complete! Generated ${totalGenerated} total new occurrences`)
    
    return {
      success: true,
      totalParents: parentClasses.length,
      totalGenerated,
      results
    }
    
  } catch (error) {
    console.error('[Cron: Auto-Generate Classes] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Allow running this cron manually for testing
if (require.main === module) {
  autoGenerateFutureClasses()
    .then(result => {
      console.log('\n✅ Cron job completed:', JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ Cron job failed:', error)
      process.exit(1)
    })
}
