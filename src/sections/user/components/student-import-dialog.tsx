'use client';

import type { StudentImportRow } from '../student-import-utils';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { Upload } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';

import { bulkImportStudents } from '../user-actions';
import { parseStudentImportFile } from '../student-import-utils';

// ----------------------------------------------------------------------

const EXCEL_ACCEPT = {
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function StudentImportDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<StudentImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const importMutation = useMutation({
    mutationFn: (rows: StudentImportRow[]) =>
      bulkImportStudents(
        rows.map((row) => ({
          row: row.row,
          studentCode: row.studentCode,
          nationalId: row.nationalId || undefined,
          namePrefix: row.namePrefix,
          firstName: row.firstName,
          lastName: row.lastName,
          firstNameEn: row.firstNameEn,
          lastNameEn: row.lastNameEn,
          nickname: row.nickname,
          gender: row.gender,
          birthDate: row.birthDate || undefined,
          nationality: row.nationality,
          ethnicity: row.ethnicity,
          religion: row.religion,
          username: row.username,
          email: row.email || undefined,
          password: row.password || undefined,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'student'] });
    },
  });

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    importMutation.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDrop = async (acceptedFiles: File[]) => {
    const picked = acceptedFiles[0];
    if (!picked) return;

    setFile(picked);
    setParseError(null);
    setIsParsing(true);
    importMutation.reset();
    try {
      const rows = await parseStudentImportFile(picked);
      if (!rows.length) {
        setParseError('ไม่พบข้อมูลนักเรียนในไฟล์นี้');
      }
      setParsedRows(rows);
    } catch {
      setParseError('ไม่สามารถอ่านไฟล์นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel ที่ถูกต้อง');
    } finally {
      setIsParsing(false);
    }
  };

  const validRows = parsedRows.filter((row) => row.errors.length === 0);
  const invalidRows = parsedRows.filter((row) => row.errors.length > 0);

  const result = importMutation.data;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>นำเข้านักเรียนจาก Excel</DialogTitle>
      <DialogContent>
        {!file && (
          <Upload
            onDrop={handleDrop}
            accept={EXCEL_ACCEPT}
            placeholder={
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <RemixIcon icon="eva:cloud-upload-fill" width={48} sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1" sx={{ mt: 1 }}>
                  ลากไฟล์ Excel มาวาง หรือคลิกเพื่อเลือกไฟล์
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  รองรับไฟล์ .xlsx, .xls ที่กรอกตาม Template
                </Typography>
              </Box>
            }
          />
        )}

        {isParsing && (
          <Alert severity="info" sx={{ mt: 2 }}>
            กำลังอ่านไฟล์...
          </Alert>
        )}

        {parseError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {parseError}
          </Alert>
        )}

        {!!file && !isParsing && !parseError && !result && (
          <>
            <Box
              sx={{
                mt: 2,
                mb: 2,
                gap: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                <RemixIcon icon="solar:file-check-bold" width={20} sx={{ color: 'success.main' }} />
                <Typography variant="body2">{file.name}</Typography>
                <Chip size="small" color="success" label={`พร้อมนำเข้า ${validRows.length} รายการ`} />
                {!!invalidRows.length && (
                  <Chip size="small" color="error" label={`ข้อมูลผิดพลาด ${invalidRows.length} รายการ`} />
                )}
              </Box>
              <Button size="small" color="inherit" onClick={reset}>
                เลือกไฟล์ใหม่
              </Button>
            </Box>

            <TableContainer sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={60}>แถว</TableCell>
                    <TableCell>รหัสนักเรียน</TableCell>
                    <TableCell>ชื่อ-นามสกุล</TableCell>
                    <TableCell>ชื่อผู้ใช้งาน</TableCell>
                    <TableCell>สถานะ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow key={row.row} hover>
                      <TableCell>{row.row}</TableCell>
                      <TableCell>{row.studentCode || '-'}</TableCell>
                      <TableCell>
                        {`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || '-'}
                      </TableCell>
                      <TableCell>{row.username || '-'}</TableCell>
                      <TableCell>
                        {row.errors.length ? (
                          <Typography variant="caption" sx={{ color: 'error.main' }}>
                            {row.errors.join(', ')}
                          </Typography>
                        ) : (
                          <Chip size="small" color="success" variant="soft" label="พร้อมนำเข้า" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {importMutation.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {importMutation.error.message}
          </Alert>
        )}

        {result && (
          <>
            <Alert severity={result.failureCount ? 'warning' : 'success'} sx={{ mt: 2, mb: 2 }}>
              นำเข้าสำเร็จ {result.successCount} รายการ
              {result.failureCount ? ` · ล้มเหลว ${result.failureCount} รายการ` : ''}
            </Alert>
            {!!result.failureCount && (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={60}>แถว</TableCell>
                      <TableCell>รหัสนักเรียน</TableCell>
                      <TableCell>สาเหตุ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.results
                      .filter((row) => !row.success)
                      .map((row) => (
                        <TableRow key={row.row} hover>
                          <TableCell>{row.row}</TableCell>
                          <TableCell>{row.studentCode || '-'}</TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'error.main' }}>
                              {row.message}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose}>
          {result ? 'เสร็จสิ้น' : 'ยกเลิก'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            disabled={!validRows.length || isParsing}
            loading={importMutation.isPending}
            onClick={() => importMutation.mutate(validRows)}
          >
            นำเข้า {validRows.length} รายการ
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
