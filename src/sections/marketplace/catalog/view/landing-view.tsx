'use client';

import type { RemixiconComponentType } from '@remixicon/react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiStarLine,
  RiLockLine,
  RiTimeLine,
  RiSearchLine,
  RiSchoolLine,
  RiStore2Line,
  RiUserAddLine,
  RiWallet3Line,
  RiDownloadLine,
  RiUserStarLine,
  RiBookOpenLine,
  RiBookReadLine,
  RiArrowDownLine,
  RiFileList3Line,
  RiArrowDownSLine,
  RiUploadCloudLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiGraduationCapLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

const categories = [
  { label: 'แผนการสอน', icon: RiFileList3Line },
  { label: 'ใบงาน', icon: RiBookOpenLine },
  { label: 'สื่อประกอบ', icon: RiGraduationCapLine },
  { label: 'แบบทดสอบ', icon: RiShieldCheckLine },
];

const trustMetrics = [
  { value: '15,000+', label: 'คุณครู' },
  { value: '120,000+', label: 'สื่อการสอน' },
  { value: '500+', label: 'โรงเรียน' },
];

const benefits = [
  {
    title: 'ค้นหาสื่อได้เร็ว',
    description: 'ค้นหาตามวิชา ระดับชั้น และประเภทสื่อได้ในไม่กี่ขั้นตอน',
    icon: RiSearchLine,
    color: '#1565F5',
    background: '#E9F2FF',
  },
  {
    title: 'สร้างรายได้จากสื่อ',
    description: 'เปลี่ยนผลงานการสอนของคุณให้เป็นรายได้อย่างเป็นระบบ',
    icon: RiMoneyDollarCircleLine,
    color: '#16A36A',
    background: '#E8F8EF',
  },
  {
    title: 'คุณภาพผ่านการตรวจสอบ',
    description: 'สินค้าทุกชิ้นผ่านขั้นตอนตรวจสอบก่อนเผยแพร่สู่ Marketplace',
    icon: RiStarLine,
    color: '#F59E0B',
    background: '#FFF5D9',
  },
  {
    title: 'ปลอดภัย',
    description: 'ชำระเงิน ดาวน์โหลด และจัดการสิทธิ์ผ่านบัญชี E-KRU ของคุณ',
    icon: RiLockLine,
    color: '#8B5CF6',
    background: '#F2EDFF',
  },
];

const buyerSteps = [
  { label: 'สมัครสมาชิก', icon: RiUserAddLine },
  { label: 'ค้นหา', icon: RiSearchLine },
  { label: 'ดาวน์โหลด', icon: RiDownloadLine },
  { label: 'นำไปใช้', icon: RiBookReadLine },
];

const sellerSteps = [
  { label: 'สมัครผู้ขาย', icon: RiStore2Line },
  { label: 'อัปโหลดสื่อ', icon: RiUploadCloudLine },
  { label: 'รออนุมัติ', icon: RiTimeLine },
  { label: 'รับรายได้', icon: RiWallet3Line },
];

const audiences = [
  {
    title: 'ครู',
    description: 'ค้นหาสื่อพร้อมใช้และแบ่งปันผลงานของคุณ',
    icon: RiUserStarLine,
  },
  {
    title: 'โรงเรียน',
    description: 'จัดซื้อ License และมอบสิทธิ์ให้ครูในโรงเรียน',
    icon: RiSchoolLine,
  },
  {
    title: 'นักศึกษา',
    description: 'เตรียมสอนและพัฒนาทักษะด้วยสื่อคุณภาพ',
    icon: RiGraduationCapLine,
  },
  {
    title: 'ติวเตอร์',
    description: 'เลือกสื่อให้เหมาะกับผู้เรียนและรูปแบบการสอน',
    icon: RiBookOpenLine,
  },
];

