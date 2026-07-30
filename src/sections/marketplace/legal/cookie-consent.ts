export const COOKIE_CONSENT_NAME = 'ekru_cookie_consent';
export const COOKIE_CONSENT_EVENT = 'ekru-cookie-consent-change';
export const OPEN_COOKIE_SETTINGS_EVENT = 'ekru-open-cookie-settings';

export type CookieConsentChoice = 'all' | 'necessary';

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_NAME}=`))
    ?.split('=')[1];
  return value === 'all' || value === 'necessary' ? value : null;
}

export function writeCookieConsent(choice: CookieConsentChoice) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_CONSENT_NAME}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: choice }));
}

export function hasAnalyticsConsent() {
  return readCookieConsent() === 'all';
}
