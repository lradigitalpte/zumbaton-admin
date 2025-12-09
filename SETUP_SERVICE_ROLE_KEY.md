# Setting Up Supabase Service Role Key

## Why This Is Needed

The service role key is required for server-side operations like verifying JWT tokens in API routes. It has elevated permissions and should **NEVER** be exposed to the client.

## Steps to Get Your Service Role Key

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/ejeihiyxuzlqamlgudnr/settings/api
   - Or navigate: Dashboard → Your Project → Settings → API

2. **Find the Service Role Key**
   - Look for "Project API keys" section
   - Find the **"service_role"** key (NOT the "anon" key)
   - Click "Reveal" if it's hidden
   - Copy the entire key (it's a long JWT token starting with `eyJ...`)

3. **Update `.env.local`**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
   ```
   
   Replace `your_actual_service_role_key_here` with the key you copied.

4. **Restart Your Development Server**
   - Stop the current server (Ctrl+C or Cmd+C)
   - Start it again: `npm run dev`

## Security Warning

⚠️ **IMPORTANT**: The service role key bypasses Row-Level Security (RLS) and should:
- Only be used in server-side code (API routes, server components)
- NEVER be exposed to the client/browser
- NEVER be committed to version control
- Be kept in `.env.local` (which should be in `.gitignore`)

## Verification

After updating the key and restarting the server, try accessing the Staff Management page. The API calls should work without the "Invalid API key" error.

