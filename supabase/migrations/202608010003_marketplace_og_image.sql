-- Replace the former Class Go social preview with the E-KRU Marketplace artwork.
-- The versioned Cloudinary URL gives social crawlers a distinct image cache key.
update public.marketplace_provider_settings
set
  og_image_url =
    'https://res.cloudinary.com/dkdbilwtj/image/upload/v1785509072/marketplace_ahtoum.png',
  updated_at = now()
where
  id = 'default'
  and (
    og_image_url is null
    or og_image_url =
      'https://tajovpzrhynoawxmcxcy.supabase.co/storage/v1/object/public/marketplace-platform-assets/og-image/d5437470-fe69-4152-8f0d-0cdba6f6ac9a.webp'
  );
