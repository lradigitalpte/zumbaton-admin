# SMTP Setup Guide for Supabase
## Using hello@zumbaton.sg with Google Mail Server

This guide will help you configure SMTP in Supabase to send emails using your Google Workspace/Gmail account.

---

## Step 1: Get App-Specific Password from Google

Since you're using Google Mail, you need to create an **App-Specific Password** (not your regular password).

### For Google Workspace (Business Account):

1. Go to your Google Admin Console: https://admin.google.com
2. Navigate to **Security** → **API Controls** → **App passwords**
3. Or go directly to: https://myaccount.google.com/apppasswords
4. Sign in with `hello@zumbaton.sg`
5. Click **"Select app"** → Choose **"Mail"**
6. Click **"Select device"** → Choose **"Other (Custom name)"**
7. Enter name: **"Supabase SMTP"**
8. Click **"Generate"**
9. **Copy the 16-character password** (you'll need this for Supabase)
   - Format: `xxxx xxxx xxxx xxxx` (remove spaces when entering in Supabase)

### For Personal Gmail Account:

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in with your Gmail account
3. If 2-Step Verification is not enabled, enable it first
4. Follow steps 5-9 above

**Important**: 
- You CANNOT use your regular Gmail password
- You MUST use an App-Specific Password
- The password will look like: `abcd efgh ijkl mnop`

---

## Step 2: Configure SMTP in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SMTP Settings**
   - Go to: **Settings** → **Auth** → **SMTP Settings**
   - Or direct link: `https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/auth/smtp`

3. **Enable Custom SMTP**
   - Toggle **"Enable Custom SMTP"** to ON

4. **Enter SMTP Credentials**

   For **Google Workspace/Gmail**, use these settings:

   ```
   Host: smtp.gmail.com
   Port: 587
   Username: hello@zumbaton.sg
   Password: [Your 16-character App-Specific Password - no spaces]
   Sender email: hello@zumbaton.sg
   Sender name: Zumbaton
   ```

   **Security**: 
   - Use **TLS** (Port 587) - this is the default
   - Do NOT use SSL (Port 465) unless TLS doesn't work

5. **Test Connection**
   - Click **"Test SMTP Connection"** or **"Send Test Email"**
   - Enter a test email address (your personal email)
   - Click **"Send Test Email"**
   - Check your inbox for the test email

6. **Save Settings**
   - Click **"Save"** or **"Update"**

---

## Step 3: Configure Email Templates (Optional but Recommended)

1. **Go to Email Templates**
   - Navigate to: **Settings** → **Auth** → **Email Templates**

2. **Customize Templates**
   - You can customize:
     - **Confirm signup** - Email confirmation
     - **Reset password** - Password reset emails
     - **Magic Link** - Magic link login emails
     - **Change email address** - Email change confirmation

3. **Add Your Branding**
   - Use HTML in templates
   - Include your logo, colors, etc.
   - Available variables: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`

---

## Step 4: Set Site URL and Redirect URLs

1. **Go to URL Configuration**
   - Navigate to: **Settings** → **Auth** → **URL Configuration**

2. **Set Site URL**
   - **Site URL**: `https://your-domain.com` (your production domain)
   - For development: `http://localhost:3000`

3. **Add Redirect URLs**
   - Add these redirect URLs:
     ```
     https://your-domain.com/set-password
     https://your-domain.com/auth/callback
     http://localhost:3000/set-password
     http://localhost:3000/auth/callback
     ```

---

## Step 5: Test Email Sending

### Test 1: Password Reset Email

1. Go to your app's forgot password page
2. Enter a valid user email
3. Submit the form
4. Check the email inbox
5. You should receive an email from `hello@zumbaton.sg`

### Test 2: Check Supabase Logs

1. Go to Supabase Dashboard
2. Navigate to: **Logs** → **Auth Logs**
3. Look for email sending events
4. Check for any errors

### Test 3: Send Test Email from Dashboard

1. In **SMTP Settings**, use the **"Send Test Email"** button
2. Enter your email address
3. Click send
4. Check your inbox

---

## Step 6: Verify Email Delivery

### Check Your Inbox

- Check **Inbox** for the test email
- Check **Spam/Junk** folder (sometimes first emails go to spam)
- Check **Promotions** tab (if using Gmail)

### If Email Goes to Spam

1. **Mark as Not Spam** - Move email to inbox and mark as "Not Spam"
2. **Add to Contacts** - Add `hello@zumbaton.sg` to your contacts
3. **Configure SPF/DKIM** (Advanced - for better deliverability)
   - This requires DNS configuration for your domain
   - Contact your domain provider for help

---

## Troubleshooting

### Error: "Authentication failed"

**Possible causes:**
- Wrong password (using regular password instead of app-specific password)
- 2-Step Verification not enabled
- App-specific password not generated correctly

**Solution:**
1. Generate a new app-specific password
2. Make sure you copy it correctly (no spaces)
3. Re-enter in Supabase

### Error: "Connection timeout"

**Possible causes:**
- Firewall blocking port 587
- Wrong SMTP host

**Solution:**
1. Try port 465 with SSL instead
2. Check if your network allows SMTP connections
3. Verify host is `smtp.gmail.com`

### Error: "Email not received"

**Possible causes:**
- Email went to spam
- Wrong email address
- Rate limiting (Gmail free: 500 emails/day)

**Solution:**
1. Check spam folder
2. Verify email address is correct
3. Check Gmail sending limits
4. Check Supabase logs for errors

### Emails Still Coming from noreply@mail.app.supabase.io

**Possible causes:**
- SMTP not properly saved
- SMTP test failed but settings were saved anyway

**Solution:**
1. Go back to SMTP Settings
2. Verify "Enable Custom SMTP" is ON
3. Test connection again
4. Save settings again

---

## Gmail/Google Workspace Limits

### Free Gmail Account:
- **500 emails per day**
- **100 recipients per email**
- Not recommended for production

### Google Workspace (Paid):
- **2,000 emails per day** (Starter plan)
- **10,000 emails per day** (Business plan)
- Better deliverability
- Recommended for production

---

## Next Steps After SMTP Setup

Once SMTP is working, you can:

1. **Test password reset emails** - Users will receive emails from `hello@zumbaton.sg`
2. **Test signup confirmation** - New users will receive confirmation emails
3. **Configure custom notifications** - For token purchases, booking confirmations, etc.

---

## Important Notes

1. **App-Specific Password**: Always use app-specific password, never your regular password
2. **Security**: Keep your app-specific password secure
3. **Rate Limits**: Be aware of Gmail sending limits
4. **Deliverability**: First emails might go to spam - this is normal
5. **Testing**: Always test with a real email address first

---

## Support

If you encounter issues:
1. Check Supabase Dashboard → Logs → Auth Logs
2. Verify app-specific password is correct
3. Test SMTP connection in Supabase dashboard
4. Check Gmail account for any security alerts
5. Review Supabase documentation: https://supabase.com/docs/guides/auth/auth-smtp

---

## For Custom Notifications (Token Purchase, etc.)

**Note**: Supabase SMTP is primarily for **Auth emails** (password reset, signup confirmation, etc.).

For **custom notifications** (like token purchase confirmations), you have two options:

### Option 1: Use Supabase SMTP via API (Recommended)
- Supabase provides email sending API
- Can be used for custom notifications
- Uses the same SMTP settings

### Option 2: Use External Email Service
- Resend, SendGrid, AWS SES, etc.
- Better for high-volume emails
- More features (templates, analytics, etc.)

We'll configure custom notifications after SMTP is working!

