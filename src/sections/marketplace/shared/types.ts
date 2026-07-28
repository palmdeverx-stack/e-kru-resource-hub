export type SellerType =
  | 'individual'
  | 'teacher'
  | 'school'
  | 'company'
  | 'publisher'
  | 'university';
export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';
export type ResourceType = 'digital' | 'physical' | 'service';

export type MarketplaceCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MarketplaceMediaType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  delivery_mode: ResourceType;
  sort_order: number;
  is_active: boolean;
};

export type MarketplaceSaleType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  pricing_mode: 'free' | 'paid';
  sort_order: number;
  is_active: boolean;
};

export type MarketplaceSeller = {
  id: string;
  owner_id: string;
  owner_role: string;
  seller_type: SellerType;
  display_name: string;
  display_name_en?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  bio: string | null;
  contact_email: string | null;
  seller_name?: string | null;
  phone?: string | null;
  national_tax_id?: string | null;
  company_name?: string | null;
  company_registration_no?: string | null;
  company_tax_id?: string | null;
  wizard_step?: number;
  seller_agreement_accepted_at?: string | null;
  copyright_confirmed_at?: string | null;
  fee_agreement_accepted_at?: string | null;
  pdpa_accepted_at?: string | null;
  status: 'draft' | 'pending' | 'active' | 'suspended' | 'rejected';
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  documents?: MarketplaceSellerDocument[];
  payout_account?: {
    bank_code: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    promptpay_id: string | null;
  } | null;
};

export type MarketplaceSellerDocument = {
  id: string;
  document_type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  url: string | null;
};

export type MarketplaceProduct = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  media_type_id?: string | null;
  sale_type_id?: string | null;
  resource_type: ResourceType;
  price: number;
  currency: string;
  cover_url: string | null;
  file_url?: string | null;
  status: ProductStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  seller?: Pick<MarketplaceSeller, 'id' | 'display_name' | 'seller_type'> | null;
  media_type?: Pick<MarketplaceMediaType, 'id' | 'name' | 'delivery_mode'> | null;
  sale_type?: Pick<MarketplaceSaleType, 'id' | 'name' | 'pricing_mode'> | null;
};

export type CartItem = {
  product: MarketplaceProduct;
  quantity: number;
};

export type MarketplaceOrder = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status:
    | 'pending'
    | 'pending_payment'
    | 'payment_review'
    | 'payment_rejected'
    | 'paid'
    | 'completed'
    | 'cancelled'
    | 'refunded';
  total: number;
  gross_amount?: number;
  commission_rate?: number;
  platform_fee?: number;
  seller_net?: number;
  payment_session_id?: string | null;
  currency: string;
  created_at: string;
  seller?: Pick<MarketplaceSeller, 'id' | 'display_name'> | null;
  items?: Array<{
    id: string;
    product_id: string;
    title: string;
    unit_price: number;
    quantity: number;
    product?: Pick<MarketplaceProduct, 'file_url' | 'cover_url' | 'resource_type'> | null;
  }>;
};

export type MarketplacePaymentSession = {
  id: string;
  buyer_id: string;
  amount: number;
  currency: string;
  payment_method: 'promptpay' | 'stripe' | 'free';
  status: 'pending_payment' | 'payment_review' | 'verified' | 'rejected' | 'expired';
  account_name_snapshot: string | null;
  slip_file_name: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  bank_transaction_reference: string | null;
  stripe_checkout_url?: string | null;
  stripe_payment_intent_id?: string | null;
  processor_fee?: number;
  expires_at: string;
  created_at: string;
  promptpayPayload?: string | null;
  slipUrl?: string | null;
  orders?: MarketplaceOrder[];
};

export type MarketplaceFinanceSettings = {
  promptpayId: string;
  promptpayAccountName: string;
  commissionRate: number;
  holdDays: number;
  payoutDay: number;
  minimumPayout: number;
  stripeEnabled: boolean;
  stripeConfigured: boolean;
  stripeWebhookUrl: string;
  isActive: boolean;
};

export type ProductInput = {
  title: string;
  description: string;
  category: string;
  mediaTypeId: string;
  saleTypeId: string;
  price: number;
  coverUrl?: string;
  fileUrl?: string;
};
