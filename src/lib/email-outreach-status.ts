import { getWebAppUrl } from '@/lib/email-url'

export function getEmailOutreachStatus() {
  const webAppUrl = getWebAppUrl()
  const hasWebAppUrl = Boolean(webAppUrl)
  const hasApiSecret = Boolean(process.env.EMAIL_API_SECRET)
  const configured = hasWebAppUrl && hasApiSecret

  return {
    configured,
    hasWebAppUrl,
    hasApiSecret,
    webAppUrl,
    message: configured
      ? 'Ready — follow-up emails send via your web app Resend account'
      : 'Missing EMAIL_API_SECRET or web app URL in admin environment',
  }
}
