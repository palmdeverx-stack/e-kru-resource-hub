import 'server-only';

import sharp from 'sharp';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type ImagePreset = 'avatar' | 'content' | 'document';

type OptimizeImageOptions = {
  preset?: ImagePreset;
  output?: 'webp' | 'original';
  resize?: boolean;
};

export type OptimizedImage = {
  data: Buffer;
  contentType: string;
  extension: 'jpg' | 'png' | 'webp';
  size: number;
  originalSize: number;
  optimized: boolean;
};

const MAX_DIMENSION: Record<ImagePreset, number> = {
  avatar: 1024,
  content: 2400,
  document: 2800,
};

function extensionFor(contentType: string): OptimizedImage['extension'] {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Normalizes orientation, removes camera metadata and limits oversized images.
 * PNG converted to WebP stays lossless. JPEG/WebP use a high visual-quality
 * setting with 4:4:4 chroma so text and document edges remain sharp.
 */
export async function optimizeUploadedImage(
  file: File,
  { preset = 'content', output = 'webp', resize = true }: OptimizeImageOptions = {}
): Promise<OptimizedImage> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error('ชนิดไฟล์รูปภาพไม่รองรับการบีบอัด');
  }

  const original = Buffer.from(await file.arrayBuffer());
  let pipeline = sharp(original, {
    failOn: 'warning',
    limitInputPixels: 80_000_000,
  }).rotate();
  if (resize) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION[preset],
      height: MAX_DIMENSION[preset],
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  let contentType = file.type;
  if (output === 'webp') {
    contentType = 'image/webp';
    pipeline =
      file.type === 'image/png'
        ? pipeline.webp({ lossless: true, effort: 6 })
        : pipeline.webp({ quality: 90, effort: 6, smartSubsample: true });
  } else if (file.type === 'image/png') {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 });
  } else if (file.type === 'image/webp') {
    pipeline = pipeline.webp({ quality: 92, effort: 6, smartSubsample: true });
  } else {
    pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' });
  }

  const optimized = await pipeline.toBuffer();
  if (optimized.length >= original.length) {
    return {
      data: original,
      contentType: file.type,
      extension: extensionFor(file.type),
      size: original.length,
      originalSize: original.length,
      optimized: false,
    };
  }

  return {
    data: optimized,
    contentType,
    extension: extensionFor(contentType),
    size: optimized.length,
    originalSize: original.length,
    optimized: true,
  };
}
