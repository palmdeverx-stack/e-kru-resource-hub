'use client';

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';

import { listAssignments } from 'src/sections/assignment/assignment-actions';

type Props = {
  teacherAssignmentId: string;
  assignmentNewPath: string;
  gradebookPath: (assignmentId: string) => string;
};

export const AssignmentsTab = memo(function AssignmentsTab({
  teacherAssignmentId,
  assignmentNewPath,
  gradebookPath,
}: Props) {
  const {
    data: assignments,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['assignments', teacherAssignmentId],
    queryFn: () => listAssignments(teacherAssignmentId),
  });
  const workAssignments = assignments?.filter((assignment) => assignment.category === 'assignment');

  return (
    <>
      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ไม่สามารถโหลดรายการงานได้
        </Alert>
      )}
      <Card variant="outlined" sx={{ borderRadius: { xs: 2, sm: 1 } }}>
        <Box
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            gap: { xs: 1, sm: 2 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
              งาน
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              สร้างงานและเข้าสู่สมุดคะแนนของแต่ละงาน
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            href={assignmentNewPath}
            variant="contained"
            startIcon={<RemixIcon icon="mingcute:add-line" />}
            aria-label="สร้างงาน"
            sx={{
              minWidth: { xs: 40, sm: 64 },
              px: { xs: 1, sm: 2 },
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              สร้างงาน
            </Box>
          </Button>
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
          {!isLoading && !workAssignments?.length && (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              ยังไม่มีงาน
            </Typography>
          )}
          {workAssignments?.map((assignment) => (
            <Box
              key={assignment.id}
              component={RouterLink}
              href={gradebookPath(assignment.id)}
              sx={{
                p: 1.25,
                gap: 1,
                display: 'grid',
                color: 'text.primary',
                border: '1px solid',
                borderRadius: 1.5,
                alignItems: 'center',
                borderColor: 'divider',
                textDecoration: 'none',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {assignment.title}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', color: 'text.secondary' }}
                  noWrap
                >
                  {assignment.full_score} คะแนน ·{' '}
                  {assignment.due_at
                    ? `ส่ง ${fDateTime(assignment.due_at, 'DD/MM/YYYY HH:mm')}`
                    : 'ไม่กำหนดส่ง'}
                </Typography>
              </Box>
              <RemixIcon
                icon="eva:arrow-ios-forward-fill"
                width={20}
                sx={{ color: 'text.disabled' }}
              />
            </Box>
          ))}
        </Box>
        <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ชื่องาน</TableCell>
                <TableCell>รายละเอียด</TableCell>
                <TableCell>กำหนดส่ง</TableCell>
                <TableCell align="center">คะแนนเต็ม</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !workAssignments?.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีงาน กด “สร้างงาน” เพื่อเริ่มต้น
                  </TableCell>
                </TableRow>
              )}
              {workAssignments?.map((assignment) => (
                <TableRow key={assignment.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{assignment.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ maxWidth: 360, color: 'text.secondary' }}
                    >
                      {assignment.description || 'ไม่มีรายละเอียด'}
                    </Typography>
                    {!!assignment.attachments.length && (
                      <Box sx={{ gap: 0.75, mt: 1, display: 'flex', flexWrap: 'wrap' }}>
                        {assignment.attachments.map((file) => (
                          <Link
                            key={file.id}
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                            variant="caption"
                          >
                            {file.file_name}
                          </Link>
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {assignment.due_at
                        ? fDateTime(assignment.due_at, 'DD/MM/YYYY HH:mm')
                        : 'ไม่กำหนด'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{assignment.full_score}</TableCell>
                  <TableCell align="right">
                    <Button
                      component={RouterLink}
                      href={gradebookPath(assignment.id)}
                      size="small"
                      variant="outlined"
                    >
                      เปิดสมุดคะแนน
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
});
