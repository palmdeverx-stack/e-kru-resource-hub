'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import {
  RiKey2Line,
  RiUserLine,
  RiFlowChart,
  RiStore2Line,
  RiSchoolLine,
  RiWallet3Line,
  RiMegaphoneLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiErrorWarningLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

type ReviewTone = 'success' | 'warning' | 'error' | 'info';

type FlowStatus = {
  label: string;
  color: ReviewTone;
};

type ReviewSourceTab = 'codex' | 'automated' | 'external' | 'claude';

const auditDate = '2 สิงหาคม 2569';
const auditReviewer = 'OpenAI Codex';

const verified = { label: 'ยืนยันจากหลักฐาน', color: 'success' as const, points: 100 };
const partial = { label: 'มีหลักฐานบางส่วน', color: 'warning' as const, points: 50 };
const staticReview = { label: 'Static Review', color: 'info' as const, points: 75 };
const notMeasured = { label: 'N/A · ยังไม่มีข้อมูลวัดผล', color: 'error' as const, points: 0 };

const automatedChecks = [
  { label: 'Security Regression Test', result: '5/5 ผ่าน' },
  { label: 'ESLint', result: 'ผ่าน · 0 error' },
  { label: 'TypeScript', result: 'ผ่าน · 0 error' },
  { label: 'Production Build', result: 'ผ่าน' },
];

const qualityMetrics = [
  {
    label: 'ความปลอดภัย',
    status: partial,
    detail: 'Mutation API มี Same-Origin protection และ Rate limit ปฏิเสธคำขอเมื่อระบบขัดข้อง',
  },
  {
    label: 'คุณภาพโค้ด',
    status: verified,
    detail: 'TypeScript, ESLint, Production Build และ Security Regression Test ผ่าน',
  },
  {
    label: 'ความครบถ้วนของฟีเจอร์',
    status: staticReview,
    detail: 'ครอบคลุมบัญชี Marketplace การซื้อ License การเงิน และการดูแลระบบ',
  },
  {
    label: 'ความพร้อมของ End-to-End Flow',
    status: staticReview,
    detail: 'Flow หลักเชื่อมต่อจนจบ ส่วนบริการภายนอกต้องตั้งค่าให้ครบ',
  },
  {
    label: 'ความพร้อมด้านปฏิบัติการ',
    status: partial,
    detail: 'มี Audit Log, Monitoring บางส่วน และชุด Security Regression Test ที่รันซ้ำได้',
  },
  {
    label: 'SQL Injection Readiness',
    status: staticReview,
    detail:
      'ไม่พบเส้นทางที่นำ input ต่อเข้า Raw SQL โดยตรงจาก Static Review แต่ยังไม่ใช่ผล Dynamic Scan หรือ Penetration Test',
  },
  {
    label: 'SEO Readiness',
    status: staticReview,
    detail:
      'ตรวจพบ 7 องค์ประกอบ: Metadata, Canonical, Open Graph, Twitter, robots, sitemap และ JSON-LD แต่ยังไม่มีผล Production',
  },
];

const additionalQualityMetrics = [
  {
    label: 'Accessibility Readiness',
    status: partial,
    detail: 'มี Label, aria-label และ responsive typography แต่ยังไม่มีผลตรวจ WCAG อัตโนมัติ',
  },
  {
    label: 'Performance Readiness',
    status: notMeasured,
    detail:
      'มี Image component, pagination และ parallel fetching แต่ยังไม่มี Core Web Vitals จาก Production',
  },
  {
    label: 'Reliability',
    status: partial,
    detail: 'มี error handling, retry, idempotency และสถานะ Flow โดยยังไม่มี Chaos/Failure testing',
  },
  {
    label: 'API Quality',
    status: partial,
    detail: 'มี authentication, validation, pagination, status code และ error response ที่สม่ำเสมอ',
  },
  {
    label: 'Data Integrity',
    status: verified,
    detail: 'มี Foreign key, Unique constraint, Check constraint และกลไกป้องกันข้อมูลซ้ำ',
  },
  {
    label: 'Privacy & Compliance',
    status: partial,
    detail: 'มี PDPA/Legal flow, Cookie consent, Private storage, encryption และ Audit trail',
  },
  {
    label: 'Test Coverage',
    status: notMeasured,
    detail:
      'มี TypeScript, Build และ Security Regression Test แต่ยังขาด Unit, Integration และ E2E coverage',
  },
  {
    label: 'Maintainability',
    status: partial,
    detail:
      'ใช้ TypeScript, ESLint และแยกโมดูลตามขอบเขตงาน โดยระบบมีขนาดใหญ่และควรติดตาม duplication',
  },
  {
    label: 'Mobile UX',
    status: notMeasured,
    detail:
      'มี responsive layout, mobile navigation และ touch-friendly controls แต่ยังไม่มีผลทดสอบหลายอุปกรณ์',
  },
  {
    label: 'Backup & Recovery',
    status: notMeasured,
    detail:
      'ยังไม่พบหลักฐาน Backup policy, Restore drill, RPO/RTO หรือ Disaster Recovery test ใน repository',
  },
  {
    label: 'Observability',
    status: partial,
    detail:
      'มี Audit Log, analytics และ delivery status แต่ยังไม่มีหลักฐาน alerting และ error tracing ส่วนกลาง',
  },
  {
    label: 'External Service Readiness',
    status: partial,
    detail:
      'รองรับ Stripe, LINE, Email, Storage และ ClamAV แต่ความพร้อมจริงขึ้นกับการตั้งค่าแต่ละบริการ',
  },
];

