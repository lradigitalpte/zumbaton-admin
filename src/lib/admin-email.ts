/**
 * Admin Email Helper
 * Utility functions for admins to send emails via the web app's email API
 */

/**
 * Send an email to a user via the web app's email API
 * 
 * @param type - Email type
 * @param data - Email data
 * @returns Promise with result
 */
export async function sendAdminEmail(
  type: 'welcome' | 'token-purchase' | 'token-expiry' | 'class-reminder' | 'booking-confirmation' | 'token-adjustment' | 'admin-created-user',
  data: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || 'http://localhost:3000'
    const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

    const response = await fetch(`${webAppUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        secret: emailApiSecret,
        data,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send email',
      }
    }

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    console.error('[AdminEmail] Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send a custom email to a user (for future use - when we add custom email templates)
 */
export async function sendCustomEmailToUser(
  userEmail: string,
  userName: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // For now, this would need a new email type in the API
  // Or we could create a generic "custom" email type
  // This is a placeholder for future functionality
  console.warn('[AdminEmail] Custom email sending not yet implemented')
  return {
    success: false,
    error: 'Custom email sending not yet implemented',
  }
}

