'use client';

export type MarketplaceLineSettings = {
  integration: {
    channelId: string;
    oaBasicId: string;
    isEnabled: boolean;
    hasChannelSecret: boolean;
    hasAccessToken: boolean;
    notifyNewSeller: boolean;
    notifyProductApproval: boolean;
    allowSellerNotifications: boolean;
    lineDisplayName: string | null;
    lineLinkedAt: string | null;
  };
  webhookUrl: string;
  invitation: {
    code: string;
    expiresAt: string;
    lineUrl: string | null;
  } | null;
  quota: {
    type: 'none' | 'limited' | 'unavailable';
    limit: number | null;
    used: number;
    remaining: number | null;
    error: string | null;
  };
  recentDeliveries: Array<{
    id: string;
    event_type: 'new_seller' | 'product_approval';
    status: 'sent' | 'failed' | 'skipped';
    last_error: string | null;
    created_at: string;
    sent_at: string | null;
  }>;
};

export type MarketplaceLineSettingsInput = {
  channelId: string;
  oaBasicId: string;
  webhookUrl: string;
  channelSecret: string;
  accessToken: string;
  isEnabled: boolean;
  notifyNewSeller: boolean;
  notifyProductApproval: boolean;
  allowSellerNotifications: boolean;
};

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message ?? fallback);
  return result as T;
}

const endpoint = '/api/marketplace/admin/line-settings';

export async function getMarketplaceLineSettings() {
  return parse<MarketplaceLineSettings>(
    await fetch(endpoint),
    'ไม่สามารถโหลดการตั้งค่า LINE Marketplace ได้'
  );
}

export async function saveMarketplaceLineSettings(input: MarketplaceLineSettingsInput) {
  return parse<{ success: boolean; requiresLineLink?: boolean; message?: string }>(
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    'ไม่สามารถบันทึกการตั้งค่า LINE Marketplace ได้'
  );
}

export async function createMarketplaceLineInvitation() {
  return parse<{ invitation: MarketplaceLineSettings['invitation'] }>(
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invite' }),
    }),
    'ไม่สามารถสร้างรหัสผูก LINE ได้'
  );
}

export async function testMarketplaceLineConnection() {
  return parse<{ success: boolean }>(
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' }),
    }),
    'ไม่สามารถส่งข้อความทดสอบได้'
  );
}

export async function unlinkMarketplaceLine() {
  return parse<{ success: boolean }>(
    await fetch(endpoint, { method: 'DELETE' }),
    'ไม่สามารถยกเลิกการผูก LINE ได้'
  );
}
