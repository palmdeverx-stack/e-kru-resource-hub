import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

type SystemSellerDetails = {
  bio?: string | null;
  contactEmail?: string | null;
  displayName?: string | null;
  displayNameEn?: string | null;
};

export async function provisionEkruSystemSeller(
  ownerId: string,
  details: SystemSellerDetails = {}
) {
  const { data: existingSeller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('display_name, display_name_en, bio, contact_email')
    .eq('owner_id', ownerId)
    .maybeSingle();

  let contactEmail = details.contactEmail;
  if (contactEmail === undefined) {
    contactEmail = existingSeller?.contact_email;
    if (contactEmail === undefined) {
      const { data: owner } = await supabaseAdmin
        .from('app_users')
        .select('email')
        .eq('id', ownerId)
        .maybeSingle();
      contactEmail = owner?.email ?? null;
    }
  }

  return supabaseAdmin
    .from('marketplace_sellers')
    .upsert(
      {
        owner_id: ownerId,
        owner_role: 'master_admin',
        seller_type: 'company',
        display_name:
          details.displayName === undefined
            ? existingSeller?.display_name || 'eKru'
            : details.displayName?.trim() || 'eKru',
        display_name_en:
          details.displayNameEn === undefined
            ? existingSeller?.display_name_en
            : details.displayNameEn?.trim() || null,
        bio:
          details.bio === undefined
            ? existingSeller?.bio || 'ร้านค้าอย่างเป็นทางการโดยทีมงาน eKru'
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
