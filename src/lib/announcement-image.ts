import 'server-only';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

const BUCKET = 'announcement-images';
const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
const MAX_SIZE = 5 * 1024 * 1024;

export function validateAnnouncementImage(file: File | null) {
  if (!file) return null;
  if (!ALLOWED_TYPES.includes(file.type)) return 'รองรับเฉพาะไฟล์ PNG หรือ JPEG';
  if (file.size > MAX_SIZE) return 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB';
  return null;
}

export async function removeAnnouncementImage(schoolId: string, announcementId: string) {
  const folder = `${schoolId}/${announcementId}`;
  const { data: files, error } = await supabaseAdmin.storage.from(BUCKET).list(folder);
  if (error) throw new Error(error.message);
  if (!files?.length) return;

  const { error: removeError } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove(files.map((file) => `${folder}/${file.name}`));
  if (removeError) throw new Error(removeError.message);
}

export async function replaceAnnouncementImage(
  schoolId: string,
  announcementId: string,
  file: File
) {
  await removeAnnouncementImage(schoolId, announcementId);

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${schoolId}/${announcementId}/cover.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return `${publicUrl}?v=${Date.now()}`;
}
