import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

type StoredFile = { id?: string; storage_bucket: string; storage_path: string; file_name?: string };

export async function removeProductFiles(bucket: string, paths: string[]) {
  const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
}
export async function productFileUrl(file: StoredFile, seconds = 600, download = false) {
  const { data, error } = await supabaseAdmin.storage
    .from(file.storage_bucket)
    .createSignedUrl(
      file.storage_path,
      seconds,
      download ? { download: file.file_name } : undefined
    );
  if (error) throw new Error(error.message);
  return data?.signedUrl ?? null;
}
