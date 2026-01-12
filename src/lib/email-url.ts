/**
 * Helper function to get the web app URL for email API calls
 * In production, defaults to https://zumbaton.sg
 * In development, defaults to http://localhost:3000
 * 
 * Note: This should return the WEB app URL (zumbaton.sg), not the admin app URL (admin.zumbaton.sg)
 */
export function getWebAppUrl(): string {
  let webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL
  
  if (!webAppUrl) {
    // Default to production URL if not set
    webAppUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://zumbaton.sg'
  } else {
    // Validate and fix common mistakes
    if (process.env.NODE_ENV !== 'development') {
      // In production, ensure we're using the web app URL, not admin URL
      if (webAppUrl.includes('admin.zumbaton.sg') || webAppUrl.includes('/admin')) {
        console.warn('[EmailURL] Detected admin URL, overriding to use web app URL: https://zumbaton.sg')
        webAppUrl = 'https://zumbaton.sg'
      } else if (webAppUrl.includes('localhost')) {
        // If somehow localhost is set in production, override it
        console.warn('[EmailURL] Overriding localhost web app URL in production, using https://zumbaton.sg')
        webAppUrl = 'https://zumbaton.sg'
      }
    }
  }
  
  return webAppUrl
}
