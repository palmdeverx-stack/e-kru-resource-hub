import "server-only";

import { supabaseAdmin } from 'src/lib/supabase-admin';

type SystemSellerDetails = {
  bio?: string | null;
  contactEmail?: string | null;
};

export async function provisionEkruSystemSeller(
  ownerId: string,
  details: SystemSellerDetails = {}
) {
  let contactEmail = details.contactEmail;
  if (contactEmail === undefined) {
    const { data: owner } = await supabaseAdmin
      .from('app_users')
      .select('email')
      .eq('id', ownerId)
      .maybeSingle();
    contactEmail = owner?.email ?? null;
  }

  return supabaseAdmin
    .from('marketplace_sellers')
    .upsert(
      {
        owner_id: ownerId,
        owner_role: 'master_admin',
        seller_type: 'company',
        display_name: 'eKru',
        bio:
          details.bio === undefined
            ? 'ร้านค้าอย่างเป็นทางการโดยทีมงาน eKru'
            : details.bio || null,
        contact_email: contactEmail || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' }
    )
    .select('*')
    .single();
}
