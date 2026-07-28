'use client';

import type { SchoolDocumentTemplate } from '../document-catalog';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

const DocumentExamplePdfDialog = dynamic(
  () => import('../components/document-example-pdf-dialog'),
  { ssr: false }
);

export function DocumentDetailView({
  template,
  initialPreview = false,
  backPath = paths.admin.documents.root,
}: {
  template: SchoolDocumentTemplate;
  initialPreview?: boolean;
  backPath?: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (initialPreview) setPreviewOpen(true);
  }, [initialPreview]);

  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
      <Button
        component={RouterLink}
        href={backPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้ารายการเอกสาร
      </Button>

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
          <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography component="h1" variant="h3">
              {template.name}
            </Typography>
            <Chip color="primary" variant="soft" label={template.code} />
          </Box>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>{template.description}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RemixIcon icon="solar:eye-bold" />}
          onClick={() => setPreviewOpen(true)}
        >
          พรีวิว PDF
        </Button>
      </Box>

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        }}
      >
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            รูปแบบเอกสาร
          </Typography>
          <Typography variant="h6">{template.paper}</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            แหล่งข้อมูล
          </Typography>
          <Typography variant="h6">{template.source}</Typography>
        </Card>
      </Box>

      <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h6">ส่วนประกอบของเอกสาร</Typography>
        <Box
          sx={{
            mt: 2,
            gap: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          }}
        >
          {template.sections.map((section, index) => (
            <Box
              key={section}
              sx={{
                p: 2,
                gap: 1.5,
                display: 'flex',
                borderRadius: 1.5,
                bgcolor: 'background.neutral',
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  flexShrink: 0,
                  borderRadius: '50%',
                  placeItems: 'center',
                  color: 'primary.contrastText',
                  bgcolor: 'primary.main',
                }}
              >
                {index + 1}
              </Box>
              <Typography variant="subtitle2">{section}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      <Card variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6">หมายเหตุเกี่ยวกับแม่แบบ</Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          ตัวอย่าง PDF ใช้ข้อมูลสมมติเพื่อแสดงโครงสร้างเอกสาร โรงเรียนควรตรวจสอบข้อความ
          เลขที่หนังสือ ตราสัญลักษณ์ และรูปแบบที่หน่วยงานต้นสังกัดกำหนดก่อนนำไปใช้ออกเอกสารจริง
        </Typography>
      </Card>

      {previewOpen && (
        <DocumentExamplePdfDialog open template={template} onClose={() => setPreviewOpen(false)} />
      )}
    </Container>
  );
}
