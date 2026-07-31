import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

function authorize(request: Request) {
  return requireRole(request, ['master_admin', 'super_admin']);
}

function isHttpUrl(value: string) {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูข้อมูลผู้ให้บริการ' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('marketplace_provider_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      {
        message:
          error.code === '42P01'
            ? 'กรุณารัน Marketplace schema เวอร์ชันล่าสุดใน Supabase'
            : error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    settings: {
      providerType: data?.provider_type ?? 'individual',
      firstName: data?.first_name ?? '',
      lastName: data?.last_name ?? '',
      companyName: data?.company_name ?? '',
      companyRegistrationNo: data?.company_registration_no ?? '',
      taxId: data?.tax_id ?? '',
      address: data?.address ?? '',
      contactEmail: data?.contact_email ?? '',
      contactPhone: data?.contact_phone ?? '',
      platformNameTh: data?.platform_name_th ?? '',
      platformNameEn: data?.platform_name_en ?? '',
      brandName: data?.brand_name ?? '',
      websiteUrl: data?.website_url ?? '',
      supportEmail: data?.support_email ?? '',
      supportPhone: data?.support_phone ?? '',
      financeEmail: data?.finance_email ?? '',
      privacyEmail: data?.privacy_email ?? '',
      lineOaId: data?.line_oa_id ?? '',
      businessHours: data?.business_hours ?? '',
      complaintUrl: data?.complaint_url ?? '',
      vatRegistered: data?.vat_registered ?? false,
      vatRate: Number(data?.vat_rate ?? 7),
      officeType: data?.office_type ?? 'head_office',
      branchNumber: data?.branch_number ?? '',
      documentIssuerName: data?.document_issuer_name ?? '',
      documentTaxAddress: data?.document_tax_address ?? '',
      authorizedSignatoryName: data?.authorized_signatory_name ?? '',
      signatureUrl: data?.signature_url ?? '',
      sealUrl: data?.seal_url ?? '',
      receiptPrefix: data?.receipt_prefix ?? '',
      taxInvoicePrefix: data?.tax_invoice_prefix ?? '',
      logoUrl: data?.logo_url ?? '',
      transparentLogoUrl: data?.transparent_logo_url ?? '',
      faviconUrl: data?.favicon_url ?? '',
      ogImageUrl: data?.og_image_url ?? '',
      primaryColor: data?.primary_color ?? '#1565C0',
      footerText: data?.footer_text ?? '',
      copyrightText: data?.copyright_text ?? '',
      timezone: data?.timezone ?? 'Asia/Bangkok',
      currency: data?.currency ?? 'THB',
      defaultLanguage: data?.default_language ?? 'th',
      serviceCountry: data?.service_country ?? 'TH',
      productionUrl: data?.production_url ?? '',
      updatedAt: data?.updated_at ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ให้บริการ' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const providerType = body?.providerType === 'company' ? 'company' : 'individual';
  const firstName = String(body?.firstName ?? '').trim();
  const lastName = String(body?.lastName ?? '').trim();
  const companyName = String(body?.companyName ?? '').trim();
  const companyRegistrationNo = String(body?.companyRegistrationNo ?? '').replace(/\D/g, '');
  const taxId = String(body?.taxId ?? '').replace(/\D/g, '');
  const address = String(body?.address ?? '').trim();
  const contactEmail = String(body?.contactEmail ?? '').trim().toLowerCase();
  const contactPhone = String(body?.contactPhone ?? '').replace(/[^\d+]/g, '');
  const platformNameTh = String(body?.platformNameTh ?? '').trim();
  const platformNameEn = String(body?.platformNameEn ?? '').trim();
  const brandName = String(body?.brandName ?? '').trim();
  const websiteUrl = String(body?.websiteUrl ?? '').trim();
  const supportEmail = String(body?.supportEmail ?? '').trim().toLowerCase();
  const supportPhone = String(body?.supportPhone ?? '').trim();
  const financeEmail = String(body?.financeEmail ?? '').trim().toLowerCase();
  const privacyEmail = String(body?.privacyEmail ?? '').trim().toLowerCase();
  const lineOaId = String(body?.lineOaId ?? '').trim();
  const businessHours = String(body?.businessHours ?? '').trim();
  const complaintUrl = String(body?.complaintUrl ?? '').trim();
  const vatRegistered = body?.vatRegistered === true;
  const vatRate = Number(body?.vatRate ?? 7);
  const officeType = body?.officeType === 'branch' ? 'branch' : 'head_office';
  const branchNumber = String(body?.branchNumber ?? '').replace(/\D/g, '');
  const documentIssuerName = String(body?.documentIssuerName ?? '').trim();
  const documentTaxAddress = String(body?.documentTaxAddress ?? '').trim();
  const authorizedSignatoryName = String(body?.authorizedSignatoryName ?? '').trim();
  const signatureUrl = String(body?.signatureUrl ?? '').trim();
  const sealUrl = String(body?.sealUrl ?? '').trim();
  const receiptPrefix = String(body?.receiptPrefix ?? '').trim().toUpperCase();
  const taxInvoicePrefix = String(body?.taxInvoicePrefix ?? '').trim().toUpperCase();
  const logoUrl = String(body?.logoUrl ?? '').trim();
  const transparentLogoUrl = String(body?.transparentLogoUrl ?? '').trim();
  const faviconUrl = String(body?.faviconUrl ?? '').trim();
  const ogImageUrl = String(body?.ogImageUrl ?? '').trim();
  const primaryColor = String(body?.primaryColor ?? '').trim().toUpperCase();
  const footerText = String(body?.footerText ?? '').trim();
  const copyrightText = String(body?.copyrightText ?? '').trim();
  const timezone = String(body?.timezone ?? 'Asia/Bangkok').trim();
  const currency = String(body?.currency ?? 'THB').trim().toUpperCase();
  const defaultLanguage = String(body?.defaultLanguage ?? 'th').trim().toLowerCase();
  const serviceCountry = String(body?.serviceCountry ?? 'TH').trim().toUpperCase();
  const productionUrl = String(body?.productionUrl ?? '').trim();
  const emails = [supportEmail, financeEmail, privacyEmail].filter(Boolean);
  const urls = [
    websiteUrl,
    complaintUrl,
    signatureUrl,
    sealUrl,
    logoUrl,
    transparentLogoUrl,
    faviconUrl,
    ogImageUrl,
    productionUrl,
  ];

  if (
    (providerType === 'individual' && (firstName.length < 2 || lastName.length < 2)) ||
    (providerType === 'company' &&
      (companyName.length < 2 || companyRegistrationNo.length !== 13)) ||
    (taxId && taxId.length !== 13) ||
    address.length < 10 ||
    !/^\S+@\S+\.\S+$/.test(contactEmail) ||
    (contactPhone && (contactPhone.replace(/\D/g, '').length < 9 || contactPhone.length > 16)) ||
    platformNameTh.length < 2 ||
    brandName.length < 2 ||
    emails.some((email) => !/^\S+@\S+\.\S+$/.test(email)) ||
    urls.some((url) => !isHttpUrl(url)) ||
    !Number.isFinite(vatRate) ||
    vatRate < 0 ||
    vatRate > 100 ||
    (officeType === 'branch' && !branchNumber) ||
    !/^#[0-9A-F]{6}$/.test(primaryColor) ||
    !/^[A-Z0-9_-]{0,12}$/.test(receiptPrefix) ||
    !/^[A-Z0-9_-]{0,12}$/.test(taxInvoicePrefix) ||
    !/^[A-Z]{3}$/.test(currency) ||
    !/^[A-Z]{2}$/.test(serviceCountry) ||
    !['th', 'en'].includes(defaultLanguage) ||
    timezone.length < 3
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอกข้อมูลผู้ให้บริการและข้อมูลติดต่อให้ถูกต้องครบถ้วน' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from('marketplace_provider_settings').upsert({
    id: 'default',
    provider_type: providerType,
    first_name: firstName || null,
    last_name: lastName || null,
    company_name: companyName || null,
    company_registration_no: companyRegistrationNo || null,
    tax_id: taxId || null,
    address,
    contact_email: contactEmail,
    contact_phone: contactPhone || null,
    platform_name_th: platformNameTh,
    platform_name_en: platformNameEn || null,
    brand_name: brandName,
    website_url: websiteUrl || null,
    support_email: supportEmail || null,
    support_phone: supportPhone || null,
    finance_email: financeEmail || null,
    privacy_email: privacyEmail || null,
    line_oa_id: lineOaId || null,
    business_hours: businessHours || null,
    complaint_url: complaintUrl || null,
    vat_registered: vatRegistered,
    vat_rate: vatRate,
    office_type: officeType,
    branch_number: officeType === 'branch' ? branchNumber : null,
    document_issuer_name: documentIssuerName || null,
    document_tax_address: documentTaxAddress || null,
    authorized_signatory_name: authorizedSignatoryName || null,
    signature_url: signatureUrl || null,
    seal_url: sealUrl || null,
    receipt_prefix: receiptPrefix || null,
    tax_invoice_prefix: taxInvoicePrefix || null,
    logo_url: logoUrl || null,
    transparent_logo_url: transparentLogoUrl || null,
    favicon_url: faviconUrl || null,
    og_image_url: ogImageUrl || null,
    primary_color: primaryColor,
    footer_text: footerText || null,
    copyright_text: copyrightText || null,
    timezone,
    currency,
    default_language: defaultLanguage,
    service_country: serviceCountry,
    production_url: productionUrl || null,
    updated_by: caller.sub,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.provider_settings_update',
    targetType: 'provider_settings',
    targetId: 'default',
    result: 'success',
    metadata: { provider_type: providerType },
  });

  return NextResponse.json({ success: true });
}
