type PaymentMessage = {
  payment_method: string;
  rejection_reason: string | null;
};

export function getPaymentReason(payment: PaymentMessage | null | undefined): string | null {
  const reason = payment?.rejection_reason?.trim();
  if (!reason) return null;

  if (payment?.payment_method !== 'stripe' || /[ก-ฮ]/.test(reason)) return reason;
  if (/\bpromptpay\b.*\bexpired\b/i.test(reason)) {
    return 'รายการชำระเงินผ่านพร้อมเพย์หมดอายุ กรุณาเริ่มชำระเงินใหม่';
  }
  if (/\binsufficient funds\b/i.test(reason)) {
    return 'ยอดเงินคงเหลือไม่เพียงพอ';
  }
  if (/\bcard (?:was |has been )?declined\b/i.test(reason)) {
    return 'บัตรถูกปฏิเสธ กรุณาตรวจสอบกับธนาคารผู้ออกบัตร';
  }
  return 'ชำระเงินไม่สำเร็จ กรุณาตรวจสอบข้อมูลการชำระเงินแล้วลองใหม่';
}
