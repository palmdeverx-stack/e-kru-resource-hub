export type ThaiBank = {
  code: string;
  alias: string;
  name: string;
  logo?: string;
  color: string;
};

// Common payout destinations using Bank of Thailand institution codes.
export const THAI_BANKS: ThaiBank[] = [
  {
    code: '002',
    alias: 'BBL',
    name: 'ธนาคารกรุงเทพ',
    logo: '/assets/images/banks/BBL.png',
    color: '#1e4598',
  },
  {
    code: '004',
    alias: 'KBANK',
    name: 'ธนาคารกสิกรไทย',
    logo: '/assets/images/banks/KBANK.png',
    color: '#138f2d',
  },
  {
    code: '006',
    alias: 'KTB',
    name: 'ธนาคารกรุงไทย',
    logo: '/assets/images/banks/KTB.png',
    color: '#1ba5e1',
  },
  {
    code: '011',
    alias: 'TTB',
    name: 'ธนาคารทหารไทยธนชาต',
    logo: '/assets/images/banks/TTB.png',
    color: '#f36f21',
  },
  {
    code: '014',
    alias: 'SCB',
    name: 'ธนาคารไทยพาณิชย์',
    logo: '/assets/images/banks/SCB.png',
    color: '#4e2e7f',
  },
  { code: '020', alias: 'SCBT', name: 'ธนาคารสแตนดาร์ดชาร์เตอร์ด (ไทย)', color: '#0072aa' },
  {
    code: '022',
    alias: 'CIMBT',
    name: 'ธนาคารซีไอเอ็มบี ไทย',
    logo: '/assets/images/banks/CIMB.png',
    color: '#7e2f36',
  },
  {
    code: '024',
    alias: 'UOBT',
    name: 'ธนาคารยูโอบี',
    logo: '/assets/images/banks/UOB.png',
    color: '#0b3979',
  },
  {
    code: '025',
    alias: 'BAY',
    name: 'ธนาคารกรุงศรีอยุธยา',
    logo: '/assets/images/banks/BAY.png',
    color: '#fdb913',
  },
  {
    code: '030',
    alias: 'GSB',
    name: 'ธนาคารออมสิน',
    logo: '/assets/images/banks/GSB.png',
    color: '#eb198d',
  },
  {
    code: '033',
    alias: 'GHB',
    name: 'ธนาคารอาคารสงเคราะห์',
    logo: '/assets/images/banks/GHB.png',
    color: '#f57d23',
  },
  {
    code: '034',
    alias: 'BAAC',
    name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',
    logo: '/assets/images/banks/BAAC.png',
    color: '#4b9b1d',
  },
  {
    code: '066',
    alias: 'ISBT',
    name: 'ธนาคารอิสลามแห่งประเทศไทย',
    logo: '/assets/images/banks/IBANK.png',
    color: '#1b8b74',
  },
  {
    code: '067',
    alias: 'TCRB',
    name: 'ธนาคารไทยเครดิต',
    logo: '/assets/images/banks/TCRB.png',
    color: '#1f338f',
  },
  {
    code: '069',
    alias: 'KKP',
    name: 'ธนาคารเกียรตินาคินภัทร',
    logo: '/assets/images/banks/KKP.png',
    color: '#5b2d82',
  },
  {
    code: '070',
    alias: 'ICBCT',
    name: 'ธนาคารไอซีบีซี (ไทย)',
    logo: '/assets/images/banks/ICBC.png',
    color: '#c8161d',
  },
  {
    code: '071',
    alias: 'TISCO',
    name: 'ธนาคารทิสโก้',
    logo: '/assets/images/banks/TISCO.png',
    color: '#12549f',
  },
  {
    code: '073',
    alias: 'LHBANK',
    name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์',
    logo: '/assets/images/banks/LHB.png',
    color: '#6d6e71',
  },
];

export function findThaiBank(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase('th-TH');
  if (!normalized) return null;
  return (
    THAI_BANKS.find(
      (bank) =>
        bank.code.toLocaleLowerCase('th-TH') === normalized ||
        bank.alias.toLocaleLowerCase('th-TH') === normalized ||
        bank.name.toLocaleLowerCase('th-TH') === normalized
    ) ?? null
  );
}
