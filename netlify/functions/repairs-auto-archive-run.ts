// Netlify Function: repairs-auto-archive-run
// Exécution batch côté backend pour archiver les tickets livrés après 19:00
// Évite les boucles côté front; à appeler 1 fois/jour après 19:00 par le client.

import { createClient } from '@supabase/supabase-js';

interface NetlifyEvent { httpMethod: string; headers: Record<string, string>; body: string | null }
interface NetlifyResponse { statusCode: number; body: string; headers?: Record<string, string> }

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
  console.log('[repairs-auto-archive-run] start');

  if (event.httpMethod !== 'POST') {
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur et rôle
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }
    const userId = userWrap.user.id;

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profErr || !profile) {
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profile not found' } });
    }

    const allowed = ['ADMIN', 'ADMIN_FULL'];
    if (!allowed.includes(profile.role)) {
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
    }

    // Sélectionner les tickets livrés (batch raisonnable)
    const { data: deliveredRows, error: selErr } = await supabase
      .from('repair_tickets')
      .select('id, status, invoice_id')
      .eq('status', 'delivered')
      .limit(500);

    if (selErr) {
      console.log('[auto-archive] select error', selErr);
      return resp(500, { ok: false, error: { code: 'INTERNAL', message: selErr.message } });
    }

    const delivered = Array.isArray(deliveredRows) ? deliveredRows : [];
    if (!delivered.length) {
      return resp(200, { ok: true, data: { archived: 0, total_delivered: 0 }, message: 'No delivered tickets to archive' });
    }

    // Appeler repairs-archive pour chaque ticket (serveur → serveur avec même token)
    let archived = 0;
    for (const t of delivered) {
      try {
        const res = await fetch(process.env.URL ? `${process.env.URL}/.netlify/functions/repairs-archive` : '/.netlify/functions/repairs-archive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ repair_id: (t as any).id })
        });
        if (res.ok) archived += 1;
        else console.warn('[auto-archive] repairs-archive failed for', (t as any).id, res.status);
      } catch (e) {
        console.warn('[auto-archive] exception for', (t as any).id, e);
      }
    }

    return resp(200, { ok: true, data: { archived, total_delivered: delivered.length } });
  } catch (e: any) {
    console.log('[repairs-auto-archive-run] exception', e);
    return resp(500, { ok: false, error: { code: 'INTERNAL', message: String(e?.message || e) } });
  }
};
