'use client';

import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import {
  RiBook2Line,
  RiChat3Line,
  RiFlowChart,
  RiQrScan2Line,
  RiUserAddLine,
  RiLoginBoxLine,
  RiBuildingLine,
  RiPriceTag3Line,
  RiArrowDownSLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

type FlowStep = {
  readonly title: string;
  readonly detail: string;
  readonly fe?: string;
  readonly be?: readonly string[];
};

type Flow = {
  readonly id: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly FlowStep[];
};

const FLOWS: readonly Flow[] = [
  {
    id: 'auth',
    icon: <RiLoginBoxLine />,
    title: '1. เข้าสู่ระบบและกำหนดสิทธิ์',
    summary: 'ทุกบทบาทเข้าทางเดียวกัน ระบบตรวจสอบและพาไปหน้าแรกของตัวเองโดยอัตโนมัติ',
    steps: [
      {
        title: 'กรอกชื่อผู้ใช้และรหัสผ่าน',
        detail:
          'ตรวจรหัสผ่าน (bcrypt), สถานะบัญชี/นักเรียน, สถานะโรงเรียนและแพ็กเกจต้องใช้งานได้ และผ่านการจำกัดจำนวนครั้งเข้าสู่ระบบผิด (rate limit ตาม IP และชื่อผู้ใช้)',
        fe: '/auth/jwt/sign-in',
        be: ['POST /api/auth/sign-in'],
      },
      {
        title: 'ดึงข้อมูลผู้ใช้แบบเต็ม',
        detail: 'สำหรับครู จะดึงฝ่ายที่สังกัดและสิทธิ์ที่ได้รับมอบในฝ่ายนั้นมาด้วย',
        fe: 'อัตโนมัติหลังล็อกอิน',
        be: ['GET /api/auth/me'],
      },
      {
        title: 'พาไปหน้าแรกตามบทบาท',
        detail:
          'master_admin → /master, ผู้ดูแลโรงเรียน/ครูที่ได้รับมอบสิทธิ์ฝ่าย → /admin, ครู → /teacher, นักเรียน → /student',
      },
      {
        title: 'ด่านตรวจก่อนเข้าใช้งานทุกหน้า',
        detail:
          'ต้องล็อกอินอยู่ · ต้องเปลี่ยนรหัสผ่านถ้าเป็นบัญชีสร้างใหม่ · ต้องยอมรับข้อตกลงการใช้งาน · แพ็กเกจของโรงเรียนต้องยังใช้งานได้ (ไม่บังคับกับ master_admin)',
      },
    ],
  },
  {
    id: 'enrollment',
    icon: <RiUserAddLine />,
    title: '2. ลงทะเบียนนักเรียนเข้าห้องเรียน',
    summary: 'ทำผ่านหน้ารายการห้องเรียน ไม่มีหน้าฟอร์มแยกต่างหากอีกต่อไป',
    steps: [
      {
        title: 'เปิดรายการห้องเรียนตามปีการศึกษา',
        detail: 'หน้าเดียวกันใช้ได้ทั้งฝั่งผู้ดูแลโรงเรียนและครูหัวหน้าฝ่ายที่มีสิทธิ์ "จัดการลงทะเบียน"',
        fe: '/admin/enrollment หรือ /teacher/department-work/enrollment',
        be: ['GET /api/classrooms', 'GET /api/enrollments'],
      },
      {
        title: 'เปิดห้องเรียน แล้วกด "เพิ่มนักเรียน"',
        detail: 'เพิ่มผ่านกล่องโต้ตอบ (dialog) บนหน้ารายชื่อของห้องนั้น',
        fe: '.../enrollment/classroom/[id]',
        be: ['POST /api/enrollments'],
      },
      {
        title: 'แก้ไข ย้าย หรือถอนนักเรียนออกจากห้อง',
        detail: 'รวมถึงดูความคืบหน้ารายวิชาของนักเรียนแต่ละคน',
        be: ['PATCH /api/enrollments/[id]', 'DELETE /api/enrollments/[id]', 'GET /api/enrollments/[id]/progress'],
      },
      {
        title: 'เลื่อนชั้นยกชุดตอนขึ้นปีการศึกษาใหม่',
        detail: 'ปุ่ม "เลื่อนชั้นยกชุด" บนหน้ารายการห้องเรียน',
        be: ['POST /api/enrollments/bulk-promote'],
      },
    ],
  },
  {
    id: 'attendance',
    icon: <RiQrScan2Line />,
    title: '3. เช็กชื่อเข้าเรียน',
    summary: 'มี 3 ทาง: สแกน QR รายคาบ, บันทึกมือหน้าเสาธง, และนักเรียนดูประวัติของตัวเอง',
    steps: [
      {
        title: 'สแกน QR รายคาบเรียน',
        detail:
          'ครูเปิดรอบสแกน เลือกวิชา/ห้อง แล้วสแกน QR ของนักเรียนทีละคน — บันทึกลงตาราง attendance (คาบวิชา) หรือ homeroom_assembly_attendance (หน้าเสาธง) ตามประเภทรอบ',
        fe: '/teacher/attendance-scan → /teacher/attendance-scan/session/[id]',
        be: [
          'POST .../attendance-scan/sessions',
          'POST .../sessions/[id]/scan',
          'PATCH .../sessions/[id] (ปิดรอบ)',
        ],
      },
      {
        title: 'บันทึกหน้าเสาธงด้วยมือ (ครูประจำชั้น)',
        detail: 'ไม่ต้องสแกน เลือกสถานะ มา/ขาด/ลา/สาย ทีละคนในตารางเดียว',
        fe: '/teacher/students',
        be: ['GET /api/teacher/homeroom-attendance', 'POST /api/teacher/homeroom-attendance'],
      },
      {
        title: 'นักเรียนดูประวัติการมาเรียนของตัวเอง',
        detail: 'แสดงเฉพาะการเช็กชื่อรายคาบวิชา ไม่รวมหน้าเสาธง',
        fe: '/student/attendance',
        be: ['GET /api/student/attendance'],
      },
    ],
  },
  {
    id: 'assignment',
    icon: <RiBook2Line />,
    title: '4. งาน แบบทดสอบ และการให้คะแนน',
    summary: 'งานทั่วไปให้คะแนนด้วยมือ ส่วนแบบทดสอบให้คะแนนอัตโนมัติ แต่ลงตารางคะแนนเดียวกัน',
    steps: [
      {
        title: 'ครูสร้างงานหรือแบบทดสอบ',
        detail: 'งานทั่วไป (ไฟล์แนบ) หรือแบบทดสอบ (คำถาม/ตัวเลือก/เวลาจำกัด) ผ่านฟอร์มเดียวกันของแต่ละประเภท',
        fe: '.../assignments/[id]/new หรือ .../assignments/[id]/quiz/new',
        be: ['POST /api/teacher-assignments/[id]/assignments'],
      },
      {
        title: 'นักเรียนทำแบบทดสอบ',
        detail: 'เริ่มทำ (สร้าง/ต่อรอบทำ) แล้วส่งคำตอบ ระบบตรวจให้คะแนนทันทีและบันทึกลงตาราง scores',
        fe: '/student/assignments/[id]/quiz',
        be: ['POST /api/student/quizzes/[id]/start', 'POST /api/student/quizzes/[id]/submit'],
      },
      {
        title: 'ครูให้คะแนนงานที่ไม่ใช่แบบทดสอบ',
        detail: 'ตารางให้คะแนนต่อชิ้นงาน หนึ่งแถวต่อนักเรียนหนึ่งคน',
        fe: '/teacher/gradebook/[assignmentId]',
        be: ['GET /api/assignments/[id]/scores', 'POST /api/assignments/[id]/scores'],
      },
    ],
  },
  {
    id: 'line',
    icon: <RiChat3Line />,
    title: '5. แจ้งเตือนผู้ปกครองผ่าน LINE',
    summary: 'ส่งทันทีเมื่อบันทึกเหตุการณ์ แล้วมีตัวตั้งเวลาช่วยส่งซ้ำสิ่งที่ยังค้างอยู่',
    steps: [
      {
        title: 'เกิดเหตุการณ์ที่ต้องแจ้งผู้ปกครอง',
        detail: 'การเช็กชื่อ (ขาด/ลา/สาย) หรือการส่งประกาศจากครู/โรงเรียน จะเข้าคิวข้อความรอส่ง',
        be: ['เรียกจาก /api/teacher/homeroom-attendance, attendance-scan, teacher-assignments/.../attendance, /api/teacher/announcements'],
      },
      {
        title: 'พยายามส่งทันทีหลังบันทึก',
        detail: 'ทำงานเบื้องหลังทันทีที่มีการเขียนข้อมูล ไม่ต้องรอตัวตั้งเวลา',
      },
      {
        title: 'ตัวตั้งเวลาส่งซ้ำข้อความที่ยังค้าง',
        detail: 'ป้องกันข้อความตกหล่นหากการส่งทันทีล้มเหลว ทำงานวันละ 1 ครั้งตามที่ตั้งไว้',
        be: ['GET /api/internal/line-notifications/process (cron, ตรวจสิทธิ์ด้วย CRON_SECRET)'],
      },
      {
        title: 'ผูกบัญชี LINE ของผู้ปกครอง',
        detail:
          'ครู/ผู้ดูแลกด "เชิญเชื่อม LINE" เพื่อสร้างโค้ดอายุ 24 ชั่วโมง ผู้ปกครองพิมพ์โค้ดในแชท LINE ของโรงเรียน ระบบยืนยันและผูกบัญชีให้อัตโนมัติ',
        be: ['POST /api/guardians/[guardianId]/line-link', 'POST /api/line/webhook/[schoolId]'],
      },
    ],
  },
  {
    id: 'subscription',
    icon: <RiBuildingLine />,
    title: '6. เปิดโรงเรียนใหม่และแพ็กเกจการใช้งาน',
    summary: 'สิทธิ์ของ master_admin เท่านั้น เป็นตัวกำหนดว่าโรงเรียนหนึ่งใช้งานอะไรได้บ้าง',
    steps: [
      {
        title: 'สร้างโรงเรียนใหม่',
        detail: 'ระบบตั้งฝ่ายเริ่มต้นให้อัตโนมัติ แต่ยังไม่มีแพ็กเกจจนกว่าจะตั้งค่าในขั้นต่อไป',
        fe: '/master/school/new',
        be: ['POST /api/schools'],
      },
      {
        title: 'ตั้งค่าแพ็กเกจของโรงเรียนนั้น',
        detail: 'สถานะ (ทดลอง/ใช้งาน/ระงับ), วันหมดอายุ, จำนวนที่นั่งสูงสุดต่อบทบาท, และฟีเจอร์ที่เปิดใช้งาน',
        fe: '/master/school/[id]/subscription',
        be: ['GET /api/schools/[id]/subscription', 'PATCH /api/schools/[id]/subscription'],
      },
      {
        title: 'จัดการแม่แบบแพ็กเกจไว้ใช้ซ้ำ',
        detail: 'เทมเพลตสำหรับหยิบไปตั้งค่าให้โรงเรียนใหม่ได้เร็วขึ้น แยกจากแพ็กเกจจริงที่บังคับใช้ต่อโรงเรียน',
        fe: '/master/subscription-plan',
        be: ['GET/POST /api/subscription-plans', 'PATCH /api/subscription-plans/[id]'],
      },
      {
        title: 'สร้างบัญชีผู้ดูแลให้โรงเรียนนั้น',
        fe: '/master/school-admin/new',
        detail: 'ผู้ดูแลโรงเรียนคนแรกที่จะเข้าไปตั้งค่าปีการศึกษา ห้องเรียน และเพิ่มครู/นักเรียนต่อ',
        be: ['POST /api/admin/users'],
      },
      {
        title: 'การบังคับใช้แพ็กเกจ',
        detail:
          'ตรวจตอนล็อกอิน (สถานะ/วันหมดอายุ) · ตรวจซ้ำทุกครั้งที่เปลี่ยนหน้าฝั่งโรงเรียน (ฟีเจอร์เฉพาะหน้าต้องเปิดอยู่) · จำกัดจำนวนบัญชีตามที่นั่งที่ซื้อไว้',
      },
    ],
  },
];

// ----------------------------------------------------------------------

export function SystemFlowView() {
  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Card
        sx={{
          p: { xs: 2.5, sm: 4 },
          mb: { xs: 3, md: 4 },
          overflow: 'hidden',
          color: 'common.white',
          position: 'relative',
          borderRadius: 3,
          background: 'linear-gradient(135deg, #123A72 0%, #1976D2 100%)',
        }}
      >
        <Box sx={{ maxWidth: 650, position: 'relative', zIndex: 1 }}>
          <Chip
            icon={<RiFlowChart />}
            label="เอกสารระบบ"
            sx={{
              mb: 2,
              color: 'common.white',
              bgcolor: 'rgba(255,255,255,0.14)',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Typography
            component="h1"
            variant="h3"
            sx={{ fontSize: { xs: 28, sm: 38 }, lineHeight: 1.25 }}
          >
            การทำงานของระบบ ตั้งแต่หน้าเว็บถึง API
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: 600, opacity: 0.82 }}>
            สรุป flow การทำงานหลักของระบบ แต่ละขั้นตอนระบุว่าเกิดที่หน้าเว็บ (FE) หรือ endpoint (BE)
            ใด สำหรับผู้ดูแลระบบใช้ทำความเข้าใจภาพรวมก่อนตัดสินใจเชิงระบบ
          </Typography>
        </Box>
        <RiFlowChart
          size={180}
          style={{ right: -24, bottom: -40, opacity: 0.08, position: 'absolute' }}
        />
      </Card>

      <Box>
        {FLOWS.map((flow) => (
          <Accordion key={flow.id} disableGutters defaultExpanded={flow.id === 'auth'}>
            <AccordionSummary
              expandIcon={<RiArrowDownSLine />}
              id={`flow-${flow.id}-header`}
              aria-controls={`flow-${flow.id}-content`}
            >
              <Box sx={{ gap: 2, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    flexShrink: 0,
                    borderRadius: '50%',
                    placeItems: 'center',
                    color: 'primary.main',
                    bgcolor: 'primary.lighter',
                    '& svg': { width: 20, height: 20 },
                  }}
                >
                  {flow.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1">{flow.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    {flow.summary}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box
                sx={{
                  gap: 2.5,
                  pl: { xs: 0, sm: 7 },
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {flow.steps.map((step, index) => (
                  <Box key={step.title}>
                    <Typography variant="subtitle2">
                      {index + 1}. {step.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary' }}>
                      {step.detail}
                    </Typography>
                    {(step.fe || step.be) && (
                      <Box sx={{ mt: 1, gap: 0.75, display: 'flex', flexWrap: 'wrap' }}>
                        {step.fe && (
                          <Chip
                            size="small"
                            variant="outlined"
                            color="info"
                            label={`FE: ${step.fe}`}
                            sx={{ fontFamily: 'monospace', fontSize: 12 }}
                          />
                        )}
                        {step.be?.map((route) => (
                          <Chip
                            key={route}
                            size="small"
                            variant="outlined"
                            color="secondary"
                            label={`BE: ${route}`}
                            sx={{ fontFamily: 'monospace', fontSize: 12 }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
        <Divider />
      </Box>

      <Alert severity="info" icon={<RiPriceTag3Line />} sx={{ mt: 4, borderRadius: 2 }}>
        <Typography variant="subtitle2">หน้าที่พบว่าไม่มีเมนูเชื่อมถึงแล้ว</Typography>
        <Typography variant="body2">
          <code>/teacher/enrollment/new</code>, <code>/teacher/classroom/new</code> และ{' '}
          <code>/teacher/subject/new</code> ยังเปิดใช้งานได้ผ่าน URL ตรง ๆ แต่ไม่มีปุ่มหรือเมนูใดพาไปแล้ว
          — เหลือจากตอนย้ายฟอร์มเหล่านี้ไปเป็นกล่องโต้ตอบบนหน้ารายการ (ดู flow ที่ 2) ยังไม่ได้ตัดสินใจว่าจะลบทิ้งหรือดึงกลับมาใช้
        </Typography>
      </Alert>
    </Container>
  );
}
