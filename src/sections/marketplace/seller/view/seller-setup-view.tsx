'use client';

import type { MarketplaceSeller } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Step from '@mui/material/Step';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Stepper from '@mui/material/Stepper';
import Checkbox from '@mui/material/Checkbox';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter, useSearchParams } from 'src/routes/hooks';

import { RiUploadCloud2Line, RiCheckboxCircleLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getSeller, saveSeller } from '../../shared/api';

const STEPS = ['ข้อมูลร้านค้า', 'ข้อมูลผู้ขาย', 'รับเงิน', 'เอกสารยืนยัน', 'ข้อตกลง'];
const SELLER_TYPES = [
  ['individual', 'บุคคลทั่วไป'],
  ['teacher', 'ครู'],
  ['school', 'โรงเรียน'],
  ['company', 'บริษัท'],
  ['publisher', 'สำนักพิมพ์'],
  ['university', 'มหาวิทยาลัย'],
];

type AgreementKey = 'sellerAgreement' | 'copyrightConfirmed' | 'feeAgreement' | 'pdpaAccepted';

type Agreement = {
  key: AgreementKey;
  title: string;
  checkboxLabel: string;
  introduction: string;
  sections: Array<{ heading: string; content: string }>;
};

const AGREEMENTS: Agreement[] = [
  {
    key: 'sellerAgreement',
    title: 'ข้อตกลงการเป็นผู้ขาย E-KRU Marketplace',
    checkboxLabel: 'ยอมรับข้อตกลงการเป็นผู้ขาย',
    introduction:
      'ข้อตกลงนี้กำหนดสิทธิ หน้าที่ และมาตรฐานของผู้ขายที่เปิดร้านบน E-KRU Marketplace กรุณาอ่านเนื้อหาทั้งหมดก่อนยอมรับ',
    sections: [
      {
        heading: '1. คุณสมบัติและข้อมูลผู้ขาย',
        content:
          'ผู้ขายยืนยันว่าข้อมูลชื่อ ที่อยู่ ช่องทางติดต่อ บัญชีรับเงิน และเอกสารยืนยันตัวตนที่ส่งให้แพลตฟอร์มเป็นข้อมูลจริง ถูกต้อง และเป็นปัจจุบัน ผู้ขายต้องแจ้งหรือแก้ไขข้อมูลทันทีเมื่อมีการเปลี่ยนแปลง และยินยอมให้ผู้ดูแลตรวจสอบข้อมูลก่อนอนุมัติร้าน',
      },
      {
        heading: '2. การลงขายสินค้า',
        content:
          'ผู้ขายต้องระบุชื่อ รายละเอียด ราคา ประเภทไฟล์ เงื่อนไขการใช้งาน และภาพตัวอย่างให้ตรงกับสินค้าจริง ห้ามเผยแพร่เนื้อหาที่ผิดกฎหมาย ละเมิดสิทธิ ไม่เหมาะสม มีข้อมูลส่วนบุคคลโดยไม่ได้รับอนุญาต หรืออาจทำให้ผู้ซื้อเข้าใจผิด สินค้าต้องผ่านการตรวจสอบก่อนเผยแพร่',
      },
      {
        heading: '3. การให้บริการผู้ซื้อ',
        content:
          'ผู้ขายรับผิดชอบคุณภาพ ความครบถ้วน และการใช้งานของไฟล์ รวมถึงตอบคำถามหรือแก้ไขปัญหาที่เกี่ยวกับสินค้าอย่างเหมาะสม หากสินค้าเสียหาย ไม่ตรงรายละเอียด หรือไม่สามารถใช้งานได้ ผู้ขายต้องร่วมตรวจสอบและดำเนินการตามนโยบายคืนเงินของแพลตฟอร์ม',
      },
      {
        heading: '4. การตรวจสอบและระงับร้าน',
        content:
          'E-KRU Marketplace อาจขอเอกสารเพิ่มเติม ซ่อนสินค้า ระงับการขาย ระงับยอดโอน หรือปิดร้านชั่วคราวระหว่างตรวจสอบข้อร้องเรียน การทุจริต หรือการฝ่าฝืนข้อตกลง โดยจะแจ้งเหตุผลและเปิดช่องทางให้ผู้ขายชี้แจงตามความเหมาะสม',
      },
      {
        heading: '5. การเปลี่ยนแปลงเงื่อนไข',
        content:
          'แพลตฟอร์มอาจปรับปรุงเงื่อนไขเพื่อให้สอดคล้องกับบริการ กฎหมาย หรือความปลอดภัย การเปลี่ยนแปลงที่มีสาระสำคัญจะแจ้งให้ทราบ และอาจต้องให้ผู้ขายยอมรับฉบับใหม่ก่อนใช้งานบางส่วนต่อไป',
      },
    ],
  },
  {
    key: 'copyrightConfirmed',
    title: 'คำยืนยันสิทธิและลิขสิทธิ์ของสื่อ',
    checkboxLabel: 'ยืนยันว่าเป็นเจ้าของลิขสิทธิ์หรือมีสิทธินำมาจำหน่าย',
    introduction:
      'ผู้ขายต้องมีสิทธิโดยชอบในทุกองค์ประกอบของสินค้าที่นำมาวางขาย รวมถึงข้อความ ภาพ เสียง วิดีโอ แบบฝึกหัด ฟอนต์ และไฟล์ประกอบ',
    sections: [
      {
        heading: '1. การเป็นเจ้าของหรือได้รับอนุญาต',
        content:
          'ผู้ขายยืนยันว่าเป็นผู้สร้างผลงานเอง เป็นเจ้าของลิขสิทธิ์ หรือได้รับใบอนุญาตที่ครอบคลุมการทำซ้ำ ดัดแปลง เผยแพร่ และจำหน่ายเชิงพาณิชย์บนแพลตฟอร์มนี้ การพบเนื้อหาบนอินเทอร์เน็ตไม่ได้หมายความว่าสามารถนำมาขายได้',
      },
      {
        heading: '2. ทรัพย์สินของบุคคลอื่น',
        content:
          'ห้ามนำหนังสือเรียน แบบฝึกหัด ข้อสอบ ภาพการ์ตูน เครื่องหมายการค้า โลโก้ ฟอนต์ เพลง คลิป หรือผลงานของบุคคลอื่นมาใช้เกินขอบเขตที่เจ้าของสิทธิอนุญาต หากใช้ทรัพยากรแบบมี License ผู้ขายต้องเก็บหลักฐานและปฏิบัติตามข้อกำหนดเรื่องเครดิต จำนวนผู้ใช้ และการจำหน่ายต่อ',
      },
      {
        heading: '3. ข้อมูลนักเรียนและบุคคล',
        content:
          'สื่อต้องไม่มีชื่อ ภาพถ่าย เสียง ผลการเรียน เลขประจำตัว หรือข้อมูลที่ระบุตัวนักเรียน ครู หรือบุคคลอื่น เว้นแต่มีฐานกฎหมายและหนังสือยินยอมที่เหมาะสม ควรลบหรือปกปิดข้อมูลจริงก่อนอัปโหลดเสมอ',
      },
      {
        heading: '4. การร้องเรียนละเมิดสิทธิ',
        content:
          'เมื่อได้รับรายงาน แพลตฟอร์มอาจซ่อนสินค้าและขอหลักฐานการสร้างผลงานหรือใบอนุญาต ผู้ขายต้องให้ความร่วมมือภายในเวลาที่กำหนด หากพิสูจน์สิทธิไม่ได้ สินค้าอาจถูกถอดถอน ยอดเงินอาจถูกพักเพื่อคืนผู้ซื้อ และบัญชีอาจถูกจำกัดตามความร้ายแรงหรือการกระทำซ้ำ',
      },
      {
        heading: '5. ความรับผิดชอบ',
        content:
          'ผู้ขายรับผิดชอบต่อข้อเรียกร้อง ความเสียหาย และค่าใช้จ่ายที่เกิดจากสินค้าของตนตามกฎหมาย การอนุมัติสินค้าโดยผู้ดูแลเป็นการตรวจเบื้องต้นและไม่ใช่การรับรองว่าผลงานปราศจากการละเมิดสิทธิ',
      },
    ],
  },
  {
    key: 'feeAgreement',
    title: 'ข้อตกลงค่าธรรมเนียมและการรับเงิน',
    checkboxLabel: 'ยอมรับการหักค่าธรรมเนียมและรอบการโอนเงิน',
    introduction:
      'ยอดขายที่ผู้ซื้อชำระจะผ่านแพลตฟอร์มก่อนคำนวณรายรับสุทธิและโอนให้ผู้ขายตามรอบที่กำหนด',
    sections: [
      {
        heading: '1. ราคาขายและค่าธรรมเนียมแพลตฟอร์ม',
        content:
          'ผู้ขายเป็นผู้กำหนดราคาสินค้าตามประเภทการจำหน่าย ระบบจะหักค่าธรรมเนียมแพลตฟอร์มตามอัตราที่แสดงในระบบ ณ เวลาที่เกิดคำสั่งซื้อ อัตราดังกล่าวรองรับค่าใช้บริการ การตรวจสอบ การดูแลระบบ และการดำเนินงานของ Marketplace',
      },
      {
        heading: '2. ค่าธรรมเนียมการชำระเงิน',
        content:
          'ช่องทางชำระเงินบางประเภทอาจมีค่าธรรมเนียมจากผู้ให้บริการภายนอก เช่น Stripe รายละเอียดค่าธรรมเนียมและผู้รับผิดชอบจะแสดงตามการตั้งค่าของแพลตฟอร์ม ผู้ขายสามารถตรวจยอดขาย ค่าธรรมเนียม และรายรับสุทธิได้ในหน้ารายได้ของร้าน',
      },
      {
        heading: '3. ระยะพักยอดและรอบโอน',
        content:
          'หลังยืนยันการชำระเงิน รายรับจะอยู่ในสถานะพักยอดตามจำนวนวันที่กำหนดเพื่อรองรับการตรวจสอบ การคืนเงิน หรือข้อพิพาท เมื่อพ้นระยะพักยอดและถึงขั้นต่ำ ระบบจะนำยอดเข้ารอบโอนตามวันที่แพลตฟอร์มกำหนด การแจ้งเตือนเงินเข้า LINE หมายถึงแพลตฟอร์มรับชำระแล้ว ไม่ใช่เงินเข้าบัญชีธนาคารของผู้ขายทันที',
      },
      {
        heading: '4. การคืนเงินและรายการผิดปกติ',
        content:
          'หากมีการคืนเงิน ยกเลิกคำสั่งซื้อ Chargeback การทุจริต หรือการโอนเงินผิดพลาด แพลตฟอร์มอาจหัก ปรับปรุง หรือพักยอดที่เกี่ยวข้อง หากยอดคงเหลือไม่เพียงพอ อาจนำไปหักจากรายรับรอบถัดไปพร้อมแสดงรายการในประวัติการเงิน',
      },
      {
        heading: '5. บัญชีรับเงินและภาษี',
        content:
          'ผู้ขายต้องใช้บัญชีรับเงินที่ชื่อตรงกับข้อมูลยืนยันตัวตนและรับผิดชอบภาษีของตนเอง แพลตฟอร์มอาจขอเอกสารภาษีหรือหักภาษี ณ ที่จ่ายเมื่อกฎหมายกำหนด การแก้ไขบัญชีรับเงินอาจต้องผ่านการตรวจสอบใหม่ก่อนใช้ในรอบโอน',
      },
    ],
  },
  {
    key: 'pdpaAccepted',
    title: 'ประกาศความเป็นส่วนตัวสำหรับผู้ขาย',
    checkboxLabel: 'รับทราบและยอมรับการประมวลผลข้อมูลส่วนบุคคล (PDPA)',
    introduction:
      'เอกสารนี้อธิบายการใช้ข้อมูลส่วนบุคคลที่จำเป็นต่อการสมัคร ตรวจสอบ และให้บริการร้านค้าบน E-KRU Marketplace',
    sections: [
      {
        heading: '1. ข้อมูลที่เก็บรวบรวม',
        content:
          'แพลตฟอร์มเก็บข้อมูลบัญชี ชื่อและช่องทางติดต่อ ข้อมูลร้าน เลขประจำตัวหรือเลขผู้เสียภาษี เอกสารยืนยันตัวตน ข้อมูลบัญชีธนาคาร ประวัติสินค้า คำสั่งซื้อ รายรับ การติดต่อฝ่ายสนับสนุน และข้อมูลการใช้งานที่จำเป็นต่อความปลอดภัย',
      },
      {
        heading: '2. วัตถุประสงค์',
        content:
          'ข้อมูลถูกใช้เพื่อยืนยันตัวตน พิจารณาคำขอเปิดร้าน เผยแพร่ข้อมูลหน้าร้าน รับชำระและโอนเงิน ป้องกันการทุจริต ดูแลข้อร้องเรียน ปฏิบัติตามสัญญา กฎหมาย ภาษี และบัญชี รวมถึงแจ้งเตือนเหตุการณ์ที่ผู้ขายเลือกเปิดใช้งาน',
      },
      {
        heading: '3. การเปิดเผยข้อมูล',
        content:
          'ข้อมูลอาจถูกส่งให้ผู้ให้บริการที่จำเป็น เช่น ระบบจัดเก็บข้อมูล ผู้ให้บริการชำระเงิน ธนาคาร ผู้ให้บริการข้อความ และผู้ตรวจสอบที่อยู่ภายใต้หน้าที่รักษาความลับ รวมถึงหน่วยงานรัฐเมื่อมีกฎหมายหรือคำสั่งที่ชอบด้วยกฎหมาย ข้อมูลส่วนตัวที่ไม่จำเป็นจะไม่แสดงต่อผู้ซื้อ',
      },
      {
        heading: '4. ระยะเวลาและความปลอดภัย',
        content:
          'แพลตฟอร์มเก็บข้อมูลเท่าที่จำเป็นต่อการให้บริการ ระยะเวลาตามกฎหมาย การบัญชี การป้องกันข้อพิพาท และความปลอดภัย เอกสารสำคัญจัดเก็บแบบจำกัดสิทธิ ส่วน Credential เช่น LINE Channel access token จะถูกเข้ารหัสก่อนบันทึก',
      },
      {
        heading: '5. สิทธิของเจ้าของข้อมูล',
        content:
          'ผู้ขายอาจขอเข้าถึง แก้ไข โอน ลบ จำกัด หรือคัดค้านการใช้ข้อมูล และถอนความยินยอมในกรณีที่การประมวลผลอาศัยความยินยอม ทั้งนี้บางคำขออาจถูกจำกัดเมื่อจำเป็นต่อสัญญา การดำเนินธุรกรรม การเก็บหลักฐาน หรือหน้าที่ตามกฎหมาย ผู้ขายสามารถติดต่อผู้ดูแลผ่านช่องทางของแพลตฟอร์ม',
      },
    ],
  },
];

