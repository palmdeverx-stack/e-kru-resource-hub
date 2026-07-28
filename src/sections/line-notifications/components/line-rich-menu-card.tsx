'use client';

import type { LineRichMenuAction, LineRichMenuLayout } from '../line-notification-actions';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { RemixIcon } from 'src/components/remix-icon';

import { LineRichMenuDeleteDialog } from './line-rich-menu-delete-dialog';
import {
  getLineRichMenu,
  createLineRichMenu,
  deleteLineRichMenu,
  getLineRichMenuImage,
} from '../line-notification-actions';

// ----------------------------------------------------------------------

const MAX_IMAGE_SIZE = 1024 * 1024;

const DEFAULT_ACTIONS: LineRichMenuAction[] = [
  { label: 'ข้อมูลนักเรียน', type: 'message', value: 'ข้อมูลนักเรียน' },
  { label: 'การเข้าเรียน', type: 'message', value: 'การเข้าเรียน' },
  { label: 'ช่วยเหลือ', type: 'message', value: 'ช่วยเหลือ' },
  { label: 'ประกาศโรงเรียน', type: 'message', value: 'ประกาศ' },
  { label: 'ติดต่อโรงเรียน', type: 'message', value: 'ติดต่อโรงเรียน' },
  { label: 'เชื่อมบัญชี', type: 'message', value: 'เชื่อมบัญชี' },
];

function expectedSize(layout: LineRichMenuLayout) {
  if (layout === 'six') return { width: 2500, height: 1686, count: 6 };
  if (layout === 'one') return { width: 2500, height: 843, count: 1 };
  if (layout === 'two') return { width: 2500, height: 843, count: 2 };
  return { width: 2500, height: 843, count: 3 };
}

function previewColumns(layout: LineRichMenuLayout) {
  if (layout === 'one') return '1fr';
  if (layout === 'two') return 'repeat(2, 1fr)';
  return 'repeat(3, 1fr)';
}

function layoutFromAreaCount(count: number): LineRichMenuLayout {
  if (count === 1) return 'one';
  if (count === 2) return 'two';
  if (count === 6) return 'six';
  return 'three';
}

function imageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error('ไม่สามารถอ่านขนาดรูปภาพได้'));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

type Props = {
  hasAccessToken: boolean;
};