const securityDimensions = [
  { label: 'Authentication และ Session', status: verified },
  { label: 'Authorization และ Data Isolation', status: verified },
  { label: 'Data Protection และ Privacy', status: partial },
  { label: 'Web และ API Protection', status: partial },
  { label: 'File Safety', status: partial },
  { label: 'Observability และ Operations', status: partial },
];

const capabilities = [
  {
    title: 'ตัวตนและสิทธิ์เข้าใช้งาน',
    icon: <RiKey2Line size={24} />,
    features: [
      'สมัครสมาชิก ยืนยันอีเมล และ Google Sign-in',
      'เข้าสู่ระบบด้วย Password และ PIN สำหรับผู้ดูแล',
      'Role-based access 6 บทบาท พร้อมเพิกถอน Session',
      'เปลี่ยนรหัสผ่าน ระงับบัญชี และบังคับเปลี่ยนรหัสผ่าน',
    ],
  },
  {
    title: 'โรงเรียน บัญชี และสิทธิ์',
    icon: <RiSchoolLine size={24} />,
    features: [
      'School onboarding ผ่าน Token และเปิดสิทธิ์ใช้งาน',
      'จัดการบัญชีผู้ดูแลระบบ ผู้ขาย และผู้ซื้อ',
      'School entitlement และ License สำหรับองค์กร',
      'เปิด ปิด ระงับบัญชี และติดตาม Session',
    ],
  },
  {
    title: 'Marketplace และร้านค้า',
    icon: <RiStore2Line size={24} />,
    features: [
      'สมัครผู้ขาย ตรวจเอกสาร อนุมัติ และระงับร้านค้า',
      'โปรไฟล์ร้าน Badge สถิติ และการตั้งค่า LINE ร้านค้า',
      'สร้างสินค้า รูปภาพ ไฟล์ Preview ราคา และ License',
      'ตรวจอนุมัติสินค้า เผยแพร่ Archive และจัดการข้อเสนอขาย',
    ],
  },
  {
    title: 'การค้นหาและการซื้อ',
    icon: <RiUserLine size={24} />,
    features: [
      'หน้า Landing, Catalog, ร้านค้า และสินค้าที่เกี่ยวข้อง',
      'หมวดหมู่ ระดับชั้น หลักสูตร วิชา แท็ก และ Collection',
      'ตะกร้า Checkout ใบเสนอราคา และซื้อในนามโรงเรียน',
      'รีวิวสินค้า รายงานปัญหา และ Feedback',
    ],
  },
  {
    title: 'การชำระเงินและเอกสาร',
    icon: <RiWallet3Line size={24} />,
    features: [
      'ชำระด้วยสลิปและ Stripe พร้อม Webhook',
      'ตรวจสอบการชำระเงิน ใบเสร็จ และหลักฐานคำสั่งซื้อ',
      'Refund, Dispute และติดตามสถานะการเงิน',
      'เข้ารหัสข้อมูลบัญชีรับเงินด้วย AES-256-GCM',
    ],
  },
  {
    title: 'License การดาวน์โหลด และรายได้',
    icon: <RiShieldCheckLine size={24} />,
    features: [
      'License บุคคล โรงเรียน แพลตฟอร์ม และ Subscription',
      'มอบหมายสิทธิ์ให้ครูและติดตามการใช้สิทธิ์',
      'ดาวน์โหลดไฟล์ Private ผ่าน Signed URL และตรวจ Entitlement',
      'Ledger, ยอดพัก ยอดพร้อมจ่าย และรอบโอนผู้ขาย',
    ],
  },
  {
    title: 'การสื่อสารและการตลาด',
    icon: <RiMegaphoneLine size={24} />,
    features: [
      'แจ้งเตือนในระบบ LINE OA และ Rich Menu',
      'Popup Announcement และข้อความ Marketplace',
      'Referral, Reward, Campaign และ Marketing Overview',
      'แจ้งเตือนการชำระเงิน การอนุมัติ และรอบโอนเงิน',
    ],
  },
  {
    title: 'การกำกับดูแลระบบ',
    icon: <RiSettings3Line size={24} />,
    features: [
      'ตั้งค่าแพลตฟอร์ม การเงิน Storage LINE และข้อมูลหลัก',
      'Security Audit Log พร้อม IP, User Agent และ Request ID',
      'นโยบาย กฎหมาย Cookie Consent และเอกสารข้อตกลง',
      'Dashboard ภาพรวม Analytics และงานประมวลผลตามเวลา',
    ],
  },
];

