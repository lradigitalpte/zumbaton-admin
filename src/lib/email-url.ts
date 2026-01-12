/**
 * Helper function to get the web app URL for email API calls
 * In production, defaults to https://zumbaton.sg
 * In development, defaults to http://localhost:3000
 */
export function getWebAppUrl(): string {
  let webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL
  
  if (!webAppUrl) {
    // Default to production URL if not set
    webAppUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://zumbaton.sg'
  } else if (webAppUrl.includes('localhost') && process.env.NODE_ENV !== 'development') {
    // If somehow localhost is set in production, override it
    console.warn('[EmailURL] Overriding localhost web app URL in production, using https://zumbaton.sg')
    webAppUrl = 'https://zumbaton.sg'
  }
  
  return webAppUrl
}
