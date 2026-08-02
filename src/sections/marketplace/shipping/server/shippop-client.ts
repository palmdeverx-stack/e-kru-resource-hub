import 'server-only';

export type ShippingAddress = {
  name: string;
  phone: string;
  address: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

export type ShippingParcel = {
  name: string;
  weightGrams: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
};

export type ShippingRate = {
  id: string;
  courierCode: string;
  courierName: string;
  courierRef: string;
  serviceName: string;
  serviceType: 'pick_up' | 'drop_off';
  price: number;
  duration: string;
};

type ShippopEnvironment = 'sandbox' | 'production';

const baseUrl = (environment: ShippopEnvironment = 'sandbox') =>
  (environment === 'production'
    ? (process.env.SHIPPOP_PRODUCTION_API_BASE_URL ?? process.env.SHIPPOP_API_BASE_URL)
    : (process.env.SHIPPOP_SANDBOX_API_BASE_URL ?? process.env.SHIPPOP_API_BASE_URL)) ??
  'https://mkpservice.shippop.dev';

function apiKey() {
  const value = process.env.SHIPPOP_API_KEY;
  if (!value) throw new Error('ยังไม่ได้ตั้งค่า SHIPPOP_API_KEY');
  return value;
}

function toShippopAddress(value: ShippingAddress) {
  return {
    name: value.name,
    address: value.address,
    district: value.subdistrict,
    state: value.district,
    province: value.province,
    postcode: value.postalCode,
    tel: value.phone,
  };
}

async function post(
  path: string,
  payload: Record<string, unknown>,
  environment: ShippopEnvironment
) {
  const response = await fetch(`${baseUrl(environment).replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey(), ...payload }),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.status === false) {
    throw new Error(
      result?.message ?? result?.data?.message ?? `SHIPPOP ตอบกลับ ${response.status}`
    );
  }
  return result;
}

export async function getShippopRates(input: {
  sender: ShippingAddress;
  receiver: ShippingAddress;
  parcel: ShippingParcel;
  environment?: ShippopEnvironment;
}) {
  const result = await post(
    '/public/pricelist/',
    {
      data: {
        0: {
          from: toShippopAddress(input.sender),
          to: toShippopAddress(input.receiver),
          parcel: {
            name: input.parcel.name,
            weight: input.parcel.weightGrams,
            width: input.parcel.widthCm,
            length: input.parcel.lengthCm,
            height: input.parcel.heightCm,
          },
          showall: 1,
        },
      },
    },
    input.environment ?? 'sandbox'
  );
  const group = result.data?.['0'] ?? result.data?.[0] ?? result.data ?? {};
  const candidates = group.couriers ?? group.price ?? group;
  const rows = Array.isArray(candidates) ? candidates : Object.values(candidates ?? {});
  return rows
    .map((row: any) => ({
      id: String(row.courier_code ?? row.code ?? row.ref ?? row.courier_ref ?? ''),
      courierCode: String(row.courier_code ?? row.code ?? ''),
      courierName: String(row.courier_name ?? row.name ?? row.courier ?? ''),
      courierRef: String(row.courier_ref ?? row.ref ?? row.courier_code ?? row.code ?? ''),
      serviceName: String(row.service_name ?? row.service ?? row.name ?? 'Standard'),
      serviceType: (row.type === 'drop_off' ? 'drop_off' : 'pick_up') as 'pick_up' | 'drop_off',
      price: Number(row.price ?? row.total_price ?? 0),
      duration: String(row.duration ?? row.estimate_time ?? '-'),
    }))
    .filter(
      (row: ShippingRate) =>
        Boolean(row.id && row.courierName) && Number.isFinite(row.price) && row.price >= 0
    );
}

export async function bookShippopShipment(input: {
  sender: ShippingAddress;
  receiver: ShippingAddress;
  parcel: ShippingParcel;
  courierCode: string;
  environment?: ShippopEnvironment;
}) {
  const result = await post(
    '/booking/',
    {
      email: process.env.SHIPPOP_ACCOUNT_EMAIL ?? process.env.SHIPPOP_API_SECRET ?? '',
      force_confirm: 1,
      data: [
        {
          from: toShippopAddress(input.sender),
          to: toShippopAddress(input.receiver),
          parcel: {
            name: input.parcel.name,
            weight: input.parcel.weightGrams,
            width: input.parcel.widthCm,
            length: input.parcel.lengthCm,
            height: input.parcel.heightCm,
          },
          courier_code: input.courierCode,
        },
      ],
    },
    input.environment ?? 'sandbox'
  );
  const shipment =
    result.data?.['0'] ?? result.data?.[0] ?? result.result?.['0'] ?? result.result?.[0] ?? {};
  return {
    providerOrderId: String(result.purchase_id ?? shipment.purchase_id ?? ''),
    trackingCode: String(shipment.tracking_code ?? ''),
    courierTrackingCode: String(shipment.courier_tracking_code ?? ''),
    providerFee: Number(
      shipment.total_price ?? shipment.price ?? result.total_price ?? result.price ?? Number.NaN
    ),
  };
}

export async function fetchShippopLabel(
  trackingCode: string,
  environment: ShippopEnvironment = 'sandbox'
) {
  const response = await fetch(`${baseUrl(environment).replace(/\/$/, '')}/label_tracking_code/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey(),
      tracking_code: trackingCode,
      size: 'sticker4x6',
      type: 'pdf',
      showproduct: 1,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`โหลดใบปะหน้าไม่สำเร็จ (${response.status})`);
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get('content-type') ?? 'application/pdf',
  };
}
