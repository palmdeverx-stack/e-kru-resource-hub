import 'server-only';

import type { AppRole } from 'src/lib/auth-token';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export type SecurityAuditResult = 'success' | 'failure' | 'denied';

type SecurityAuditInput = {
  request?: Request;
  actorId?: string | null;
  actorUsername?: string | null;
  actorRole?: AppRole | string | null;
  category: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  result: SecurityAuditResult;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEYS =
  /password|passcode|pin|secret|token|authorization|cookie|credential|signed.?url/i;

function sanitize(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEYS.test(key)) return '[REDACTED]';
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitize(item, '', depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitize(entryValue, entryKey, depth + 1),
        ])
    );
  }
  return String(value);
}

function clientIp(request?: Request) {
  if (!request) return null;
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}

/**
 * Security logging must never make the business request fail. Database errors
 * are reported server-side without including event metadata or credentials.
 */
export async function writeSecurityAudit(input: SecurityAuditInput): Promise<void> {
  const requestId =
    input.request?.headers.get('x-request-id') ??
    input.request?.headers.get('x-vercel-id') ??
    crypto.randomUUID();

  const { error } = await supabaseAdmin.from('security_audit_logs').insert({
    actor_id: input.actorId ?? null,
    actor_username: input.actorUsername?.slice(0, 200) ?? null,
    actor_role: input.actorRole ?? null,
    category: input.category.slice(0, 100),
    action: input.action.slice(0, 160),
    target_type: input.targetType?.slice(0, 100) ?? null,
    target_id: input.targetId?.slice(0, 300) ?? null,
    result: input.result,
    ip_address: clientIp(input.request)?.slice(0, 100) ?? null,
    user_agent: input.request?.headers.get('user-agent')?.slice(0, 1000) ?? null,
    request_id: requestId.slice(0, 200),
    metadata: sanitize(input.metadata ?? {}),
  });

  if (error) {
    console.error('Security audit write failed', error.code, error.message);
  }
}

