/** Shared limits for seller branding, verification documents, and receipt signatures. */
export const SELLER_ASSET_UPLOAD_MAX_MB = 2;
export const SELLER_ASSET_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const SELLER_ASSET_UPLOAD_ACCEPT = SELLER_ASSET_UPLOAD_MIME_TYPES.join(',');

export function validateSellerUploadSelection(
  file: Pick<File, 'name' | 'size' | 'type'>,
  accept: string,
  maxSizeMb: number
): string | null {
  if (!file.size) return 'ไฟล์ว่าง กรุณาเลือกไฟล์ใหม่';
  if (file.size > maxSizeMb * 1024 * 1024) return `ไฟล์ต้องมีขนาดไม่เกิน ${maxSizeMb} MB`;

  const acceptedTypes = accept.split(',').map((type) => type.trim());
  const isPdf =
    ['application/pdf', '', 'application/octet-stream', 'application/x-pdf'].includes(file.type) &&
    /\.pdf$/i.test(file.name);
  const validType = acceptedTypes.some(
    (type) => type === file.type || (type === 'application/pdf' && isPdf)
  );
  return validType ? null : 'ชนิดไฟล์ไม่รองรับ กรุณาเลือกไฟล์ตามรูปแบบที่ระบุ';
}
