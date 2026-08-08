export type MarketplaceLandingBanner = {
  id: string;
  title: string;
  alt_text: string;
  desktop_image_url: string;
  mobile_image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};
