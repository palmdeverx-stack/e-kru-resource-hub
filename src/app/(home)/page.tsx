import type { Metadata } from 'next';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  verifyAppToken,
  ACCESS_TOKEN_COOKIE,
} from 'src/lib/auth-token';

import { MarketplaceCatalogView } from 'src/sections/marketplace/catalog/view/catalog-view';

// ----------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'eKru Marketplace | สื่อการสอนจากครูเพื่อครู',
  description: 'ค้นหา ซื้อ และขายสื่อการสอนคุณภาพจากครูและนักสร้างสรรค์ทั่วประเทศ',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const caller = token ? verifyAppToken(token) : null;

  if (preview !== '1' && caller?.role === 'master_admin') {
    redirect('/dashboard');
  }

  if (preview !== '1' && caller) {
    const { data: seller } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('id')
      .eq('owner_id', caller.sub)
      .maybeSingle();
    if (seller) redirect('/dashboard');
  }

  return <MarketplaceCatalogView />;
}
