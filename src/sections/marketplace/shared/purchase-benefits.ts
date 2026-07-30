export const MAX_PURCHASE_BENEFITS_HTML_LENGTH = 30_000;
export const MAX_PURCHASE_BENEFITS_TEXT_LENGTH = 10_000;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function legacyPurchaseBenefitsToHtml(items: string[] = []) {
  const benefits = items.map((item) => item.trim()).filter(Boolean);
  if (!benefits.length) return '';

  return `<ul>${benefits.map((benefit) => `<li><p>${escapeHtml(benefit)}</p></li>`).join('')}</ul>`;
}

export function hasUnsafePurchaseBenefitsHtml(html: string) {
  return (
    /<\s*\/?\s*(script|iframe|object|embed|form|input|button|textarea|select|style|link|meta)\b/i.test(
      html
    ) ||
    /\son[a-z]+\s*=/i.test(html) ||
    /\b(?:javascript|vbscript)\s*:/i.test(html) ||
    /\bdata\s*:\s*text\/html/i.test(html)
  );
}

export function hasPurchaseBenefitsContent(html?: string | null, legacyItems: string[] = []) {
  const text = String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();

  return Boolean(text || legacyItems.some((item) => item.trim()));
}