const ready: FlowStatus = { label: 'Flow ครบ', color: 'success' };
const configured: FlowStatus = { label: 'ต้องตั้งค่าบริการ', color: 'info' };
const conditional: FlowStatus = { label: 'พร้อมใช้แบบมีเงื่อนไข', color: 'warning' };

const flows = [
  {
    group: 'บัญชีและโรงเรียน',
    title: 'สมัครและเริ่มใช้งานบัญชี',
    steps: ['สมัคร', 'ยืนยันอีเมล', 'ยอมรับข้อตกลง', 'เข้าสู่ระบบ', 'สร้าง Session'],
    status: ready,
    evidence: 'หน้าสมัคร/ยืนยันอีเมล/เข้าสู่ระบบ และ API /api/auth/*',
  },
  {
    group: 'บัญชีและโรงเรียน',
    title: 'เข้าสู่ระบบผู้ดูแลแบบยกระดับ',
    steps: ['Password', 'ตรวจ Rate limit', 'ยืนยัน PIN', 'ตรวจ Role', 'เข้า Dashboard'],
    status: ready,
    evidence: 'API sign-in, verify-pin, auth-token และ src/proxy.ts',
  },
  {
    group: 'บัญชีและโรงเรียน',
    title: 'เปิดโรงเรียนและ Subscription',
    steps: ['สร้างโรงเรียน', 'เลือกแผน', 'เปิด Feature', 'สร้างผู้ดูแล', 'เริ่มใช้งาน'],
    status: ready,
    evidence: 'หน้า /school/setup/[token], School onboarding และ Subscription API',
  },
  {
    group: 'บัญชีและโรงเรียน',
    title: 'จัดการบุคลากรและนักเรียน',
    steps: ['สร้าง/นำเข้า', 'กำหนดบทบาท', 'ผูกโรงเรียน', 'เปิดบัญชี', 'ติดตามสถานะ'],
    status: ready,
    evidence: 'หน้า System Users และ API /api/admin/system-users',
  },
  {
    group: 'Marketplace',
    title: 'สมัครและอนุมัติผู้ขาย',
    steps: ['กรอกข้อมูล', 'อัปโหลดเอกสาร', 'ตรวจสอบ', 'อนุมัติ', 'เปิดร้าน'],
    status: ready,
    evidence: 'Seller setup, Seller approvals และ Seller review API',
  },
  {
    group: 'Marketplace',
    title: 'สร้างและเผยแพร่สินค้า',
    steps: ['สร้างสินค้า', 'อัปโหลดไฟล์', 'ตรวจไฟล์', 'แอดมินอนุมัติ', 'เผยแพร่'],
    status: conditional,
    evidence: 'Product form, Product approvals, Product files API และ Malware scanner',
  },
  {
    group: 'Marketplace',
    title: 'ค้นหา เลือกสินค้า และเข้าตะกร้า',
    steps: ['ค้นหา/กรอง', 'ดูรายละเอียด', 'ดูร้านค้า', 'เลือก License', 'เพิ่มตะกร้า'],
    status: ready,
    evidence: 'Landing, Catalog, Product detail, Storefront และ Cart context',
  },
  {
    group: 'การซื้อและสิทธิ์',
    title: 'Checkout และชำระเงิน',
    steps: ['ตรวจตะกร้า', 'เลือกผู้ซื้อ', 'สร้างคำสั่งซื้อ', 'ชำระเงิน', 'ยืนยันผล'],
    status: configured,
    evidence: 'Checkout UI, Orders API, Payment session และ Stripe webhook',
  },
  {
    group: 'การซื้อและสิทธิ์',
    title: 'ออกใบเสร็จและจัดการข้อพิพาท',
    steps: ['ยืนยันยอด', 'สร้างหลักฐาน', 'ออกใบเสร็จ', 'รับเรื่อง', 'Refund/ปิดข้อพิพาท'],
    status: ready,
    evidence: 'Payment review, Receipts, Refund และ Dispute lifecycle',
  },
  {
    group: 'การซื้อและสิทธิ์',
    title: 'เปิด License และดาวน์โหลดสินค้า',
    steps: ['ชำระสำเร็จ', 'สร้าง Entitlement', 'มอบหมายสิทธิ์', 'ตรวจสิทธิ์', 'Signed Download'],
    status: conditional,
    evidence: 'License subscriptions, Entitlement API และ Product download API',
  },
  {
    group: 'การเงินและการตลาด',
    title: 'คำนวณรายได้และโอนผู้ขาย',
    steps: ['บันทึก Ledger', 'พักยอด', 'ยอดพร้อมจ่าย', 'สร้างรอบโอน', 'ยืนยันการโอน'],
    status: ready,
    evidence: 'Seller finance, Ledger, Payout management และ Payout API',
  },
  {
    group: 'การเงินและการตลาด',
    title: 'Referral และ Reward',
    steps: ['สร้างรหัส', 'แชร์ลิงก์', 'ติดตาม Click', 'ตรวจ Conversion', 'ให้รางวัล'],
    status: ready,
    evidence: 'Referral dashboard, Referral API และ Referral settings',
  },
  {
    group: 'การสื่อสาร',
    title: 'แจ้งเตือนในระบบและ LINE',
    steps: ['เกิด Event', 'สร้างข้อความ', 'เข้าคิว', 'ส่ง LINE/ในระบบ', 'ติดตามผล'],
    status: configured,
    evidence: 'Notifications API, Marketplace LINE webhook และ Seller LINE settings',
  },
  {
    group: 'กำกับดูแล',
    title: 'ตรวจสอบเหตุการณ์และรับ Feedback',
    steps: ['บันทึก Audit', 'ดู Dashboard', 'กรองเหตุการณ์', 'รับ Feedback', 'ติดตามแก้ไข'],
    status: ready,
    evidence: 'Security Audit Log, Admin overview และ Feedback management',
  },
];

