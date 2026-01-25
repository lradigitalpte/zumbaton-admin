/**
 * Helper function to get the web app URL for email API calls
 * Priority order:
 * 1. NEXT_PUBLIC_WEB_APP_URL (main variable set in Vercel)
 * 2. NEXT_PUBLIC_WEB_URL (alternative name)
 * 3. NEXT_PUBLIC_APP_URL (fallback)
 * 4. https://zumbaton.sg (production default)
 * 5. http://localhost:3000 (development only)
 * 
 * CRITICAL: Must set NEXT_PUBLIC_WEB_APP_URL in Vercel environment variables!
 * Without it, production emails will contain localhost URLs.
 * 
 * Note: This should return the WEB app URL (zumbaton.sg), not the admin app URL (admin.zumbaton.sg)
 */
export function getWebAppUrl(): string {
  // Try multiple sources for the web app URL
  let webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || 
                  process.env.NEXT_PUBLIC_WEB_URL ||
                  process.env.NEXT_PUBLIC_APP_URL
  
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
      } else if (webAppUrl.includes('localhost') || webAppUrl.includes('3000') || webAppUrl.includes('3001')) {
        // If somehow localhost/dev port is set in production, override it
        console.error('[EmailURL] CRITICAL: Localhost/dev URL detected in production! Got:', webAppUrl)
        console.error('[EmailURL] Please set NEXT_PUBLIC_WEB_APP_URL=https://zumbaton.sg in Vercel environment')
        webAppUrl = 'https://zumbaton.sg'
      }
    }
  }
  
  return webAppUrl
}