const faqs = [
  {
    question: 'สมัครใช้งานและเปิดร้านฟรีไหม',
    answer:
      'สมัครสมาชิกและส่งคำขอเปิดร้านได้ฟรี ไม่มีค่าเปิดร้าน เมื่อร้านผ่านการตรวจสอบแล้วจึงเริ่มลงสินค้าและส่งอนุมัติได้',
  },
  {
    question: 'ค่าธรรมเนียมการขายเท่าไร',
    answer:
      'ระบบหักค่าธรรมเนียมจากยอดขายตามอัตราที่ E-KRU Marketplace กำหนด โดยผู้ขายจะเห็นอัตราค่าธรรมเนียมและยอดสุทธิก่อนยอมรับข้อตกลงและในหน้าการเงินของร้าน',
  },
  {
    question: 'ผู้ขายจะได้รับเงินเมื่อไร',
    answer:
      'ยอดขายที่ชำระสำเร็จจะเข้าสู่ยอดรอตรวจสอบก่อน เมื่อพ้นระยะพักยอดและถึงรอบโอน ระบบจะแสดงยอดพร้อมจ่ายให้ผู้ขายติดตามได้จากหน้า “รายได้ของร้าน”',
  },
  {
    question: 'ใครสามารถขายสื่อได้บ้าง',
    answer:
      'ครู บุคคลทั่วไป โรงเรียน บริษัท สำนักพิมพ์ และมหาวิทยาลัยสามารถสมัครเป็นผู้ขายได้ โดยต้องยืนยันตัวตน บัญชีรับเงิน และยอมรับข้อตกลงของ Marketplace',
  },
  {
    question: 'รองรับไฟล์ประเภทใด',
    answer:
      'รองรับ PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ZIP และไฟล์รูปภาพ JPG, PNG, WebP โดยไฟล์สินค้าแต่ละไฟล์มีขนาดไม่เกิน 50 MB และภาพปกไม่เกิน 5 MB',
  },
];

