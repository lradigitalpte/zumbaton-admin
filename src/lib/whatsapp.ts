/**
 * WhatsApp Cloud API sender for lead follow-ups.
 * Requires: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 * Optional: WHATSAPP_TEMPLATE_NAME (approved Meta template), WHATSAPP_TEMPLATE_LANGUAGE (default en)
 */

export interface WhatsAppSendResult {
  success: boolean
  messageId?: string
  error?: string
}

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en'

  return { accessToken, phoneNumberId, templateName, templateLanguage }
}

export function isWhatsAppConfigured(): boolean {
  const { accessToken, phoneNumberId, templateName } = getConfig()
  return Boolean(accessToken && phoneNumberId && templateName)
}

export async function sendWhatsAppTemplateMessage(
  toPhone: string,
  leadName: string,
  bodyPreview: string
): Promise<WhatsAppSendResult> {
  const { accessToken, phoneNumberId, templateName, templateLanguage } = getConfig()

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp API not configured (missing token or phone number ID)' }
  }

  if (!templateName) {
    return { success: false, error: 'WhatsApp template not configured (set WHATSAPP_TEMPLATE_NAME)' }
  }

  const digits = toPhone.replace(/\D/g, '')
  if (!digits) {
    return { success: false, error: 'Invalid phone number' }
  }

  const firstName = leadName.trim().split(/\s+/)[0] || 'there'

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: digits,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: firstName }],
              },
            ],
          },
        }),
      }
    )

    const payload = await response.json() as {
      messages?: Array<{ id: string }>
      error?: { message?: string }
    }

    if (!response.ok) {
      return {
        success: false,
        error: payload.error?.message || `WhatsApp API error (${response.status})`,
      }
    }

    return {
      success: true,
      messageId: payload.messages?.[0]?.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WhatsApp send failed',
    }
  }
}

export function getWhatsAppConfigStatus() {
  const { accessToken, phoneNumberId, templateName } = getConfig()
  return {
    configured: isWhatsAppConfigured(),
    hasToken: Boolean(accessToken),
    hasPhoneNumberId: Boolean(phoneNumberId),
    hasTemplate: Boolean(templateName),
  }
}
