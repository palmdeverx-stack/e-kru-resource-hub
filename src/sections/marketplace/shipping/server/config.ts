import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export type MarketplaceShippingConfig = {
  enabled: boolean;
  officialAccessEnabled: boolean;
  officialEnabled: boolean;
  requestedEnabled: boolean;
  provider: 'shippop';
  environment: 'sandbox' | 'production';
  providerConfigured: boolean;
  webhookUrl?: string;
};

export function isShippopConfigured() {
  return Boolean(
    process.env.SHIPPOP_API_KEY &&
    (process.env.SHIPPOP_ACCOUNT_EMAIL || process.env.SHIPPOP_API_SECRET) &&
    process.env.SHIPPOP_WEBHOOK_SECRET &&
    (process.env.MARKETPLACE_SHIPPING_QUOTE_SECRET || process.env.AUTH_SECRET)
  );
}

export async function getMarketplaceShippingConfig(
  origin?: string
): Promise<MarketplaceShippingConfig> {
  const { data } = await supabaseAdmin
    .from('marketplace_shipping_settings')
    .select('is_enabled, provider, environment')
    .eq('id', 'default')
    .maybeSingle();
  const requestedEnabled = data?.is_enabled === true;
  const providerConfigured = isShippopConfigured();
  const killed = process.env.MARKETPLACE_SHIPPING_KILL_SWITCH === 'true';
  const officialEnabled = providerConfigured && !killed;

  return {
    enabled: requestedEnabled && providerConfigured && !killed,
    officialAccessEnabled: !killed,
    officialEnabled,
    requestedEnabled,
    provider: 'shippop',
    environment: data?.environment === 'production' ? 'production' : 'sandbox',
    providerConfigured,
    ...(origin
      ? {
          webhookUrl: `${origin}/api/marketplace/shipping/webhook/shippop${
            process.env.SHIPPOP_WEBHOOK_SECRET
              ? `?token=${encodeURIComponent(process.env.SHIPPOP_WEBHOOK_SECRET)}`
              : ''
          }`,
        }
      : {}),
  };
}

export async function requireMarketplaceShippingEnabled() {
  const config = await getMarketplaceShippingConfig();
  if (!config.enabled) throw new Error('ระบบจัดส่งยังไม่เปิดใช้งาน');
  return config;
}

export function isMarketplaceShippingEnabledForOfficialSeller(
  config: MarketplaceShippingConfig,
  ownerRole?: string | null
) {
  return config.enabled || (config.officialEnabled && ownerRole === 'master_admin');
}

export function isMarketplaceShippingSetupEnabledForOfficialSeller(
  config: MarketplaceShippingConfig,
  ownerRole?: string | null
) {
  return config.enabled || (config.officialAccessEnabled && ownerRole === 'master_admin');
}
