import 'server-only';

import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';

// ----------------------------------------------------------------------

const rawSecret = process.env.AUTH_JWT_SECRET;

if (!rawSecret) {
  throw new Error('Missing AUTH_JWT_SECRET environment variable');
}

const secret = createHash('sha256').update(`${rawSecret}:guardian-portal`).digest();
const issuer = 'i-scores';
const audience = 'guardian-portal';

type GuardianPortalPurpose = 'identity' | 'link' | 'session';

export type GuardianPortalToken = {
  schoolId: string;
  lineUserId: string;
  studentId?: string;
  purpose: GuardianPortalPurpose;
};

function signGuardianPortalToken(
  payload: GuardianPortalToken,
  expiresIn: jwt.SignOptions['expiresIn']
) {
  return jwt.sign(payload, secret, { expiresIn, issuer, audience });
}

export function signGuardianPortalLinkToken(schoolId: string, lineUserId: string) {
  return signGuardianPortalToken({ schoolId, lineUserId, purpose: 'link' }, '10m');
}

export function signGuardianPortalIdentityToken(schoolId: string, lineUserId: string) {
  return jwt.sign({ schoolId, lineUserId, purpose: 'identity' }, secret, { issuer, audience });
}

export function signGuardianPortalSessionToken(
  schoolId: string,
  lineUserId: string,
  studentId: string
) {
  return signGuardianPortalToken({ schoolId, lineUserId, studentId, purpose: 'session' }, '30d');
}

export function verifyGuardianPortalToken(
  token: string,
  purpose: GuardianPortalPurpose
): GuardianPortalToken | null {
  try {
    const payload = jwt.verify(token, secret, { issuer, audience }) as GuardianPortalToken;
    if (
      payload.purpose !== purpose ||
      typeof payload.schoolId !== 'string' ||
      typeof payload.lineUserId !== 'string' ||
      (purpose === 'session' && typeof payload.studentId !== 'string')
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
