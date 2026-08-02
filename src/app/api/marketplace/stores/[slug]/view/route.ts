import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

type Context = { params: Promise<{ slug: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;

  const caller = requireAuthenticated(request);
  const body = await request.json().catch(() => null);
  const visitorId = String(body?.visitorId ?? '');
  if (!caller && !UUID_PATTERN.test(visitorId)) {
    return NextResponse.json({ message: 'ข้อมูลผู้เข้าชมไม่ถูกต้อง' }, { status: 400 });
  }

  const { slug } = await params;
  const identifier = decodeURIComponent(slug);
  let sellerQuery = supabaseAdmin
    .from('marketplace_sellers')
    .select('id,owner_id')
    .eq('status', 'active');
  sellerQuery = UUID_PATTERN.test(identifier)
    ? sellerQuery.eq('id', identifier)
    : sellerQuery.eq('slug', identifier);
  const { data: seller } = await sellerQuery.maybeSingle();
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  if (caller?.sub === seller.owner_id) {
    const { count } = await supabaseAdmin
      .from('marketplace_store_views')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', seller.id);
    return NextResponse.json({ views: count ?? 0, counted: false });
  }

  const subject = caller?.sub ?? visitorId;
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-store-view',
      subject,
      maxAttempts: 60,
      windowSeconds: 60,
    }))
  ) {
    return NextResponse.json({ message: 'บันทึกการเข้าชมบ่อยเกินไป' }, { status: 429 });
  }

  const { error } = await supabaseAdmin.from('marketplace_store_views').upsert(
    {
      seller_id: seller.id,
      visitor_key: caller ? `user:${caller.sub}` : `guest:${visitorId}`,
      viewer_id: caller?.sub ?? null,
      last_viewed_at: new Date().toISOString(),
    },
    { onConflict: 'seller_id,visitor_key' }
  );
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { count } = await supabaseAdmin
    .from('marketplace_store_views')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', seller.id);
  return NextResponse.json({ views: count ?? 0, counted: true });
}
