'use client';

// ----------------------------------------------------------------------

export const PROFILE_IMAGE_TARGET_BYTES = 1024 * 1024;
export const PROFILE_IMAGE_UPLOAD_LIMIT_BYTES = Math.round(1.5 * 1024 * 1024);
export const PROFILE_IMAGE_SOURCE_LIMIT_BYTES = 12 * 1024 * 1024;

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_DIMENSION = 1200;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('ไม่สามารถย่อขนาดรูปภาพได้'));
      },
      'image/webp',
      quality
    );
  });
}

export async function resizeProfileImage(file: File): Promise<File> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์ PNG, JPEG หรือ WEBP');
  }
  if (file.size > PROFILE_IMAGE_SOURCE_LIMIT_BYTES) {
    throw new Error('ไฟล์ต้นฉบับต้องมีขนาดไม่เกิน 12MB');
  }

  const image = await loadImage(file);
  const initialScale = Math.min(
    1,
    MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  let scale = initialScale;
  let quality = 0.88;

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการย่อขนาดรูปภาพ');

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= PROFILE_IMAGE_TARGET_BYTES) {
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile';
      return new File([blob], `${baseName}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });
    }

    if (quality > 0.56) {
      quality -= 0.08;
    } else {
      scale *= 0.82;
      quality = 0.78;
    }
  }

  throw new Error('ไม่สามารถย่อรูปให้ต่ำกว่า 1MB ได้ กรุณาเลือกรูปอื่น');
}

export function formatImageSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