export function LineRichMenuCard({ hasAccessToken }: Props) {
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState<LineRichMenuLayout>('three');
  const [name, setName] = useState('Parent Portal');
  const [chatBarText, setChatBarText] = useState('เมนูผู้ปกครอง');
  const [selected, setSelected] = useState(true);
  const [actions, setActions] = useState(DEFAULT_ACTIONS.slice(0, 3));
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState('');
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState('');

  const query = useQuery({
    queryKey: ['line-rich-menu'],
    queryFn: getLineRichMenu,
    enabled: hasAccessToken,
    staleTime: 30_000,
  });
  const current = query.data?.richMenu;
  const currentLayout = current ? layoutFromAreaCount(current.areas.length) : null;
  const imageQuery = useQuery({
    queryKey: ['line-rich-menu-image', current?.id],
    queryFn: getLineRichMenuImage,
    enabled: Boolean(current?.id),
    staleTime: 30_000,
  });
  const createMutation = useMutation({
    mutationFn: createLineRichMenu,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['line-rich-menu'] }),
        queryClient.invalidateQueries({ queryKey: ['line-rich-menu-image'] }),
      ]);
      setImage(null);
      setImageError('');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteLineRichMenu,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['line-rich-menu'] }),
        queryClient.invalidateQueries({ queryKey: ['line-rich-menu-image'] }),
      ]);
      setDeleteOpen(false);
    },
  });

  useEffect(() => {
    if (!image) {
      setUploadedPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setUploadedPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (!imageQuery.data) {
      setCurrentPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(imageQuery.data);
    setCurrentPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageQuery.data]);

  useEffect(() => {
    if (!current) return;
    const loadedLayout = layoutFromAreaCount(current.areas.length);
    setLayout(loadedLayout);
    setName(current.name);
    setChatBarText(current.chatBarText);
    setSelected(current.selected);
    setActions(
      current.areas.map((area, index) => {
        if (area.action.type === 'message' && 'text' in area.action) {
          return {
            label: area.action.label ?? `ช่อง ${index + 1}`,
            type: 'message',
            value: area.action.text,
          };
        }
        if (area.action.type === 'uri' && 'uri' in area.action) {
          return {
            label: area.action.label ?? `ช่อง ${index + 1}`,
            type: 'uri',
            value: area.action.uri,
          };
        }
        return (
          DEFAULT_ACTIONS[index] ?? {
            label: `ช่อง ${index + 1}`,
            type: 'message',
            value: `เมนู ${index + 1}`,
          }
        );
      })
    );
    setImage(null);
    setImageError('');
  }, [current]);

  const size = expectedSize(layout);
  const previewUrl = uploadedPreviewUrl || (currentLayout === layout ? currentPreviewUrl : '');
  const statusLabel = useMemo(() => {
    if (!hasAccessToken) return 'รอเชื่อม LINE OA';
    if (query.data?.source === 'manager') return 'ตั้งค่าจาก LINE Manager';
    if (current) return 'กำลังใช้งาน';
    return 'ยังไม่ได้ตั้งค่า';
  }, [current, hasAccessToken, query.data?.source]);

  const changeLayout = (value: LineRichMenuLayout) => {
    setLayout(value);
    setActions(DEFAULT_ACTIONS.slice(0, expectedSize(value).count));
    setImage(null);
    setImageError('');
  };

  const changeAction = (index: number, value: Partial<LineRichMenuAction>) => {
    setActions((currentActions) =>
      currentActions.map((action, actionIndex) =>
        actionIndex === index ? { ...action, ...value } : action
      )
    );
  };

  const selectImage = async (file: File | undefined) => {
    setImage(null);
    setImageError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setImageError('รองรับเฉพาะไฟล์ PNG หรือ JPEG');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('รูปภาพต้องมีขนาดไม่เกิน 1 MB');
      return;
    }
    try {
      const dimensions = await imageDimensions(file);
      if (dimensions.width !== size.width || dimensions.height !== size.height) {
        setImageError(
          `Layout นี้ต้องใช้ภาพ ${size.width} × ${size.height} px แต่ภาพที่เลือกมีขนาด ${dimensions.width} × ${dimensions.height} px`
        );
        return;
      }
      setImage(file);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'ไม่สามารถอ่านรูปภาพได้');
    }
  };

  const create = () => {
    if (!image) {
      setImageError('กรุณาเลือกรูป Rich Menu');
      return;
    }
    createMutation.mutate({ image, layout, name, chatBarText, selected, actions });
  };

  return (
    <>
      <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
        <Box
          sx={{
            gap: 2,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">LINE Rich Menu</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              สร้างเมนูด้านล่างห้องแชต เพื่อให้ผู้ปกครองเข้าถึงข้อมูลสำคัญได้ง่าย
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="soft"
            color={current ? 'success' : query.data?.source === 'manager' ? 'info' : 'default'}
            label={statusLabel}
          />
        </Box>

        {!hasAccessToken && (
          <Alert severity="info" sx={{ mt: 2.5 }}>
            บันทึก Channel access token ก่อนจึงจะเชื่อม Rich Menu ได้
          </Alert>
        )}
        {query.isError && (
          <Alert severity="error" sx={{ mt: 2.5 }}>
            {query.error.message}
          </Alert>
        )}
        {imageQuery.isError && (
          <Alert severity="warning" sx={{ mt: 2.5 }}>
            โหลดข้อมูล Rich Menu ได้ แต่ไม่สามารถแสดงภาพปัจจุบัน: {imageQuery.error.message}
          </Alert>
        )}
        {query.data?.source === 'manager' && (
          <Alert severity="warning" sx={{ mt: 2.5 }}>
            บัญชีนี้มี Rich Menu ที่สร้างจาก LINE Official Account Manager
            ระบบสามารถสร้างเมนูใหม่ผ่าน Messaging API ได้ แต่เมนูเดิมต้องจัดการจาก LINE Manager
          </Alert>
        )}
        {current && (
          <Alert severity="success" variant="outlined" sx={{ mt: 2.5 }}>
            กำลังใช้ “{current.name}” · ปุ่มเปิดเมนู “{current.chatBarText}” ·{' '}
            {current.areas.length} พื้นที่กด
          </Alert>
        )}
        {(createMutation.error || createMutation.isSuccess) && (
          <Alert
            severity={createMutation.error ? 'error' : 'success'}
            onClose={() => createMutation.reset()}
            sx={{ mt: 2.5 }}
          >
            {createMutation.error?.message ?? 'สร้างและตั้ง Rich Menu เป็นค่าเริ่มต้นแล้ว'}
          </Alert>
        )}

        <Box
          sx={{
            gap: 2,
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <TextField
            select
            label="รูปแบบเมนู"
            value={layout}
            disabled={!hasAccessToken || createMutation.isPending}
            onChange={(event) => changeLayout(event.target.value as LineRichMenuLayout)}
          >
            <MenuItem value="one">1 ช่อง · 2500 × 843 px</MenuItem>
            <MenuItem value="two">2 ช่อง · 2500 × 843 px</MenuItem>
            <MenuItem value="three">3 ช่อง · 2500 × 843 px</MenuItem>
            <MenuItem value="six">6 ช่อง · 2500 × 1686 px</MenuItem>
          </TextField>
          <TextField
            label="ชื่อ Rich Menu"
            value={name}
            disabled={!hasAccessToken || createMutation.isPending}
            onChange={(event) => setName(event.target.value.slice(0, 300))}
          />
          <TextField
            label="ข้อความปุ่มเปิดเมนู"
            value={chatBarText}
            helperText={`${chatBarText.length}/14 ตัวอักษร`}
            disabled={!hasAccessToken || createMutation.isPending}
            onChange={(event) => setChatBarText(event.target.value.slice(0, 14))}
          />
          <FormControlLabel
            label="เปิดเมนูอัตโนมัติเมื่อเข้าห้องแชต"
            control={
              <Switch
                checked={selected}
                disabled={!hasAccessToken || createMutation.isPending}
                onChange={(event) => setSelected(event.target.checked)}
              />
            }
          />
        </Box>

        <Box sx={{ mt: 2.5 }}>
          <Typography variant="subtitle2">รูป Rich Menu</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            PNG หรือ JPEG ขนาด {size.width} × {size.height} px และไม่เกิน 1 MB
          </Typography>
          {current && !image && previewUrl && (
            <Typography variant="caption" sx={{ ml: 1, color: 'success.main', fontWeight: 600 }}>
              · กำลังแสดงภาพที่ใช้งานอยู่
            </Typography>
          )}
          <Box
            sx={{
              mt: 1.25,
              position: 'relative',
              overflow: 'hidden',
              aspectRatio: `${size.width} / ${size.height}`,
              borderRadius: 2,
              bgcolor: 'background.neutral',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundImage: previewUrl ? `url("${previewUrl}")` : 'none',
              border: '1px dashed',
              borderColor: imageError ? 'error.main' : 'divider',
            }}
          >
            <Box
              sx={{
                inset: 0,
                display: 'grid',
                position: 'absolute',
                gridTemplateColumns: previewColumns(layout),
                gridTemplateRows: layout === 'six' ? 'repeat(2, 1fr)' : '1fr',
              }}
            >
              {actions.map((action, index) => (
                <Box
                  key={`${layout}-${index}`}
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    borderRight:
                      index < actions.length - 1 && (layout !== 'six' || index % 3 < 2)
                        ? '1px solid rgba(255,255,255,0.8)'
                        : 'none',
                    borderBottom:
                      layout === 'six' && index < 3 ? '1px solid rgba(255,255,255,0.8)' : 'none',
                    bgcolor: previewUrl ? 'rgba(0,0,0,0.12)' : 'transparent',
                  }}
                >
                  <Chip
                    size="small"
                    label={`${index + 1}. ${action.label}`}
                    sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}
                  />
                </Box>
              ))}
            </Box>
            {!previewUrl && (
              <Box
                sx={{
                  inset: 0,
                  gap: 1,
                  display: 'grid',
                  position: 'absolute',
                  placeItems: 'center',
                  alignContent: 'center',
                  color: 'text.secondary',
                }}
              >
                <RemixIcon icon="solar:gallery-wide-bold" width={36} />
                <Typography variant="body2">ตัวอย่างพื้นที่กด {actions.length} ช่อง</Typography>
              </Box>
            )}
          </Box>
          {imageError && (
            <Typography variant="caption" sx={{ mt: 0.75, display: 'block', color: 'error.main' }}>
              {imageError}
            </Typography>
          )}
          <Button
            component="label"
            variant="outlined"
            disabled={!hasAccessToken || createMutation.isPending}
            startIcon={<RemixIcon icon="solar:gallery-add-bold" />}
            sx={{ mt: 1.25 }}
          >
            เลือกรูป Rich Menu
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => void selectImage(event.target.files?.[0])}
            />
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2">การทำงานเมื่อกดแต่ละช่อง</Typography>
          <Box sx={{ gap: 1.5, mt: 1.5, display: 'grid' }}>
            {actions.map((action, index) => (
              <Box
                key={`${layout}-action-${index}`}
                sx={{
                  gap: 1.5,
                  display: 'grid',
                  alignItems: 'start',
                  gridTemplateColumns: { xs: '1fr', sm: '56px 1fr 140px 1.5fr' },
                }}
              >
                <Chip label={index + 1} sx={{ mt: 1 }} />
                <TextField
                  label="ชื่อช่อง"
                  value={action.label}
                  disabled={!hasAccessToken || createMutation.isPending}
                  onChange={(event) =>
                    changeAction(index, { label: event.target.value.slice(0, 20) })
                  }
                />
                <TextField
                  select
                  label="การทำงาน"
                  value={action.type}
                  disabled={!hasAccessToken || createMutation.isPending}
                  onChange={(event) =>
                    changeAction(index, {
                      type: event.target.value as 'message' | 'uri',
                      value: '',
                    })
                  }
                >
                  <MenuItem value="message">ส่งข้อความ</MenuItem>
                  <MenuItem value="uri">เปิดลิงก์</MenuItem>
                </TextField>
                <TextField
                  label={action.type === 'message' ? 'ข้อความที่ส่งหา Bot' : 'HTTPS URL'}
                  value={action.value}
                  disabled={!hasAccessToken || createMutation.isPending}
                  onChange={(event) => changeAction(index, { value: event.target.value })}
                />
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            gap: 1,
            mt: 3,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          {current && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<RemixIcon icon="solar:trash-bin-trash-bold" />}
              onClick={() => setDeleteOpen(true)}
            >
              ยกเลิก Rich Menu
            </Button>
          )}
          <Button
            variant="contained"
            loading={createMutation.isPending}
            disabled={
              !hasAccessToken ||
              !image ||
              !name.trim() ||
              !chatBarText.trim() ||
              actions.some((action) => !action.label.trim() || !action.value.trim())
            }
            startIcon={<RemixIcon icon="solar:check-circle-bold" />}
            onClick={create}
          >
            {current ? 'สร้างและใช้เมนูใหม่' : 'สร้างและเชื่อม Rich Menu'}
          </Button>
        </Box>
      </Card>

      <LineRichMenuDeleteDialog
        open={deleteOpen}
        loading={deleteMutation.isPending}
        errorMessage={deleteMutation.error?.message}
        onClose={() => {
          setDeleteOpen(false);
          deleteMutation.reset();
        }}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
