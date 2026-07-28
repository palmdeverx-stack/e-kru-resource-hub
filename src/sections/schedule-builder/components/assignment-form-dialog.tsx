'use client';

import type { UserRow } from 'src/sections/user/user-actions';
import type { Subject } from 'src/sections/subject/subject-actions';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  subjects: Subject[];
  teachers: UserRow[];
  onClose: () => void;
  onSubmit: (params: { subjectId: string; teacherId: string }) => Promise<void>;
};

function teacherName(teacher: UserRow) {
  return `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() || teacher.username;
}

export function AssignmentFormDialog({ open, subjects, teachers, onClose, onSubmit }: Props) {
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!subjectId || !teacherId) {
      setError('กรุณาเลือกวิชาและครูผู้สอน');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({ subjectId, teacherId });
      setSubjectId('');
      setTeacherId('');
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ไม่สามารถเพิ่มวิชาที่สอนได้');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={isSaving ? undefined : onClose}>
      <DialogTitle>เพิ่มวิชาที่สอนในห้องนี้</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          select
          fullWidth
          label="รายวิชา"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          sx={{ mt: 1 }}
        >
          {subjects.map((subject) => (
            <MenuItem key={subject.id} value={subject.id}>
              {subject.code ? `${subject.code} · ` : ''}
              {subject.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="ครูผู้สอน"
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
          sx={{ mt: 2 }}
        >
          {teachers.map((teacher) => (
            <MenuItem key={teacher.id} value={teacher.id}>
              {teacherName(teacher)}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" variant="outlined" disabled={isSaving} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          loading={isSaving}
          disabled={!subjects.length || !teachers.length}
          onClick={handleSubmit}
        >
          เพิ่มวิชาที่สอน
        </Button>
      </DialogActions>
    </Dialog>
  );
}
