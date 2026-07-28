import 'server-only';

import { timingSafeEqual } from 'node:crypto';

// ----------------------------------------------------------------------

export function isValidCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization') ?? '';
  const expected = cronSecret ? `Bearer ${cronSecret}` : '';

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    !!cronSecret &&
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}
