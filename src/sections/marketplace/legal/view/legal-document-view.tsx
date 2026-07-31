'use client';

import type { LegalDocumentType, MarketplaceLegalDocument } from '../types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import { Editor } from 'src/components/editor';
import { editorClasses } from 'src/components/editor/classes';
import { RiShieldCheckLine } from 'src/components/remix-icon';

type Props = {
  documentType: LegalDocumentType;
};

export function MarketplaceLegalDocumentView({ documentType }: Props) {
  const [document, setDocument] = useState<MarketplaceLegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/legal-documents', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดเอกสารไม่สำเร็จ');
        setDocument(
          result.items.find(
            (item: MarketplaceLegalDocument) => item.document_type === documentType
          ) ?? null
        );
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดเอกสารไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, [documentType]);

  return (
    <Box sx={{ bgcolor: 'background.default', py: { xs: 3 }, minHeight: 400 }}>
      <Container maxWidth="lg">
        {loading ? (
          <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !document && documentType === 'cookie_policy' ? (
          <CookiePolicyFallback />
        ) : !document ? (
          <Alert severity="info">
            เอกสารนี้อยู่ระหว่างการจัดทำ กรุณาติดต่อผู้ให้บริการหากต้องการข้อมูลเพิ่มเติม
          </Alert>
        ) : (
          <Card sx={{ p: { xs: 2.5, sm: 4, md: 6 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  display: 'grid',
                  borderRadius: 2,
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RiShieldCheckLine size={25} />
              </Box>
              <Box>
                <Typography component="h1" variant="h3">
                  {document.title}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip size="small" label={`เวอร์ชัน ${document.version}`} />
                  <Chip size="small" color="success" label="ฉบับเผยแพร่" />
                </Stack>
              </Box>
            </Stack>
            {document.summary && (
              <Typography color="text.secondary" sx={{ mt: 3, lineHeight: 1.8 }}>
                {document.summary}
              </Typography>
            )}
            <Divider sx={{ my: 4 }} />
            <Editor
              editable={false}
              value={document.content_html}
              sx={{
                minHeight: 0,
                border: 0,
                opacity: '1 !important',
                [`.${editorClasses.toolbar.root}`]: { display: 'none' },
                [`.${editorClasses.content.root}`]: {
                  overflow: 'visible',
                  bgcolor: 'transparent',
                  '& .tiptap.ProseMirror': { px: 0 },
                },
              }}
            />
            <Divider sx={{ my: 4 }} />
            <Typography variant="h6">ข้อมูลผู้ให้บริการ</Typography>
            <Stack spacing={0.75} sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>ผู้ให้บริการ:</strong> {document.provider_name}
              </Typography>
              <Typography variant="body2">
                <strong>ประเภท:</strong>{' '}
                {document.provider_type === 'company' ? 'นิติบุคคล' : 'บุคคลธรรมดา'}
              </Typography>
              {document.provider_registration_no && (
                <Typography variant="body2">
                  <strong>เลขทะเบียนนิติบุคคล:</strong> {document.provider_registration_no}
                </Typography>
              )}
              {document.provider_tax_id && (
                <Typography variant="body2">
                  <strong>เลขประจำตัวผู้เสียภาษี:</strong> {document.provider_tax_id}
                </Typography>
              )}
              <Typography variant="body2">
                <strong>ที่อยู่:</strong> {document.provider_address}
              </Typography>
              <Typography variant="body2">
                <strong>อีเมล:</strong> {document.contact_email}
              </Typography>
              {document.provider_phone && (
                <Typography variant="body2">
                  <strong>โทรศัพท์:</strong> {document.provider_phone}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                มีผลตั้งแต่{' '}
                {document.effective_at
                  ? fDateTime(document.effective_at, 'DD MMM YYYY HH:mm')
                  : '-'}
              </Typography>
            </Stack>
          </Card>
        )}
      </Container>
    </Box>
  );
}

function CookiePolicyFallback() {
  return (
    <Card sx={{ p: { xs: 2.5, sm: 4, md: 6 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 48,
            height: 48,
            display: 'grid',
            flexShrink: 0,
            borderRadius: 2,
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          }}
        >
          <RiShieldCheckLine size={25} />
        </Box>
        <Box>
          <Typography component="h1" variant="h3">
            Cookie Policy
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            การใช้คุกกี้และเทคโนโลยีจัดเก็บข้อมูลของ E-KRU Marketplace
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ my: 4 }} />
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5">คุกกี้ที่จำเป็น</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.8 }}>
            ใช้สำหรับการเข้าสู่ระบบ ความปลอดภัย การตั้งค่าหน้าจอ ตะกร้าสินค้า
            การจดจำประกาศที่ปิดแล้ว และการบันทึกตัวเลือกคุกกี้
            ส่วนนี้จำเป็นต่อการทำงานของเว็บไซต์และไม่สามารถปิดจากแถบตั้งค่าได้
          </Typography>
        </Box>
        <Box>
          <Typography variant="h5">ข้อมูลการเข้าชม</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.8 }}>
            เมื่อเลือก “ยอมรับทั้งหมด” ระบบจะสร้างตัวระบุแบบสุ่มบนอุปกรณ์
            เพื่อบันทึกจำนวนการเปิดดูสินค้าและปรับปรุงประสบการณ์ใช้งาน
            ระบบจะไม่สร้างตัวระบุนี้เมื่อเลือก “เฉพาะที่จำเป็น”
          </Typography>
        </Box>
        <Box>
          <Typography variant="h5">ระยะเวลาและการเปลี่ยนตัวเลือก</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.8 }}>
            ระบบจดจำตัวเลือกคุกกี้เป็นเวลาไม่เกิน 1 ปี คุณสามารถเปลี่ยนตัวเลือกได้ทุกเมื่อจากปุ่ม
            “ตั้งค่าคุกกี้” ที่ส่วนท้ายเว็บไซต์
            และสามารถลบคุกกี้หรือข้อมูลเว็บไซต์ผ่านการตั้งค่าเบราว์เซอร์ได้
          </Typography>
        </Box>
      </Stack>
      {/* <Alert severity="info" sx={{ mt: 4 }}>
        ผู้ดูแลระบบสามารถจัดทำและเผยแพร่ Cookie Policy
        ฉบับเต็มแทนข้อความสรุปนี้ได้จากเมนูเอกสารข้อกำหนด Marketplace
      </Alert> */}
    </Card>
  );
}
