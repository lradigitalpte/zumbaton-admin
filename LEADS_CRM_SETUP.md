# Leads CRM setup

## 1. Apply the database migration

Run `supabase/migrations/20260717_create_marketing_leads_crm.sql` in the Supabase SQL editor before opening `/leads`.

## 2. Import the historical CSV exports

With `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`:

```bash
npm run leads:import
```

The importer is repeat-safe for records with a Meta or TikTok lead ID.

## 3. Configure live ingestion

Generate a long random secret and add it to the deployed admin environment:

```text
LEADS_INGEST_SECRET=replace-with-a-long-random-secret
```

Send each new lead to `POST https://ADMIN-DOMAIN/api/leads/ingest` with:

```text
Content-Type: application/json
x-leads-ingest-secret: the same secret
x-leads-source: google-sheets
```

The endpoint accepts one lead object, an array, or `{ "leads": [...] }`. It recognizes both the current Meta and TikTok sheet column names and preserves all additional form questions in `raw_form_data`.

## Google Apps Script example

In the response spreadsheet choose Extensions > Apps Script, save the secret in Script Properties as `LEADS_INGEST_SECRET`, and install an **On form submit** trigger for this function:

```javascript
function sendLeadToDashboard(e) {
  const values = e.namedValues;
  const lead = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value[0] || ""]));
  const secret = PropertiesService.getScriptProperties().getProperty("LEADS_INGEST_SECRET");
  UrlFetchApp.fetch("https://ADMIN-DOMAIN/api/leads/ingest", {
    method: "post",
    contentType: "application/json",
    headers: { "x-leads-ingest-secret": secret, "x-leads-source": "google-sheets" },
    payload: JSON.stringify(lead),
    muteHttpExceptions: true
  });
}
```

For sheets populated by an external connector rather than Google Forms, use an installable time-based trigger that sends rows not yet marked as synced.
