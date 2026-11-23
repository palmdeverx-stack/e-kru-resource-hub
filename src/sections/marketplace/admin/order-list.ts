import { getPaymentReason } from '../shared/payment-message';

type OrderStatusDisplay = {
  label: string;
  color: 'default' | 'warning' | 'info' | 'success' | 'error';
};

export const orderStatus: Record<string, OrderStatusDisplay> = {
  pending: { label: 'dashboardUi.pending', color: 'warning' },
  pending_payment: { label: 'dashboardUi.awaitingPayment', color: 'warning' },
  payment_review: { label: 'dashboardUi.paymentReview', color: 'info' },
  payment_rejected: { label: 'dashboardUi.paymentRejected', color: 'error' },
  paid: { label: 'dashboardUi.paidLabel', color: 'success' },
  completed: { label: 'dashboardUi.completed', color: 'success' },
  disputed: { label: 'อยู่ระหว่างโต้แย้งการชำระเงิน', color: 'warning' },
  cancelled: { label: 'dashboardUi.cancelled', color: 'default' },
  refunded: { label: 'dashboardUi.refunded', color: 'error' },
};

export const adminOrdersPageSize = 25;

export type AdminOrder = {
  id: string;
  buyer_name: string | null;
  buyer_reference: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  total: number;
  currency: string;
  seller: { display_name: string } | null;
  payment_session: {
    status: string;
    payment_method: string;
    rejection_reason: string | null;
  } | null;
  items: { id: string; title: string; quantity: number }[];
};

export function getOrderOutcome(order: AdminOrder) {
  const payment = order.payment_session;
  switch (order.status) {
    case 'cancelled':
    case 'payment_rejected':
      return getPaymentReason(payment) ?? 'ไม่มีบันทึกเหตุผลสำหรับคำสั่งซื้อนี้';
    case 'paid':
    case 'completed':
      if (payment?.status === 'verified') {
        switch (payment.payment_method) {
          case 'free':
            return 'ระบบยืนยันคำสั่งซื้อฟรี';
          case 'stripe':
            return 'ยืนยันการชำระผ่าน Stripe แล้ว';
          case 'promptpay':
            return 'ยืนยันการชำระผ่านพร้อมเพย์แล้ว';
          default:
            return 'ยืนยันการชำระแล้ว';
        }
      }
      return order.paid_at ? 'มีบันทึกเวลายืนยันการชำระ' : 'ไม่มีบันทึกวิธียืนยันการชำระ';
    case 'payment_review':
      return 'รอตรวจสอบการชำระเงิน';
    case 'pending':
    case 'pending_payment':
      return 'ยังไม่ยืนยันการชำระเงิน';
    default:
      return '—';
  }
}

export type AdminOrderDetails = {
  paymentMethod: string | null;
  events: { label: string; at: string | null; detail?: string }[];
  delivery: { id: string; title: string; status: string }[];
};
