'use client';

import { useTranslate } from 'src/locales';

import { formatPrice } from './api';

/** Localizes dashboard copy while keeping user-entered content unchanged. */
export function useDashboardLocale() {
  const { t, currentLang } = useTranslate('marketplace');
  const locale = currentLang.numberFormat.code;
  const tx = (text: string, values?: Record<string, unknown>) =>
    t(`dashboardText.${text}`, { ...values, nsSeparator: false, defaultValue: text });
  const money = (amount: number, currency = 'THB') => formatPrice(amount, currency, locale);

  return { tx, locale, money };
}