export function MarketplaceLandingView() {
  return (
    <>
      <Box
        sx={{
          py: { xs: 8, md: 14 },
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 82% 18%, rgba(21,101,245,0.18), transparent 32%), radial-gradient(circle at 15% 82%, rgba(24,185,160,0.12), transparent 30%), linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%)',
        }}
      >
        <Container maxWidth="xl">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3.5} alignItems={{ xs: 'center', md: 'flex-start' }}>
                <Chip
                  color="primary"
                  variant="soft"
                  icon={<RiGraduationCapLine />}
                  label="E-KRU Marketplace"
                />
                <Typography
                  component="h1"
                  variant="h1"
                  sx={{
                    maxWidth: 760,
                    fontSize: { xs: 42, sm: 54, md: 72 },
                    lineHeight: 1.08,
                    textAlign: { xs: 'center', md: 'left' },
                  }}
                >
                  พื้นที่รวมสื่อการสอน
                  <Box component="span" sx={{ display: 'block', color: 'primary.main' }}>
                    จากครู เพื่อครู
                  </Box>
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    maxWidth: 680,
                    fontWeight: 400,
                    color: 'text.secondary',
                    lineHeight: 1.8,
                    textAlign: { xs: 'center', md: 'left' },
                  }}
                >
                  ค้นหา ซื้อ และแบ่งปันแผนการสอน ใบงาน แบบทดสอบ
                  และสื่อคุณภาพจากครูและนักสร้างสรรค์ทั่วประเทศ
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    size="large"
                    variant="contained"
                    component={RouterLink}
                    href={paths.marketplace.products}
                    startIcon={<RiShoppingBag3Line />}
                  >
                    เลือกซื้อสื่อการสอน
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    component={RouterLink}
                    href={paths.marketplace.seller}
                    startIcon={<RiStore2Line />}
                  >
                    เริ่มต้นขายผลงาน
                  </Button>
                </Stack>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 5,
                  color: 'common.white',
                  background: 'linear-gradient(145deg, #0B3B91 0%, #1565F5 100%)',
                  boxShadow: '0 32px 80px rgba(13,63,156,0.28)',
                }}
              >
                <Stack spacing={3}>
                  <RiShieldCheckLine size={52} />
                  <Typography variant="h3">Marketplace ที่เข้าใจการศึกษา</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.8 }}>
                    สินค้าผ่านการตรวจสอบก่อนเผยแพร่ ชำระเงินอย่างปลอดภัย
                    และดาวน์โหลดไฟล์จากบัญชีของคุณได้ทุกเวลา
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="h4">1 บัญชี</Typography>
                      <Typography variant="caption">ใช้ร่วมกับ E-KRU</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="h4">0 บาท</Typography>
                      <Typography variant="caption">ค่าเปิดร้าน</Typography>
                    </Grid>
                  </Grid>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box
        sx={{
          py: { xs: 5, md: 6 },
          color: 'common.white',
          bgcolor: 'primary.darker',
        }}
      >
        <Container maxWidth="xl">
          <Typography
            variant="overline"
            sx={{ display: 'block', mb: 2.5, textAlign: 'center', color: 'primary.lighter' }}
          >
            Trusted By
          </Typography>
          <Grid container>
            {trustMetrics.map((metric, index) => (
              <Grid key={metric.label} size={{ xs: 12, sm: 4 }}>
                <Box
                  sx={{
                    py: { xs: 2, sm: 1 },
                    textAlign: 'center',
                    borderRight: { sm: index < trustMetrics.length - 1 ? '1px solid' : 0 },
                    borderColor: { sm: 'rgba(255,255,255,0.18)' },
                  }}
                >
                  <Typography variant="h2" sx={{ color: 'common.white' }}>
                    {metric.value}
                  </Typography>
                  <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.72)' }}>
                    {metric.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4.5}>
          <SectionHeading
            eyebrow="E-KRU MARKETPLACE"
            title="ทำไมต้อง E-KRU"
            description="ทุกสิ่งที่ครูต้องการ ตั้งแต่ค้นหาสื่อไปจนถึงสร้างรายได้จากผลงาน"
          />
          <Grid container spacing={2.5}>
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Grid key={benefit.title} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 3,
                      height: 1,
                      borderRadius: 3,
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 },
                    }}
                  >
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        display: 'grid',
                        borderRadius: 2.25,
                        placeItems: 'center',
                        color: benefit.color,
                        bgcolor: benefit.background,
                      }}
                    >
                      <Icon size={30} />
                    </Box>
                    <Typography variant="h6" sx={{ mt: 2.5 }}>
                      {benefit.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, lineHeight: 1.75 }}
                    >
                      {benefit.description}
                    </Typography>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </Container>

      <Container maxWidth="xl" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3">เลือกสื่อตามรูปแบบที่ต้องการ</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              เข้าสู่หน้าสื่อการสอนเพื่อค้นหาและเปรียบเทียบผลงานจากผู้ขาย
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Grid key={category.label} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    component={RouterLink}
                    href={`${paths.marketplace.products}?category=${encodeURIComponent(category.label)}`}
                    sx={{
                      p: 3,
                      height: 1,
                      display: 'block',
                      color: 'text.primary',
                      textAlign: 'center',
                      textDecoration: 'none',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 },
                    }}
                  >
                    <Box sx={{ color: 'primary.main' }}>
                      <Icon size={38} />
                    </Box>
                    <Typography variant="h6" sx={{ mt: 1.5 }}>
                      {category.label}
                    </Typography>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </Container>

      <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: 'background.neutral' }}>
        <Container maxWidth="xl">
          <Stack spacing={5}>
            <SectionHeading
              eyebrow="HOW IT WORKS"
              title="วิธีใช้งาน"
              description="เริ่มต้นได้ง่าย ไม่ว่าคุณต้องการซื้อสื่อหรือสร้างรายได้จากผลงาน"
            />
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <ProcessCard
                  title="สำหรับผู้ซื้อ"
                  description="ค้นหาสื่อที่ต้องการและนำไปใช้ได้ทันที"
                  steps={buyerSteps}
                  color="primary"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ProcessCard
                  title="สำหรับผู้ขาย"
                  description="เปิดร้าน ส่งผลงานตรวจสอบ และเริ่มสร้างรายได้"
                  steps={sellerSteps}
                  color="success"
                />
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4.5}>
          <SectionHeading
            eyebrow="FOR EVERY LEARNER"
            title="สำหรับใคร"
            description="พื้นที่เดียวสำหรับผู้สอน ผู้เรียน และสถานศึกษาทุกรูปแบบ"
          />
          <Grid container spacing={2.5}>
            {audiences.map((audience) => {
              const Icon = audience.icon;
              return (
                <Grid key={audience.title} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 3,
                      height: 1,
                      borderRadius: 3,
                      textAlign: 'center',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        mx: 'auto',
                        display: 'grid',
                        borderRadius: '50%',
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: 'primary.lighter',
                      }}
                    >
                      <Icon size={32} />
                    </Box>
                    <Typography variant="h5" sx={{ mt: 2.5 }}>
                      {audience.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, lineHeight: 1.7 }}
                    >
                      {audience.description}
                    </Typography>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Box sx={{ pt: { xs: 4, md: 6 }, pb: 2 }}>
            <SectionHeading
              eyebrow="FREQUENTLY ASKED QUESTIONS"
              title="คำถามที่พบบ่อย"
              description="ข้อมูลสำคัญก่อนเริ่มซื้อหรือเปิดร้านบน E-KRU Marketplace"
            />
            <Stack spacing={1.5} sx={{ maxWidth: '100%', mx: 'auto', mt: 4, pb: 2 }}>
              {faqs.map((faq, index) => (
                <Accordion
                  key={faq.question}
                  disableGutters
                  defaultExpanded={index === 0}
                  elevation={0}
                  sx={{
                    px: { xs: 2, md: 2.5 },
                    borderRadius: '12px !important',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    '&::before': { display: 'none' },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<RiArrowDownSLine size={22} />}
                    sx={{
                      px: 0,
                      minHeight: 64,
                      '& .MuiAccordionSummary-content': { my: 1.5 },
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          display: 'grid',
                          flexShrink: 0,
                          borderRadius: '50%',
                          placeItems: 'center',
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                          typography: 'subtitle2',
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography variant="subtitle1">{faq.question}</Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0, pb: 2.5 }}>
                    <Typography color="text.secondary" sx={{ pl: { sm: 6 }, lineHeight: 1.85 }}>
                      {faq.answer}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </Box>

          <Card
            sx={{
              mt: 3,
              p: { xs: 3, md: 5 },
              borderRadius: 4,
              color: 'common.white',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #0B3B91 0%, #1565F5 100%)',
            }}
          >
            <Typography variant="h3">เริ่มต้นกับ E-KRU Marketplace วันนี้</Typography>
            <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.75)' }}>
              ค้นหาสื่อที่เหมาะกับห้องเรียน หรือเปิดร้านเพื่อแบ่งปันผลงานของคุณ
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="center"
              sx={{ mt: 3 }}
            >
              <Button
                size="large"
                variant="contained"
                color="inherit"
                component={RouterLink}
                href={paths.marketplace.products}
              >
                เลือกดูสื่อการสอน
              </Button>
              <Button
                size="large"
                variant="outlined"
                component={RouterLink}
                href={paths.marketplace.seller}
                sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.45)' }}
              >
                สมัครเป็นผู้ขาย
              </Button>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="overline" color="primary.main">
        {eyebrow}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.5 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 680, mx: 'auto', mt: 1.25 }}>
        {description}
      </Typography>
    </Box>
  );
}

function ProcessCard({
  title,
  description,
  steps,
  color,
}: {
  title: string;
  description: string;
  steps: Array<{ label: string; icon: RemixiconComponentType }>;
  color: 'primary' | 'success';
}) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 3, md: 4 }, height: 1, borderRadius: 3 }}>
      <Chip size="small" color={color} variant="soft" label={title} />
      <Typography variant="h5" sx={{ mt: 2 }}>
        {description}
      </Typography>
      <Stack spacing={1.25} sx={{ mt: 3 }}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Stack key={step.label} spacing={1.25}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: `${color}.lighter`,
                  color: `${color}.darker`,
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    display: 'grid',
                    flexShrink: 0,
                    borderRadius: 1.5,
                    placeItems: 'center',
                    color: `${color}.main`,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Icon size={21} />
                </Box>
                <Typography variant="subtitle1">{step.label}</Typography>
                <Typography variant="caption" sx={{ ml: 'auto !important', opacity: 0.65 }}>
                  {String(index + 1).padStart(2, '0')}
                </Typography>
              </Stack>
              {index < steps.length - 1 && (
                <Box sx={{ display: 'grid', placeItems: 'center', color: `${color}.main` }}>
                  <RiArrowDownLine size={20} />
                </Box>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}
