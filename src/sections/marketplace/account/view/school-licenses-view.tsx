'use client';

import type { MarketplaceSchoolLicense, MarketplaceLicenseTeacher } from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { SCHOOL_FEATURES } from 'src/lib/school-subscription-config';

import {
  RiTeamLine,
  RiSchoolLine,
  RiUserAddLine,
  RiDeleteBinLine,
  RiShieldCheckLine,
} from 'src/components/remix-icon';

import { getSchoolLicenses, assignTeacherLicense, revokeTeacherLicense } from '../../shared/api';

const featureLabels = new Map<string, string>(
  SCHOOL_FEATURES.map((feature) => [feature.key, feature.label])
);

function teacherName(teacher: MarketplaceLicenseTeacher) {
  return [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') || teacher.username;
}

export function MarketplaceSchoolLicensesView() {
  const [licenses, setLicenses] = useState<MarketplaceSchoolLicense[]>([]);
  const [teachers, setTeachers] = useState<MarketplaceLicenseTeacher[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSchoolLicenses();
      setLicenses(result.licenses);
      setTeachers(result.teachers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลด License ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (licenseId: string) => {
    const teacherId = selectedTeachers[licenseId];
    if (!teacherId) return;
    setWorkingId(licenseId);
    setError('');
    setMessage('');
    try {
      const result = await assignTeacherLicense(licenseId, teacherId);
      setMessage(result.message);
      setSelectedTeachers((current) => ({ ...current, [licenseId]: '' }));
      await load();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'เพิ่มครูไม่สำเร็จ');
    } finally {
      setWorkingId('');
    }
  };

  const revoke = async (licenseId: string, teacherId: string) => {
    setWorkingId(licenseId);
    setError('');
    setMessage('');
    try {
      const result = await revokeTeacherLicense(licenseId, teacherId);
      setMessage(result.message);
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'นำครูออกไม่สำเร็จ');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3 } }}>
      <Stack spacing={0.75}>
        <Typography component="h1" variant="h3">
          สิทธิ์และ License
        </Typography>
        <Typography color="text.secondary">
          ดูแพ็กเกจ วันหมดอายุ และจัดสรร License ให้ครูในโรงเรียน
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {message}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 12, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : licenses.length ? (
        <Stack spacing={2.5} sx={{ mt: 4 }}>
          {licenses.map((license) => {
            const expired = new Date(license.expires_at).getTime() <= Date.now();
            const assignments = license.assignments ?? [];
            const assignedIds = new Set(assignments.map((assignment) => assignment.teacher_id));
            const availableTeachers = teachers.filter((teacher) => !assignedIds.has(teacher.id));
            const usedSeats = assignments.length;
            const seatPercent = Math.min(100, (usedSeats / license.seat_count) * 100);

            return (
              <Card key={license.id} variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Stack spacing={2.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Stack direction="row" spacing={1.5}>
                      <Box sx={{ color: 'primary.main', pt: 0.25 }}>
                        {license.license_scope === 'school' ? (
                          <RiSchoolLine size={28} />
                        ) : (
                          <RiTeamLine size={28} />
                        )}
                      </Box>
                      <Box>
                        <Typography variant="h5">
                          {license.product?.title ?? 'Package E-KRU'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {license.license_scope === 'school'
                            ? 'สิทธิ์สำหรับผู้ใช้ทั้งโรงเรียน'
                            : `License รายครู ${license.seat_count} Seat`}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack alignItems={{ sm: 'flex-end' }} spacing={0.75}>
                      <Chip
                        color={expired || license.status !== 'active' ? 'default' : 'success'}
                        icon={<RiShieldCheckLine />}
                        label={expired ? 'หมดอายุ' : 'ใช้งานอยู่'}
                      />
                      <Typography variant="body2" color="text.secondary">
                        หมดอายุ{' '}
                        {new Intl.DateTimeFormat('th-TH', {
                          dateStyle: 'long',
                          timeZone: 'Asia/Bangkok',
                        }).format(new Date(license.expires_at))}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {license.feature_keys.map((featureKey) => (
                      <Chip
                        key={featureKey}
                        size="small"
                        variant="soft"
                        label={featureLabels.get(featureKey) ?? featureKey}
                      />
                    ))}
                  </Stack>

                  {license.license_scope === 'teacher' && (
                    <>
                      <Box>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                          <Typography variant="subtitle2">การใช้งาน Seat</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {usedSeats}/{license.seat_count} คน
                          </Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={seatPercent} />
                      </Box>

                      {!expired && license.status === 'active' && (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                          <TextField
                            fullWidth
                            select
                            size="small"
                            label="เลือกครู"
                            value={selectedTeachers[license.id] ?? ''}
                            onChange={(event) =>
                              setSelectedTeachers((current) => ({
                                ...current,
                                [license.id]: event.target.value,
                              }))
                            }
                          >
                            <MenuItem value="">เลือกครูที่ต้องการเพิ่ม</MenuItem>
                            {availableTeachers.map((teacher) => (
                              <MenuItem key={teacher.id} value={teacher.id}>
                                {teacherName(teacher)}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Button
                            variant="contained"
                            startIcon={<RiUserAddLine />}
                            disabled={
                              workingId === license.id ||
                              !selectedTeachers[license.id] ||
                              usedSeats >= license.seat_count
                            }
                            onClick={() => assign(license.id)}
                            sx={{ minWidth: 150 }}
                          >
                            เพิ่มครู
                          </Button>
                        </Stack>
                      )}

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {assignments.map((assignment) => {
                          const teacher = teachers.find(
                            (item) => item.id === assignment.teacher_id
                          );
                          return (
                            <Chip
                              key={assignment.id}
                              label={teacher ? teacherName(teacher) : 'ครู'}
                              onDelete={
                                expired
                                  ? undefined
                                  : () => revoke(license.id, assignment.teacher_id)
                              }
                              deleteIcon={<RiDeleteBinLine />}
                            />
                          );
                        })}
                        {!assignments.length && (
                          <Typography variant="body2" color="text.secondary">
                            ยังไม่ได้เพิ่มครูเข้า License
                          </Typography>
                        )}
                      </Stack>
                    </>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <Card variant="outlined" sx={{ mt: 4, p: 6, textAlign: 'center' }}>
          <RiShieldCheckLine size={44} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            โรงเรียนยังไม่มี License ที่ซื้อจาก Marketplace
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            License จะปรากฏที่นี่หลังชำระเงินสำเร็จ
          </Typography>
        </Card>
      )}
    </Container>
  );
}
