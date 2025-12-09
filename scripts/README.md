# Admin Scripts

## Create Super Admin User

This script creates the first super_admin user for the admin dashboard.

### Prerequisites

1. Make sure you have run the database schema (`supabase/schema.sql`) in your Supabase SQL Editor
2. Set up your `.env.local` file with Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (required - get this from Supabase Dashboard > Settings > API)

### Usage

#### Option 1: Run with default values

```bash
node scripts/create-super-admin.js
```

This will create a super_admin user with:
- Email: `admin@zumbaton.com`
- Password: `Admin@12345!`
- Name: `Super Admin`

#### Option 2: Run with custom values

```bash
ADMIN_EMAIL=your-email@zumbaton.com ADMIN_PASSWORD=YourSecurePassword123! ADMIN_NAME="Your Name" node scripts/create-super-admin.js
```

### What the script does

1. Checks if a user with the email already exists
2. Creates a new auth user in Supabase Auth (if needed)
3. Creates/updates the user profile with `super_admin` role
4. Creates notification preferences
5. Creates user stats record

### Security Notes

- The script requires the `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS
- **IMPORTANT**: Change the default password after first login
- Only run this script once to create the initial super_admin
- Future admin users should be created through the admin dashboard by the super_admin

### Troubleshooting

**Error: Missing Supabase environment variables**
- Make sure `.env.local` exists and has the correct values
- The script looks for `.env.local` in the project root

**Error: Failed to create auth user**
- Check that `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify the Supabase project is active

**Error: Failed to create/update profile**
- Make sure the database schema has been run
- Check that RLS policies allow service role inserts (should be handled by SECURITY DEFINER functions)

