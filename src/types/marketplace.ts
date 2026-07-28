export type MarketplaceProduct = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  resource_type: 'digital' | 'physical' | 'service';
  price: number;
  currency: string;
  cover_url: string | null;
  file_url?: string | null;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  seller?: {
    id: string;
    display_name: string;
    seller_type: 'teacher' | 'external' | 'organization';
  } | null;
};

export type MarketplaceSeller = {
  id: string;
  owner_id: string;
  owner_role: string;
  seller_type: 'teacher' | 'external' | 'organization';
  display_name: string;
  bio: string | null;
  contact_email: string | null;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  created_at: string;
};
