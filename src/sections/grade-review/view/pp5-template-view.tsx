'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

const SAMPLE_ROWS = [
  { no: 1, code: '65001', name: 'เด็กชายตัวอย่าง หนึ่ง', work: 25, quiz: 10, mid: 18, final: 32, other: 5, total: 90, grade: '4' },
  { no: 2, code: '65002', name: 'เด็กหญิงตัวอย่าง สอง', work: 22, quiz: 8, mid: 15, final: 27, other: 5, total: 77, grade: '3.5' },
  { no: 3, code: '65003', name: 'เด็กชายตัวอย่าง สาม', work: 18, quiz: 7, mid: 12, final: 22, other: 4, total: 63, grade: '2' },
];

const DATA_FIELDS = [
  ['ข้อมูลโรงเรียน', 'ข้อมูลโรงเรียน'],
  ['ปีการศึกษา/ภาคเรียน', 'ปีการศึกษาและภาคเรียนของรายวิชา'],
  ['รายวิชา/ห้องเรียน', 'ครูประจำวิชา'],
  ['รายชื่อนักเรียน', 'ทะเบียนนักเรียนในห้อง'],
  ['คะแนนแต่ละหมวด', 'สมุดคะแนนของครู'],
  ['ผลการเรียน', 'คำนวณหลังฝ่ายวิชาการอนุมัติ'],
];

export function Pp5TemplateView({
  resultsPath = paths.admin.gradeResults,
}: {
  resultsPath?: string;
}) {
  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">เอกสาร ปพ.5</Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            ตัวอย่างรูปแบบเอกสารที่สร้างจากหน้าผลการเรียนหลังผ่านการตรวจสอบ
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={resultsPath}
          variant="contained"
          startIcon={<RemixIcon icon="solar:document-text-bold" />}
        >
          ไปหน้าผลการเรียน
        </Button>
      </Box>

      <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h6">ข้อมูลที่นำมาแสดง</Typography>
        <Box
          sx={{
            mt: 2,
            gap: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {DATA_FIELDS.map(([label, source]) => (
            <Box
              key={label}
              sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.neutral' }}
            >
              <Typography variant="subtitle2">{label}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                ดึงจาก: {source}
              </Typography>
            </Box>
          ))}
        </Box>
      </Card>

      <Box sx={{ p: { xs: 1, md: 3 }, overflow: 'auto', bgcolor: 'grey.900' }}>
        <Box
          sx={{
            p: 3,
            mx: 'auto',
            minWidth: 900,
            maxWidth: 1120,
            aspectRatio: '297 / 210',
            color: 'grey.900',
            bgcolor: 'common.white',
            boxShadow: 24,
          }}
        >
          <Typography align="center" variant="h5">
            แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)
          </Typography>
          <Typography align="center" variant="body2">โรงเรียนตัวอย่าง</Typography>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">รายวิชา ท101 ภาษาไทย</Typography>
            <Typography variant="body2">ชั้น ป.6/1</Typography>
            <Typography variant="body2">ภาคเรียนที่ 1 ปีการศึกษา 2569</Typography>
            <Typography variant="body2">ครูผู้สอน ครูตัวอย่าง</Typography>
          </Box>

          <TableContainer sx={{ mt: 2, border: '1px solid', borderColor: 'grey.900' }}>
            <Table
              size="small"
              sx={{
                '& th, & td': {
                  py: 0.75,
                  borderRight: '1px solid',
                  borderColor: 'grey.900',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'งาน', 'แบบทดสอบ', 'กลางภาค', 'ปลายภาค', 'อื่น ๆ', 'รวม/100', 'ผลการเรียน'].map((label) => (
                    <TableCell key={label} align={label === 'ชื่อ-นามสกุล' ? 'left' : 'center'}>
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {SAMPLE_ROWS.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell align="center">{row.no}</TableCell>
                    <TableCell align="center">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell align="center">{row.work}</TableCell>
                    <TableCell align="center">{row.quiz}</TableCell>
                    <TableCell align="center">{row.mid}</TableCell>
                    <TableCell align="center">{row.final}</TableCell>
                    <TableCell align="center">{row.other}</TableCell>
                    <TableCell align="center">{row.total}</TableCell>
                    <TableCell align="center"><Chip size="small" label={row.grade} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 6, display: 'flex', justifyContent: 'space-around' }}>
            <Typography align="center">
              ลงชื่อ ..................................................<br />(ครูตัวอย่าง)<br />ครูผู้สอน
            </Typography>
            <Typography align="center">
              ลงชื่อ ..................................................<br />(ผู้อนุมัติตัวอย่าง)<br />ผู้ตรวจสอบ/ผู้อนุมัติ
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
