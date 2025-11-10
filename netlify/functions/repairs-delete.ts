// Netlify Function: repairs-delete
// Supprime définitivement un dossier de réparation (+ médias + pièces + étiquettes)

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

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    // Expected: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.substring(idx + marker.length);
  } catch {
    return null;
  }
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod !== 'POST') {
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token manquant' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });

    const userId = userWrap.user.id;
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (profileErr || !profile) return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil introuvable' } });

    const allowedRoles = ['ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Suppression réservée aux administrateurs' } });
    }

    let parsed: any = {};
    try { parsed = JSON.parse(event.body || '{}'); } catch {}
    const { repair_id } = parsed || {};
    if (!repair_id) return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'repair_id requis' } });

    // Récupérer le ticket pour supprimer les étiquettes si présentes
    const { data: ticket } = await supabase
      .from('repair_tickets')
      .select('*')
      .eq('id', repair_id)
      .single();

    // Libérer les réservations (non bloquant si échoue)
    try {
      await supabase.rpc('fn_repair_release_reservations', { p_repair_id: repair_id });
    } catch {}

    // Supprimer médias (fichiers + lignes)
    const { data: medias } = await supabase
      .from('repair_media')
      .select('id, kind, file_url')
      .eq('repair_id', repair_id);

    if (Array.isArray(medias)) {
      for (const m of medias) {
        const url: string = m.file_url;
        // La signature et les photos sont dans bucket app-assets
        const appAssetsPath = extractStoragePath(url, 'app-assets');
        if (appAssetsPath) {
          try { await supabase.storage.from('app-assets').remove([appAssetsPath]); } catch {}
        }
      }
      // Delete rows
      await supabase.from('repair_media').delete().eq('repair_id', repair_id);
    }

    // Supprimer pièces attachées
    await supabase.from('repair_items').delete().eq('repair_id', repair_id);

    // Supprimer étiquettes si présentes (bucket labels)
    const labelUrls: string[] = [];
    if (ticket?.label_client_url) labelUrls.push(ticket.label_client_url);
    if (ticket?.label_tech_url) labelUrls.push(ticket.label_tech_url);

    for (const u of labelUrls) {
      const p = extractStoragePath(u, 'labels');
      if (p) {
        try { await supabase.storage.from('labels').remove([p]); } catch {}
      }
    }

    // Supprimer le ticket
    const { error: delErr } = await supabase
      .from('repair_tickets')
      .delete()
      .eq('id', repair_id);

    if (delErr) {
      return resp(500, { ok: false, error: { code: 'INTERNAL', message: delErr.message } });
    }

    return resp(200, { ok: true, data: { deleted: repair_id } });
  } catch (e: any) {
    return resp(500, { ok: false, error: { code: 'INTERNAL', message: String(e?.message || e) } });
  }
};
