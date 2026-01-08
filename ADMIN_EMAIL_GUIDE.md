# Admin Email Sending Guide

## Overview

Admins can send emails to users in several ways:

1. **Automatic emails** - Sent automatically when certain actions occur
2. **Via API** - Call the web app's email API directly
3. **Via helper functions** - Use the `admin-email.ts` helper

## Automatic Admin Emails

These emails are sent automatically when admins perform certain actions:

### 1. Token Adjustment Email
**Trigger**: Admin adjusts a user's token balance
**Location**: `src/services/token.service.ts` - `adminAdjustTokens()`
**Email Type**: `token-adjustment`
**What it includes**:
- Tokens added/removed
- New balance
- Reason for adjustment
- Admin name who made the adjustment

### 2. Admin Created User Email
**Trigger**: Admin creates a new user account
**Location**: `src/services/user.service.ts` - `createUser()`
**Email Type**: `admin-created-user`
**What it includes**:
- Welcome message
- Temporary password (if provided)
- Admin name who created the account
- Sign-in link

## How It Works

### Architecture

```
Admin App → Calls Web App Email API → Web App sends email via SMTP
```

The admin app doesn't have SMTP credentials. Instead, it calls the web app's email API endpoint (`/api/email/send`), which handles the actual email sending.

### Email API Endpoint

**URL**: `https://zumbaton-web.vercel.app/api/email/send`

**Authentication**: Uses `EMAIL_API_SECRET` to authenticate requests

**Request Format**:
```json
{
  "type": "token-adjustment",
  "secret": "your-email-api-secret",
  "data": {
    "userEmail": "user@example.com",
    "userName": "John Doe",
    "tokensChange": 10,
    "newBalance": 15,
    "reason": "Compensation for service issue",
    "adjustedBy": "Admin Name"
  }
}
```

## Available Email Types

| Type | Description | Required Data |
|------|-------------|---------------|
| `welcome` | Welcome email for new users | `userEmail`, `userName` |
| `token-purchase` | Token purchase confirmation | `userEmail`, `userName`, `packageName`, `tokenCount`, `amount`, `currency`, `expiresAt` |
| `token-expiry` | Token expiry warning | `userEmail`, `userName`, `tokensRemaining`, `expiresAt` |
| `class-reminder` | Class reminder (3 hours before) | `userEmail`, `userName`, `className`, `classDate`, `classTime`, `classLocation`, `instructorName?` |
| `booking-confirmation` | Booking confirmation | `userEmail`, `userName`, `className`, `classDate`, `classTime`, `classLocation`, `tokensUsed`, `instructorName?` |
| `token-adjustment` | Token adjustment notification | `userEmail`, `userName`, `tokensChange`, `newBalance`, `reason`, `adjustedBy?` |
| `admin-created-user` | Admin created user welcome | `userEmail`, `userName`, `temporaryPassword?`, `createdBy?` |

## Using the Helper Function

Import and use the helper function:

```typescript
import { sendAdminEmail } from '@/lib/admin-email'

// Send token adjustment email
await sendAdminEmail('token-adjustment', {
  userEmail: 'user@example.com',
  userName: 'John Doe',
  tokensChange: 10,
  newBalance: 15,
  reason: 'Compensation for service issue',
  adjustedBy: 'Admin Name',
})
```

## Manual Email Sending (Future)

For sending custom emails or bulk emails, you can:

1. **Use the API directly** - Call `/api/email/send` with appropriate data
2. **Create a new email type** - Add a new template in `zumbaton-web/src/lib/email-templates.ts` and add it to the API route

## Environment Variables Required

In `zumbaton-admin/.env.local`:

```env
# Web App URL (for calling email API)
NEXT_PUBLIC_WEB_APP_URL=https://zumbaton-web.vercel.app

# Email API Secret (must match web app)
EMAIL_API_SECRET=your-secret-key-here
```

## Testing

### Test Token Adjustment Email

1. Go to Users page in admin app
2. Adjust a user's tokens
3. Check user's email inbox

### Test Admin Created User Email

1. Go to Users page in admin app
2. Create a new user
3. Check user's email inbox (should receive welcome email with temporary password if provided)

## Troubleshooting

### Email Not Sending

1. **Check environment variables** - Verify `NEXT_PUBLIC_WEB_APP_URL` and `EMAIL_API_SECRET` are set
2. **Check web app is accessible** - Verify the web app URL is correct
3. **Check API secret matches** - Must be the same in both apps
4. **Check server logs** - Look for error messages in console

### "Unauthorized" Error

- Verify `EMAIL_API_SECRET` matches in both apps
- Check the secret is set correctly in environment variables

## Future Enhancements

- Custom email templates for admins
- Bulk email sending
- Email scheduling
- Email templates management UI
- Email history/logs

