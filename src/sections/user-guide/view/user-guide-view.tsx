'use client';

import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import {
  RiTeamLine,
  RiBook2Line,
  RiGuideLine,
  RiQrScan2Line,
  RiUserAddLine,
  RiMegaphoneLine,
  RiDashboardLine,
  RiArrowRightLine,
  RiPresentationLine,
  RiGraduationCapLine,
  RiCalendarScheduleLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

type GuideRole = 'admin' | 'teacher';

type GuideStep = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly action: string;
  readonly icon: ReactNode;
  readonly tips: readonly string[];
};

const COPY = {
  th: {
    admin: {
      eyebrow: 'คู่มือผู้ดูแลโรงเรียน',
      title: 'เริ่มต้นจัดการโรงเรียนอย่างเป็นขั้นตอน',
      description:
        'ตั้งค่าข้อมูลพื้นฐาน เพิ่มครูและนักเรียน แล้วเปิดใช้งานการเรียนการสอนและการสื่อสารกับผู้ปกครอง',
      notice:
        'แนะนำให้ทำตามลำดับด้านล่าง เพื่อให้ข้อมูลปีการศึกษา ห้องเรียน และการลงทะเบียนเชื่อมกันถูกต้อง',
      checklist: 'ลำดับแนะนำสำหรับการเริ่มใช้งาน',
      steps: [
        {
          title: 'ตรวจสอบข้อมูลโรงเรียน',
          description: 'เพิ่มชื่อ ที่อยู่ โลโก้ และข้อมูลติดต่อที่จะแสดงในระบบ',
          href: paths.admin.school,
          action: 'ไปที่ข้อมูลโรงเรียน',
          icon: <RiDashboardLine />,
          tips: ['ตรวจชื่อโรงเรียนภาษาไทยและอังกฤษ', 'เพิ่มโลโก้ให้ครูและผู้ปกครองจำได้ง่าย'],
        },
        {
          title: 'สร้างโครงสร้างการเรียน',
          description: 'สร้างปีการศึกษา ห้องเรียน และรายวิชา ก่อนเพิ่มการลงทะเบียน',
          href: paths.admin.academicYear.root,
          action: 'จัดการปีการศึกษา',
          icon: <RiPresentationLine />,
          tips: ['เปิดปีการศึกษาที่กำลังใช้งาน', 'ตรวจชื่อห้องและระดับชั้นให้ถูกต้อง'],
        },
        {
          title: 'เพิ่มครูและนักเรียน',
          description: 'สร้างบัญชีผู้ใช้งานและกรอกข้อมูลบุคคลให้ครบถ้วน',
          href: paths.admin.user.root,
          action: 'จัดการครู/บุคลากร',
          icon: <RiTeamLine />,
          tips: [
            'บัญชีทุกคนต้องอยู่ในโรงเรียนเดียวกัน',
            'ปิด Active เมื่อต้องการระงับการเข้าสู่ระบบ',
          ],
        },
        {
          title: 'มอบหมายครูและลงทะเบียนนักเรียน',
          description: 'กำหนดครูผู้สอน ครูประจำชั้น และเพิ่มนักเรียนเข้าห้อง',
          href: paths.admin.teacherAssignment.root,
          action: 'มอบหมายครู',
          icon: <RiUserAddLine />,
          tips: ['เลือกครูประจำชั้นให้ครบ', 'ตรวจรายชื่อนักเรียนในแต่ละห้องก่อนเปิดภาคเรียน'],
        },
        {
          title: 'เชื่อม LINE และส่งประกาศ',
          description: 'ตั้งค่า LINE Official Account เพื่อแจ้งขาด ลา สาย และข่าวสารถึงผู้ปกครอง',
          href: paths.admin.lineNotifications,
          action: 'ตั้งค่า LINE',
          icon: <RiMegaphoneLine />,
          tips: ['ทดสอบ Webhook ก่อนใช้งานจริง', 'ให้ผู้ปกครองสแกน QR เชื่อมบัญชี'],
        },
      ],
    },
    teacher: {
      eyebrow: 'คู่มือครูผู้สอน',
      title: 'งานประจำวันของครูอยู่ครบในที่เดียว',
      description:
        'ดูวิชาที่สอน เช็กชื่อนักเรียน บันทึกงานและคะแนน รวมถึงสื่อสารกับผู้ปกครองในห้องที่ดูแล',
      notice: 'เมนูที่มองเห็นขึ้นอยู่กับหน้าที่ที่โรงเรียนมอบหมายและแพ็กเกจที่โรงเรียนเปิดใช้งาน',
      checklist: 'เริ่มใช้งานสำหรับครู',
      steps: [
        {
          title: 'ตรวจสอบโปรไฟล์และตารางสอน',
          description: 'ตรวจข้อมูลติดต่อ วิชาที่ได้รับมอบหมาย และตารางสอนประจำวัน',
          href: paths.teacher.profile,
          action: 'เปิดโปรไฟล์ของฉัน',
          icon: <RiCalendarScheduleLine />,
          tips: ['แจ้งผู้ดูแลหากรายวิชาหรือห้องเรียนไม่ถูกต้อง', 'ตรวจตารางสอนก่อนเริ่มภาคเรียน'],
        },
        {
          title: 'ดูวิชาที่สอนและบันทึกคะแนน',
          description: 'สร้างงาน ดูรายชื่อนักเรียน และบันทึกคะแนนในแต่ละรายวิชา',
          href: paths.teacher.assignments,
          action: 'เปิดวิชาที่สอน',
          icon: <RiBook2Line />,
          tips: ['กำหนดคะแนนเต็มและวันส่งให้ชัดเจน', 'ส่งออกคะแนนเป็น CSV หรือ Excel ได้'],
        },
        {
          title: 'ดูแลนักเรียนประจำชั้น',
          description: 'ดูข้อมูลนักเรียน เช็กชื่อเข้าแถว และติดตามประวัติการมาเรียน',
          href: paths.teacher.students,
          action: 'เปิดนักเรียนของฉัน',
          icon: <RiGraduationCapLine />,
          tips: ['บันทึกแยกช่วงเช้าและเย็น', 'ตรวจสถานะ ขาด ลา และสาย ก่อนบันทึก'],
        },
        {
          title: 'สแกนเช็กชื่อรายคาบ',
          description: 'เปิดรอบเช็กชื่อและสแกน QR ประจำตัวนักเรียนด้วยกล้อง',
          href: paths.teacher.attendanceScan,
          action: 'เปิดหน้าสแกน',
          icon: <RiQrScan2Line />,
          tips: ['เลือกรายวิชาและคาบให้ถูกต้องก่อนเริ่ม', 'ปิดรอบสแกนเมื่อหมดเวลา'],
        },
        {
          title: 'ส่งประกาศถึงผู้ปกครอง',
          description: 'ส่งข้อความหรือรูปภาพไปยังผู้ปกครองของห้องที่เป็นครูประจำชั้น',
          href: paths.teacher.announcements,
          action: 'สร้างประกาศ',
          icon: <RiMegaphoneLine />,
          tips: ['ตรวจกลุ่มเป้าหมายก่อนส่ง', 'ใช้ข้อความสั้นและระบุวันที่ให้ชัดเจน'],
        },
      ],
    },
    step: 'ขั้นตอน',
    open: 'เปิดเมนู',
    helpTitle: 'หากข้อมูลหรือเมนูไม่ครบ',
    helpText: 'ติดต่อผู้ดูแลโรงเรียนเพื่อตรวจสอบสิทธิ์ แพ็กเกจ และการมอบหมายห้องเรียนหรือรายวิชา',
  },
  en: {
    admin: {
      eyebrow: 'School administrator guide',
      title: 'Set up your school step by step',
      description:
        'Configure school information, add teachers and students, then enable teaching workflows and parent communication.',
      notice:
        'Follow the sequence below so academic years, classrooms, and enrollments are connected correctly.',
      checklist: 'Recommended setup order',
      steps: [
        {
          title: 'Review school information',
          description: 'Add the school name, address, logo, and contact information.',
          href: paths.admin.school,
          action: 'Open school information',
          icon: <RiDashboardLine />,
          tips: ['Check Thai and English school names', 'Upload a recognizable school logo'],
        },
        {
          title: 'Create the academic structure',
          description: 'Create an academic year, classrooms, and subjects before enrollment.',
          href: paths.admin.academicYear.root,
          action: 'Manage academic years',
          icon: <RiPresentationLine />,
          tips: ['Activate the current academic year', 'Check classroom and grade names'],
        },
        {
          title: 'Add teachers and students',
          description: 'Create user accounts and complete each person’s information.',
          href: paths.admin.user.root,
          action: 'Manage staff',
          icon: <RiTeamLine />,
          tips: ['Every account must belong to this school', 'Disable Active to suspend sign-in'],
        },
        {
          title: 'Assign teachers and enroll students',
          description: 'Assign subject teachers, homeroom teachers, and students to classrooms.',
          href: paths.admin.teacherAssignment.root,
          action: 'Assign teachers',
          icon: <RiUserAddLine />,
          tips: ['Assign every homeroom teacher', 'Review classroom rosters before term starts'],
        },
        {
          title: 'Connect LINE and send announcements',
          description: 'Configure LINE OA for attendance alerts and school announcements.',
          href: paths.admin.lineNotifications,
          action: 'Configure LINE',
          icon: <RiMegaphoneLine />,
          tips: ['Verify the webhook first', 'Ask guardians to scan their connection QR'],
        },
      ],
    },
    teacher: {
      eyebrow: 'Teacher guide',
      title: 'Your daily teaching work in one place',
      description:
        'Review assigned subjects, take attendance, record work and scores, and communicate with guardians.',
      notice:
        'Available menus depend on your school assignment and the features enabled in its plan.',
      checklist: 'Getting started as a teacher',
      steps: [
        {
          title: 'Review your profile and timetable',
          description: 'Check your contact details, assigned subjects, and daily timetable.',
          href: paths.teacher.profile,
          action: 'Open my profile',
          icon: <RiCalendarScheduleLine />,
          tips: ['Tell the administrator if an assignment is incorrect', 'Review the timetable'],
        },
        {
          title: 'Manage subjects and scores',
          description: 'Create assignments, view students, and record scores for each subject.',
          href: paths.teacher.assignments,
          action: 'Open my subjects',
          icon: <RiBook2Line />,
          tips: ['Set a clear maximum score and due date', 'Export scores to CSV or Excel'],
        },
        {
          title: 'Support homeroom students',
          description: 'View student profiles, take assembly attendance, and review history.',
          href: paths.teacher.students,
          action: 'Open my students',
          icon: <RiGraduationCapLine />,
          tips: ['Record morning and evening separately', 'Review absence and late status'],
        },
        {
          title: 'Scan class attendance',
          description: 'Start a session and scan each student’s personal QR code.',
          href: paths.teacher.attendanceScan,
          action: 'Open QR scanner',
          icon: <RiQrScan2Line />,
          tips: ['Select the correct subject and period', 'Close the session when time is up'],
        },
        {
          title: 'Send guardian announcements',
          description: 'Send text or images to guardians in your homeroom classrooms.',
          href: paths.teacher.announcements,
          action: 'Create announcement',
          icon: <RiMegaphoneLine />,
          tips: ['Review recipients before sending', 'Keep the message concise and date-specific'],
        },
      ],
    },
    step: 'Step',
    open: 'Open menu',
    helpTitle: 'Missing information or menus?',
    helpText:
      'Contact your school administrator to review permissions, plan features, and classroom or subject assignments.',
  },
} as const;

