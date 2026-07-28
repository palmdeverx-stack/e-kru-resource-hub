'use client';

import type { TeacherAssignment } from '../teacher-assignment-actions';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { TruncatedTypography } from 'src/components/typography';

// ----------------------------------------------------------------------

type Props = {
  row: TeacherAssignment;
  detailPath: string;
  canEdit: boolean;
  onEdit: (row: TeacherAssignment) => void;
  onDelete: (row: TeacherAssignment) => void;
};

export function TeacherAssignmentCard({ row, detailPath, canEdit, onEdit, onDelete }: Props) {
  const teacherName =
    `${row.teacher.first_name ?? ''} ${row.teacher.last_name ?? ''}`.trim() || row.teacher.username;
  const teacherInitial = teacherName.charAt(0).toUpperCase();

  return (
    <Card
      variant="outlined"
      sx={{
        height: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.16),
        transition: (theme) =>
          theme.transitions.create(['transform', 'box-shadow', 'border-color'], {
            duration: theme.transitions.duration.shorter,
          }),
        '&:hover': {
          transform: 'translateY(-5px)',
          borderColor: 'primary.main',
          boxShadow: (theme) => theme.customShadows.card,
        },
        '&:focus-within': {
          outline: (theme) => `3px solid ${varAlpha(theme.vars.palette.primary.mainChannel, 0.22)}`,
          outlineOffset: 2,
        },
      }}
    >
      <CardActionArea
        component={RouterLink}
        href={detailPath}
        disableRipple
        aria-label={`เปิดรายวิชา ${row.subject.name} ห้อง ${row.classroom.name}`}
        sx={{
          width: 1,
          flex: 1,
          display: 'flex',
          alignItems: 'stretch',
          '&:hover .MuiCardActionArea-focusHighlight': { opacity: 0 },
        }}
      >
        <Box sx={{ width: 1, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 132,
              overflow: 'hidden',
              position: 'relative',
              bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.1),
            }}
          >
            {row.subject.image_url ? (
              <Box
                component="img"
                src={row.subject.image_url}
                alt=""
                sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
              />
            ) : (
              <Box
                sx={{
                  width: 1,
                  height: 1,
                  display: 'grid',
                  color: 'primary.main',
                  placeItems: 'center',
                  background: (theme) =>
                    `linear-gradient(135deg, ${theme.vars.palette.primary.lighter}, ${varAlpha(
                      theme.vars.palette.primary.mainChannel,
                      0.18
                    )})`,
                }}
              >
                <RemixIcon icon="solar:notebook-bold-duotone" width={54} />
              </Box>
            )}

            <Chip
              size="small"
              label={row.classroom.name}
              sx={{
                top: 12,
                left: 12,
                position: 'absolute',
                fontWeight: 700,
                color: 'primary.darker',
                bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.92),
                boxShadow: (theme) => theme.customShadows.z8,
              }}
            />
          </Box>

          <Box sx={{ p: { xs: 2, sm: 2 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 1, minWidth: 0 }}>
              <TruncatedTypography variant="h6">
                {row.subject.code || '-'} | {row.subject.name}
              </TruncatedTypography>
              <Box sx={{ gap: 1, mt: 1, display: 'flex', alignItems: 'center' }}>
                <Avatar
                  src={row.teacher.avatar_url ?? undefined}
                  alt={`รูปครู ${teacherName}`}
                  sx={{
                    width: 32,
                    height: 32,
                    typography: 'caption',
                    color: 'primary.main',
                    bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.1),
                  }}
                >
                  {teacherInitial}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    ครูผู้สอน
                  </Typography>
                  <Typography variant="subtitle2" noWrap>
                    {teacherName}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mt: 'auto', borderStyle: 'dashed' }} />
            <Box
              sx={{
                gap: 1,
                pt: 1,
                display: 'flex',
                color: 'primary.main',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ gap: 0.75, display: 'flex', alignItems: 'center' }}>
                <RemixIcon icon="solar:chart-square-outline" width={20} />
                <Typography variant="subtitle2">เปิดห้องเรียน</Typography>
              </Box>
              <RemixIcon icon="eva:arrow-ios-forward-fill" width={22} />
            </Box>
          </Box>
        </Box>
      </CardActionArea>
      <Box
        sx={{
          gap: 1,
          px: 1.5,
          py: 1.25,
          width: 1,
          display: 'flex',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant="caption"
          sx={{ pl: 0.75, color: 'text.secondary', alignSelf: 'center' }}
        >
          จัดการรายวิชา
        </Typography>
        <Box sx={{ gap: 0.5, display: 'flex' }}>
          {canEdit && (
            <Button
              size="small"
              color="inherit"
              onClick={() => onEdit(row)}
              startIcon={<RemixIcon icon="solar:pen-bold" />}
            >
              แก้ไข
            </Button>
          )}
          <Button
            size="small"
            color="error"
            onClick={() => onDelete(row)}
            startIcon={<RemixIcon icon="solar:trash-bin-trash-bold" />}
          >
            ลบ
          </Button>
        </Box>
      </Box>
    </Card>
  );
}
