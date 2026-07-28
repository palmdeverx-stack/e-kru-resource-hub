import 'server-only';

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function crc16(value: string) {
  let crc = 0xffff;

  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function normalizePromptPayId(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 10 && digits.startsWith('0')) {
    return { tag: '01', value: `0066${digits.slice(1)}` };
  }
  if (digits.length === 13) {
    return { tag: '02', value: digits };
  }

  throw new Error('PromptPay ID ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตร/เลขภาษี 13 หลัก');
}

export function createPromptPayPayload(promptPayId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999.99) {
    throw new Error('ยอดชำระไม่ถูกต้อง');
  }

  const target = normalizePromptPayId(promptPayId);
  const merchantAccount = field('00', 'A000000677010111') + field(target.tag, target.value);
  const base = [
    field('00', '01'),
    field('01', '12'),
    field('29', merchantAccount),
    field('53', '764'),
    field('54', amount.toFixed(2)),
    field('58', 'TH'),
    field('59', 'EKRU MARKETPLACE'),
    field('60', 'BANGKOK'),
  ].join('');
  const payloadForCrc = `${base}6304`;

  return `${payloadForCrc}${crc16(payloadForCrc)}`;
}
