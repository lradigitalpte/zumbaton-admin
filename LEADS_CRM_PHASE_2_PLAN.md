# Leads CRM Phase 2 Implementation Plan

## Objective

Turn the Leads CRM into a proactive sales workflow that tells staff who to contact, records every action, reduces duplicates, distributes work automatically, and measures month-to-month progress.

## Recommended implementation order

1. Activity timeline
2. Follow-up reminders
3. WhatsApp templates
4. Duplicate detection and merging
5. Automatic staff assignment
6. Month-to-month analytics comparison
7. CSV exports

The activity timeline comes first because every later automation needs an auditable record of what happened.

---

## Phase 1: Lead activity timeline

### Step 1. Extend the activity schema

Create `supabase/migrations/20260720_expand_lead_activities.sql`.

Add support for these activity types:

- `created`
- `imported`
- `status_changed`
- `note_added`
- `assigned`
- `follow_up_set`
- `call_started`
- `whatsapp_opened`
- `reminder_sent`
- `starred`
- `unstarred`
- `archived`
- `restored`
- `merged`
- `exported`

Add optional columns:

```sql
ALTER TABLE lead_activities
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
```

Update the activity-type check constraint to include every supported value.

### Step 2. Record every lead mutation

Update these endpoints:

- `PUT /api/leads`
- `POST /api/leads/bulk`
- `POST /api/leads/book`
- `POST /api/leads/import`

Each change should insert an activity containing:

- Lead ID
- Staff actor ID
- Activity type
- Previous values
- New values
- Optional note
- Timestamp

Do not allow activity logging failure to silently hide a failed lead update. Use a database transaction/RPC for changes that must remain atomic.

### Step 3. Create the activity API

Add:

```text
GET /api/leads/[leadId]/activities
POST /api/leads/[leadId]/activities
```

`GET` should return newest-first activity records with actor names.

`POST` should support manual notes and explicit contact events.

### Step 4. Add the timeline to Lead Details

Add an **Activity** section to the right-side Lead Details drawer.

Display:

- Icon and readable activity label
- Staff member
- Date/time in Singapore time
- Old and new status where relevant
- Notes
- Follow-up date where relevant

Include an **Add note** composer at the top.

### Step 5. Test the timeline

Verify:

- Single status updates create one activity.
- Bulk changes create one activity per affected lead.
- Assigning and unassigning staff are recorded.
- Archiving, restoring, starring and booking are recorded.
- Deleted leads remove their timeline through cascading deletion.

---

## Phase 2: Automatic follow-up reminders

### Step 1. Add reminder fields

Create `supabase/migrations/20260721_add_lead_reminders.sql`.

Add to `marketing_leads`:

```sql
ALTER TABLE marketing_leads
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_snoozed_until TIMESTAMPTZ;
```

Add an index for due reminders.

### Step 2. Define reminder rules

Initial rules:

- New lead untouched for 24 hours: notify owner.
- Follow-up due within 30 minutes: notify owner.
- Follow-up overdue: show in an overdue queue and notify once.
- Unassigned new lead untouched for 2 hours: notify admins.
- Converted, closed, cold or archived leads: no reminders.

Store these timings in system settings later; begin with environment/config constants.

### Step 3. Create the reminder processor

Add a scheduled job/service:

```text
POST /api/cron/lead-reminders
```

The processor should:

1. Find due leads.
2. Ignore archived or closed leads.
3. Determine the recipient.
4. Create an in-app notification.
5. Record a `reminder_sent` activity.
6. Update `reminder_sent_at` to prevent duplicates.

Make the job idempotent so running it twice does not send two reminders.

### Step 4. Schedule the job

Run it every 10–15 minutes using the project’s existing cron mechanism.

Protect it with the existing cron secret/authentication approach.

### Step 5. Improve the Leads UI

Add:

- Red **Overdue** count
- **Due today** queue
- Reminder bell/icon on affected rows
- Snooze options: 1 hour, tomorrow, next week
- “Mark contacted” shortcut

### Step 6. Test reminders

Test due, overdue, snoozed, reassigned, archived and converted leads. Verify that duplicate job executions do not duplicate notifications.

---

## Phase 3: WhatsApp message templates

### Step 1. Create the templates table

Create `lead_message_templates` with:

- `id`
- `name`
- `category`
- `message`
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

Suggested categories:

- First contact
- No answer
- Follow-up
- Trial confirmation
- Trial reminder
- Post-trial conversion
- Re-engagement

### Step 2. Support template variables

Initial variables:

```text
{{name}}
{{staff_name}}
{{class_name}}
{{class_date}}
{{class_time}}
{{location}}
```

Escape values and leave unsupported variables visibly unchanged rather than deleting them.

### Step 3. Build template management

Add a settings page:

```text
/settings/lead-templates
```

Admins can create, edit, preview, activate and deactivate templates.

### Step 4. Add WhatsApp actions

Replace the basic WhatsApp link with a template picker:

1. Choose template.
2. Preview personalized message.
3. Copy message or open WhatsApp.
4. Record `whatsapp_opened` in the activity timeline.

Opening WhatsApp should not automatically mark a lead contacted. Staff should confirm the outcome.

---

## Phase 4: Duplicate review and merging

### Step 1. Improve duplicate detection

Detect possible duplicates using:

- Exact normalized phone
- Exact normalized email
- Same external platform ID
- Optional fuzzy name match only when phone/email is also similar

Never automatically merge based on name alone.

