# Supabase Email Configuration Guide

## Overview

The forgot password functionality is now fully implemented and uses **Supabase's built-in email service**. Supabase handles all email sending automatically - you don't need to set up your own email server.

## How It Works

1. **User requests password reset** → Fills out the forgot password form
2. **API sends request to Supabase** → Uses `resetPasswordForEmail()`
3. **Supabase sends email** → Automatically sends password reset email
4. **User clicks link** → Redirects to `/set-password` with reset token
5. **User sets new password** → Password is updated via Supabase

## Supabase Email Configuration

### Default Setup (Free Tier)

Supabase provides a **default email service** that works out of the box:
- ✅ No configuration needed
- ✅ Uses Supabase's email infrastructure
- ✅ Limited to 3 emails per hour per user (free tier)
- ✅ Emails come from `noreply@mail.app.supabase.io`

### Custom Email Setup (Recommended for Production)

For production, you should configure custom SMTP settings:

#### Step 1: Configure SMTP in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Auth** → **SMTP Settings**
3. Enable **Custom SMTP**
4. Enter your SMTP credentials:
   - **Host**: Your SMTP server (e.g., `smtp.gmail.com`, `smtp.sendgrid.net`)
   - **Port**: Usually `587` (TLS) or `465` (SSL)
   - **Username**: Your email address
   - **Password**: Your email password or app-specific password
   - **Sender email**: The email address that will send the emails
   - **Sender name**: Display name (e.g., "Zumbaton")

#### Step 2: Configure Email Templates

1. Go to **Settings** → **Auth** → **Email Templates**
2. Customize the **Reset Password** template:
   - You can use HTML
   - Variables available: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`
   - Default redirect URL: `{{ .SiteURL }}/set-password`

#### Step 3: Set Site URL

1. Go to **Settings** → **Auth** → **URL Configuration**
2. Set **Site URL** to your production domain:
   - Example: `https://admin.zumbaton.com`
3. Add **Redirect URLs**:
   - `https://admin.zumbaton.com/set-password`
   - `http://localhost:3000/set-password` (for development)

### Environment Variables

Make sure your `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=https://your-domain.com  # Optional, for production
```

## Email Service Providers

### Option 1: Gmail (Free, Limited)

- **Host**: `smtp.gmail.com`
- **Port**: `587`
- **Requires**: App-specific password (not regular password)
- **Limits**: 500 emails/day (free account)

### Option 2: SendGrid (Recommended)

- **Free tier**: 100 emails/day
- **Host**: `smtp.sendgrid.net`
- **Port**: `587`
- **Username**: `apikey`
- **Password**: Your SendGrid API key

### Option 3: AWS SES

- **Pay-as-you-go**: Very cheap
- **High deliverability**
- **Requires**: AWS account setup

### Option 4: Mailgun

- **Free tier**: 5,000 emails/month
- **Good deliverability**
- **Easy setup**

## Testing

### Test Password Reset Flow

1. Go to `/forgot-password`
2. Enter a valid user email
3. Check your email inbox (or Supabase logs)
4. Click the reset link
5. Set a new password
6. Sign in with the new password

### Check Email Logs

1. Go to Supabase Dashboard
2. Navigate to **Logs** → **Auth Logs**
3. Look for password reset events

### Development Testing

For local development, Supabase will send emails even to localhost. The reset link will work if:
- Your `NEXT_PUBLIC_APP_URL` is set to `http://localhost:3000`
- Or Supabase redirect URL includes `http://localhost:3000/set-password`

## Troubleshooting

### Emails Not Sending

1. **Check Supabase logs** → Look for email errors
2. **Verify SMTP settings** → Test credentials
3. **Check rate limits** → Free tier has limits
4. **Verify email address** → Must be a valid user email

### Reset Link Not Working

1. **Check redirect URL** → Must match Supabase configuration
2. **Check token expiration** → Links expire after 1 hour (default)
3. **Verify Site URL** → Must match your domain

### Email Going to Spam

1. **Configure SPF/DKIM** → For custom domains
2. **Use reputable email service** → SendGrid, AWS SES, etc.
3. **Warm up domain** → Gradually increase email volume

## Security Notes

- ✅ Password reset links expire after 1 hour (configurable)
- ✅ Links can only be used once
- ✅ Supabase validates tokens server-side
- ✅ No email enumeration (always returns success)
- ✅ Rate limiting prevents abuse

## Next Steps

1. ✅ Forgot password is implemented
2. ✅ Email sending works with Supabase default service
3. 🔄 Configure custom SMTP for production (recommended)
4. 🔄 Customize email templates with your branding
5. 🔄 Set up proper Site URL for production

## Support

If you encounter issues:
1. Check Supabase dashboard logs
2. Verify environment variables
3. Test SMTP credentials separately
4. Review Supabase documentation: https://supabase.com/docs/guides/auth/auth-email

