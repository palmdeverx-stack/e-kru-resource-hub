import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';
import { decryptLineCredential } from 'src/lib/line-credentials';

// ----------------------------------------------------------------------

type RichMenuLayout = 'one' | 'two' | 'three' | 'six';
type RichMenuAction = {
  label: string;
  type: 'message' | 'uri';
  value: string;
};

const LINE_API = 'https://api.line.me/v2/bot';
const LINE_DATA_API = 'https://api-data.line.me/v2/bot';

async function authorize(request: Request) {
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) return null;
  if (!(await schoolHasFeature(caller.schoolId, 'admin.line_notifications'))) return null;

  const { data: integration } = await supabaseAdmin
    .from('school_line_integrations')
    .select('channel_access_token_encrypted')
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (!integration?.channel_access_token_encrypted) return { caller, accessToken: null };

  try {
    return {
      caller,
      accessToken: decryptLineCredential(integration.channel_access_token_encrypted),
    };
  } catch {
    return { caller, accessToken: null };
  }
}

function authHeaders(accessToken: string, contentType?: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

async function lineError(response: Response, fallback: string) {
  const result = await response.json().catch(() => null);
  const details = Array.isArray(result?.details)
    ? result.details
        .map((item: { message?: string }) => item.message)
        .filter(Boolean)
        .join(', ')
    : '';
  return details || result?.message || fallback;
}

function richMenuSize(layout: RichMenuLayout) {
  return layout === 'six' ? { width: 2500, height: 1686 } : { width: 2500, height: 843 };
}

function richMenuBounds(layout: RichMenuLayout) {
  if (layout === 'one') {
    return [{ x: 0, y: 0, width: 2500, height: 843 }];
  }
  if (layout === 'two') {
    return [
      { x: 0, y: 0, width: 1250, height: 843 },
      { x: 1250, y: 0, width: 1250, height: 843 },
    ];
  }
  const columns = [
    { x: 0, width: 834 },
    { x: 834, width: 833 },
    { x: 1667, width: 833 },
  ];
  if (layout === 'three') {
    return columns.map((column) => ({ ...column, y: 0, height: 843 }));
  }
  return [0, 843].flatMap((y) => columns.map((column) => ({ ...column, y, height: 843 })));
}

function validActions(value: unknown, expectedCount: number): value is RichMenuAction[] {
  return (
    Array.isArray(value) &&
    value.length === expectedCount &&
    value.every(
      (action) =>
        action &&
        typeof action.label === 'string' &&
        action.label.trim().length > 0 &&
        action.label.trim().length <= 20 &&
        (action.type === 'message' || action.type === 'uri') &&
        typeof action.value === 'string' &&
        action.value.trim().length > 0 &&
        (action.type === 'message'
          ? action.value.trim().length <= 300
          : action.value.trim().length <= 1000 && /^https:\/\//i.test(action.value.trim()))
    )
  );
}

function actionPayload(action: RichMenuAction) {
  return action.type === 'message'
    ? {
        type: 'message',
        label: action.label.trim(),
        text: action.value.trim(),
      }
    : {
        type: 'uri',
        label: action.label.trim(),
        uri: action.value.trim(),
      };
}

async function getDefaultRichMenu(accessToken: string) {
  const defaultResponse = await fetch(`${LINE_API}/user/all/richmenu`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  if (defaultResponse.status === 404) {
    return { source: 'none' as const, richMenu: null };
  }
  if (defaultResponse.status === 403) {
    return { source: 'manager' as const, richMenu: null };
  }
  if (!defaultResponse.ok) {
    throw new Error(await lineError(defaultResponse, 'ไม่สามารถตรวจสอบ Rich Menu ได้'));
  }

  const { richMenuId } = (await defaultResponse.json()) as { richMenuId: string };
  const detailResponse = await fetch(`${LINE_API}/richmenu/${encodeURIComponent(richMenuId)}`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  if (!detailResponse.ok) {
    throw new Error(await lineError(detailResponse, 'ไม่สามารถโหลดข้อมูล Rich Menu ได้'));
  }
  const detail = await detailResponse.json();
  return {
    source: 'messaging-api' as const,
    richMenu: {
      id: richMenuId,
      name: detail.name as string,
      chatBarText: detail.chatBarText as string,
      selected: detail.selected as boolean,
      size: detail.size as { width: number; height: number },
      areas: detail.areas as unknown[],
    },
  };
}

export async function GET(request: Request) {
  const access = await authorize(request);
  if (!access) {
    return NextResponse.json({ message: 'แพ็กเกจนี้ไม่รองรับ LINE Rich Menu' }, { status: 403 });
  }
  if (!access.accessToken) {
    return NextResponse.json({
      connected: false,
      source: 'none',
      richMenu: null,
    });
  }

  try {
    const current = await getDefaultRichMenu(access.accessToken);
    if (new URL(request.url).searchParams.get('content') === '1') {
      if (!current.richMenu) {
        return NextResponse.json(
          {
            message:
              current.source === 'manager'
                ? 'ไม่สามารถโหลดภาพเมนูที่สร้างจาก LINE Manager ผ่าน Messaging API'
                : 'ยังไม่ได้ตั้ง Rich Menu',
          },
          { status: 404 }
        );
      }
      const imageResponse = await fetch(
        `${LINE_DATA_API}/richmenu/${encodeURIComponent(current.richMenu.id)}/content`,
        {
          headers: authHeaders(access.accessToken),
          cache: 'no-store',
        }
      );
      if (!imageResponse.ok) {
        return NextResponse.json(
          { message: await lineError(imageResponse, 'ไม่สามารถโหลดภาพ Rich Menu ได้') },
          { status: imageResponse.status }
        );
      }
      return new NextResponse(await imageResponse.arrayBuffer(), {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': imageResponse.headers.get('content-type') ?? 'image/png',
        },
      });
    }
    return NextResponse.json({ connected: true, ...current });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถตรวจสอบ Rich Menu ได้' },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const access = await authorize(request);
  if (!access?.accessToken) {
    return NextResponse.json(
      { message: 'กรุณาบันทึก Channel access token ก่อนเชื่อม Rich Menu' },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const image = formData.get('image');
  const rawLayout = formData.get('layout');
  const layout: RichMenuLayout =
    rawLayout === 'one' || rawLayout === 'two' || rawLayout === 'six' ? rawLayout : 'three';
  const name = typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : '';
  const chatBarText =
    typeof formData.get('chatBarText') === 'string'
      ? String(formData.get('chatBarText')).trim()
      : '';
  const selected = formData.get('selected') !== 'false';
  let actions: unknown = null;
  try {
    actions = JSON.parse(String(formData.get('actions') ?? 'null'));
  } catch {
    actions = null;
  }

  const bounds = richMenuBounds(layout);
  if (
    !(image instanceof File) ||
    !['image/png', 'image/jpeg'].includes(image.type) ||
    image.size === 0 ||
    image.size > 1024 * 1024 ||
    !name ||
    name.length > 300 ||
    !chatBarText ||
    chatBarText.length > 14 ||
    !validActions(actions, bounds.length)
  ) {
    return NextResponse.json(
      { message: 'ข้อมูล Rich Menu หรือรูปภาพไม่ตรงตามข้อกำหนดของ LINE' },
      { status: 400 }
    );
  }

  const richMenuObject = {
    size: richMenuSize(layout),
    selected,
    name,
    chatBarText,
    areas: bounds.map((bound, index) => ({
      bounds: bound,
      action: actionPayload(actions[index]),
    })),
  };

  let richMenuId: string | null = null;
  try {
    const validateResponse = await fetch(`${LINE_API}/richmenu/validate`, {
      method: 'POST',
      headers: authHeaders(access.accessToken, 'application/json'),
      body: JSON.stringify(richMenuObject),
    });
    if (!validateResponse.ok) {
      return NextResponse.json(
        { message: await lineError(validateResponse, 'รูปแบบ Rich Menu ไม่ถูกต้อง') },
        { status: 400 }
      );
    }

    const createResponse = await fetch(`${LINE_API}/richmenu`, {
      method: 'POST',
      headers: authHeaders(access.accessToken, 'application/json'),
      body: JSON.stringify(richMenuObject),
    });
    if (!createResponse.ok) {
      return NextResponse.json(
        { message: await lineError(createResponse, 'LINE ไม่สามารถสร้าง Rich Menu ได้') },
        { status: 400 }
      );
    }
    ({ richMenuId } = (await createResponse.json()) as { richMenuId: string });

    const imageResponse = await fetch(
      `${LINE_DATA_API}/richmenu/${encodeURIComponent(richMenuId)}/content`,
      {
        method: 'POST',
        headers: authHeaders(access.accessToken, image.type),
        body: await image.arrayBuffer(),
      }
    );
    if (!imageResponse.ok) {
      throw new Error(await lineError(imageResponse, 'LINE ไม่สามารถอัปโหลดภาพ Rich Menu ได้'));
    }

    const defaultResponse = await fetch(
      `${LINE_API}/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
      {
        method: 'POST',
        headers: authHeaders(access.accessToken),
      }
    );
    if (!defaultResponse.ok) {
      throw new Error(await lineError(defaultResponse, 'ไม่สามารถตั้ง Rich Menu เป็นค่าเริ่มต้น'));
    }

    return NextResponse.json({ success: true, richMenuId });
  } catch (error) {
    if (richMenuId) {
      await fetch(`${LINE_API}/richmenu/${encodeURIComponent(richMenuId)}`, {
        method: 'DELETE',
        headers: authHeaders(access.accessToken),
      }).catch(() => null);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถเชื่อม Rich Menu ได้' },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  const access = await authorize(request);
  if (!access?.accessToken) {
    return NextResponse.json({ message: 'ยังไม่ได้เชื่อม LINE Official Account' }, { status: 400 });
  }

  try {
    const current = await getDefaultRichMenu(access.accessToken);
    if (current.source === 'manager') {
      return NextResponse.json(
        { message: 'Rich Menu นี้สร้างจาก LINE Official Account Manager กรุณาลบจาก Manager' },
        { status: 409 }
      );
    }
    if (!current.richMenu) return NextResponse.json({ success: true });

    const clearResponse = await fetch(`${LINE_API}/user/all/richmenu`, {
      method: 'DELETE',
      headers: authHeaders(access.accessToken),
    });
    if (!clearResponse.ok) {
      throw new Error(await lineError(clearResponse, 'ไม่สามารถยกเลิก Rich Menu เริ่มต้นได้'));
    }
    const deleteResponse = await fetch(
      `${LINE_API}/richmenu/${encodeURIComponent(current.richMenu.id)}`,
      {
        method: 'DELETE',
        headers: authHeaders(access.accessToken),
      }
    );
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error(await lineError(deleteResponse, 'ยกเลิก Rich Menu แล้ว แต่ลบรายการไม่ได้'));
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถยกเลิก Rich Menu ได้' },
      { status: 502 }
    );
  }
}
