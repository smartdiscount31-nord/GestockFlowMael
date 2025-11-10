// Netlify Function: repairs-public-link-create
// Crée (ou régénère) un lien public signé pour qu'un client puisse consulter
// l'état d'une réparation sans authentification.

import { createClient } from '@supabase/supabase-js';

interface NetlifyEvent { httpMethod: string; headers: Record<string,string>; body: string | null }
interface NetlifyResponse { statusCode: number; headers?: Record<string,string>; body: string }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function resp(statusCode: number, body: any): NetlifyResponse {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function getAuthToken(event: NetlifyEvent): string | null {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function computeBaseUrl(event: NetlifyEvent): string {
  const proto = (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'] || 'https').toString();
  const host = (event.headers['x-forwarded-host'] || event.headers['X-Forwarded-Host'] || event.headers['host'] || event.headers['Host'] || '').toString();
  if (host) return `${proto}://${host}`;
  // Fallback: variable d'env configurable côté Netlify
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  return 'http://localhost:8888';
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  try {
    if (event.httpMethod !== 'POST') {
      return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return resp(500, { ok: false, error: { code: 'MISSING_CONFIG', message: 'Clés Supabase manquantes (URL/ANON)' } });
    }

    // 1) Vérifier l'utilisateur (staff) via le token porté par le front
    const accessToken = getAuthToken(event);
    if (!accessToken) return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token manquant' } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    const { data: userWrap, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userWrap?.user) {
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }

    // 2) Lire body
    let parsed: any = {};
    try { parsed = JSON.parse(event.body || '{}'); } catch {}
    const repair_id = parsed?.repair_id as string | undefined;
    const ttl_days = Number(parsed?.ttl_days ?? 30);
    if (!repair_id) {
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Champ requis: repair_id' } });
    }

    // 3) Service role pour contourner RLS et créer le lien
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      // Fallback: si pas de service role, on ne peut pas écrire; on retourne un lien JWT non stocké (simple) plus tard si besoin
      return resp(500, { ok: false, error: { code: 'MISSING_SERVICE_ROLE', message: 'SUPABASE_SERVICE_ROLE_KEY manquant sur Netlify' } });
    }

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Générer un token UUID v4
    const token = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : require('crypto').randomUUID();
    const expiresAt = new Date(Date.now() + Math.max(1, ttl_days) * 24 * 60 * 60 * 1000);

    // Créer la table si elle n'existe pas? (on tente insert, sinon message d'erreur clair)
    const { error: insertErr } = await service
      .from('repair_public_links')
      .insert({ repair_id, token, expires_at: expiresAt.toISOString() });

    if (insertErr) {
      return resp(500, { ok: false, error: { code: 'DB_ERROR', message: 'Création du lien public échouée (table manquante ?)', details: insertErr?.message } });
    }

    const baseUrl = computeBaseUrl(event);
    const public_url = `${baseUrl}/.netlify/functions/repairs-public-status?token=${encodeURIComponent(token)}`;

    return resp(200, { ok: true, data: { public_url, token, expires_at: expiresAt.toISOString() } });
  } catch (e: any) {
    return resp(500, { ok: false, error: { code: 'INTERNAL', message: String(e?.message || e) } });
  }
};