const excludedLegacyFlows = [
  'โครงสร้างปีการศึกษาและข้อมูลวิชาการ',
  'ลงทะเบียนและเลื่อนชั้น',
  'ตารางสอนและการอนุมัติ',
  'เช็กชื่อและติดตามการเข้าเรียน',
  'งาน แบบทดสอบ และคะแนน',
  'ทบทวนผลการเรียนและรายงานผู้ปกครอง',
];

const strengths = [
  'Session อยู่ใน HttpOnly/Secure Cookie และมีอายุจำกัด',
  'มี Role checking, Account status และ Session revocation',
  'ข้อมูลการเงินเข้ารหัส AES-256-GCM และไฟล์สำคัญอยู่ใน Private Storage',
  'Signed URL มีอายุสั้นและตรวจสิทธิ์ผู้ซื้อก่อนดาวน์โหลด',
  'มี Security Headers, Rate limit แบบ fail-closed, Audit Log และ Webhook signature verification',
  'Mutation API ใช้ Same-Origin protection และมี Security Regression Test ป้องกันการถอยหลัง',
  'TypeScript, ESLint และ Production Build ผ่าน',
];

const deductions = [
  'ยังไม่ได้เปิด ClamAV และไฟล์ pending_scan ยังเข้าถึงได้',
  "Content Security Policy ยังอนุญาต 'unsafe-inline'",
  'Encryption Key ยัง fallback ไปใช้ JWT Secret ได้ ควรแยก Key ใน Production',
  'ยังไม่มีผล Penetration Test จากผู้ทดสอบภายนอก',
];

const priorities = [
  'เปิด ClamAV, ทดสอบด้วย EICAR และสแกน pending_scan ให้เหลือศูนย์',
  'อนุญาตดาวน์โหลดเฉพาะไฟล์สถานะ safe',
  'แยก FINANCIAL_DATA_ENCRYPTION_KEY จาก AUTH_JWT_SECRET',
  'ลด unsafe-inline ด้วย CSP nonce/hash และนำ Security Test เข้า CI',
];

// Addendum below is a separate follow-up check by a different reviewer/session.
// Kept out of the qualityMetrics/scoredMetrics arrays above so the original
// Codex audit numbers stay exactly as that pass reported them.
const claudeReviewer = 'Claude Sonnet 5';

type ClaudeCheckStatus =
  | typeof verified
  | typeof partial
  | typeof staticReview
  | typeof notMeasured;

