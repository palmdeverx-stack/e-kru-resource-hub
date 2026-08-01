import 'server-only';

import { cache } from 'react';

import { supabaseAdmin } from 'src/lib/supabase-admin';

function publicStorageReference(url: string | null) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const [bucket, ...pathParts] = decodeURIComponent(url.slice(index + marker.length)).split('/');
  const path = pathParts.join('/');
  if (!bucket || !path) return null;
  const extension = path.split('.').at(-1)?.toLowerCase();
  const mimeType =
    extension === 'png'
      ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : 'image/webp';
  return { bucket, path, mimeType };
}

export const getPublicPlatformSettings = cache(async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('marketplace_provider_settings')
      .select(
        'platform_name_th, platform_name_en, brand_name, website_url, production_url, logo_url, transparent_logo_url, favicon_url, og_image_url, official_product_thumbnail_url, primary_color'
      )
      .eq('id', 'default')
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
});

export async function getPlatformBrandAssets() {
  const settings = await getPublicPlatformSettings();
  return {
    platformName:
      settings?.platform_name_th || settings?.platform_name_en || 'E-KRU Marketplace',
    logo: publicStorageReference(settings?.logo_url || settings?.transparent_logo_url || null),
  };
}

export async function getPlatformReceiptProviderSnapshot(issuedBy?: string) {
  const { data, error } = await supabaseAdmin
    .from('marketplace_provider_settings')
    .select(
      'provider_type, first_name, last_name, company_name, tax_id, address, contact_email, contact_phone, document_issuer_name, document_tax_address, signature_url, updated_by'
    )
    .eq('id', 'default')
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const legalName =
    data.provider_type === 'company'
      ? data.company_name?.trim()
      : `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim();
  const signature = publicStorageReference(data.signature_url);
  const issuerId = issuedBy || data.updated_by;
  if (!issuerId) return null;
  return {
    issued_by: issuerId,
    provider_name: data.document_issuer_name?.trim() || legalName || null,
    provider_tax_id: data.tax_id || null,
    provider_address: data.document_tax_address?.trim() || data.address?.trim() || null,
    provider_email: data.contact_email || null,
    provider_phone: data.contact_phone || null,
    provider_signature_bucket: signature?.bucket || null,
    provider_signature_path: signature?.path || null,
    provider_signature_mime_type: signature?.mimeType || null,
  };
}
