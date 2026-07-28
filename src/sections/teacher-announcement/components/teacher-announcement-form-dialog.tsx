'use client';

import type {
  TeacherClassroom,
  TeacherAnnouncement,
  AnnouncementPayload,
} from '../teacher-announcement-actions';

import * as z from 'zod';
import { useMemo, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import FormGroup from '@mui/material/FormGroup';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormHelperText from '@mui/material/FormHelperText';
import FormControlLabel from '@mui/material/FormControlLabel';

import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import {
  createTeacherAnnouncement,
  updateTeacherAnnouncement,
} from '../teacher-announcement-actions';

// ----------------------------------------------------------------------

const FormSchema = z
  .object({
    title: z.string().trim().min(1, 'กรุณากรอกหัวข้อประกาศ'),
    content: z.string().trim().max(4000, 'รายละเอียดต้องไม่เกิน 4,000 ตัวอักษร'),
    announcementType: z.enum(['general', 'holiday', 'exam']),
    priority: z.enum(['normal', 'important', 'urgent']),
    classroomIds: z.array(z.string()).min(1, 'เลือกห้องเรียนอย่างน้อย 1 ห้อง'),
    eventStart: z.string(),
    eventEnd: z.string(),
    expiresAt: z.string(),
    sendLine: z.boolean(),
  })
  .refine((data) => !data.eventStart || !data.eventEnd || data.eventEnd >= data.eventStart, {
    message: 'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น',
    path: ['eventEnd'],
  });

type FormValues = z.infer<typeof FormSchema>;
type Props = {
  open: boolean;
  announcement: TeacherAnnouncement | null;
  classrooms: TeacherClassroom[];
  mode?: 'teacher' | 'admin';
  onClose: () => void;
};

const emptyValues: FormValues = {
  title: '',
  content: '',
  announcementType: 'general',
  priority: 'normal',
  classroomIds: [],
  eventStart: '',
  eventEnd: '',
  expiresAt: '',
  sendLine: false,
};

function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TeacherAnnouncementFormDialog({
  open,
  announcement,
  classrooms,
  mode = 'teacher',
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: emptyValues,
  });

  const createMutation = useMutation({
    mutationFn: ({ payload, image }: { payload: AnnouncementPayload; image: File | null }) =>
      createTeacherAnnouncement(payload, image),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] });
      await queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['line-notification-settings'] });
      if (result.lineRequested) {
        if (result.lineQueued > 0) {
          toast.success(`เผยแพร่ประกาศและนำ LINE เข้าคิว ${result.lineQueued} ผู้รับแล้ว`);
        } else {
          toast.warning(
            'เผยแพร่ประกาศแล้ว แต่ไม่พบผู้ปกครองที่เชื่อม LINE หรือการแจ้งเตือน LINE ยังไม่พร้อมใช้งาน'
          );
        }
      } else {
        toast.success('เผยแพร่ประกาศเรียบร้อยแล้ว');
      }
      onClose();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      payload,
      image,
      shouldRemoveImage,
    }: {
      payload: AnnouncementPayload;
      image: File | null;
      shouldRemoveImage: boolean;
    }) => updateTeacherAnnouncement(announcement!.id, payload, image, shouldRemoveImage),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] });
      await queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success('บันทึกประกาศเรียบร้อยแล้ว');
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    setImageFile(null);
    setRemoveImage(false);
    createMutation.reset();
    updateMutation.reset();
    methods.reset(
      announcement
        ? {
            title: announcement.title,
            content: announcement.content,
            announcementType: announcement.announcement_type,
            priority: announcement.priority,
            classroomIds: announcement.targets.map((target) => target.classroom_id),
            eventStart: toLocalInput(announcement.event_start),
            eventEnd: toLocalInput(announcement.event_end),
            expiresAt: toLocalInput(announcement.expires_at),
            sendLine: false,
          }
        : emptyValues
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement, methods, open]);

  const imagePreview = useMemo(
    () =>
      imageFile
        ? URL.createObjectURL(imageFile)
        : !removeImage
          ? (announcement?.image_url ?? null)
          : null,
    [announcement?.image_url, imageFile, removeImage]
  );
  useEffect(
    () => () => {
      if (imageFile && imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    },
    [imageFile, imagePreview]
  );

  const gradeGroups = useMemo(() => {
    const groups = new Map<string, TeacherClassroom[]>();
    for (const classroom of classrooms) {
      const grade = classroom.grade_level?.trim() || 'ไม่ระบุชั้น';
      const values = groups.get(grade) ?? [];
      values.push(classroom);
      groups.set(grade, values);
    }
    return Array.from(groups.entries());
  }, [classrooms]);

  const pending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error ?? updateMutation.error;
  const onSubmit = methods.handleSubmit((values) => {
    if (!values.content.trim() && !imageFile && (!announcement?.image_url || removeImage)) {
      methods.setError('content', { message: 'กรุณาเพิ่มรายละเอียดหรือรูปภาพอย่างน้อย 1 อย่าง' });
      return;
    }
    const payload: AnnouncementPayload = {
      ...values,
      eventStart: values.eventStart ? new Date(values.eventStart).toISOString() : '',
      eventEnd: values.eventEnd ? new Date(values.eventEnd).toISOString() : '',
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : '',
      sendLine: announcement ? false : values.sendLine,
    };
    if (announcement) {
      updateMutation.mutate({
        payload,
        image: imageFile,
        shouldRemoveImage: removeImage,
      });
    } else {
      createMutation.mutate({ payload, image: imageFile });
    }
  });

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="md">
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">
                {announcement ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                ข่าวสารจะแสดงแก่นักเรียน และเลือกส่ง LINE ถึงผู้ปกครองได้
              </Typography>
            </Box>
            <IconButton onClick={onClose} disabled={pending} aria-label="ปิดหน้าต่าง">
              <RemixIcon icon="mingcute:close-line" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.message}
            </Alert>
          )}
          <Box sx={{ mt: 2, gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <Field.Text name="title" label="หัวข้อประกาศ *" />
            <Field.Text
              name="content"
              label="รายละเอียด"
              multiline
              minRows={4}
              helperText="ใส่ข้อความ รูปภาพ หรือทั้งสองอย่างก็ได้"
            />
            <Box
              sx={{
                p: 2,
                gap: 2,
                display: 'flex',
                borderRadius: 2,
                alignItems: { xs: 'stretch', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                border: '1px dashed',
                borderColor: 'divider',
              }}
            >
              {imagePreview ? (
                <Box
                  component="img"
                  src={imagePreview}
                  alt="ตัวอย่างรูปประกาศ"
                  sx={{ width: 120, height: 86, borderRadius: 1.5, objectFit: 'cover' }}
                />
              ) : (
                <Box
                  sx={{
                    width: 120,
                    height: 86,
                    display: 'grid',
                    borderRadius: 1.5,
                    placeItems: 'center',
                    color: 'text.disabled',
                    bgcolor: 'action.hover',
                  }}
                >
                  <RemixIcon icon="solar:gallery-add-bold" width={30} />
                </Box>
              )}
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">รูปภาพประกาศ</Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  PNG หรือ JPEG ขนาดไม่เกิน 5MB
                </Typography>
                <Box sx={{ gap: 1, mt: 1, display: 'flex' }}>
                  <Button component="label" size="small" variant="outlined">
                    {imagePreview ? 'เปลี่ยนรูป' : 'เลือกรูป'}
                    <input
                      hidden
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setImageFile(file);
                        if (file) {
                          setRemoveImage(false);
                          methods.clearErrors('content');
                        }
                        event.target.value = '';
                      }}
                    />
                  </Button>
                  {imagePreview && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        setImageFile(null);
                        setRemoveImage(true);
                      }}
                    >
                      ลบรูป
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
            <Box
              sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
              <Field.Select name="announcementType" label="ประเภทประกาศ">
                <MenuItem value="general">ประกาศทั่วไป</MenuItem>
                <MenuItem value="holiday">วันหยุด</MenuItem>
                <MenuItem value="exam">วันสอบ</MenuItem>
              </Field.Select>
              <Field.Select name="priority" label="ความสำคัญ">
                <MenuItem value="normal">ทั่วไป</MenuItem>
                <MenuItem value="important">สำคัญ</MenuItem>
                <MenuItem value="urgent">เร่งด่วน</MenuItem>
              </Field.Select>
            </Box>

            <Controller
              name="classroomIds"
              control={methods.control}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error}>
                  <Typography variant="subtitle2">กลุ่มเป้าหมาย *</Typography>
                  <Typography variant="caption" sx={{ mb: 1, color: 'text.secondary' }}>
                    {mode === 'teacher'
                      ? 'เลือกทั้งระดับชั้น หรือเลือกเฉพาะห้องที่คุณเป็นครูประจำชั้น'
                      : 'เลือกทั้งระดับชั้น หรือเลือกเฉพาะบางห้องได้'}
                  </Typography>
                  <Box sx={{ gap: 1.5, display: 'grid' }}>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1.5,
                        color:
                          field.value.length === classrooms.length
                            ? 'primary.main'
                            : 'text.primary',
                        bgcolor:
                          field.value.length === classrooms.length
                            ? 'primary.lighter'
                            : 'action.hover',
                      }}
                    >
                      <FormControlLabel
                        label={
                          <Box>
                            <Typography variant="subtitle2">ทั้งหมด</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {mode === 'teacher'
                                ? 'เลือกทุกห้องที่คุณเป็นครูประจำชั้น'
                                : 'เลือกทุกระดับชั้นและทุกห้องในโรงเรียน'}
                            </Typography>
                          </Box>
                        }
                        control={
                          <Checkbox
                            checked={
                              classrooms.length > 0 && field.value.length === classrooms.length
                            }
                            indeterminate={
                              field.value.length > 0 && field.value.length < classrooms.length
                            }
                            onChange={(event) =>
                              field.onChange(
                                event.target.checked
                                  ? classrooms.map((classroom) => classroom.id)
                                  : []
                              )
                            }
                          />
                        }
                      />
                    </Box>
                    {gradeGroups.map(([grade, gradeClassrooms]) => {
                      const gradeIds = gradeClassrooms.map((classroom) => classroom.id);
                      const selectedCount = gradeIds.filter((id) =>
                        field.value.includes(id)
                      ).length;
                      return (
                        <Box
                          key={grade}
                          sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}
                        >
                          <FormControlLabel
                            label={
                              <Typography variant="subtitle2">
                                {grade} ({selectedCount}/{gradeIds.length} ห้อง)
                              </Typography>
                            }
                            control={
                              <Checkbox
                                checked={selectedCount === gradeIds.length}
                                indeterminate={selectedCount > 0 && selectedCount < gradeIds.length}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.checked
                                      ? Array.from(new Set([...field.value, ...gradeIds]))
                                      : field.value.filter((id) => !gradeIds.includes(id))
                                  )
                                }
                              />
                            }
                          />
                          <FormGroup
                            sx={{
                              pl: 3,
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            }}
                          >
                            {gradeClassrooms.map((classroom) => (
                              <FormControlLabel
                                key={classroom.id}
                                label={classroom.name}
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={field.value.includes(classroom.id)}
                                    onChange={(event) =>
                                      field.onChange(
                                        event.target.checked
                                          ? [...field.value, classroom.id]
                                          : field.value.filter((id) => id !== classroom.id)
                                      )
                                    }
                                  />
                                }
                              />
                            ))}
                          </FormGroup>
                        </Box>
                      );
                    })}
                  </Box>
                  {!classrooms.length && (
                    <Alert severity="warning">ยังไม่มีห้องเรียนที่รับผิดชอบ</Alert>
                  )}
                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />

            <Box
              sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
              <Field.DatePicker name="eventStart" label="วันเวลาเริ่มกิจกรรม" />
              <Field.DatePicker name="eventEnd" label="วันเวลาสิ้นสุดกิจกรรม" />
            </Box>
            <Field.DatePicker name="expiresAt" label="ซ่อนประกาศอัตโนมัติเมื่อ" />

            {!announcement && (
              <Controller
                name="sendLine"
                control={methods.control}
                render={({ field }) => (
                  <FormControlLabel
                    sx={{
                      m: 0,
                      p: 1.5,
                      borderRadius: 2,
                      alignItems: 'flex-start',
                      bgcolor: field.value ? 'rgba(6, 199, 85, 0.08)' : 'action.hover',
                    }}
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(_, checked) => field.onChange(checked)}
                        sx={{ mt: -0.5 }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="subtitle2">ส่งประกาศไปยัง LINE ผู้ปกครอง</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ส่งเฉพาะผู้ปกครองของนักเรียนในห้องที่เลือกและเชื่อม LINE แล้ว
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={pending} disabled={!classrooms.length}>
            {announcement ? 'บันทึกการแก้ไข' : 'เผยแพร่ประกาศ'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
