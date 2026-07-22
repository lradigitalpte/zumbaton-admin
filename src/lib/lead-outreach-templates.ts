export type OutreachChannel = 'email' | 'whatsapp'

export const DEFAULT_EMAIL_SUBJECT = 'Thanks for your interest in One Step Fitness!'

export const DEFAULT_EMAIL_BODY = `Hi {{name}},

Thank you for reaching out to One Step Fitness! We'd love to help you get started with Zumba and fitness classes.

Reply to this email or WhatsApp us to book your trial class.

See you on the dance floor!
One Step Fitness Team`

export const DEFAULT_WHATSAPP_BODY = `Hi {{name}}, thanks for your interest in One Step Fitness! We'd love to help you book a trial class. Reply here anytime.`

export function renderTemplate(template: string, vars: { name: string }): string {
  const firstName = vars.name.trim().split(/\s+/)[0] || 'there'
  return template
    .replaceAll('{{name}}', vars.name || 'there')
    .replaceAll('{{first_name}}', firstName)
}

export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">${escaped.replace(/\n/g, '<br>')}</div>`
}
