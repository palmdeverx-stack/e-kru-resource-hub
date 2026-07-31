import 'server-only';

import path from 'node:path';
import {
  Font,
  Page,
  Text,
  View,
  Image,
  Document,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

Font.register({
  family: 'LINE Seed Sans TH',
  fonts: [
    {
      src: path.join(process.cwd(), 'public/fonts/LINESeedSansTH-Regular.ttf'),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), 'public/fonts/LINESeedSansTH-Bold.ttf'),
      fontWeight: 700,
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

export type MarketplaceReceiptPdfData = {
  receipt_number: string;
  status: 'issued' | 'void';
  amount: number;
  currency: string;
  payment_method: 'promptpay' | 'stripe' | 'free';
  transaction_reference: string | null;
  items_snapshot: Array<{
    orderId: string;
    sellerName: string;
    title: string;
    unitPrice: number;
    listUnitPrice?: number;
    quantity: number;
    subtotal: number;
  }>;
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
};

const styles = StyleSheet.create({
  page: {
    padding: 38,
    fontSize: 10,
    lineHeight: 1.55,
    color: '#182230',
    fontFamily: 'LINE Seed Sans TH',
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  headerHeading: {
    paddingBottom: 4,
  },
  brand: {
    marginBottom: 6,
    color: '#1565F5',
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  brandLogo: {
    width: 150,
    height: 42,
    marginBottom: 6,
    objectFit: 'contain',
    objectPosition: 'left',
  },
  title: {
    marginBottom: 3,
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.4,
  },
  receiptLabel: {
    lineHeight: 1.35,
  },
  muted: { color: '#667085' },
  right: { textAlign: 'right' },
  receiptNumber: { fontSize: 12, fontWeight: 700, marginBottom: '4px' },
  divider: { marginVertical: 18, height: 1, backgroundColor: '#E4E7EC' },
  parties: { display: 'flex', flexDirection: 'row', gap: 24 },
  party: { flex: 1 },
  overline: { marginBottom: 5, color: '#667085', fontSize: 8, fontWeight: 700 },
  partyName: { marginBottom: 3, fontSize: 11, fontWeight: 700 },
  table: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 4,
  },
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F2F4F7',
    fontWeight: 700,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
  },
  itemName: { flex: 1, paddingRight: 10 },
  quantity: { width: 45, textAlign: 'center' },
  unitPrice: { width: 85, textAlign: 'right' },
  amount: { width: 90, textAlign: 'right' },
  total: {
    alignSelf: 'flex-end',
    width: 280,
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D0D5DD',
  },
  totalRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  grandTotal: {
    marginTop: 4,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
  },
  totalText: { fontSize: 13, fontWeight: 700 },
  payment: {
    marginTop: 18,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 4,
    lineHeight: 1.6,
  },
  paidStatus: { marginBottom: 4, color: '#067647', fontSize: 11, fontWeight: 700 },
  notes: { marginTop: 8 },
  certification: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 24,
  },
  electronicNote: {
    width: '55%',
    color: '#667085',
    fontSize: 8,
    lineHeight: 1.55,
  },
  signature: {
    width: 190,
    textAlign: 'center',
  },
  signatureImage: {
    width: 150,
    height: 54,
    marginHorizontal: 'auto',
    objectFit: 'contain',
  },
  signaturePlaceholder: {
    height: 54,
  },
  signatureLine: {
    marginTop: 5,
    marginBottom: 5,
    borderTopWidth: 1,
    borderTopColor: '#98A2B3',
  },
  footer: {
    position: 'absolute',
    right: 38,
    bottom: 24,
    left: 38,
    color: '#98A2B3',
    fontSize: 8,
    textAlign: 'center',
  },
  watermark: {
    position: 'absolute',
    top: '43%',
    left: '25%',
    color: '#D92D20',
    fontSize: 72,
    fontWeight: 700,
    opacity: 0.12,
    transform: 'rotate(-18deg)',
  },
  voidAlert: {
    marginTop: 16,
    padding: 10,
    color: '#B42318',
    backgroundColor: '#FEF3F2',
  },
});

const paymentLabels: Record<MarketplaceReceiptPdfData['payment_method'], string> = {
  promptpay: 'PromptPay / โอนเงิน',
  stripe: 'Stripe (บัตรเครดิต/เดบิต)',
  free: 'ไม่มีค่าใช้จ่าย',
};

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: currency || 'THB',
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function ReceiptDocument({
  receipt,
  signatureDataUrl,
  brand,
}: {
  receipt: MarketplaceReceiptPdfData;
  signatureDataUrl?: string | null;
  brand?: { name?: string | null; logoDataUrl?: string | null };
}) {
  const brandName = brand?.name || 'E-KRU Marketplace';
  return (
    <Document title={`ใบเสร็จรับเงิน ${receipt.receipt_number}`} author={brandName}>
      <Page size="A4" style={styles.page}>
        {receipt.status === 'void' && <Text style={styles.watermark}>ยกเลิก</Text>}

        <View style={styles.header}>
          <View style={styles.headerHeading}>
            {brand?.logoDataUrl ? (
              <Image style={styles.brandLogo} src={brand.logoDataUrl} />
            ) : (
              <Text style={styles.brand}>{brandName}</Text>
            )}
            <Text style={styles.title}>ใบเสร็จรับเงิน</Text>
            <Text style={[styles.muted, styles.receiptLabel]}>RECEIPT</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.receiptNumber}>{receipt.receipt_number}</Text>
            <Text style={{ marginBottom: '4px' }}>วันที่ออก {formatDate(receipt.issued_at)}</Text>
            <Text style={{ marginBottom: '4px' }}>วันที่ชำระ {formatDate(receipt.paid_at)}</Text>
            <Text style={styles.muted}>
              {receipt.status === 'issued' ? 'สถานะ: ออกแล้ว' : 'สถานะ: ยกเลิกแล้ว'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.overline}>{brandName}</Text>
            <Text style={styles.partyName}>{receipt.provider_name}</Text>
            {!!receipt.provider_tax_id && <Text>เลขผู้เสียภาษี {receipt.provider_tax_id}</Text>}
            {!!receipt.provider_address && <Text>{receipt.provider_address}</Text>}
            {!!receipt.provider_phone && <Text>โทร {receipt.provider_phone}</Text>}
            {!!receipt.provider_email && <Text>อีเมล {receipt.provider_email}</Text>}
          </View>
          <View style={styles.party}>
            <Text style={styles.overline}>ผู้รับ</Text>
            <Text style={styles.partyName}>{receipt.buyer_name}</Text>
            {!!receipt.buyer_tax_id && <Text>เลขผู้เสียภาษี {receipt.buyer_tax_id}</Text>}
            {!!receipt.buyer_address && <Text>{receipt.buyer_address}</Text>}
            {!!receipt.buyer_email && <Text>อีเมล {receipt.buyer_email}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.itemName}>รายการ</Text>
            <Text style={styles.quantity}>จำนวน</Text>
            <Text style={styles.unitPrice}>ราคาต่อหน่วย</Text>
            <Text style={styles.amount}>จำนวนเงิน</Text>
          </View>
          {receipt.items_snapshot.map((item, index) => (
            <View key={`${item.orderId}-${index}`} style={styles.tableRow} wrap={false}>
              <View style={styles.itemName}>
                <Text>{item.title}</Text>
                <Text style={styles.muted}>
                  {item.sellerName} · {formatPrice(Number(item.unitPrice), receipt.currency)}/รายการ
                </Text>
              </View>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <Text style={styles.unitPrice}>
                {formatPrice(Number(item.unitPrice), receipt.currency)}
              </Text>
              <Text style={styles.amount}>
                {formatPrice(Number(item.subtotal), receipt.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.total}>
          <View style={styles.totalRow}>
            <Text>รวมเงิน</Text>
            <Text>{formatPrice(Number(receipt.subtotal_amount), receipt.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>ส่วนลด</Text>
            <Text>-{formatPrice(Number(receipt.discount_amount), receipt.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>ภาษีมูลค่าเพิ่ม (VAT ถ้ามี)</Text>
            <Text>{formatPrice(Number(receipt.vat_amount), receipt.currency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.totalText}>ยอดสุทธิ</Text>
            <Text style={styles.totalText}>
              {formatPrice(Number(receipt.amount), receipt.currency)}
            </Text>
          </View>
        </View>

        <View style={styles.payment}>
          <Text style={styles.paidStatus}>ชำระเงินเรียบร้อยแล้ว · Payment Status: Paid</Text>
          <Text>วิธีชำระเงิน: {paymentLabels[receipt.payment_method]}</Text>
          <Text>Transaction ID: {receipt.transaction_reference || '-'}</Text>
          {!!receipt.notes && <Text style={styles.notes}>หมายเหตุ: {receipt.notes}</Text>}
        </View>

        <View style={styles.certification} wrap={false}>
          {/* <Text style={styles.electronicNote}>
            เอกสารนี้ออกโดยระบบอิเล็กทรอนิกส์ของ E-KRU Marketplace
            ข้อมูลการชำระเงินได้รับการยืนยันจากระบบแล้ว
          </Text> */}
          <View style={styles.signature}>
            <Text>ผู้จ่ายเงิน</Text>
            <View style={styles.signaturePlaceholder} />
            <View style={styles.signatureLine} />
            <Text>( {receipt.buyer_name} )</Text>
            <Text style={{ marginBottom: '4px' }}> </Text>
          </View>
          <View style={styles.signature}>
            <Text>ผู้รับเงิน</Text>
            {signatureDataUrl ? (
              <Image style={styles.signatureImage} src={signatureDataUrl} />
            ) : (
              <View style={styles.signaturePlaceholder} />
            )}
            <View style={styles.signatureLine} />
            <Text>( {receipt.provider_name} )</Text>
            <Text style={{ marginBottom: '4px' }}>วันที่ {formatDate(receipt.issued_at)}</Text>
          </View>
        </View>

        {receipt.status === 'void' && (
          <View style={styles.voidAlert}>
            <Text>
              ใบเสร็จฉบับนี้ถูกยกเลิกเมื่อ {formatDate(receipt.voided_at)}
              {receipt.void_reason ? ` — ${receipt.void_reason}` : ''}
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          เอกสารนี้สร้างจากระบบ {brandName} และดาวน์โหลดโดยเจ้าของคำสั่งซื้อ
        </Text>
      </Page>
    </Document>
  );
}

export function renderMarketplaceReceiptPdf(
  receipt: MarketplaceReceiptPdfData,
  signatureDataUrl?: string | null,
  brand?: { name?: string | null; logoDataUrl?: string | null }
) {
  return renderToBuffer(
    <ReceiptDocument receipt={receipt} signatureDataUrl={signatureDataUrl} brand={brand} />
  );
}
