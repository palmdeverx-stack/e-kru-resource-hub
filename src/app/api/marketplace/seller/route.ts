import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('owner_id', caller.sub)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ seller });
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const body = await request.json();
  const displayName = String(body.displayName ?? '').trim();
  const bio = String(body.bio ?? '').trim();
  const contactEmail = String(body.contactEmail ?? '').trim();
  const requestedType = String(body.sellerType ?? '');
  const sellerType =
    caller.role === 'teacher'
      ? 'teacher'
      : requestedType === 'organization'
        ? 'organization'
        : 'external';

  if (displayName.length < 2) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อร้านค้าอย่างน้อย 2 ตัวอักษร' },
      { status: 400 }
    );
  }

  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .upsert(
      {
        owner_id: caller.sub,
        owner_role: caller.role,
        seller_type: sellerType,
        display_name: displayName,
        bio: bio || null,
        contact_email: contactEmail || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' }
    )
    .select('*')
    .single();

  if (error || !seller) {
    return NextResponse.json(
      {
        message:
          error?.code === '42P01'
            ? 'ยังไม่ได้ติดตั้ง Marketplace schema ใน Supabase'
            : (error?.message ?? 'ไม่สามารถเปิดร้านค้าได้'),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ seller });
}
