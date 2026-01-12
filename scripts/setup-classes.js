/**
 * Script to clear all classes and create two recurring classes
 * 
 * Usage:
 *   node scripts/setup-classes.js
 * 
 * This script will:
 * 1. Delete all existing classes from the database
 * 2. Create "Choreographed Dance with Steppers" as a recurring class
 * 3. Create "ZUMBATON" as a recurring class
 * Both classes will be set up for 2 months of recurring schedule
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

// Helper function to generate class occurrences for 2 months
function generateOccurrences(startDate, daysOfWeek) {
  const occurrences = []
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIndices = daysOfWeek.map(day => dayNames.indexOf(day.toLowerCase())).filter(idx => idx !== -1)
  
  if (dayIndices.length === 0) {
    return occurrences
  }

  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + 2) // 2 months from start

  const originalHours = startDate.getHours()
  const originalMinutes = startDate.getMinutes()
  const originalSeconds = startDate.getSeconds()

  let currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const currentDay = currentDate.getDay()
    
    if (dayIndices.includes(currentDay)) {
      const occurrenceDate = new Date(currentDate)
      occurrenceDate.setHours(originalHours, originalMinutes, originalSeconds, 0)
      occurrences.push(occurrenceDate)
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return occurrences
}

async function setupClasses() {
  console.log('\n=== Setting Up Classes ===\n')

  try {
    // Step 1: Get an instructor ID (optional - can be null)
    console.log('Fetching instructors...')
    const { data: instructors, error: instructorError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .eq('role', 'instructor')
      .limit(1)

    let instructorId = null
    let instructorName = null

    if (!instructorError && instructors && instructors.length > 0) {
      instructorId = instructors[0].id
      instructorName = instructors[0].name
      console.log(`Found instructor: ${instructorName} (${instructors[0].email})`)
    } else {
      console.log('No instructor found, classes will be created without instructor')
    }

    // Step 2: Clear all existing classes
    console.log('\nClearing all existing classes...')
    const { error: deleteError } = await supabase
      .from('classes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (using a condition that's always true)

    if (deleteError) {
      console.error('Error clearing classes:', deleteError)
      throw deleteError
    }
    console.log('✓ All classes cleared')

    // Step 3: Set up dates
    // Start from tomorrow at 10:00 AM
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 1)
    startDate.setHours(10, 0, 0, 0)

    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 2)

    console.log(`\nStart date: ${startDate.toLocaleString()}`)
    console.log(`End date: ${endDate.toLocaleString()}`)

    // Step 4: Create "Choreographed Dance with Steppers" class
    console.log('\n=== Creating "Choreographed Dance with Steppers" class ===')
    
    const danceStartDate = new Date(startDate)
    const danceOccurrences = generateOccurrences(danceStartDate, ['monday', 'wednesday', 'friday'])
    
    console.log(`Will create ${danceOccurrences.length} occurrences for Choreographed Dance with Steppers`)

    // Create parent class
    const { data: danceParent, error: danceParentError } = await supabase
      .from('classes')
      .insert({
        title: 'Choreographed Dance with Steppers',
        description: 'This class focuses on structured dance routines performed using steppers to enhance movement, coordination, and strength. Each session combines rhythm, precision, and cardio, making it perfect for those who enjoy learning choreography while improving endurance and lower-body strength.',
        class_type: 'dance',
        level: 'all_levels',
        instructor_id: instructorId,
        instructor_name: instructorName,
        scheduled_at: danceStartDate.toISOString(),
        duration_minutes: 60,
        capacity: 20,
        token_cost: 1,
        location: null,
        status: 'scheduled',
        recurrence_type: 'recurring',
        recurrence_pattern: {
          days: ['monday', 'wednesday', 'friday'],
          endDate: endDate.toISOString(),
          endType: 'date'
        },
        parent_class_id: null,
        occurrence_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (danceParentError) {
      console.error('Error creating dance parent class:', danceParentError)
      throw danceParentError
    }
    console.log('✓ Parent class created')

    // Create occurrences
    if (danceOccurrences.length > 0) {
      const danceOccurrenceClasses = danceOccurrences.map(occurrenceDate => ({
        title: `Choreographed Dance with Steppers - ${occurrenceDate.toLocaleDateString()}`,
        description: 'This class focuses on structured dance routines performed using steppers to enhance movement, coordination, and strength. Each session combines rhythm, precision, and cardio, making it perfect for those who enjoy learning choreography while improving endurance and lower-body strength.',
        class_type: 'dance',
        level: 'all_levels',
        instructor_id: instructorId,
        instructor_name: instructorName,
        scheduled_at: occurrenceDate.toISOString(),
        duration_minutes: 60,
        capacity: 20,
        token_cost: 1,
        location: null,
        status: 'scheduled',
        recurrence_type: 'recurring',
        recurrence_pattern: {
          days: ['monday', 'wednesday', 'friday'],
          endDate: endDate.toISOString(),
          endType: 'date'
        },
        parent_class_id: danceParent.id,
        occurrence_date: occurrenceDate.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { error: danceOccurrencesError } = await supabase
        .from('classes')
        .insert(danceOccurrenceClasses)

      if (danceOccurrencesError) {
        console.error('Error creating dance occurrences:', danceOccurrencesError)
        // Clean up parent class
        await supabase.from('classes').delete().eq('id', danceParent.id)
        throw danceOccurrencesError
      }
      console.log(`✓ Created ${danceOccurrenceClasses.length} occurrences`)
    }

    // Step 5: Create "ZUMBATON" class
    console.log('\n=== Creating "ZUMBATON" class ===')
    
    const zumbatonStartDate = new Date(startDate)
    zumbatonStartDate.setDate(zumbatonStartDate.getDate() + 1) // Start one day after dance class
    const zumbatonOccurrences = generateOccurrences(zumbatonStartDate, ['tuesday', 'thursday', 'saturday'])
    
    console.log(`Will create ${zumbatonOccurrences.length} occurrences for ZUMBATON`)

    // Create parent class
    const { data: zumbatonParent, error: zumbatonParentError } = await supabase
      .from('classes')
      .insert({
        title: 'ZUMBATON',
        description: 'A high-energy Zumba Step workout elevated for added intensity and calorie burn. This class blends fun, easy-to-follow Zumba choreography with step movements, delivering a full-body workout that feels more like a party than exercise.',
        class_type: 'zumba',
        level: 'all_levels',
        instructor_id: instructorId,
        instructor_name: instructorName,
        scheduled_at: zumbatonStartDate.toISOString(),
        duration_minutes: 60,
        capacity: 20,
        token_cost: 1,
        location: null,
        status: 'scheduled',
        recurrence_type: 'recurring',
        recurrence_pattern: {
          days: ['tuesday', 'thursday', 'saturday'],
          endDate: endDate.toISOString(),
          endType: 'date'
        },
        parent_class_id: null,
        occurrence_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (zumbatonParentError) {
      console.error('Error creating zumbaton parent class:', zumbatonParentError)
      throw zumbatonParentError
    }
    console.log('✓ Parent class created')

    // Create occurrences
    if (zumbatonOccurrences.length > 0) {
      const zumbatonOccurrenceClasses = zumbatonOccurrences.map(occurrenceDate => ({
        title: `ZUMBATON - ${occurrenceDate.toLocaleDateString()}`,
        description: 'A high-energy Zumba Step workout elevated for added intensity and calorie burn. This class blends fun, easy-to-follow Zumba choreography with step movements, delivering a full-body workout that feels more like a party than exercise.',
        class_type: 'zumba',
        level: 'all_levels',
        instructor_id: instructorId,
        instructor_name: instructorName,
        scheduled_at: occurrenceDate.toISOString(),
        duration_minutes: 60,
        capacity: 20,
        token_cost: 1,
        location: null,
        status: 'scheduled',
        recurrence_type: 'recurring',
        recurrence_pattern: {
          days: ['tuesday', 'thursday', 'saturday'],
          endDate: endDate.toISOString(),
          endType: 'date'
        },
        parent_class_id: zumbatonParent.id,
        occurrence_date: occurrenceDate.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { error: zumbatonOccurrencesError } = await supabase
        .from('classes')
        .insert(zumbatonOccurrenceClasses)

      if (zumbatonOccurrencesError) {
        console.error('Error creating zumbaton occurrences:', zumbatonOccurrencesError)
        // Clean up parent class
        await supabase.from('classes').delete().eq('id', zumbatonParent.id)
        throw zumbatonOccurrencesError
      }
      console.log(`✓ Created ${zumbatonOccurrenceClasses.length} occurrences`)
    }

    console.log('\n=== Setup Complete! ===')
    console.log(`\nCreated classes:`)
    console.log(`- Choreographed Dance with Steppers: ${danceOccurrences.length} occurrences`)
    console.log(`- ZUMBATON: ${zumbatonOccurrences.length} occurrences`)
    console.log(`\nBoth classes are set for 2 months of recurring schedule.`)
    console.log(`You can edit the times, dates, and other details in the admin dashboard.`)

  } catch (error) {
    console.error('\nError setting up classes:', error)
    process.exit(1)
  }
}

// Run the script
setupClasses().then(() => {
  console.log('\nDone!')
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
