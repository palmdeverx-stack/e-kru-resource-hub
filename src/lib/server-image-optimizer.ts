import 'server-only';

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type ImagePreset = 'avatar' | 'content' | 'document';

type OptimizeImageOptions = {
  preset?: ImagePreset;
  output?: 'webp' | 'original';
  resize?: boolean;
  maxBytes?: number;
  watermarkLines?: readonly string[];
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

const WATERMARK_FONT_URL = new URL(
  '../../public/fonts/LINESeedSansTH-Regular.ttf',
  import.meta.url
);
let watermarkFontPromise: Promise<Buffer> | undefined;

function getWatermarkFont() {
  watermarkFontPromise ??= readFile(WATERMARK_FONT_URL);
  return watermarkFontPromise;
}

function extensionFor(contentType: string): OptimizedImage['extension'] {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

async function constrainImageSize(data: Buffer, contentType: string, maxBytes: number) {
  if (data.length <= maxBytes) return data;

  const attempts = [
    { dimension: 2400, quality: 84 },
    { dimension: 2000, quality: 78 },
    { dimension: 1700, quality: 72 },
    { dimension: 1400, quality: 66 },
    { dimension: 1150, quality: 58 },
    { dimension: 900, quality: 50 },
    { dimension: 700, quality: 42 },
    { dimension: 520, quality: 34 },
  ];

  for (const attempt of attempts) {
    let pipeline = sharp(data, { failOn: 'warning' }).resize({
      width: attempt.dimension,
      height: attempt.dimension,
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (contentType === 'image/webp') {
      pipeline = pipeline.webp({
        quality: attempt.quality,
        effort: 6,
        smartSubsample: true,
      });
    } else if (contentType === 'image/png') {
      pipeline = pipeline.png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        quality: attempt.quality,
        effort: 10,
      });
    } else {
      pipeline = pipeline.jpeg({
        quality: attempt.quality,
        mozjpeg: true,
        chromaSubsampling: '4:4:4',
      });
    }

    const constrained = await pipeline.toBuffer();
    if (constrained.length <= maxBytes) return constrained;
  }

  throw new Error('ไม่สามารถลดขนาดรูปภาพให้อยู่ในขนาดที่กำหนดได้');
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function createWatermarkTile(lines: readonly string[]) {
  const fontData = (await getWatermarkFont()).toString('base64');
  const renderedLines = lines
    .map(
      (line, index) => `
        <text
          x="550"
          y="${118 + index * 34}"
          fill="#1565f5"
          fill-opacity="0.16"
          font-family="WatermarkThai, sans-serif"
          font-size="23"
          font-weight="700"
          text-anchor="middle"
        >${escapeXml(line)}</text>
      `
    )
    .join('');
  return Buffer.from(`
    <svg width="1100" height="300" xmlns="http://www.w3.org/2000/svg">
      <style>
        @font-face {
          font-family: 'WatermarkThai';
          src: url('data:font/ttf;base64,${fontData}') format('truetype');
        }
      </style>
      <g transform="rotate(-18 550 150)">
        ${renderedLines}
      </g>
    </svg>
  `);
}

/**
 * Normalizes orientation, removes camera metadata and limits oversized images.
 * PNG converted to WebP stays lossless. JPEG/WebP use a high visual-quality
 * setting with 4:4:4 chroma so text and document edges remain sharp.
 */
export async function optimizeUploadedImage(
  file: File,
  {
    preset = 'content',
    output = 'webp',
    resize = true,
    maxBytes,
    watermarkLines,
  }: OptimizeImageOptions = {}
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
  if (watermarkLines?.length) {
    pipeline = pipeline.composite([
      {
        input: await createWatermarkTile(watermarkLines),
        tile: true,
        blend: 'over',
      },
    ]);
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

  let optimized: Buffer = await pipeline.toBuffer();
  if (
    !watermarkLines?.length &&
    optimized.length >= original.length &&
    (!maxBytes || original.length <= maxBytes)
  ) {
    return {
      data: original,
      contentType: file.type,
      extension: extensionFor(file.type),
      size: original.length,
      originalSize: original.length,
      optimized: false,
    };
  }

  if (maxBytes) {
    optimized = await constrainImageSize(optimized, contentType, maxBytes);
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
