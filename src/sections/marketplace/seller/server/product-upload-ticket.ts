import 'server-only';

import { z } from 'zod';
import jwt from 'jsonwebtoken';

export const UploadTicketSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  userId: z.string().min(1),
  name: z.string().min(1).max(255),
  mime: z.string(),
  size: z.number().int().positive(),
  isPreview: z.boolean(),
  path: z.string(),
});
export type UploadTicket = z.infer<typeof UploadTicketSchema>;

function key() {
  if (!process.env.AUTH_JWT_SECRET) throw new Error('Missing AUTH_JWT_SECRET');
  return `${process.env.AUTH_JWT_SECRET}:marketplace-file-transfer`;
}
export function signUploadTicket(ticket: UploadTicket) {
  return jwt.sign(ticket, key(), {
    algorithm: 'HS256',
    audience: 'product-upload',
    expiresIn: '30m',
  });
}
export function verifyUploadTicket(token: string): UploadTicket {
  return UploadTicketSchema.parse(
    jwt.verify(token, key(), { algorithms: ['HS256'], audience: 'product-upload' })
  );
}
