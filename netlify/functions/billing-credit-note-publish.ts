import { createClient } from '@supabase/supabase-js';

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string>;
  body: string | null;
}

interface NetlifyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function resp(statusCode: number, body: any): NetlifyResponse {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function getAuthToken(event: NetlifyEvent): string | null {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod !== 'POST') {
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) return resp(401, { ok: false, error: { code: 'UNAUTHORIZED' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED' } });
    }
    const userId = userWrap.user.id;

    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } });
    }

    const creditNoteId = String(parsed.creditNoteId || '').trim();
    if (!creditNoteId) {
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'creditNoteId is required' } });
    }

    const { data, error } = await supabase.rpc('process_credit_note', {
      p_credit_note_id: creditNoteId,
      p_user: userId
    });

    if (error) {
      return resp(500, { ok: false, error: { code: 'INTERNAL', message: error.message } });
    }

    return resp(200, { ok: true, data });
  } catch (e: any) {
    return resp(500, { ok: false, error: { code: 'INTERNAL', message: String(e?.message || e) } });
  }
};
