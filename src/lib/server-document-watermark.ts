import 'server-only';

import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { rgb, degrees, PDFDocument } from 'pdf-lib';

const WATERMARK_FONT_URL = new URL(
  '../../public/fonts/LINESeedSansTH-Regular.ttf',
  import.meta.url
);
let watermarkFontPromise: Promise<Buffer> | undefined;

function getWatermarkFont() {
  watermarkFontPromise ??= readFile(WATERMARK_FONT_URL);
  return watermarkFontPromise;
}

export async function watermarkPdfDocument(bytes: Uint8Array, lines: readonly string[]) {
  const pdfDocument = await PDFDocument.load(bytes);
  pdfDocument.registerFontkit(fontkit);
  const font = await pdfDocument.embedFont(await getWatermarkFont(), { subset: true });

  for (const page of pdfDocument.getPages()) {
    const { width, height } = page.getSize();
    const fontSize = Math.max(10, Math.min(15, width / 38));
    const labelWidth = Math.max(...lines.map((line) => font.widthOfTextAtSize(line, fontSize)));
    const columnGap = Math.max(labelWidth + 70, width * 0.82);
    const rowGap = Math.max(150, height * 0.21);

    for (let row = -1, y = 40; y < height + rowGap; row += 1, y += rowGap) {
      const offset = row % 2 === 0 ? 0 : -columnGap / 2;
      for (let x = -width * 0.3 + offset; x < width * 1.2; x += columnGap) {
        const options = {
          x,
          y,
          font,
          size: fontSize,
          rotate: degrees(24),
          color: rgb(0.08, 0.4, 0.96),
          opacity: 0.14,
        };
        lines.forEach((line, index) => {
          page.drawText(line, { ...options, y: y - index * fontSize * 1.4 });
        });
      }
    }
  }

  return Buffer.from(await pdfDocument.save());
}
