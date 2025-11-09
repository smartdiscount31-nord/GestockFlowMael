// Netlify Function: repairs-drying-ack
// Marque comme "pris en compte" la fin du séchage pour un ticket

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
  const auth = (event.headers?.authorization || event.headers?.Authorization || '').trim();
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod !== 'POST') {
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST uniquement' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token manquant' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }

    const userId = userWrap.user.id;
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    const allowedRoles = ['MAGASIN', 'ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Permissions insuffisantes' } });
    }

    let parsed: any = {};
    try { parsed = JSON.parse(event.body || '{}'); } catch { /* ignore */ }

    const repair_id: string | undefined = parsed?.repair_id;
    if (!repair_id) {
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'repair_id requis' } });
    }

    const { data: ticket, error: ticketErr } = await supabase
      .from('repair_tickets')
      .select('*')
      .eq('id', repair_id)
      .single();

    if (ticketErr || !ticket) {
      return resp(404, { ok: false, error: { code: 'NOT_FOUND', message: 'Ticket introuvable' } });
    }

    // Optionnel: vérifier que la fin est atteinte (drying_end_at <= now)
    // et que non déjà acquitté.

    const { data: updated, error: updateErr } = await supabase
      .from('repair_tickets')
      .update({ drying_acknowledged_at: new Date().toISOString() })
      .eq('id', repair_id)
      .select()
      .single();

    if (updateErr || !updated) {
      return resp(500, { ok: false, error: { code: 'INTERNAL', message: updateErr?.message || 'Erreur MAJ ack séchage' } });
    }

    return resp(200, { ok: true, data: { ticket: updated } });
  } catch (e: any) {
    return resp(500, { ok: false, error: { code: 'INTERNAL', message: String(e?.message || e) } });
  }
};
