'use client';

import type { Classroom } from '../classroom-actions';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import { Box, Grid, Stack } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { today, fIsBetween } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { listUsers } from 'src/sections/user/user-actions';
import { listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import {
  listClassrooms,
  createClassroom,
  deleteClassroom,
  updateClassroom,
} from '../classroom-actions';

// ----------------------------------------------------------------------

const CreateSchema = z.object({
  name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อห้องเรียนภาษาไทย!' }),
  nameEn: z.string().trim(),
  gradeLevel: z.string().trim(),
  gradeLevelEn: z.string().trim(),
  academicYearId: z.string().min(1, { error: 'กรุณาเลือกปีการศึกษา!' }),
  teacherIds: z.array(z.string()).min(1, { error: 'กรุณาเลือกครูประจำชั้นอย่างน้อย 1 คน!' }),
});

export function ClassroomListView() {
  const table = useTable({ defaultRowsPerPage: 10 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [deletingClassroom, setDeletingClassroom] = useState<Classroom | null>(null);
  const queryClient = useQueryClient();

  const {
    data: classrooms = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => listClassrooms(),
  });
  const visibleClassrooms = rowInPage(classrooms, table.page, table.rowsPerPage);
  const {
    data: academicYears = [],
    isLoading: academicYearsLoading,
    isError: academicYearsError,
  } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });
  const {
    data: teachers = [],
    isLoading: teachersLoading,
    isError: teachersError,
  } = useQuery({
    queryKey: ['users', 'teacher'],
    queryFn: () => listUsers('teacher'),
  });

  const methods = useForm({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      name: '',
      nameEn: '',
      gradeLevel: '',
      gradeLevelEn: '',
      academicYearId: '',
      teacherIds: [] as string[],
    },
  });
  const { handleSubmit, reset } = methods;

  const saveMutation = useMutation({
    mutationFn: (data: z.infer<typeof CreateSchema>) => {
      const params = {
        name: data.name.trim(),
        nameEn: data.nameEn.trim() || undefined,
        academicYearId: data.academicYearId,
        gradeLevel: data.gradeLevel.trim() || undefined,
        gradeLevelEn: data.gradeLevelEn.trim() || undefined,
        teacherIds: data.teacherIds,
      };
      return editingClassroom
        ? updateClassroom(editingClassroom.id, params)
        : createClassroom(params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      setDialogOpen(false);
      setEditingClassroom(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClassroom,
    onSuccess: async () => {
      table.onUpdatePageDeleteRow(visibleClassrooms.length);
      await queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      setDeletingClassroom(null);
    },
  });

  const openCreateDialog = () => {
    setEditingClassroom(null);
    reset({
      name: '',
      nameEn: '',
      gradeLevel: '',
      gradeLevelEn: '',
      academicYearId: '',
      teacherIds: [],
    });
    saveMutation.reset();
    setDialogOpen(true);
  };

  const openEditDialog = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    reset({
      name: classroom.name,
      nameEn: classroom.name_en ?? '',
      gradeLevel: classroom.grade_level ?? '',
      gradeLevelEn: classroom.grade_level_en ?? '',
      academicYearId: classroom.academic_year_id,
      teacherIds: classroom.homeroom_teachers.map((teacher) => teacher.id),
    });
    saveMutation.reset();
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saveMutation.isPending) return;
    setDialogOpen(false);
    setEditingClassroom(null);
    reset();
    saveMutation.reset();
  };

  const onSubmit = handleSubmit((data) => saveMutation.mutate(data));

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ห้องเรียน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            จัดการห้องเรียน ระดับชั้น และปีการศึกษา
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={openCreateDialog}
          startIcon={<RemixIcon icon="mingcute:add-line" />}
        >
          เพิ่มห้องเรียน
        </Button>
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดรายการห้องเรียนได้
        </Alert>
      )}

      <Card variant="outlined">
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography component="h2" variant="h6">
            รายการห้องเรียน
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {isLoading ? 'กำลังโหลด...' : `${classrooms.length} รายการ`}
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อห้อง</TableCell>
                <TableCell>ระดับชั้น</TableCell>
                <TableCell>ปีการศึกษา</TableCell>
                <TableCell>ครูประจำชั้น</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !classrooms.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีห้องเรียน กด “เพิ่มห้องเรียน” เพื่อเริ่มต้น
                  </TableCell>
                </TableRow>
              )}
              {visibleClassrooms.map((classroom) => (
                <TableRow key={classroom.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{classroom.name}</Typography>
                    {classroom.name_en && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {classroom.name_en}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{classroom.grade_level ?? 'ไม่ระบุ'}</Typography>
                    {classroom.grade_level_en && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {classroom.grade_level_en}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{classroom.academic_years?.year ?? '-'}</TableCell>
                  <TableCell>
                    {classroom.homeroom_teachers.length
                      ? classroom.homeroom_teachers
                          .map(
                            (teacher) =>
                              `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() ||
                              teacher.username
                          )
                          .join(', ')
                      : 'ยังไม่ได้กำหนด'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="แก้ไข">
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(classroom)}
                        aria-label={`แก้ไขห้อง ${classroom.name}`}
                      >
                        <RemixIcon icon="solar:pen-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          deleteMutation.reset();
                          setDeletingClassroom(classroom);
                        }}
                        aria-label={`ลบห้อง ${classroom.name}`}
                      >
                        <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={classrooms.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          getItemAriaLabel={(type) => {
            if (type === 'first') return 'หน้าแรก';
            if (type === 'last') return 'หน้าสุดท้าย';
            if (type === 'next') return 'หน้าถัดไป';
            return 'หน้าก่อนหน้า';
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <Form methods={methods} onSubmit={onSubmit}>
          <DialogTitle sx={{ pb: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  {editingClassroom ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  {editingClassroom
                    ? 'ปรับข้อมูลห้องและปีการศึกษา'
                    : 'สร้างห้องเรียนใหม่และเชื่อมกับปีการศึกษา'}
                </Typography>
              </Box>
              <IconButton
                onClick={closeDialog}
                disabled={saveMutation.isPending}
                aria-label="ปิดหน้าต่าง"
              >
                <RemixIcon icon="mingcute:close-line" />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            <Stack sx={{ mt: 2 }}>
              {saveMutation.error && (
                <Alert severity="error" sx={{ mb: 2.5 }}>
                  {saveMutation.error.message}
                </Alert>
              )}
              {academicYearsError && (
                <Alert severity="warning" sx={{ mb: 2.5 }}>
                  โหลดปีการศึกษาไม่สำเร็จ กรุณาปิดหน้าต่างแล้วลองใหม่
                </Alert>
              )}
              {teachersError && (
                <Alert severity="warning" sx={{ mb: 2.5 }}>
                  โหลดรายชื่อครูไม่สำเร็จ กรุณาปิดหน้าต่างแล้วลองใหม่
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Field.Select
                    name="academicYearId"
                    label="ปีการศึกษา *"
                    disabled={academicYearsLoading || academicYearsError}
                    helperText="ปีการศึกษาที่ห้องนี้เปิดใช้งาน"
                  >
                    {academicYearsLoading && <MenuItem disabled>กำลังโหลด...</MenuItem>}
                    {!academicYearsLoading && !academicYears.length && (
                      <MenuItem disabled>ยังไม่มีปีการศึกษา</MenuItem>
                    )}
                    {academicYears.map((year) => (
                      <MenuItem key={year.id} value={year.id}>
                        {year.year}{' '}
                        {fIsBetween(today(), year.start_date, year.end_date) ? '(ปัจจุบัน)' : ''}
                      </MenuItem>
                    ))}
                  </Field.Select>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Field.Text
                    name="name"
                    label="ชื่อห้องเรียนภาษาไทย *"
                    placeholder="เช่น ม.1/1"
                    helperText="ชื่อหลักที่ครูและนักเรียนจะเห็น"
                    autoFocus
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Field.Text
                    name="nameEn"
                    label="ชื่อห้องเรียนภาษาอังกฤษ"
                    placeholder="e.g. Grade 7/1"
                    helperText="ไม่บังคับ"
                    slotProps={{ htmlInput: { lang: 'en' } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Field.Text
                    name="gradeLevel"
                    label="ระดับชั้นภาษาไทย"
                    placeholder="เช่น มัธยมศึกษาปีที่ 1"
                    helperText="ไม่บังคับ"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Field.Text
                    name="gradeLevelEn"
                    label="ระดับชั้นภาษาอังกฤษ"
                    placeholder="e.g. Grade 7"
                    helperText="ไม่บังคับ"
                    slotProps={{ htmlInput: { lang: 'en' } }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Field.Autocomplete
                    name="teacherIds"
                    label="ครูประจำชั้น *"
                    placeholder="เลือกได้มากกว่า 1 คน"
                    fullWidth
                    multiple
                    filterSelectedOptions
                    loading={teachersLoading}
                    disabled={teachersLoading || teachersError}
                    keyOption={{ label: 'label', value: 'value' }}
                    options={teachers.map((teacher) => ({
                      label:
                        `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() ||
                        teacher.username,
                      value: teacher.id,
                    }))}
                    noOptionsText="ไม่พบรายชื่อครู"
                    loadingText="กำลังโหลดรายชื่อครู..."
                    helperText="เลือกครูประจำชั้นอย่างน้อย 1 คน"
                    sx={{ gridColumn: { sm: '1 / -1' } }}
                  />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button color="inherit" onClick={closeDialog} disabled={saveMutation.isPending}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" loading={saveMutation.isPending}>
              {editingClassroom ? 'บันทึกการแก้ไข' : 'เพิ่มห้องเรียน'}
            </Button>
          </DialogActions>
        </Form>
      </Dialog>

      <Dialog
        open={!!deletingClassroom}
        onClose={() => !deleteMutation.isPending && setDeletingClassroom(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบห้องเรียน</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">
            ต้องการลบห้อง <strong>{deletingClassroom?.name}</strong> ใช่หรือไม่?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            รายชื่อนักเรียน การมอบหมายครู งาน และคะแนนที่เชื่อมกับห้องนี้อาจถูกลบตามไปด้วย
            และไม่สามารถย้อนกลับได้
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingClassroom(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingClassroom && deleteMutation.mutate(deletingClassroom.id)}
          >
            ลบห้องเรียน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