### Step 2. Create a duplicate candidates API

Add:

```text
GET /api/leads/duplicates
POST /api/leads/merge
```

Return duplicate groups with match reasons and confidence.

### Step 3. Build the duplicate-review page

Add:

```text
/leads/duplicates
```

Show records side by side with:

- Contact details
- Source/campaign
- Submission date
- Status
- Notes
- Activity count
- Booking information

### Step 4. Implement safe merging

The user must choose the primary lead.

Merge rules:

- Keep the earliest real submission date.
- Keep the most complete contact fields.
- Preserve every source payload.
- Move activities to the primary lead.
- Keep the most advanced status unless the user chooses otherwise.
- Keep future follow-up and assignment.
- Store merged lead IDs for auditability.
- Soft-delete or mark secondary records as merged rather than permanently deleting immediately.

Use a Supabase/Postgres RPC transaction so partial merges cannot occur.

---

## Phase 5: Automatic staff assignment

### Step 1. Create assignment rules

Create `lead_assignment_rules` with:

- Priority/order
- Source/channel filter
- Campaign/form filter
- Assigned staff member or team
- Assignment mode
- Active flag

Supported modes:

- Fixed owner
- Round robin
- Least active leads

### Step 2. Add assignment state

Create a small assignment-state table for round-robin position. Do not depend on browser state.

### Step 3. Assign during ingestion

After importing a new lead:

1. Find the first matching active rule.
2. Select the owner.
3. Save `assigned_to`.
4. Record an `assigned` activity.
5. Notify the new owner.

Do not reassign existing leads during repeat imports.

### Step 4. Build assignment settings

Add:

```text
/settings/lead-assignment
```

Provide rule ordering, staff availability and a “Test this rule” preview.

---

## Phase 6: Month-to-month analytics comparison

### Step 1. Extend the analytics API

Return current and previous period metrics:

- Total leads
- Progressed leads
- Converted leads
- Conversion rate
- Channel volume
- Campaign volume

For April 2026, compare against March 2026. For “All months in 2026,” compare against 2025.

### Step 2. Calculate deltas safely

Return:

```json
{
  "current": 120,
  "previous": 100,
  "change": 20,
  "changePercent": 20
}
```

Handle a zero previous value without division errors.

### Step 3. Enhance report cards

Show:

- Up/down indicator
- Percentage change
- Previous-period value
- Green/red/neutral styling based on metric meaning

Add channel comparison series to the month-to-month graph.

### Step 4. Add date-quality messaging

TikTok rows without original submission dates should display a warning that analytics uses the import or manually corrected date.

---

## Phase 7: CSV exports

### Step 1. Add lead export API

Create:

```text
GET /api/leads/export
```

Support the same filters as the Leads CRM:

- Queue
- Status
- Channel
- Visibility
- Starred
- Date range
- Search
- Assigned owner

Export operational columns plus optional raw form answers.

### Step 2. Add analytics export API

Create:

```text
GET /api/leads/analytics/export
```

Include:

- Summary metrics
- Monthly performance
- Channel performance
- Campaign performance
- Status breakdown

### Step 3. Add UI buttons

Add **Export CSV** to:

- Leads CRM
- Lead Analytics

The button must export the active filtered dataset, not every lead silently.

Record `exported` activities or audit logs with actor, filters and row count.

### Step 4. Protect sensitive data

- Require admin/staff authentication.
- Restrict exports by role if necessary.
- Never include service keys or internal metadata.
- Consider excluding raw form data by default.

---

## Cross-cutting requirements

### Permissions

Define separate permissions for:

- View leads
- Edit leads
- Bulk edit
- Merge duplicates
- Manage templates
- Manage assignment rules
- Export leads
- View lead analytics

### Auditability

Every bulk change, merge, export and automated assignment must identify the actor or system job.

### Performance

- Add indexes for follow-up dates, status, owner, starred, archived and normalized contact fields.
- Keep dashboard list queries paginated.
- Aggregate analytics server-side.
- Avoid loading all activity history until the Lead Details drawer opens.

### Privacy

- Avoid logging names, phones and emails in server logs.
- Limit service-role usage to server routes.
- Keep exports and message-template access authenticated.
- Preserve source payloads but do not display unnecessary personal data broadly.

---

## Delivery milestones

### Milestone A: Staff productivity

- Activity timeline
- Notes
- Follow-up reminders
- Due-today and overdue queues

### Milestone B: Communication and data quality

- WhatsApp templates
- Duplicate review
- Safe merge workflow

### Milestone C: Automation and reporting

- Automatic assignment
- Previous-period comparisons
- Filtered CSV exports

---

## Definition of done

Phase 2 is complete when:

- Every lead action is visible in an activity timeline.
- Due and overdue follow-ups generate one reliable reminder.
- Staff can use managed WhatsApp templates.
- Admins can review and safely merge duplicates.
- New leads can be assigned automatically.
- Analytics compares the selected period with the prior period.
- Leads and reports can be exported using active filters.
- All new endpoints enforce authentication and authorization.
- Database migrations are repeat-safe.
- TypeScript and production builds pass.
- Core workflows have manual or automated test coverage.

## Recommended first implementation sprint

Build only these items first:

1. Expand `lead_activities`.
2. Add the Lead Details activity timeline.
3. Add manual notes.
4. Add the reminder processor.
5. Add Due Today and Overdue queues.
6. Test idempotent reminders.

This sprint delivers the highest operational value without requiring message templates, merge logic or assignment automation immediately.
