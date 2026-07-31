export type SellerType =
  | 'individual'
  | 'teacher'
  | 'school'
  | 'company'
  | 'publisher'
  | 'university';
export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';
export type ResourceType = 'digital' | 'physical' | 'service' | 'feature_unlock';

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

export type MarketplaceGradeLevel = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type MarketplaceCurriculum = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type MarketplaceTag = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type MarketplaceSubjectOption = {
  value: string;
  label: string;
  group: 'รายวิชาในระบบ' | 'กลุ่มสาระการเรียนรู้';
  code: string | null;
};

export type MarketplaceSubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  plan_scope: 'school' | 'individual';
  billing_cycle: 'monthly' | 'yearly' | 'custom';
  price: number;
  currency: string;
  max_school_admins: number;
  max_teachers: number;
  max_students: number;
  max_line_notifications: number;
  enabled_features: string[];
  is_active: boolean;
};

export type MarketplaceProductImage = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  position: number;
  is_cover: boolean;
  url: string;
};

export type MarketplaceProductFile = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  position: number;
  is_preview: boolean;
  url: string;
};

export type MarketplaceProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  images: Array<{ id: string; url: string }>;
  reply: {
    id: string;
    responder_name: string;
    comment: string;
    created_at: string;
    updated_at: string;
  } | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceProductEngagement = {
  views: number;
  likes: number;
  purchases: number;
  downloads: number;
  reviewCount: number;
  averageRating: number;
  reviews: MarketplaceProductReview[];
  canReview: boolean;
  canReply: boolean;
  myReview: MarketplaceProductReview | null;
};

export type MarketplaceProductPurchaseAccess = {
  canPurchase: boolean;
  hasPurchased: boolean;
  accessExpiresAt: string | null;
  message: string | null;
};

export type MarketplaceSchoolLicense = {
  id: string;
  school_id: string;
  product_id: string;
  order_id: string;
  license_scope: 'school' | 'teacher';
  feature_keys: string[];
  seat_count: number;
  starts_at: string;
  expires_at: string;
  status: 'active' | 'renewed' | 'expired' | 'disputed' | 'revoked' | 'refunded';
  grants_plan_code?: string | null;
  max_teachers?: number | null;
  max_students?: number | null;
  max_school_admins?: number | null;
  line_quota?: number | null;
  product?: Pick<MarketplaceProduct, 'id' | 'title'> | null;
  assignments?: Array<{
    id: string;
    teacher_id: string;
    assigned_at: string;
  }>;
};

export type MarketplaceLicenseTeacher = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
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
  profile_completion?: number;
  is_system_store?: boolean;
  bio: string | null;
  contact_email: string | null;
  seller_name?: string | null;
  phone?: string | null;
  national_tax_id?: string | null;
  company_name?: string | null;
  company_registration_no?: string | null;
  company_tax_id?: string | null;
  business_address?: string | null;
  wizard_step?: number;
  seller_agreement_accepted_at?: string | null;
  copyright_confirmed_at?: string | null;
  fee_agreement_accepted_at?: string | null;
  pdpa_accepted_at?: string | null;
  commission_rate_override?: number | null;
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
    is_verified?: boolean;
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

export type MarketplaceProductLink = {
  label: string;
  url: string;
};

export type MarketplaceProduct = {
  id: string;
  seller_id: string;
  title: string;
  title_en?: string | null;
  description: string;
  description_en?: string | null;
  short_description?: string | null;
  short_description_en?: string | null;
  subject_label?: string | null;
  curriculum_id?: string | null;
  wizard_step?: number;
  category: string;
  media_type_id?: string | null;
  sale_type_id?: string | null;
  resource_type: ResourceType;
  grants_feature_key?: string | null;
  grants_feature_keys?: string[];
  grants_plan_code?: string | null;
  grant_duration_days?: number | null;
  license_scope?: 'individual' | 'school' | 'teacher';
  license_seat_count?: number;
  license_max_teachers?: number | null;
  license_max_students?: number | null;
  license_max_school_admins?: number | null;
  license_line_quota?: number | null;
  price: number;
  list_price?: number | null;
  currency: string;
  cover_url: string | null;
  file_url?: string | null;
  external_links?: MarketplaceProductLink[];
  purchase_benefits?: string[];
  purchase_benefits_html?: string | null;
  status: ProductStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  purchase_count?: number;
  has_order_references?: boolean;
  has_deal_references?: boolean;
  can_delete?: boolean;
  can_hide?: boolean;
  created_at: string;
  seller?:
    | (Pick<MarketplaceSeller, 'id' | 'display_name' | 'seller_type' | 'slug' | 'logo_url'> &
        Partial<
          Pick<
            MarketplaceSeller,
            'display_name_en' | 'bio' | 'profile_completion' | 'is_system_store'
          >
        >)
    | null;
  media_type?: Pick<MarketplaceMediaType, 'id' | 'name' | 'delivery_mode'> | null;
  sale_type?: Pick<MarketplaceSaleType, 'id' | 'name' | 'pricing_mode'> | null;
  curriculum?: Pick<MarketplaceCurriculum, 'id' | 'name'> | null;
  grade_levels?: Array<{ grade_level: Pick<MarketplaceGradeLevel, 'id' | 'name'> }>;
  tags?: Array<{ tag: Pick<MarketplaceTag, 'id' | 'name'> }>;
  images?: MarketplaceProductImage[];
  files?: MarketplaceProductFile[];
  engagement?: MarketplaceProductEngagement;
  purchase_access?: MarketplaceProductPurchaseAccess;
};

