/** Normalize phone for wa.me links (Singapore-friendly). */
export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("65") && digits.length >= 10) return digits
  if (digits.length === 8 && /^[89]/.test(digits)) return `65${digits}`
  return digits
}

export function waMeUrl(phone: string, text?: string): string {
  const normalized = normalizeWhatsAppPhone(phone)
  if (!normalized) return ""
  const base = `https://wa.me/${normalized}`
  if (!text?.trim()) return base
  return `${base}?text=${encodeURIComponent(text)}`
}
