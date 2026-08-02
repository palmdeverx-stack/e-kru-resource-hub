import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('marketplace_seller_badge_settings')
    .select(
      'badge_key,label_th,label_en,description_th,description_en,icon_key,color,evaluation_days,criteria,priority'
    )
    .eq('is_enabled', true)
    .order('priority');

  if (error) {
    return NextResponse.json(
      { message: 'โหลดข้อมูล Badge ไม่สำเร็จ', badges: [] },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { badges: data ?? [] },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
