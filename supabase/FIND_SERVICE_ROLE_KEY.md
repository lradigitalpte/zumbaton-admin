# How to Find Your Supabase Service Role Key

## Step-by-Step Guide

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Log in to your account

2. **Select your project**
   - Click on your project: `ejeihiyxuzlqamlgudnr` (or whatever your project name is)

3. **Navigate to Settings**
   - Look for the **Settings** icon in the left sidebar (gear icon)
   - Click on **Settings**

4. **Go to API Settings**
   - In the Settings menu, click on **API**
   - You'll see a section called **Project API keys**

5. **Find the `service_role` key**
   - Look for the key labeled **`service_role`** (it's a secret key)
   - It will be different from the `anon` key you already have
   - Click the **"Reveal"** button or eye icon to show it
   - **Copy this key** - it looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

6. **Add it to your `.env.local`**
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## Important Security Notes

- **NEVER commit this key to git** - it's already in `.gitignore`
- **NEVER expose it to the client-side** - it bypasses all security
- **Only use it in server-side scripts** - like our admin creation script

## Alternative: Create Super Admin via SQL

If you can't find the service role key or prefer SQL, you can create the super_admin directly in Supabase SQL Editor. See the alternative method below.

