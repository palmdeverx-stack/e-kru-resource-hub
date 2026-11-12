import 'server-only';

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

let fontPromise: Promise<Buffer> | undefined;

export function getWatermarkFont() {
  fontPromise ??= readFile(
    join(process.cwd(), 'public', 'fonts', 'LINESeedSansTH-Regular.ttf')
  ).catch((error) => {
    fontPromise = undefined;
    throw error;
  });
  return fontPromise;
}
