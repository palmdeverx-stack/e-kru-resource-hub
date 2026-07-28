'use client';

import type { UserDocument, UserDocumentStatus } from '../document-actions';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { getSchoolDocumentTemplate } from '../document-catalog';
import { DocumentFormDialog } from '../components/document-form-dialog';
import { DocumentDeleteDialog } from '../components/document-delete-dialog';
import { listMyDocuments, updateMyDocumentStatus } from '../document-actions';

// ----------------------------------------------------------------------

const STATUS_CONFIG: Record<
  UserDocumentStatus,
  { label: string; color: 'default' | 'info' | 'success' | 'warning' }
> = {
  draft: { label: 'ฉบับร่าง', color: 'warning' },
  submitted: { label: 'ส่งดำเนินการแล้ว', color: 'info' },
  ready: { label: 'พร้อมใช้งาน', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'default' },
};

export function MyDocumentListView({
  detailBasePath = paths.admin.documents.root,
}: {
  detailBasePath?: string;
}) {
  const queryClient = useQueryClient();
  const table = useTable({ defaultRowsPerPage: 10 });
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<UserDocument | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<UserDocument | null>(null);
  const {
    data: documents = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-documents'],
    queryFn: listMyDocuments,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'submit' | 'cancel' }) =>
      updateMyDocumentStatus(id, action),
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: ['my-documents'] });
      toast.success(
        document.status === 'submitted' ? 'ส่งเอกสารดำเนินการแล้ว' : 'ยกเลิกเอกสารแล้ว'
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return documents;

    return documents.filter((document) => {
      const template = getSchoolDocumentTemplate(document.template_slug);
      return [document.title, document.purpose, template?.code, template?.name]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });
  }, [documents, search]);
  const visibleDocuments = rowInPage(filteredDocuments, table.page, table.rowsPerPage);

  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
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
            เอกสารของฉัน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            สร้างเอกสารจากแม่แบบและติดตามสถานะเอกสารที่คุณจัดทำ
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => {
            setEditingDocument(null);
            setFormOpen(true);
          }}
          startIcon={<RemixIcon icon="mingcute:add-line" />}
        >
          สร้างเอกสาร
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
          ไม่สามารถโหลดเอกสารของคุณได้
        </Alert>
      )}

      <Card variant="outlined">
        <Box
          sx={{
            gap: 2,
            p: 2.5,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              รายการเอกสาร
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `${filteredDocuments.length} รายการ`}
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.onResetPage();
            }}
            placeholder="ค้นหาเอกสาร"
            sx={{ width: { xs: 1, sm: 340 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="eva:search-fill" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>เอกสาร</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>วันที่สร้าง</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading &&
                visibleDocuments.map((document) => {
                  const template = getSchoolDocumentTemplate(document.template_slug);
                  const status = STATUS_CONFIG[document.status];

                  return (
                    <TableRow key={document.id} hover>
                      <TableCell sx={{ maxWidth: 360 }}>
                        <Typography variant="subtitle2">{document.title}</Typography>
                        {document.purpose && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {document.purpose}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{template?.code ?? '-'}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {template?.name ?? 'ไม่พบแม่แบบ'}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatThaiDate(document.created_at)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="soft"
                          color={status.color}
                          label={status.label}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ gap: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          {template && (
                            <Button
                              component={RouterLink}
                              href={`${detailBasePath}/${template.slug}?preview=1`}
                              size="small"
                              variant="outlined"
                              startIcon={<RemixIcon icon="solar:eye-bold" />}
                            >
                              ดูแม่แบบ
                            </Button>
                          )}
                          {document.status === 'draft' && (
                            <>
                              <IconButton
                                size="small"
                                aria-label={`แก้ไข ${document.title}`}
                                onClick={() => {
                                  setEditingDocument(document);
                                  setFormOpen(true);
                                }}
                              >
                                <RemixIcon icon="solar:pen-bold" width={18} />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`ลบ ${document.title}`}
                                onClick={() => setDeletingDocument(document)}
                              >
                                <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                              </IconButton>
                              <Button
                                size="small"
                                variant="contained"
                                loading={
                                  statusMutation.isPending &&
                                  statusMutation.variables?.id === document.id
                                }
                                onClick={() =>
                                  statusMutation.mutate({ id: document.id, action: 'submit' })
                                }
                              >
                                ส่งดำเนินการ
                              </Button>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!isLoading && !filteredDocuments.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}
                  >
                    {documents.length
                      ? 'ไม่พบเอกสารที่ค้นหา'
                      : 'ยังไม่มีเอกสาร กด “สร้างเอกสาร” เพื่อเริ่มต้น'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={filteredDocuments.length}
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

      <DocumentFormDialog
        open={formOpen}
        document={editingDocument}
        onClose={() => {
          setFormOpen(false);
          setEditingDocument(null);
        }}
      />
      <DocumentDeleteDialog document={deletingDocument} onClose={() => setDeletingDocument(null)} />
    </Container>
  );
}

function formatThaiDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
