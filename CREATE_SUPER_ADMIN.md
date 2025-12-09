# How to Create Your First Super Admin User

## Quick Answer

**Super Admin = Regular user with special privileges** ✅  
**Service Role Key = Secret key (only needed for automated script)** 🔑

You have 2 options:

---

## ✅ Option 1: Simple SQL Method (Recommended - No Service Role Key Needed)

### Step 1: Create User in Dashboard
1. Go to **Supabase Dashboard** → Your Project → **Authentication** → **Users**
2. Click **"Add User"**
3. Fill in:
   - Email: `admin@zumbaton.com` (or your email)
   - Password: `YourSecurePassword123!`
   - ✅ Check **"Auto Confirm User"** (important!)
4. Click **"Create User"**

### Step 2: Update Role via SQL
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open file: `supabase/create_super_admin_simple.sql`
3. Replace `'admin@zumbaton.com'` with your email (in 3 places)
4. Click **"Run"**

### Step 3: Sign In
- Go to admin sign-in page
- Use your email and password
- You now have super admin access!

---

## 🔧 Option 2: Automated Script (Requires Service Role Key)

### Find Service Role Key:
1. Supabase Dashboard → **Settings** → **API**
2. Scroll to **"Project API keys"**
3. Find **`service_role`** key (labeled "secret")
4. Click **"Reveal"** → Copy it

### Add to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Run Script:
```bash
node scripts/create-super-admin.js
```

---

## 🎯 Which Method Should I Use?

- **Use Option 1** if you want it simple and quick
- **Use Option 2** if you prefer automation or will create many users

Both methods work the same - you'll have a super admin user either way!

---

## ⚠️ Important Notes

- **Service Role Key is NOT required** for the app to run
- It's only needed for the automated user creation script
- The app works fine without it - you just need to create users manually
- Super Admin is just a user with `role = 'super_admin'` in the database