// ----------------------------------------------------------------------

export function UserGuideView({ role }: { role: GuideRole }) {
  const { currentLang } = useTranslate();
  const language = currentLang.value === 'en' ? 'en' : 'th';
  const common = COPY[language];
  const content = common[role];
  const steps: readonly GuideStep[] = content.steps;

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
            icon={<RiGuideLine />}
            label={content.eyebrow}
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
            {content.title}
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: 600, opacity: 0.82 }}>
            {content.description}
          </Typography>
        </Box>
        <RiGuideLine
          size={180}
          style={{
            right: -24,
            bottom: -40,
            opacity: 0.08,
            position: 'absolute',
          }}
        />
      </Card>

      <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
        {content.notice}
      </Alert>

      <Typography component="h2" variant="h5" sx={{ mb: 1 }}>
        {content.checklist}
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        {steps.length} {language === 'en' ? 'steps' : 'ขั้นตอน'}
      </Typography>

      <Box>
        {steps.map((item, index) => (
          <GuideStepItem
            key={item.title}
            item={item}
            number={index + 1}
            stepLabel={common.step}
            openLabel={common.open}
            isLast={index === steps.length - 1}
          />
        ))}
      </Box>

      <Alert severity="warning" sx={{ mt: 4, borderRadius: 2 }}>
        <Typography variant="subtitle2">{common.helpTitle}</Typography>
        <Typography variant="body2">{common.helpText}</Typography>
      </Alert>
    </Container>
  );
}

