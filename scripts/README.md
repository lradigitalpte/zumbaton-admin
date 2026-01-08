# SMTP Test Script

This script tests your Gmail/Google Workspace SMTP configuration to verify it's working correctly.

## Installation

First, install the required dependency:

```bash
cd zumbaton-admin
npm install
```

## Usage

### Option 1: Interactive Mode (Recommended)

Run the script and it will prompt you for the password and email:

```bash
node scripts/test-smtp.js
```

The script will:
1. Ask for your SMTP password (app-specific password from Google)
2. Ask for the test email address to send to
3. Test SMTP connection on port 587 (TLS)
4. If that fails, test port 465 (SSL)
5. Send a test email

### Option 2: Environment Variables

You can also set the password and email as environment variables:

**Windows (PowerShell):**
```powershell
$env:SMTP_PASSWORD="your_app_specific_password"
$env:TEST_EMAIL="your-email@example.com"
node scripts/test-smtp.js
```

**Windows (CMD):**
```cmd
set SMTP_PASSWORD=your_app_specific_password
set TEST_EMAIL=your-email@example.com
node scripts/test-smtp.js
```

**Mac/Linux:**
```bash
SMTP_PASSWORD="your_app_specific_password" TEST_EMAIL="your-email@example.com" node scripts/test-smtp.js
```

## What the Script Tests

1. **SMTP Connection**: Verifies you can connect to `smtp.gmail.com`
2. **Authentication**: Tests your credentials (username and app-specific password)
3. **Email Sending**: Actually sends a test email to verify everything works

## Expected Output

### Success:
```
✅ SUCCESS! SMTP is working correctly on port 587 (TLS)

📧 Check your inbox at: your-email@example.com
   (Also check spam folder if not in inbox)
```

### Failure:
The script will show detailed error messages and suggest fixes.

## Troubleshooting

If the test fails:

1. **"Authentication failed"**
   - Make sure you're using an **app-specific password**, not your regular Gmail password
   - Generate a new app-specific password: https://myaccount.google.com/apppasswords
   - Remove spaces when entering the password

2. **"Connection timeout"**
   - Check your firewall settings
   - Try port 465 (SSL) instead of 587 (TLS)

3. **"Invalid credentials"**
   - Verify 2-Step Verification is enabled on your Google account
   - Regenerate the app-specific password

## Notes

- The script uses the same SMTP settings as Supabase:
  - Host: `smtp.gmail.com`
  - Username: `hello@zumbaton.sg`
  - Port: 587 (TLS) or 465 (SSL)

- If this script works, your Supabase SMTP configuration should work too!

- The password you enter is only used for testing and is not saved anywhere.
