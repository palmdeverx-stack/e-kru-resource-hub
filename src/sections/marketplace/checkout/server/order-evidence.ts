import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

type EvidenceCaller = {
  sub: string;
  username: string;
  role: string;
};

function requestContext(request?: Request) {
  return {
    ipAddress:
      request?.headers.get('x-real-ip') ??
      request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      null,
    userAgent: request?.headers.get('user-agent')?.slice(0, 2000) ?? null,
    requestId:
      request?.headers.get('x-request-id') ??
      request?.headers.get('x-vercel-id') ??
      crypto.randomUUID(),
  };
}

export async function captureOrderEvidence({
  request,
  caller,
  orderId,
  paymentSessionId,
  products,
}: {
  request: Request;
  caller: EvidenceCaller;
  orderId: string;
  paymentSessionId: string;
  products: Array<Record<string, unknown>>;
}) {
  const [{ data: buyer }, { data: legalDocuments }] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id,username,email,first_name,last_name,role,created_at,accepted_legal_at')
      .eq('id', caller.sub)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_legal_documents')
      .select('id,document_type,title,summary,content_html,version,effective_at,published_at')
      .eq('status', 'published')
      .in('document_type', [
        'terms_of_service',
        'refund_policy',
        'privacy_policy',
        'digital_product_license',
        'payment_payout_policy',
        'subscription_policy',
      ]),
  ]);
  const context = requestContext(request);
  const acceptedAt = new Date().toISOString();
  const productSnapshot = products.map((product) => ({
    id: product.id,
    seller_id: product.seller_id,
    title: product.title,
    title_en: product.title_en ?? null,
    category: product.category,
    short_description: product.short_description ?? null,
    description: product.description ?? null,
    price: Number(product.price),
    list_price: product.list_price === null ? null : Number(product.list_price),
    currency: product.currency,
    resource_type: product.resource_type,
    license_scope: product.license_scope,
    grants_feature_keys: product.grants_feature_keys ?? [],
    grant_duration_days: product.grant_duration_days ?? null,
    license_line_quota: product.license_line_quota ?? null,
    purchase_benefits: product.purchase_benefits ?? [],
    purchase_benefits_html: product.purchase_benefits_html ?? null,
  }));

  const { error } = await supabaseAdmin.from('marketplace_order_evidence').insert({
    order_id: orderId,
    payment_session_id: paymentSessionId,
    buyer_id: caller.sub,
    buyer_snapshot: {
      id: caller.sub,
      username: buyer?.username ?? caller.username,
      email: buyer?.email ?? null,
      first_name: buyer?.first_name ?? null,
      last_name: buyer?.last_name ?? null,
      role: buyer?.role ?? caller.role,
      account_created_at: buyer?.created_at ?? null,
    },
    product_snapshot: productSnapshot,
    legal_documents_snapshot: legalDocuments ?? [],
    purchase_terms_accepted: true,
    purchase_terms_accepted_at: acceptedAt,
    account_legal_accepted_at: buyer?.accepted_legal_at ?? null,
    checkout_ip: context.ipAddress,
    checkout_user_agent: context.userAgent,
    checkout_request_id: context.requestId,
  });
  if (error) throw error;

  await recordCustomerCommunication({
    orderId,
    paymentSessionId,
    buyerId: caller.sub,
    eventType: 'checkout_created',
    subject: 'สร้างคำสั่งซื้อแล้ว',
    content: `สร้างคำสั่งซื้อ ${orderId} จำนวน ${productSnapshot.length} รายการ`,
    recipientSnapshot: buyer?.email ?? null,
    metadata: { products: productSnapshot },
  });
}

export async function recordCustomerCommunication({
  orderId,
  paymentSessionId,
  buyerId,
  eventType,
  subject,
  content,
  recipientSnapshot,
  providerReference,
  channel = 'system',
  direction = 'outbound',
  metadata = {},
}: {
  orderId?: string | null;
  paymentSessionId?: string | null;
  buyerId: string;
  eventType: string;
  subject?: string | null;
  content: string;
  recipientSnapshot?: string | null;
  providerReference?: string | null;
  channel?: 'system' | 'email' | 'line' | 'support';
  direction?: 'outbound' | 'inbound';
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from('marketplace_customer_communications').insert({
    order_id: orderId ?? null,
    payment_session_id: paymentSessionId ?? null,
    buyer_id: buyerId,
    channel,
    direction,
    event_type: eventType,
    subject: subject ?? null,
    content,
    recipient_snapshot: recipientSnapshot ?? null,
    provider_reference: providerReference ?? null,
    metadata,
  });
  if (error) throw error;
}

export async function recordEntitlementUsage({
  request,
  buyerId,
  eventType,
  orderId,
  orderItemId,
  productId,
  featureKey,
  metadata = {},
}: {
  request?: Request;
  buyerId: string;
  eventType: string;
  orderId?: string | null;
  orderItemId?: string | null;
  productId?: string | null;
  featureKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const context = requestContext(request);
  const { error } = await supabaseAdmin.from('marketplace_entitlement_usage_events').insert({
    order_id: orderId ?? null,
    order_item_id: orderItemId ?? null,
    product_id: productId ?? null,
    buyer_id: buyerId,
    feature_key: featureKey ?? null,
    event_type: eventType,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    request_id: context.requestId,
    metadata,
  });
  if (error) throw error;
  return context;
}
