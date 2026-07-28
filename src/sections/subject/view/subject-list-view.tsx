'use client';

import type { Subject } from '../subject-actions';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { listSubjectMasterItems } from 'src/sections/subject-master/subject-master-actions';
import { listSemesters, listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import {
  listSubjects,
  deleteSubject,
  createSubject,
  activityTypeLabel,
  uploadSubjectImage,
  STUDENT_DEVELOPMENT_ACTIVITY_CODE,
} from '../subject-actions';

// ----------------------------------------------------------------------

export function SubjectListView({
  basePath = paths.admin.subject.root,
}: { basePath?: string } = {}) {
  const router = useRouter();
  const table = useTable({ defaultRowsPerPage: 5 });
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [yearFilter, setYearFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const {
    data: allSubjects = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['subjects', yearFilter, semesterFilter],
    queryFn: () =>
      listSubjects({
        academicYearId: yearFilter || undefined,
        semesterId: semesterFilter || undefined,
      }),
  });

  const { data: academicYears = [], isLoading: academicYearsLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });
  const { data: filterSemesters = [], isLoading: filterSemestersLoading } = useQuery({
    queryKey: ['semesters', yearFilter],
    queryFn: () => listSemesters(yearFilter),
    enabled: !!yearFilter,
  });
  const { data: masterItems = [] } = useQuery({
    queryKey: ['subject-master-items'],
    queryFn: listSubjectMasterItems,
  });
  const learningAreas = masterItems.filter((item) => item.category === 'learning_area');
  const learningAreaLabel = (code: string | null) =>
    learningAreas.find((item) => item.code === code)?.name ?? code;
  const subjectTypeLabel = (code: string | null) =>
    masterItems.find((item) => item.category === 'subject_type' && item.code === code)?.name ??
    code;
  const educationStageLabel = (code: string | null) =>
    masterItems.find((item) => item.category === 'education_stage' && item.code === code)?.name ??
    code;

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase('th');
  const subjects = allSubjects
    .filter((subject) => !areaFilter || subject.learning_area === areaFilter)
    .filter(
      (subject) =>
        !normalizedSearchQuery ||
        subject.name.toLocaleLowerCase('th').includes(normalizedSearchQuery) ||
        subject.code?.toLocaleLowerCase().includes(normalizedSearchQuery)
    );
  const visibleSubjects = rowInPage(subjects, table.page, table.rowsPerPage);

  const deleteMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: async () => {
      table.onUpdatePageDeleteRow(visibleSubjects.length);
      await queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setDeletingSubject(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (subject: Subject) => {
      if (!subject.academic_year_id || !subject.semester_id) {
        throw new Error('ไม่สามารถคัดลอกวิชาที่ยังไม่กำหนดปีการศึกษาหรือภาคเรียนได้');
      }

      const newSubject = await createSubject({
        code: subject.code
          ? `${subject.code}-COPY`
          : `SUBJ-${Date.now().toString(36).toUpperCase()}`,
        name: `${subject.name} (สำเนา)`,
        nameEn: subject.name_en ? `${subject.name_en} (Copy)` : undefined,
        credits: subject.credits,
        studyHours: subject.study_hours,
        description: subject.description ?? undefined,
        descriptionEn: subject.description_en ?? undefined,
        academicYearId: subject.academic_year_id,
        semesterId: subject.semester_id,
        learningArea: subject.learning_area ?? undefined,
        activityType: subject.activity_type ?? undefined,
        subjectType: subject.subject_type ?? undefined,
        educationStage: subject.education_stage ?? undefined,
        gradeLevels: subject.grade_levels,
        learningStandards: subject.learning_standards ?? undefined,
        learningOutcomes: subject.learning_outcomes ?? undefined,
        learningUnits: subject.learning_units ?? undefined,
        indicators: subject.indicators ?? undefined,
      });

      if (!subject.image_url) return newSubject;

      try {
        const imageResponse = await fetch(subject.image_url);
        if (!imageResponse.ok) throw new Error('ไม่สามารถคัดลอกรูปภาพวิชาได้');

        const blob = await imageResponse.blob();
        const extension = blob.type === 'image/jpeg' ? 'jpg' : (blob.type.split('/')[1] ?? 'jpg');
        const file = new File([blob], `subject-image.${extension}`, { type: blob.type });

        return await uploadSubjectImage(newSubject.id, file);
      } catch (error) {
        await deleteSubject(newSubject.id);
        throw error;
      }
    },
    onSuccess: async (newSubject) => {
      await queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success(`คัดลอกวิชา "${newSubject.name}" เรียบร้อยแล้ว`);
      router.push(`${basePath}/${newSubject.id}/edit`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

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
            วิชาและหลักสูตร
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            จัดการข้อมูล หน่วยกิต คำอธิบาย และรูปภาพรายวิชาที่เปิดสอนในโรงเรียน
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={`${basePath}/new`}
          variant="contained"
          startIcon={<RemixIcon icon="mingcute:add-line" />}
        >
          เพิ่มรายวิชา
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
          ไม่สามารถโหลดรายการรายวิชาได้
        </Alert>
      )}

      <Card variant="outlined">
        <Box
          sx={{
            gap: 2,
            px: 3,
            py: 2.5,
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              รายการรายวิชา
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `${subjects.length} รายการ`}
            </Typography>
          </Box>
          <Box sx={{ gap: 1.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              size="small"
              value={searchQuery}
              placeholder="ค้นหารหัสวิชา หรือชื่อวิชา"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                table.onResetPage();
              }}
              slotProps={{
                input: { startAdornment: <RemixIcon icon="solar:magnifer-linear" width={18} /> },
              }}
              sx={{ minWidth: 220 }}
            />
            <TextField
              select
              size="small"
              label="ปีการศึกษา"
              value={yearFilter}
              disabled={academicYearsLoading}
              onChange={(event) => {
                setYearFilter(event.target.value);
                setSemesterFilter('');
                table.onResetPage();
              }}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">ทุกปีการศึกษา</MenuItem>
              {academicYears.map((year) => (
                <MenuItem key={year.id} value={year.id}>
                  {year.year}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="ภาคเรียน"
              value={semesterFilter}
              disabled={!yearFilter || filterSemestersLoading}
              onChange={(event) => {
                setSemesterFilter(event.target.value);
                table.onResetPage();
              }}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">ทุกภาคเรียน</MenuItem>
              {filterSemesters.map((semester) => (
                <MenuItem key={semester.id} value={semester.id}>
                  {semester.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="กลุ่มสาระ"
              value={areaFilter}
              onChange={(event) => {
                setAreaFilter(event.target.value);
                table.onResetPage();
              }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">ทุกกลุ่มสาระ</MenuItem>
              {learningAreas.map((area) => (
                <MenuItem key={area.id} value={area.code}>
                  {area.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: { sm: 140 } }}>รหัสวิชา</TableCell>
                <TableCell>รายละเอียดรายวิชา</TableCell>
                <TableCell sx={{ width: 190 }}> ภาคเรียน / ปี </TableCell>
                <TableCell sx={{ width: 170 }}>หน่วยกิต / ชั่วโมง</TableCell>
                <TableCell sx={{ width: 100 }}>สถานะ</TableCell>
                <TableCell sx={{ width: 170 }} align="right">
                  การจัดการ
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !subjects.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีรายวิชา กด “เพิ่มรายวิชา” เพื่อเริ่มต้น
                  </TableCell>
                </TableRow>
              )}
              {visibleSubjects.map((subject) => (
                <TableRow key={subject.id} hover>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ color: subject.code ? 'text.primary' : 'text.disabled' }}
                    >
                      {subject.code ?? 'ไม่ระบุ'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                      <Avatar
                        variant="rounded"
                        src={subject.image_url ?? undefined}
                        alt={`รูปวิชา ${subject.name}`}
                        sx={{ width: 56, height: 44, bgcolor: 'background.neutral' }}
                      >
                        <RemixIcon icon="solar:gallery-wide-bold" width={24} />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                          <Typography variant="subtitle2">{subject.name}</Typography>
                          {subject.name_en && (
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ maxWidth: 420, color: 'text.secondary' }}
                            >
                              - {subject.name_en}
                            </Typography>
                          )}
                        </Box>
                        {(subject.learning_area ||
                          subject.subject_type ||
                          subject.education_stage) && (
                          <Box sx={{ gap: 0.5, mt: 0.5, display: 'flex', flexWrap: 'wrap' }}>
                            {subject.learning_area && (
                              <Label
                                variant="soft"
                                color={
                                  subject.learning_area === STUDENT_DEVELOPMENT_ACTIVITY_CODE
                                    ? 'warning'
                                    : 'info'
                                }
                              >
                                {learningAreaLabel(subject.learning_area)}
                                {subject.activity_type
                                  ? ` · ${activityTypeLabel(subject.activity_type)}`
                                  : ''}
                              </Label>
                            )}
                            {subject.subject_type && (
                              <Label
                                variant="soft"
                                color={subject.subject_type === 'basic' ? 'default' : 'primary'}
                              >
                                {subjectTypeLabel(subject.subject_type)}
                              </Label>
                            )}
                            {subject.education_stage && (
                              <Label variant="soft" color="default">
                                {educationStageLabel(subject.education_stage)}
                              </Label>
                            )}
                          </Box>
                        )}
                        {!!subject.grade_levels.length && (
                          <Typography
                            variant="caption"
                            sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}
                          >
                            ระดับชั้น: {subject.grade_levels.join(', ')}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ maxWidth: 420, display: 'block', color: 'text.secondary' }}
                        >
                          {subject.description || 'ยังไม่มีคำอธิบาย'}
                        </Typography>
                        {subject.description_en && (
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ maxWidth: 420, display: 'block', color: 'text.disabled' }}
                          >
                            {subject.description_en}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {subject.semesters?.name ?? 'ยังไม่กำหนดภาคเรียน'} /{' '}
                      {subject.academic_years?.year ?? 'ยังไม่กำหนดปี'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {Number(subject.credits).toLocaleString('th-TH')} หน่วยกิต
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {Number(subject.study_hours ?? 0).toLocaleString('th-TH')} ชั่วโมง
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Label
                      variant="soft"
                      color={subject.status === 'published' ? 'success' : 'default'}
                    >
                      {subject.status === 'published' ? 'เผยแพร่แล้ว' : 'แบบร่าง'}
                    </Label>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="แก้ไข">
                      <IconButton
                        size="small"
                        component={RouterLink}
                        href={`${basePath}/${subject.id}/edit`}
                        aria-label={`แก้ไขวิชา ${subject.name}`}
                      >
                        <RemixIcon icon="solar:pen-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="คัดลอกวิชา">
                      <IconButton
                        size="small"
                        disabled={duplicateMutation.isPending}
                        onClick={() => duplicateMutation.mutate(subject)}
                        aria-label={`คัดลอกวิชา ${subject.name}`}
                      >
                        <RemixIcon icon="solar:copy-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          deleteMutation.reset();
                          setDeletingSubject(subject);
                        }}
                        aria-label={`ลบวิชา ${subject.name}`}
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
          count={subjects.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
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

      <Dialog
        open={!!deletingSubject}
        onClose={() => !deleteMutation.isPending && setDeletingSubject(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบรายวิชา</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">
            ต้องการลบวิชา <strong>{deletingSubject?.name}</strong> ใช่หรือไม่?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            การมอบหมายครู งาน และคะแนนที่เชื่อมโยงกับวิชานี้อาจถูกลบตามไปด้วย
            และไม่สามารถย้อนกลับได้
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingSubject(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingSubject && deleteMutation.mutate(deletingSubject.id)}
          >
            ลบรายวิชา
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
