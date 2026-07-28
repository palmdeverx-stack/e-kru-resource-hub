'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { SCHOOL_DOCUMENT_TEMPLATES } from '../document-catalog';

// ----------------------------------------------------------------------

type PaperFilter = 'all' | 'portrait' | 'landscape';

export function DocumentListView({
  detailBasePath = paths.admin.documents.root,
  myDocumentsPath = paths.admin.documents.my,
}: {
  detailBasePath?: string;
  myDocumentsPath?: string;
}) {
  const table = useTable({ defaultRowsPerPage: 10 });
  const [search, setSearch] = useState('');
  const [paperFilter, setPaperFilter] = useState<PaperFilter>('all');

  const documents = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');

    return SCHOOL_DOCUMENT_TEMPLATES.filter((item) => {
      const matchesPaper =
        paperFilter === 'all' ||
        (paperFilter === 'portrait' && item.paper === 'A4 แนวตั้ง') ||
        (paperFilter === 'landscape' && item.paper === 'A4 แนวนอน');
      const matchesSearch =
        !keyword ||
        [item.code, item.name, item.description, item.source]
          .join(' ')
          .toLocaleLowerCase('th')
          .includes(keyword);

      return matchesPaper && matchesSearch;
    });
  }, [paperFilter, search]);
  const visibleDocuments = rowInPage(documents, table.page, table.rowsPerPage);
  const portraitCount = SCHOOL_DOCUMENT_TEMPLATES.filter(
    (item) => item.paper === 'A4 แนวตั้ง'
  ).length;
  const landscapeCount = SCHOOL_DOCUMENT_TEMPLATES.length - portraitCount;

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
            ตัวอย่างเอกสาร
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            เลือกดูโครงสร้างและพรีวิว PDF ก่อนนำแม่แบบไปสร้างเป็นเอกสารของคุณ
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={myDocumentsPath}
          variant="outlined"
          startIcon={<RemixIcon icon="solar:documents-bold-duotone" />}
        >
          เอกสารของฉัน
        </Button>
      </Box>

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <SummaryCard
          label="แม่แบบทั้งหมด"
          value={SCHOOL_DOCUMENT_TEMPLATES.length}
          icon="solar:documents-bold-duotone"
          color="primary"
        />
        <SummaryCard
          label="A4 แนวตั้ง"
          value={portraitCount}
          icon="solar:file-text-bold-duotone"
          color="success"
        />
        <SummaryCard
          label="A4 แนวนอน"
          value={landscapeCount}
          icon="solar:album-bold-duotone"
          color="warning"
        />
      </Box>

      <Card variant="outlined">
        <Box
          sx={{
            gap: 2,
            p: 2.5,
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
              แม่แบบเอกสาร
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              พบ {documents.length} รายการ
            </Typography>
          </Box>
          <Box
            sx={{
              gap: 1.5,
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <TextField
              size="small"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                table.onResetPage();
              }}
              placeholder="ค้นหาชื่อ รหัส หรือข้อมูลที่ใช้"
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
            <TextField
              select
              size="small"
              label="รูปแบบกระดาษ"
              value={paperFilter}
              onChange={(event) => {
                setPaperFilter(event.target.value as PaperFilter);
                table.onResetPage();
              }}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              <MenuItem value="portrait">A4 แนวตั้ง</MenuItem>
              <MenuItem value="landscape">A4 แนวนอน</MenuItem>
            </TextField>
          </Box>
        </Box>

        {!!visibleDocuments.length && (
          <Box
            sx={{
              p: { xs: 2, sm: 3 },
              gap: 2,
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {visibleDocuments.map((document) => (
              <Card
                key={document.slug}
                variant="outlined"
                sx={{
                  p: 2.5,
                  display: 'flex',
                  minHeight: 310,
                  flexDirection: 'column',
                  transition: (theme) =>
                    theme.transitions.create(['border-color', 'box-shadow', 'transform']),
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: 'primary.main',
                    boxShadow: (theme) => theme.vars.customShadows.z8,
                  },
                }}
              >
                <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      flexShrink: 0,
                      display: 'grid',
                      borderRadius: 1.5,
                      color: 'primary.main',
                      placeItems: 'center',
                      bgcolor: 'primary.lighter',
                    }}
                  >
                    <RemixIcon icon="solar:file-text-bold-duotone" width={27} />
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Box sx={{ gap: 0.75, mb: 0.75, display: 'flex', flexWrap: 'wrap' }}>
                      <Chip size="small" variant="soft" color="primary" label={document.code} />
                      <Chip size="small" variant="outlined" label={document.paper} />
                    </Box>
                    <Typography variant="subtitle1">{document.name}</Typography>
                  </Box>
                </Box>

                <Typography
                  variant="body2"
                  sx={{
                    mt: 2,
                    color: 'text.secondary',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {document.description}
                </Typography>

                <Box
                  sx={{
                    p: 1.5,
                    mt: 2,
                    gap: 1,
                    display: 'flex',
                    borderRadius: 1.5,
                    bgcolor: 'background.neutral',
                  }}
                >
                  <RemixIcon
                    icon="solar:database-bold-duotone"
                    width={20}
                    sx={{ mt: 0.25, color: 'text.secondary' }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ข้อมูลที่ใช้
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        overflow: 'hidden',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {document.source}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ gap: 1, mt: 2.5, display: 'flex' }}>
                  <Button
                    component={RouterLink}
                    href={`${detailBasePath}/${document.slug}`}
                    fullWidth
                    size="small"
                    variant="outlined"
                  >
                    รายละเอียด
                  </Button>
                  <Button
                    component={RouterLink}
                    href={`${detailBasePath}/${document.slug}?preview=1`}
                    fullWidth
                    size="small"
                    variant="contained"
                    startIcon={<RemixIcon icon="solar:eye-bold" />}
                  >
                    พรีวิว PDF
                  </Button>
                </Box>
              </Card>
            ))}
          </Box>
        )}

        {!documents.length && (
          <Box sx={{ py: 9, px: 2, textAlign: 'center', color: 'text.secondary' }}>
            <RemixIcon icon="solar:file-search-bold-duotone" width={48} />
            <Typography sx={{ mt: 1 }}>ไม่พบแม่แบบเอกสารที่ค้นหา</Typography>
            <Button
              color="inherit"
              onClick={() => {
                setSearch('');
                setPaperFilter('all');
                table.onResetPage();
              }}
              sx={{ mt: 1 }}
            >
              ล้างตัวกรอง
            </Button>
          </Box>
        )}

        <TablePaginationCustom
          page={table.page}
          count={documents.length}
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
    </Container>
  );
}

type SummaryCardProps = {
  label: string;
  value: number;
  icon:
    | 'solar:documents-bold-duotone'
    | 'solar:file-text-bold-duotone'
    | 'solar:album-bold-duotone';
  color: 'primary' | 'success' | 'warning';
};

function SummaryCard({ label, value, icon, color }: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.5,
            color: `${color}.main`,
            placeItems: 'center',
            bgcolor: `${color}.lighter`,
          }}
        >
          <RemixIcon icon={icon} width={25} />
        </Box>
        <Box>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}