function GuideStepItem({
  item,
  number,
  stepLabel,
  openLabel,
  isLast,
}: {
  item: GuideStep;
  number: number;
  stepLabel: string;
  openLabel: string;
  isLast: boolean;
}) {
  return (
    <Box
      sx={{
        gap: { xs: 1.5, sm: 2.5 },
        display: 'grid',
        gridTemplateColumns: { xs: '44px minmax(0, 1fr)', sm: '56px minmax(0, 1fr)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <Box
          sx={{
            width: { xs: 40, sm: 48 },
            height: { xs: 40, sm: 48 },
            display: 'grid',
            flexShrink: 0,
            borderRadius: '50%',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.lighter',
            '& svg': { width: 23, height: 23 },
          }}
        >
          {item.icon}
        </Box>
        {!isLast && <Divider orientation="vertical" flexItem sx={{ my: 1, minHeight: 52 }} />}
      </Box>

      <Box sx={{ pb: isLast ? 0 : { xs: 3, sm: 4 }, minWidth: 0 }}>
        <Typography variant="overline" sx={{ color: 'primary.main' }}>
          {stepLabel} {number}
        </Typography>
        <Typography component="h3" variant="h6">
          {item.title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {item.description}
        </Typography>

        <Box
          component="ul"
          sx={{
            pl: 2.25,
            my: 1.5,
            color: 'text.secondary',
            typography: 'body2',
            '& li + li': { mt: 0.5 },
          }}
        >
          {item.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </Box>

        <Button component={RouterLink} href={item.href} size="small" endIcon={<RiArrowRightLine />}>
          {item.action || openLabel}
        </Button>
      </Box>
    </Box>
  );
}