export type CartItem = {
  product: MarketplaceProduct;
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
    | 'disputed'
    | 'cancelled'
    | 'refunded';
  total: number;
  gross_amount?: number;
  discount_amount?: number;
  commission_rate?: number;
  platform_fee?: number;
  seller_net?: number;
  payment_session_id?: string | null;
  license_school_id?: string | null;
  paid_at?: string | null;
  updated_at?: string;
  currency: string;
  created_at: string;
  seller?: Pick<
    MarketplaceSeller,
    'id' | 'display_name' | 'slug' | 'logo_url' | 'is_system_store'
  > | null;
  payment_session?: {
    id: string;
    amount: number;
    currency: string;
    payment_method: 'promptpay' | 'stripe' | 'free';
    status: 'pending_payment' | 'payment_review' | 'verified' | 'disputed' | 'rejected' | 'expired';
    submitted_at: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    bank_transaction_reference: string | null;
    account_name_snapshot?: string | null;
    stripe_payment_intent_id?: string | null;
    processor_fee: number;
    expires_at?: string;
    created_at?: string;
  } | null;
  items?: Array<{
    id: string;
    product_id: string;
    title: string;
    unit_price: number;
    list_unit_price?: number | null;
    quantity: number;
    product?:
      | (Pick<
          MarketplaceProduct,
          | 'id'
          | 'title'
          | 'title_en'
          | 'short_description'
          | 'short_description_en'
          | 'file_url'
          | 'cover_url'
          | 'category'
          | 'subject_label'
          | 'resource_type'
          | 'license_scope'
          | 'license_seat_count'
          | 'grants_plan_code'
          | 'grant_duration_days'
          | 'external_links'
          | 'purchase_benefits_html'
        > & {
          images?: MarketplaceProductImage[];
          files?: MarketplaceProductFile[];
        })
      | null;
  }>;
  receipt?: {
    id: string;
    receipt_number: string;
    status: 'issued' | 'void';
    amount: number;
    currency: string;
    payment_method: 'promptpay' | 'stripe' | 'free';
    transaction_reference: string | null;
    buyer_name: string;
    buyer_email: string | null;
    buyer_tax_id: string | null;
    buyer_address: string | null;
    provider_name: string;
    provider_tax_id: string | null;
    provider_address: string | null;
    provider_email: string | null;
    provider_phone: string | null;
    provider_signature_bucket: string | null;
    provider_signature_path: string | null;
    provider_signature_mime_type: string | null;
    paid_at: string;
    subtotal_amount: number;
    discount_amount: number;
    vat_amount: number;
    notes: string | null;
    issued_at: string;
    voided_at: string | null;
    void_reason: string | null;
  } | null;
  school_licenses?: Array<{
    id: string;
    order_item_id: string;
    product_id: string;
    school_id: string;
    license_scope: 'school' | 'teacher';
    feature_keys: string[];
    seat_count: number;
    grants_plan_code: string | null;
    starts_at: string;
    expires_at: string;
    status: 'active' | 'renewed' | 'expired' | 'disputed' | 'revoked' | 'refunded';
    school?: { id: string; name: string } | null;
  }>;
  user_licenses?: Array<{
    id: string;
    order_item_id: string;
    product_id: string;
    feature_keys: string[];
    grants_plan_code: string | null;
    duration_days: number | null;
    starts_at: string;
    expires_at: string | null;
    status: 'active' | 'renewed' | 'expired' | 'disputed' | 'revoked' | 'refunded';
  }>;
};

export type MarketplacePaymentSession = {
  id: string;
  buyer_id: string;
  amount: number;
  currency: string;
  payment_method: 'promptpay' | 'stripe' | 'free';
  status: 'pending_payment' | 'payment_review' | 'verified' | 'disputed' | 'rejected' | 'expired';
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
  payoutBankCode: string;
  payoutBankName: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
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
  step?: 1 | 2 | 3 | 4;
  title?: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  shortDescription?: string;
  shortDescriptionEn?: string;
  category?: string;
  subjectLabel?: string;
  curriculumId?: string;
  gradeLevelIds?: string[];
  tagIds?: string[];
  mediaTypeId?: string;
  saleTypeId?: string;
  price?: number;
  listPrice?: number | null;
  grantsFeatureKey?: string;
  grantsFeatureKeys?: string[];
  grantsPlanCode?: string;
  grantDurationDays?: number | null;
  licenseScope?: 'individual' | 'school' | 'teacher';
  licenseSeatCount?: number;
  licenseMaxTeachers?: number;
  licenseMaxStudents?: number;
  licenseMaxSchoolAdmins?: number;
  licenseLineQuota?: number;
  externalLinks?: MarketplaceProductLink[];
  purchaseBenefits?: string[];
  purchaseBenefitsHtml?: string;
  submit?: boolean;
};
