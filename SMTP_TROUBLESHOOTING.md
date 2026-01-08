# SMTP Troubleshooting Guide

## Issue: API Returns Success But No Email Received

The API always returns success (for security), but that doesn't mean the email was sent. Follow these steps:

---

## Step 1: Check Supabase Auth Logs

**This is the most important step!**

1. Go to **Supabase Dashboard**
2. Navigate to: **Logs** → **Auth Logs**
3. Look for recent events (last 5-10 minutes)
4. Find the password reset request
5. **Check for errors** - Look for:
   - Red error indicators
   - Error messages like:
     - "SMTP connection failed"
     - "Authentication failed"
     - "Invalid credentials"
     - "Email sending failed"

**What to look for:**
- ✅ Green checkmark = Email sent successfully
- ❌ Red X = Email failed (check error message)
- ⚠️ Yellow warning = Partial failure

---

## Step 2: Verify SMTP is Enabled

1. Go to: **Settings** → **Auth** → **SMTP Settings**
2. Check: **"Enable custom SMTP"** toggle should be **ON** (green/enabled)
3. Verify all fields are filled:
   - Host: `smtp.gmail.com`
   - Port: `587` or `465`
   - Username: `hello@zumbaton.sg`
   - Password: [Should be filled]
   - Sender email: `hello@zumbaton.sg`
   - Sender name: `Zumbaton`

**If toggle is OFF:**
- Supabase is using default email service
- Emails come from `noreply@mail.app.supabase.io`
- Check spam folder for emails from that address

---

## Step 3: Test SMTP Connection

1. In **SMTP Settings** page
2. Look for **"Test Connection"** or **"Send Test Email"** button
3. Click it
4. Enter your email address
5. Click **"Send"**
6. Check your inbox

**If test fails:**
- Error message will show what's wrong
- Common errors:
  - "Authentication failed" → Wrong password or username
  - "Connection timeout" → Firewall or network issue
  - "Invalid credentials" → App-specific password not set up correctly

---

## Step 4: Verify Email Address Exists

The email address must exist in your Supabase Auth system:

1. Go to: **Authentication** → **Users**
2. Search for the email address you used
3. **If email doesn't exist:**
   - Create a test user first
   - Or use an existing user's email

**Note:** Supabase won't send emails to non-existent users (for security), but the API still returns success.

---

## Step 5: Check App-Specific Password

If using Gmail/Google Workspace:

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in with `hello@zumbaton.sg`
3. Verify the app-specific password exists
4. **If password was lost:**
   - Generate a new one
   - Update it in Supabase SMTP Settings
   - Save settings

**Important:**
- Must use app-specific password (16 characters)
- NOT your regular Gmail password
- Remove spaces when entering in Supabase

---

## Step 6: Check Email Templates

1. Go to: **Settings** → **Auth** → **Email Templates**
2. Click on **"Reset Password"** template
3. Verify template is not empty
4. Check if template has the correct variables:
   - `{{ .ConfirmationURL }}` or `{{ .Token }}`
   - `{{ .Email }}`

**If template is missing or broken:**
- Supabase might not send the email
- Reset to default template if needed

---

## Step 7: Check Site URL Configuration

1. Go to: **Settings** → **Auth** → **URL Configuration**
2. Verify **Site URL** is set correctly:
   - Production: `https://your-domain.com`
   - Development: `http://localhost:3001` (for web app) or `http://localhost:3000` (for admin)
3. Check **Redirect URLs** include:
   - `/reset-password` or `/set-password`
   - Your actual domain

**If Site URL is wrong:**
- Email links might not work
- But email should still be sent

---

## Step 8: Check Spam Folder

1. Check **Inbox** first
2. Check **Spam/Junk** folder
3. Check **Promotions** tab (Gmail)
4. Search for: `hello@zumbaton.sg` or `Zumbaton`

**If email is in spam:**
- Mark as "Not Spam"
- Add `hello@zumbaton.sg` to contacts
- This is normal for first-time emails

---

## Step 9: Check Rate Limits

Gmail/Google Workspace has sending limits:

- **Free Gmail**: 500 emails/day
- **Google Workspace**: 2,000 emails/day (Starter) or 10,000/day (Business)

**If you hit the limit:**
- Wait 24 hours
- Or upgrade your Google Workspace plan

---

## Step 10: Verify SMTP Credentials

Double-check your SMTP settings:

```
Host: smtp.gmail.com
Port: 587 (TLS) or 465 (SSL)
Username: hello@zumbaton.sg
Password: [16-character app-specific password, no spaces]
Sender email: hello@zumbaton.sg
Sender name: Zumbaton
```

**Common mistakes:**
- Using regular password instead of app-specific password
- Wrong host (should be `smtp.gmail.com`, not `smtp.google.com`)
- Wrong port (587 for TLS, 465 for SSL)
- Spaces in app-specific password

---

## Quick Diagnostic Checklist

Run through this checklist:

- [ ] SMTP toggle is **ON** in Supabase
- [ ] All SMTP fields are filled
- [ ] App-specific password is generated and correct
- [ ] Email address exists in Supabase Auth Users
- [ ] No errors in Supabase Auth Logs
- [ ] Checked spam folder
- [ ] Site URL is configured correctly
- [ ] Email template exists and is valid
- [ ] Test email from Supabase dashboard works
- [ ] Not hitting Gmail rate limits

---

## Next Steps

1. **Check Supabase Auth Logs first** - This will tell you exactly what's wrong
2. **Send test email from dashboard** - This tests SMTP directly
3. **Verify email exists in system** - Create test user if needed
4. **Check all settings** - Go through the checklist above

---

## Still Not Working?

If you've checked everything and it's still not working:

1. **Screenshot the error from Auth Logs** (if any)
2. **Screenshot SMTP Settings** (hide password)
3. **Check browser console** for any errors
4. **Try a different email address** (in case the first one has issues)

---

## Alternative: Use Supabase Default Email Service

If SMTP continues to have issues, you can temporarily use Supabase's default service:

1. Go to: **Settings** → **Auth** → **SMTP Settings**
2. Turn **OFF** "Enable custom SMTP"
3. Emails will come from `noreply@mail.app.supabase.io`
4. Check spam folder for emails from that address

This will help you verify the rest of the system works, then you can fix SMTP separately.

