import { createClient } from '@supabase/supabase-js';

type NetlifyResponse = { statusCode: number; headers?: Record<string, string>; body: string };
type NetlifyEvent = {
  httpMethod: string;
  headers: Record<string, string>;
  body: string | null;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Secrets / Config
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.NETLIFY_REFUNDS_WEBHOOK_SECRET || '';
const SYSTEM_USER_ID = process.env.REFUNDS_SYSTEM_USER_ID || '';

function resp(statusCode: number, body: any): NetlifyResponse {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function getHeader(headers: Record<string, string>, name: string): string {
  // Netlify lower-cases headers in some cases; try both
  return headers[name] || headers[name.toLowerCase()] || '';
}

function getAuthToken(headers: Record<string, string>): string | null {
  const auth = getHeader(headers, 'authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod !== 'POST') {
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  // Secret header check (do not leak the expected secret)
  const provided = getHeader(event.headers, 'x-webhook-secret').trim();
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return resp(401, { ok: false, error: { code: 'UNAUTHORIZED' } });
  }

  // Clients
  // - supabase: anon (optionally with user Authorization if present)
  // - supabaseService: service role (server-to-server ops, logging, RPC if policies require service)
  const token = getAuthToken(event.headers);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined as any);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Parse JSON payload
  let payload: any = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return resp(400, { ok: false, error: { code: 'BAD_JSON' } });
  }

  // Resolve userId (prefer system user if configured; else fallback to current token user)
  let userId: string | null = SYSTEM_USER_ID || null;
  if (!userId && token) {
    try {
      const { data: userWrap } = await supabase.auth.getUser();
      if (userWrap?.user?.id) userId = userWrap.user.id;
    } catch {
      // ignore; will fail below if no userId
    }
  }
  if (!userId) {
    return resp(401, { ok: false, error: { code: 'UNAUTHORIZED' } });
  }

  // Minimal audit log (same pattern as other functions: sync_logs)
  try {
    await supabaseService.from('sync_logs').insert({
      provider: 'amazon',
      operation: 'refund_ingest',
      outcome: 'ok',
      http_status: 202,
      message: 'webhook_received',
      metadata: {
        sourceEventId: payload?.sourceEventId || payload?.source_event_id || null,
        orderId: payload?.orderId || null,
        itemsCount: Array.isArray(payload?.items) ? payload.items.length : 0
      }
    });
  } catch {
    // non-bloquant
  }

  try {
    const { data, error } = await supabaseService.rpc('ingest_amazon_refund', {
      p_payload: payload,
      p_user: userId
    });

    if (error) {
      // Log failure
      try {
        await supabaseService.from('sync_logs').insert({
          provider: 'amazon',
          operation: 'refund_ingest',
          outcome: 'fail',
          http_status: 500,
          message: 'rpc_error',
          metadata: { err: String(error.message || error) }
        });
      } catch {}
      return resp(500, { ok: false, error: { code: 'INTERNAL', message: String(error.message || error) } });
    }

    const out = {
      ok: true,
      refundId: data?.refund_id || data?.refundId || null,
      creditNoteId: data?.credit_note_id || data?.creditNoteId || null,
      matchedInvoiceId: data?.matched_invoice_id || data?.matchedInvoiceId || null
    };

    // Final audit log
    try {
      await supabaseService.from('sync_logs').insert({
        provider: 'amazon',
        operation: 'refund_ingest',
        outcome: 'ok',
        http_status: 200,
        message: 'rpc_ok',
        metadata: out
      });
    } catch {}

    return resp(200, out);
  } catch (e: any) {
    try {
      await supabaseService.from('sync_logs').insert({
        provider: 'amazon',
        operation: 'refund_ingest',
        outcome: 'fail',
        http_status: 500,
        message: 'exception',
        metadata: { err: String(e?.message || e) }
      });
    } catch {}
    return resp(500, { ok: false, error: { code: 'INTERNAL', message: String(e?.message || e) } });
  }
};