const claudeChecks: { label: string; status: ClaudeCheckStatus; detail: string }[] = [
  {
    label: 'ความเสถียรของการเข้าสู่ระบบ (Login / Session)',
    status: verified,
    detail:
      'แก้บั๊ก Login วนกลับหน้า Sign-in: CSP ขาด unsafe-eval ใน Dev ทำให้หน้าไม่ hydrate และคอลัมน์ session_version ที่ src/proxy.ts ใช้ตรวจ Session ยังไม่ได้ apply migration เข้าฐานข้อมูลจริง ทำให้ proxy ลบ Cookie ทิ้งทุกครั้งหลังผ่าน PIN ทดสอบซ้ำผ่าน verify-pin → /dashboard → /api/auth/me สำเร็จด้วยบัญชี master_admin จริง',
  },
];

export function SystemCapabilityAuditView() {
  const [reviewSourceTab, setReviewSourceTab] = useState<ReviewSourceTab>('codex');
  const readyFlowCount = flows.filter((flow) => flow.status === ready).length;
  const configuredFlowCount = flows.filter((flow) => flow.status === configured).length;
  const conditionalFlowCount = flows.filter((flow) => flow.status === conditional).length;
  const scoredMetrics = [...qualityMetrics, ...additionalQualityMetrics];
  const assessedMetrics = scoredMetrics.filter((metric) => metric.status !== notMeasured);
  const totalEvidencePoints = scoredMetrics.reduce(
    (total, metric) => total + metric.status.points,
    0
  );
  const readinessScore = Math.round(totalEvidencePoints / scoredMetrics.length);
  const assessedScore = Math.round(totalEvidencePoints / assessedMetrics.length);
  const evidenceCoverage = Math.round((assessedMetrics.length / scoredMetrics.length) * 100);
  const evidenceCounts = [verified, staticReview, partial, notMeasured].map((status) => ({
    status,
    count: scoredMetrics.filter((metric) => metric.status === status).length,
  }));

  const assessedClaudeChecks = claudeChecks.filter((check) => check.status !== notMeasured);
  const totalClaudePoints = claudeChecks.reduce((total, check) => total + check.status.points, 0);
  const claudeReadinessScore = Math.round(totalClaudePoints / claudeChecks.length);
  const claudeAssessedScore = Math.round(totalClaudePoints / assessedClaudeChecks.length);
  const claudeEvidenceCoverage = Math.round(
    (assessedClaudeChecks.length / claudeChecks.length) * 100
  );
  const claudeEvidenceCounts = [verified, staticReview, partial, notMeasured].map((status) => ({
    status,
    count: claudeChecks.filter((check) => check.status === status).length,
  }));

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ภาพรวมและคุณภาพระบบ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            ความสามารถทั้งหมด End-to-End Flow และผลประเมินจากการตรวจโค้ดแบบ Static Review
          </Typography>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
        >
          <Chip variant="soft" color="info" label={`Audit Snapshot · ${auditDate}`} />
          <Chip variant="outlined" color="info" label={`ผู้ประเมิน AI · ${auditReviewer}`} />
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        รายงานนี้อ่านจาก Navigation ที่เปิดใช้งาน หน้า UI และ API ของ Marketplace ที่เชื่อมกันจนจบ
        ไม่ได้นับ Route ที่มีโค้ดอยู่แต่เป็นระบบ Legacy และยังไม่มี Usage Telemetry ประเมินโดย{' '}
        {auditReviewer} ในรูปแบบ AI-assisted Static Review ไม่ใช่ผล Penetration Test
        หรือการรับรองจากผู้ตรวจสอบอิสระ
      </Alert>

      <Card
        sx={{
          p: { xs: 2.5, md: 4 },
          mb: 3,
          background: 'linear-gradient(135deg, rgba(21, 101, 192, 0.10), rgba(24, 169, 123, 0.08))',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '220px 220px 1fr' },
            gap: { xs: 4, lg: 5 },
            alignItems: 'center',
          }}
        >
          <Box textAlign={{ xs: 'left', lg: 'center' }}>
            <Typography variant="h2" color="primary.main">
              {flows.length}
            </Typography>
            <Typography variant="subtitle1">Active Flow ที่ตรวจพบ</Typography>
          </Box>
          <Box textAlign={{ xs: 'left', lg: 'center' }}>
            <Typography variant="h2" color="success.main">
              5/5
            </Typography>
            <Typography variant="subtitle1">Security Regression Test ผ่าน</Typography>
          </Box>
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                สรุปผล
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.5 }}>
                ระบบมีโครงสร้างที่ดีและ Flow หลักเชื่อมต่อครบ
              </Typography>
            </Box>
            <Typography color="text.secondary">
              พร้อมใช้งานด้านบัญชี Marketplace การซื้อ License และการเงิน
              โดยจุดเร่งด่วนที่สุดที่เหลือคือความปลอดภัยของไฟล์และการตั้งค่าบริการภายนอก
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip color="success" variant="soft" label={`${readyFlowCount} Flow ครบ`} />
              <Chip
                color="info"
                variant="soft"
                label={`${configuredFlowCount} Flow ต้องตั้งค่าบริการ`}
              />
              <Chip
                color="warning"
                variant="soft"
                label={`${conditionalFlowCount} Flow มีเงื่อนไข`}
              />
            </Stack>
          </Stack>
        </Box>
      </Card>

      <Card sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box>
          <Typography variant="h5">ผลวัดแยกตามผู้ประเมิน</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            แต่ละแท็บแสดงเฉพาะผลจากแหล่งนั้น โดยไม่รวมคะแนนข้ามผู้ประเมิน
          </Typography>
        </Box>
        <Tabs
          value={reviewSourceTab}
          onChange={(_event, value: ReviewSourceTab) => setReviewSourceTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="เลือกแหล่งผู้ประเมินระบบ"
          sx={{ mt: 2, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab value="codex" label="OpenAI Codex" />
          <Tab value="automated" label="Automated Checks" />
          <Tab value="external" label="External Audit" />
          <Tab value="claude" label="Claude Sonnet 5" />
        </Tabs>

        {reviewSourceTab === 'codex' && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5">สรุปคะแนนจากหลักฐานทั้งหมด</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                คำนวณจาก {scoredMetrics.length} ด้านระดับบนโดยให้น้ำหนักเท่ากัน และไม่นับหัวข้อ
                Security ย่อยซ้ำอีกครั้ง
              </Typography>
              <Chip
                size="small"
                variant="soft"
                color="info"
                label={`ผู้ให้คะแนน · ${auditReviewer} (AI-assisted Static Review)`}
                sx={{ mt: 1.25 }}
              />
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {[
                {
                  value: `${readinessScore}%`,
                  label: 'ความพร้อมที่ยืนยันได้',
                  detail: 'รวม N/A เป็น 0 เพื่อสะท้อนหลักฐานที่ยังขาด',
                  color: 'primary.main',
                },
                {
                  value: `${assessedScore}%`,
                  label: 'คุณภาพเฉพาะด้านที่ประเมินได้',
                  detail: `คำนวณจาก ${assessedMetrics.length} ด้านที่มีหลักฐาน`,
                  color: 'success.main',
                },
                {
                  value: `${evidenceCoverage}%`,
                  label: 'Evidence Coverage',
                  detail: `${assessedMetrics.length}/${scoredMetrics.length} ด้านมีข้อมูลสำหรับประเมิน`,
                  color: 'info.main',
                },
              ].map((item) => (
                <Box key={item.label}>
                  <Typography variant="h3" color={item.color}>
                    {item.value}
                  </Typography>
                  <Typography variant="subtitle1">{item.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.detail}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Divider />
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {evidenceCounts.map(({ status, count }) => (
                <Chip
                  key={status.label}
                  variant="soft"
                  color={status.color}
                  label={`${status.label} ${count} ด้าน · ${status.points} คะแนน`}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              สูตร: ยืนยันจากหลักฐาน = 100, Static Review = 75, มีหลักฐานบางส่วน = 50 และ N/A = 0
              คะแนนนี้วัดความพร้อมของหลักฐาน ไม่ใช่การรับประกันคุณภาพหรือความปลอดภัยของ Production
            </Typography>
          </Stack>
        )}

        {reviewSourceTab === 'automated' && (
          <Stack spacing={2.5}>
            <Alert severity="success">
              ผลการรันล่าสุดผ่าน {automatedChecks.length}/{automatedChecks.length} รายการ
            </Alert>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              {automatedChecks.map((check) => (
                <Card key={check.label} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2">{check.label}</Typography>
                  <Typography variant="h6" color="success.main" sx={{ mt: 0.5 }}>
                    {check.result}
                  </Typography>
                </Card>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              เป็นผลจากเครื่องมืออัตโนมัติที่รันกับ source ปัจจุบัน ไม่ใช่คะแนนคุณภาพรวมและไม่แทนที่
              Runtime monitoring
            </Typography>
          </Stack>
        )}

        {reviewSourceTab === 'external' && (
          <Alert severity="warning">
            N/A · ยังไม่มีผล Penetration Test, External Security Audit
            หรือรายงานรับรองจากผู้ตรวจสอบอิสระ จึงไม่สร้างคะแนนแทนข้อมูลที่ยังไม่มี
          </Alert>
        )}

        {reviewSourceTab === 'claude' && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5">สรุปคะแนนจากหลักฐาน Follow-up</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                รายการที่ตรวจสอบและแก้ไขเพิ่มเติมนอกรอบ Audit เดิม
                คำนวณด้วยสูตรคะแนนเดียวกันแต่แยกเป็นชุดของตัวเอง ไม่ได้นับรวมกับคะแนนสรุปของ{' '}
                {auditReviewer}
              </Typography>
              <Chip
                size="small"
                variant="soft"
                color="secondary"
                label={`ผู้ให้คะแนน · ${claudeReviewer} (Follow-up Review)`}
                sx={{ mt: 1.25 }}
              />
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {[
                {
                  value: `${claudeReadinessScore}%`,
                  label: 'ความพร้อมที่ยืนยันได้',
                  detail: 'รวม N/A เป็น 0 เพื่อสะท้อนหลักฐานที่ยังขาด',
                  color: 'secondary.main',
                },
                {
                  value: `${claudeAssessedScore}%`,
                  label: 'คุณภาพเฉพาะด้านที่ประเมินได้',
                  detail: `คำนวณจาก ${assessedClaudeChecks.length} รายการที่มีหลักฐาน`,
                  color: 'success.main',
                },
                {
                  value: `${claudeEvidenceCoverage}%`,
                  label: 'Evidence Coverage',
                  detail: `${assessedClaudeChecks.length}/${claudeChecks.length} รายการมีข้อมูลสำหรับประเมิน`,
                  color: 'info.main',
                },
              ].map((item) => (
                <Box key={item.label}>
                  <Typography variant="h3" color={item.color}>
                    {item.value}
                  </Typography>
                  <Typography variant="subtitle1">{item.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.detail}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Divider />
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {claudeEvidenceCounts.map(({ status, count }) => (
                <Chip
                  key={status.label}
                  variant="soft"
                  color={status.color}
                  label={`${status.label} ${count} รายการ · ${status.points} คะแนน`}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              สูตร: ยืนยันจากหลักฐาน = 100, Static Review = 75, มีหลักฐานบางส่วน = 50 และ N/A = 0
              คะแนนนี้วัดความพร้อมของหลักฐาน ไม่ใช่การรับประกันคุณภาพหรือความปลอดภัยของ Production
            </Typography>
            <Divider />
            <Stack spacing={2}>
              {claudeChecks.map((check) => (
                <Box key={check.label}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ mb: 0.75 }}
                  >
                    <Typography variant="subtitle2">{check.label}</Typography>
                    <Chip
                      size="small"
                      variant="soft"
                      color={check.status.color}
                      label={`${check.status.label} · ${check.status.points} คะแนน`}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {check.detail}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Stack>
        )}
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {[
          { value: capabilities.length, label: 'กลุ่มความสามารถ', detail: 'เฉพาะที่ใช้งานจริง' },
          { value: flows.length, label: 'Active End-to-End Flow', detail: 'ตั้งแต่ต้นจนจบ' },
          {
            value: priorities.length,
            label: 'งานสำคัญถัดไป',
            detail: 'เพื่อเพิ่มความพร้อมของระบบ',
          },
        ].map((item) => (
          <Card key={item.label} sx={{ p: 2.5 }}>
            <Typography variant="h3" color="primary.main">
              {item.value}
            </Typography>
            <Typography variant="subtitle1">{item.label}</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.detail}
            </Typography>
          </Card>
        ))}
      </Box>

      <Card sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
          <RiShieldCheckLine size={26} />
          <Box>
            <Typography variant="h5">ผลตรวจคุณภาพแต่ละด้าน</Typography>
            <Typography variant="body2" color="text.secondary">
              แสดงสถานะตามหลักฐานที่ตรวจพบ โดยไม่สร้างเปอร์เซ็นต์เมื่อไม่มีข้อมูลวัดผล
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2.5,
          }}
        >
          {qualityMetrics.map((metric) => (
            <Box key={metric.label}>
              <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mb: 0.75 }}>
                <Typography variant="subtitle2">{metric.label}</Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color={metric.status.color}
                  label={metric.status.label}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {metric.detail}
              </Typography>
            </Box>
          ))}
        </Box>
      </Card>

      <Card sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
          <RiFlowChart size={26} />
          <Box>
            <Typography variant="h5">หลักฐานคุณภาพเพิ่มเติม</Typography>
            <Typography variant="body2" color="text.secondary">
              ถ้าไม่มีผลทดสอบหรือข้อมูล Production จะแสดง N/A แทนการคาดเดาคะแนน
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2.5,
          }}
        >
          {additionalQualityMetrics.map((metric) => (
            <Box key={metric.label}>
              <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mb: 0.75 }}>
                <Typography variant="subtitle2">{metric.label}</Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color={metric.status.color}
                  label={metric.status.label}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {metric.detail}
              </Typography>
            </Box>
          ))}
        </Box>
      </Card>

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
          <RiSettings3Line size={26} />
          <Box>
            <Typography variant="h4">ระบบทำอะไรได้บ้าง</Typography>
            <Typography color="text.secondary">
              สรุปฟีเจอร์ Marketplace ที่มีหน้าใช้งานและ Flow รองรับจริง
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2,
          }}
        >
          {capabilities.map((capability) => (
            <Card
              key={capability.title}
              sx={{ p: 2.5, contentVisibility: 'auto', containIntrinsicSize: '0 260px' }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1.5,
                    color: 'primary.main',
                    bgcolor: 'primary.lighter',
                    flexShrink: 0,
                  }}
                >
                  {capability.icon}
                </Box>
                <Typography variant="h6">{capability.title}</Typography>
              </Stack>
              <Stack spacing={1.1}>
                {capability.features.map((feature) => (
                  <Stack key={feature} direction="row" spacing={1} alignItems="flex-start">
                    <RiCheckboxCircleLine
                      size={18}
                      color="var(--palette-success-main)"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <Typography variant="body2">{feature}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Card>
          ))}
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-end' }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <RiFlowChart size={28} />
            <Box>
              <Typography variant="h4">End-to-End Flow ทั้งหมด</Typography>
              <Typography color="text.secondary">
                เฉพาะ Flow ที่พบทั้งจุดเริ่มต้น การประมวลผล และผลลัพธ์ที่ผู้ใช้เข้าถึงได้
              </Typography>
            </Box>
          </Stack>
          <Typography variant="subtitle2">รวม {flows.length} Flow</Typography>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' },
            gap: 2,
          }}
        >
          {flows.map((flow, index) => (
            <Card
              key={flow.title}
              sx={{ p: 2.5, contentVisibility: 'auto', containIntrinsicSize: '0 180px' }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ sm: 'flex-start' }}
                spacing={1}
              >
                <Box>
                  <Typography variant="caption" color="primary.main">
                    FLOW {String(index + 1).padStart(2, '0')} · {flow.group}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.25 }}>
                    {flow.title}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="soft"
                  color={flow.status.color}
                  label={flow.status.label}
                />
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                {flow.steps.map((step, stepIndex) => (
                  <Stack key={step} direction="row" spacing={0.75} alignItems="center">
                    <Chip size="small" variant="outlined" label={step} />
                    {stepIndex < flow.steps.length - 1 && (
                      <Typography color="text.disabled">→</Typography>
                    )}
                  </Stack>
                ))}
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                หลักฐาน: {flow.evidence}
              </Typography>
            </Card>
          ))}
        </Box>
      </Box>

      <Alert severity="warning" sx={{ mb: 4 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
          ไม่นำ Legacy Flow ต่อไปนี้มานับใน {flows.length} Active Flow
        </Typography>
        {excludedLegacyFlows.join(' · ')}
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <RiCheckboxCircleLine size={24} color="var(--palette-success-main)" />
            <Typography variant="h5">จุดแข็ง</Typography>
          </Stack>
          <Stack spacing={1.25}>
            {strengths.map((item) => (
              <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                <Typography color="success.main">+</Typography>
                <Typography variant="body2">{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <RiErrorWarningLine size={24} color="var(--palette-warning-main)" />
            <Typography variant="h5">ประเด็นที่ยังต้องแก้</Typography>
          </Stack>
          <Stack spacing={1.25}>
            {deductions.map((item) => (
              <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                <Typography color="warning.main">−</Typography>
                <Typography variant="body2">{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      </Box>

      <Card sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
          <RiShieldCheckLine size={26} />
          <Box>
            <Typography variant="h5">หลักฐาน Security Readiness</Typography>
            <Typography variant="body2" color="text.secondary">
              สถานะจาก Static Review โดยไม่ใช้คะแนนถ่วงน้ำหนักที่ไม่มีข้อมูลวัดผลรองรับ
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2.25,
          }}
        >
          {securityDimensions.map((dimension) => (
            <Box key={dimension.label}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography variant="subtitle2">{dimension.label}</Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color={dimension.status.color}
                  label={dimension.status.label}
                />
              </Stack>
            </Box>
          ))}
        </Box>
        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          ลำดับงานเพื่อเพิ่มความพร้อมของระบบ
        </Typography>
        <Stack spacing={1.25}>
          {priorities.map((priority, index) => (
            <Stack key={priority} direction="row" spacing={1.25} alignItems="flex-start">
              <Chip size="small" color={index < 2 ? 'error' : 'warning'} label={`P${index + 1}`} />
              <Typography variant="body2">{priority}</Typography>
            </Stack>
          ))}
        </Stack>
      </Card>
    </Container>
  );
}