const initialAgreementRead: Record<AgreementKey, boolean> = {
  sellerAgreement: false,
  copyrightConfirmed: false,
  feeAgreement: false,
  pdpaAccepted: false,
};

const initialForm = {
  displayName: '',
  displayNameEn: '',
  slug: '',
  bio: '',
  sellerType: 'individual',
  sellerName: '',
  phone: '',
  contactEmail: '',
  nationalTaxId: '',
  companyName: '',
  companyRegistrationNo: '',
  companyTaxId: '',
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  promptpayId: '',
  sellerAgreement: false,
  copyrightConfirmed: false,
  feeAgreement: false,
  pdpaAccepted: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ก-๙]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function MarketplaceSellerSetupView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const isSystemStore = user?.role === 'master_admin';
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [form, setForm] = useState(initialForm);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [openAgreement, setOpenAgreement] = useState<Agreement | null>(null);
  const [agreementRead, setAgreementRead] = useState(initialAgreementRead);

  useEffect(() => {
    getSeller()
      .then(({ seller: current }) => {
        setSeller(current);
        if (!current) {
          setForm((value) => ({
            ...value,
            contactEmail: user?.email ?? '',
            sellerType: user?.role === 'teacher' ? 'teacher' : 'individual',
          }));
          return;
        }
        const requestedStep = Number(searchParams.get('step'));
        setActiveStep(
          Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 5
            ? requestedStep - 1
            : Math.max(0, Math.min(4, (current.wizard_step ?? 1) - 1))
        );
        setForm({
          displayName: current.display_name ?? '',
          displayNameEn: current.display_name_en ?? '',
          slug: current.slug ?? '',
          bio: current.bio ?? '',
          sellerType: current.seller_type,
          sellerName: current.seller_name ?? '',
          phone: current.phone ?? '',
          contactEmail: current.contact_email ?? user?.email ?? '',
          nationalTaxId: current.national_tax_id ?? '',
          companyName: current.company_name ?? '',
          companyRegistrationNo: current.company_registration_no ?? '',
          companyTaxId: current.company_tax_id ?? '',
          bankCode: current.payout_account?.bank_code ?? '',
          bankName: current.payout_account?.bank_name ?? '',
          accountNumber: current.payout_account?.account_number ?? '',
          accountName: current.payout_account?.account_name ?? '',
          promptpayId: current.payout_account?.promptpay_id ?? '',
          sellerAgreement: Boolean(current.seller_agreement_accepted_at),
          copyrightConfirmed: Boolean(current.copyright_confirmed_at),
          feeAgreement: Boolean(current.fee_agreement_accepted_at),
          pdpaAccepted: Boolean(current.pdpa_accepted_at),
        });
        setAgreementRead({
          sellerAgreement: Boolean(current.seller_agreement_accepted_at),
          copyrightConfirmed: Boolean(current.copyright_confirmed_at),
          feeAgreement: Boolean(current.fee_agreement_accepted_at),
          pdpaAccepted: Boolean(current.pdpa_accepted_at),
        });
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [searchParams, user?.email, user?.role]);

  const update = (name: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [name]: value }));

  const save = async (action: 'save_draft' | 'submit', step = activeStep + 1) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await saveSeller({ ...form, action, wizardStep: step });
      setSeller(result.seller);
      setMessage(result.message);
      return result.seller;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกข้อมูลไม่สำเร็จ');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (!validateStep(activeStep)) return;
    const saved = await save('save_draft', Math.min(5, activeStep + 2));
    if (saved) setActiveStep((step) => Math.min(4, step + 1));
  };

  const upload = async (documentType: string, file?: File) => {
    if (!file) return;
    let current = seller;
    if (!current) current = await save('save_draft', activeStep + 1);
    if (!current) return;
    setUploading(documentType);
    setError('');
    try {
      const data = new FormData();
      data.set('documentType', documentType);
      data.set('file', file);
      const response = await fetch('/api/marketplace/seller/documents', {
        method: 'POST',
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setSeller((value) =>
        value
          ? {
              ...value,
              documents: [
                ...(value.documents ?? []).filter(
                  (document) => document.document_type !== documentType
                ),
                result.document,
              ],
              ...(documentType === 'store_logo' && { logo_url: result.document.url }),
              ...(documentType === 'store_cover' && { cover_url: result.document.url }),
            }
          : value
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading('');
    }
  };

  const hasDocument = (type: string) =>
    seller?.documents?.some((document) => document.document_type === type) ?? false;

  const validateStep = (step: number) => {
    let valid = true;
    if (step === 0)
      valid =
        form.displayName.trim().length >= 2 && form.slug.length >= 3 && hasDocument('store_logo');
    if (step === 1) {
      valid =
        form.sellerName.trim().length >= 3 &&
        form.phone.replace(/\D/g, '').length >= 9 &&
        form.contactEmail.includes('@') &&
        (form.sellerType !== 'company' ||
          (form.companyName.trim().length >= 2 &&
            form.companyRegistrationNo.replace(/\D/g, '').length >= 10));
    }
    if (step === 2) {
      valid =
        Boolean(form.bankCode && form.bankName && form.accountName) &&
        form.accountNumber.replace(/\D/g, '').length >= 6 &&
        hasDocument('bank_book');
    }
    if (step === 3) valid = hasDocument('identity_card') && hasDocument('bank_book');
    if (!valid) setError('กรุณากรอกข้อมูลที่จำเป็นและอัปโหลดเอกสารให้ครบ');
    return valid;
  };

  const submit = async () => {
    if (
      !validateStep(3) ||
      !form.sellerAgreement ||
      !form.copyrightConfirmed ||
      !form.feeAgreement ||
      !form.pdpaAccepted ||
      !Object.values(agreementRead).every(Boolean)
    ) {
      setError('กรุณายอมรับข้อตกลงทั้ง 4 ข้อ');
      return;
    }
    const result = await save('submit', 5);
    if (result) {
      router.push('/dashboard/seller');
      router.refresh();
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isSystemStore) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h3">ข้อมูลร้านทางการ eKru</Typography>
        <Card sx={{ p: 4, mt: 3 }}>
          <Stack spacing={3}>
            <Alert severity="info">ร้านเจ้าของระบบไม่ต้องผ่านขั้นตอนสมัครผู้ขาย</Alert>
            <TextField label="ชื่อร้าน" value="eKru" disabled />
            <TextField
              label="อีเมลติดต่อ"
              value={form.contactEmail}
              onChange={(e) => update('contactEmail', e.target.value)}
            />
            <TextField
              multiline
              minRows={4}
              label="คำอธิบายร้าน"
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
            />
            <Button variant="contained" loading={saving} onClick={() => save('save_draft')}>
              บันทึกข้อมูลร้าน
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography component="h1" variant="h3">
        สมัครเปิดร้าน E-KRU Marketplace
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        บันทึกร่างได้ทุกขั้น และส่งให้ผู้ดูแลตรวจสอบเมื่อข้อมูลครบ
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {!!error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {seller?.status === 'rejected' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          คำขอไม่ผ่าน: {seller.rejection_reason}
        </Alert>
      )}

      <Card sx={{ p: { xs: 2.5, md: 4 } }}>
        {activeStep === 0 && (
          <Stack spacing={2.5}>
            <Typography variant="h5">ข้อมูลร้านค้า</Typography>
            <TextField
              required
              label="ชื่อร้าน"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                  slug:
                    !current.slug || current.slug === slugify(current.displayName)
                      ? slugify(event.target.value)
                      : current.slug,
                }))
              }
            />
            <TextField
              label="ชื่อร้านภาษาอังกฤษ"
              value={form.displayNameEn}
              onChange={(e) => update('displayNameEn', e.target.value)}
            />
            <TextField
              required
              label="Slug URL"
              value={form.slug}
              onChange={(e) => update('slug', slugify(e.target.value))}
              helperText={`e-kru.com/store/${form.slug || 'your-store'}`}
            />
            <UploadField
              required
              label="โลโก้ร้าน"
              done={hasDocument('store_logo')}
              loading={uploading === 'store_logo'}
              accept="image/*"
              onFile={(file) => upload('store_logo', file)}
            />
            <UploadField
              label="ภาพหน้าปกร้าน"
              done={hasDocument('store_cover')}
              loading={uploading === 'store_cover'}
              accept="image/*"
              onFile={(file) => upload('store_cover', file)}
            />
            <TextField
              multiline
              minRows={4}
              label="คำอธิบายร้าน"
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
            />
          </Stack>
        )}
        {activeStep === 1 && (
          <Stack spacing={2.5}>
            <Typography variant="h5">ข้อมูลผู้ขาย</Typography>
            <RadioGroup
              row
              value={form.sellerType}
              onChange={(e) => update('sellerType', e.target.value)}
            >
              {SELLER_TYPES.map(([value, label]) => (
                <FormControlLabel key={value} value={value} control={<Radio />} label={label} />
              ))}
            </RadioGroup>
            <TextField
              required
              label="ชื่อ-นามสกุล"
              value={form.sellerName}
              onChange={(e) => update('sellerName', e.target.value)}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                required
                label="เบอร์โทร"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
              <TextField
                fullWidth
                required
                type="email"
                label="Email"
                value={form.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
              />
            </Stack>
            <TextField
              label="เลขบัตรประชาชน หรือเลขผู้เสียภาษี"
              value={form.nationalTaxId}
              onChange={(e) => update('nationalTaxId', e.target.value)}
            />
            {form.sellerType === 'company' && (
              <>
                <TextField
                  required
                  label="ชื่อบริษัท"
                  value={form.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                />
                <TextField
                  required
                  label="เลขนิติบุคคล"
                  value={form.companyRegistrationNo}
                  onChange={(e) => update('companyRegistrationNo', e.target.value)}
                />
                <TextField
                  label="เลขผู้เสียภาษี"
                  value={form.companyTaxId}
                  onChange={(e) => update('companyTaxId', e.target.value)}
                />
              </>
            )}
          </Stack>
        )}
        {activeStep === 2 && (
          <Stack spacing={2.5}>
            <Typography variant="h5">ข้อมูลรับเงิน</Typography>
            <TextField
              required
              label="ชื่อบัญชี"
              value={form.accountName}
              onChange={(e) => update('accountName', e.target.value)}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                required
                label="รหัสธนาคาร เช่น KBANK"
                value={form.bankCode}
                onChange={(e) => update('bankCode', e.target.value)}
              />
              <TextField
                fullWidth
                required
                label="ชื่อธนาคาร"
                value={form.bankName}
                onChange={(e) => update('bankName', e.target.value)}
              />
            </Stack>
            <TextField
              required
              label="เลขบัญชี"
              value={form.accountNumber}
              onChange={(e) => update('accountNumber', e.target.value)}
            />
            <TextField
              label="PromptPay (ถ้ามี)"
              value={form.promptpayId}
              onChange={(e) => update('promptpayId', e.target.value)}
            />
            <UploadField
              required
              label="หน้าสมุดบัญชี"
              done={hasDocument('bank_book')}
              loading={uploading === 'bank_book'}
              onFile={(file) => upload('bank_book', file)}
            />
          </Stack>
        )}
        {activeStep === 3 && (
          <Stack spacing={2.5}>
            <Typography variant="h5">เอกสารยืนยัน</Typography>
            <Alert severity="info">
              เอกสารเก็บแบบ private และเปิดให้เฉพาะผู้ขายกับ Super Admin
            </Alert>
            <UploadField
              required
              label="บัตรประชาชน"
              done={hasDocument('identity_card')}
              loading={uploading === 'identity_card'}
              onFile={(file) => upload('identity_card', file)}
            />
            <UploadField
              required
              label="หน้าสมุดบัญชี"
              done={hasDocument('bank_book')}
              loading={uploading === 'bank_book'}
              onFile={(file) => upload('bank_book', file)}
            />
            <UploadField
              label="หนังสือรับรองบริษัท (ถ้ามี)"
              done={hasDocument('company_certificate')}
              loading={uploading === 'company_certificate'}
              onFile={(file) => upload('company_certificate', file)}
            />
            <UploadField
              label="ภ.พ.20 (ถ้ามี)"
              done={hasDocument('vat_certificate')}
              loading={uploading === 'vat_certificate'}
              onFile={(file) => upload('vat_certificate', file)}
            />
          </Stack>
        )}
        {activeStep === 4 && (
          <Stack spacing={2}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              ข้อตกลง
            </Typography>
            <Alert severity="info">
              เปิดอ่านข้อตกลงแต่ละฉบับและเลื่อนจนถึงด้านล่าง จึงจะสามารถเลือกยอมรับได้
            </Alert>
            {AGREEMENTS.map((agreement) => {
              const hasRead = agreementRead[agreement.key];
              return (
                <Box
                  key={agreement.key}
                  sx={{
                    p: 2,
                    gap: 2,
                    border: '1px solid',
                    borderColor: hasRead ? 'success.light' : 'divider',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(form[agreement.key])}
                        disabled={!hasRead}
                        onChange={(event) => update(agreement.key, event.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="subtitle2">{agreement.checkboxLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {hasRead
                            ? 'อ่านครบแล้ว สามารถเลือกยอมรับได้'
                            : 'กรุณาเปิดอ่านและเลื่อนให้ถึงท้ายเอกสาร'}
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                  <Button
                    variant={hasRead ? 'outlined' : 'contained'}
                    onClick={() => setOpenAgreement(agreement)}
                    sx={{ flexShrink: 0 }}
                  >
                    {hasRead ? 'อ่านอีกครั้ง' : 'เปิดอ่านข้อตกลง'}
                  </Button>
                </Box>
              );
            })}
            <Alert severity="warning">
              ตรวจสอบข้อมูลและเอกสารให้ถูกต้องก่อนส่ง หลังส่งสถานะจะเป็น Pending Review
            </Alert>
          </Stack>
        )}

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
          <Button
            color="inherit"
            disabled={activeStep === 0}
            onClick={() => setActiveStep((step) => step - 1)}
          >
            ย้อนกลับ
          </Button>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" loading={saving} onClick={() => save('save_draft')}>
              บันทึกร่าง
            </Button>
            {activeStep < 4 ? (
              <Button variant="contained" loading={saving} onClick={next}>
                ถัดไป
              </Button>
            ) : (
              <Button
                variant="contained"
                loading={saving}
                startIcon={<RiCheckboxCircleLine />}
                onClick={submit}
              >
                ส่งคำขอเปิดร้าน
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>
      <AgreementReadDialog
        agreement={openAgreement}
        onClose={() => setOpenAgreement(null)}
        onRead={(key) => {
          setAgreementRead((current) => ({ ...current, [key]: true }));
          setOpenAgreement(null);
        }}
      />
    </Container>
  );
}

function AgreementReadDialog({
  agreement,
  onClose,
  onRead,
}: {
  agreement: Agreement | null;
  onClose: () => void;
  onRead: (key: AgreementKey) => void;
}) {
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    setReachedEnd(false);
  }, [agreement]);

  return (
    <Dialog open={Boolean(agreement)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{agreement?.title}</DialogTitle>
      <DialogContent dividers>
        <Box
          onScroll={(event) => {
            const element = event.currentTarget;
            if (element.scrollTop + element.clientHeight >= element.scrollHeight - 8) {
              setReachedEnd(true);
            }
          }}
          sx={{
            pr: 2,
            maxHeight: { xs: 380, sm: 440 },
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {agreement?.introduction}
          </Typography>
          <Stack spacing={3}>
            {agreement?.sections.map((section) => (
              <Box key={section.heading}>
                <Typography variant="subtitle1">{section.heading}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.75, lineHeight: 1.8 }}
                >
                  {section.content}
                </Typography>
              </Box>
            ))}
            <Alert severity={reachedEnd ? 'success' : 'info'}>
              {reachedEnd
                ? 'คุณอ่านถึงท้ายเอกสารแล้ว กดยืนยันการอ่านเพื่อปลดล็อก Checkbox'
                : 'เลื่อนอ่านเนื้อหาให้ถึงด้านล่างเพื่อปลดล็อกปุ่มยืนยัน'}
            </Alert>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <Button
          variant="contained"
          disabled={!reachedEnd || !agreement}
          onClick={() => agreement && onRead(agreement.key)}
        >
          ยืนยันว่าอ่านครบแล้ว
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UploadField({
  label,
  done,
  loading,
  onFile,
  accept = 'image/*,application/pdf',
  required = false,
}: {
  label: string;
  done: boolean;
  loading: boolean;
  onFile: (file?: File) => void;
  accept?: string;
  required?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ sm: 'center' }}
      spacing={2}
      sx={{
        p: 2,
        border: '1px dashed',
        borderColor: done ? 'success.main' : 'divider',
        borderRadius: 2,
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2">
          {label}
          {required ? ' *' : ''}
        </Typography>
        <Typography variant="caption" color={done ? 'success.main' : 'text.secondary'}>
          {done ? 'อัปโหลดแล้ว' : 'รองรับ JPG, PNG, WebP หรือ PDF'}
        </Typography>
      </Box>
      <Button
        component="label"
        variant={done ? 'outlined' : 'contained'}
        loading={loading}
        startIcon={<RiUploadCloud2Line />}
      >
        {done ? 'เปลี่ยนไฟล์' : 'อัปโหลด'}
        <input
          hidden
          type="file"
          accept={accept}
          onChange={(event) => onFile(event.target.files?.[0])}
        />
      </Button>
    </Stack>
  );
}
