'use client';

import type { RosterStudent } from '../../teacher-assignment-actions';

import { memo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { RemixIcon } from 'src/components/remix-icon';

import { StudentGuardiansDialog } from 'src/sections/student-guardian/components/student-guardians-dialog';

import { getRoster } from '../../teacher-assignment-actions';
import { StudentBreakdownDialog } from '../student-breakdown-dialog';

type Props = {
  teacherAssignmentId: string;
};

export const StudentsTab = memo(function StudentsTab({ teacherAssignmentId }: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [guardianStudent, setGuardianStudent] = useState<RosterStudent | null>(null);
  const {
    data: roster,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['roster', teacherAssignmentId],
    queryFn: () => getRoster(teacherAssignmentId),
  });

  return (
    <>
      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ไม่สามารถโหลดรายชื่อนักเรียนได้
        </Alert>
      )}
      <Card variant="outlined" sx={{ borderRadius: { xs: 2, sm: 1 } }}>
        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
            รายชื่อนักเรียน
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            กดดูรายละเอียดเพื่อตรวจคะแนนและสถานะการส่งงานรายคน
          </Typography>
        </Box>
        <Divider />
        <Box
          sx={{
            p: 1,
            gap: 0.75,
            display: { xs: 'flex', sm: 'none' },
            flexDirection: 'column',
          }}
        >
          {isLoading && (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              กำลังโหลด...
            </Typography>
          )}
          {!isLoading && !roster?.roster.length && (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              ยังไม่มีนักเรียนในห้องนี้
            </Typography>
          )}
          {roster?.roster.map((row) => {
            const studentName =
              `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
              row.student.username;

            return (
              <Box
                key={row.id}
                sx={{
                  p: 1,
                  gap: 1,
                  display: 'grid',
                  border: '1px solid',
                  borderRadius: 1.5,
                  alignItems: 'center',
                  borderColor: 'divider',
                  gridTemplateColumns: '40px minmax(0, 1fr) auto',
                }}
              >
                <Avatar
                  src={row.student.avatar_url ?? undefined}
                  sx={{ width: 40, height: 40, color: 'primary.main', bgcolor: 'primary.lighter' }}
                >
                  {studentName.charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {studentName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary' }}
                    noWrap
                  >
                    เลขที่ {row.student_number ?? '-'} · @{row.student.username}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setGuardianStudent(row.student)}
                    aria-label={`ข้อมูลผู้ปกครองของ ${studentName}`}
                    sx={{ minWidth: 36, px: 0.75 }}
                  >
                    <RemixIcon icon="solar:users-group-rounded-bold" width={18} />
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedStudentId(row.student.id)}
                    aria-label={`ดูผลการเรียนของ ${studentName}`}
                    sx={{ minWidth: 36, px: 0.75 }}
                  >
                    <RemixIcon icon="solar:chart-square-outline" width={18} />
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
        <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>เลขที่</TableCell>
                <TableCell>ชื่อ-นามสกุล</TableCell>
                <TableCell>ชื่อผู้ใช้งาน</TableCell>
                <TableCell>ผู้ปกครอง</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !roster?.roster.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีนักเรียนในห้องนี้
                  </TableCell>
                </TableRow>
              )}
              {roster?.roster.map((row) => {
                const studentName =
                  `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
                  row.student.username;
                return (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.student_number ?? '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ gap: 1.25, display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          src={row.student.avatar_url ?? undefined}
                          sx={{
                            width: 34,
                            height: 34,
                            typography: 'subtitle2',
                            color: 'primary.main',
                            bgcolor: 'primary.lighter',
                          }}
                        >
                          {studentName.charAt(0)}
                        </Avatar>
                        <Typography variant="subtitle2">{studentName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        @{row.student.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<RemixIcon icon="solar:users-group-rounded-bold" />}
                        onClick={() => setGuardianStudent(row.student)}
                      >
                        ข้อมูลผู้ปกครอง
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedStudentId(row.student.id)}
                      >
                        ดูผลการเรียน
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <StudentBreakdownDialog
        teacherAssignmentId={teacherAssignmentId}
        studentId={selectedStudentId}
        onClose={() => setSelectedStudentId(null)}
      />
      <StudentGuardiansDialog
        open={!!guardianStudent}
        student={guardianStudent}
        teacherAssignmentId={teacherAssignmentId}
        onClose={() => setGuardianStudent(null)}
      />
    </>
  );
});
