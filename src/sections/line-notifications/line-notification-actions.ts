'use client';

// ----------------------------------------------------------------------

export type LineNotificationSettings = {
  integration: {
    channelId: string;
    oaBasicId: string;
    isEnabled: boolean;
    hasChannelSecret: boolean;
    hasAccessToken: boolean;
    notifyAbsent: boolean;
    notifyLeave: boolean;
    notifyLate: boolean;
    notifyClassAbsent: boolean;
    updatedAt: string | null;
  };
  usage: {
    sent: number;
    pending: number;
    failed: number;
    skipped: number;
    limit: number;
    linkedGuardians: number;
  };
  webhookUrl: string;
  recentDeliveries: Array<{
    id: string;
    event_type: 'absent' | 'leave' | 'late' | 'class_absent' | 'announcement';
    status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
    last_error: string | null;
    sent_at: string | null;
    created_at: string;
    guardian: { full_name: string } | Array<{ full_name: string }> | null;
    student:
      | {
          name_prefix: string | null;
          first_name: string | null;
          last_name: string | null;
          username: string;
        }
      | Array<{
          name_prefix: string | null;
          first_name: string | null;
          last_name: string | null;
          username: string;
        }>
      | null;
  }>;
};

export type LineNotificationSettingsInput = {
  channelId: string;
  oaBasicId: string;
  webhookUrl: string;
  channelSecret: string;
  accessToken: string;
  isEnabled: boolean;
  notifyAbsent: boolean;
  notifyLeave: boolean;
  notifyLate: boolean;
  notifyClassAbsent: boolean;
};

export type LineRichMenuLayout = 'one' | 'two' | 'three' | 'six';

export type LineRichMenuAction = {
  label: string;
  type: 'message' | 'uri';
  value: string;
};

export type LineRichMenuStatus = {
  connected: boolean;
  source: 'none' | 'manager' | 'messaging-api';
  richMenu: {
    id: string;
    name: string;
    chatBarText: string;
    selected: boolean;
    size: { width: number; height: number };
    areas: Array<{
      bounds: { x: number; y: number; width: number; height: number };
      action:
        | { type: 'message'; label?: string; text: string }
        | { type: 'uri'; label?: string; uri: string }
        | { type: string; label?: string };
    }>;
  } | null;
};

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? fallback);
  return data;
}

export async function getLineNotificationSettings() {
  const response = await fetch('/api/admin/line-notifications');
  return parse<LineNotificationSettings>(response, 'ไม่สามารถโหลดการตั้งค่า LINE ได้');
}

export async function saveLineNotificationSettings(input: LineNotificationSettingsInput) {
  const response = await fetch('/api/admin/line-notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<{ success: boolean }>(response, 'ไม่สามารถบันทึกการตั้งค่า LINE ได้');
}

export async function testLineConnection() {
  const response = await fetch('/api/admin/line-notifications', { method: 'POST' });
  return parse<{ bot: { displayName?: string; basicId?: string } }>(
    response,
    'ไม่สามารถทดสอบ LINE ได้'
  );
}

export async function getLineRichMenu() {
  const response = await fetch('/api/admin/line-rich-menu');
  return parse<LineRichMenuStatus>(response, 'ไม่สามารถตรวจสอบ Rich Menu ได้');
}

export async function getLineRichMenuImage() {
  const response = await fetch('/api/admin/line-rich-menu?content=1');
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? 'ไม่สามารถโหลดภาพ Rich Menu ได้');
  }
  return response.blob();
}

export async function createLineRichMenu(input: {
  image: File;
  layout: LineRichMenuLayout;
  name: string;
  chatBarText: string;
  selected: boolean;
  actions: LineRichMenuAction[];
}) {
  const formData = new FormData();
  formData.append('image', input.image);
  formData.append('layout', input.layout);
  formData.append('name', input.name);
  formData.append('chatBarText', input.chatBarText);
  formData.append('selected', String(input.selected));
  formData.append('actions', JSON.stringify(input.actions));
  const response = await fetch('/api/admin/line-rich-menu', {
    method: 'POST',
    body: formData,
  });
  return parse<{ success: boolean; richMenuId: string }>(response, 'ไม่สามารถสร้าง Rich Menu ได้');
}

export async function deleteLineRichMenu() {
  const response = await fetch('/api/admin/line-rich-menu', { method: 'DELETE' });
  return parse<{ success: boolean }>(response, 'ไม่สามารถยกเลิก Rich Menu ได้');
}
