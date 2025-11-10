// Netlify Function: repairs-public-status
// Page publique (HTML) affichant un résumé du ticket de réparation, accessible via token.

import { createClient } from '@supabase/supabase-js';

interface NetlifyEvent { httpMethod: string; headers: Record<string,string>; queryStringParameters?: Record<string,string|undefined> }
interface NetlifyResponse { statusCode: number; headers?: Record<string,string>; body: string }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function html(statusCode: number, body: string): NetlifyResponse { return { statusCode, headers: HTML_HEADERS, body }; }
function json(statusCode: number, body: any): NetlifyResponse { return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) }; }

function page(title: string, content: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f6f7f9; margin:0; }
  .card { max-width: 520px; margin: 24px auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
  .header { padding:16px 20px; border-bottom:1px solid #eef2f7; display:flex; align-items:center; gap:10px; }
  .title { font-size:16px; font-weight:600; color:#111827; margin:0; }
  .content { padding: 16px 20px; color:#111827; }
  .row { display:flex; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px dashed #e5e7eb; }
  .row:last-child { border-bottom:none; }
  .label { font-weight:600; color:#374151; }
  .value { color:#111827; text-align:right; }
  .muted { color:#6b7280; font-size:12px; margin-top:10px; }
  .ok { color:#059669; }
  .warn { color:#b45309; }
  .err { color:#b91c1c; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M12 4h9"></path><path d="M4 9h16"></path><path d="M4 15h16"></path></svg>
      <h1 class="title">${title}</h1>
    </div>
    <div class="content">${content}</div>
  </div>
</body>
</html>`;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  try {
    if (event.httpMethod !== 'GET') {
      return json(405, { ok:false, error:{ code:'METHOD_NOT_ALLOWED', message:'Seule la méthode GET est autorisée' }});
    }

    const token = (event.queryStringParameters?.token || '').trim();
    if (!token) {
      const c = `<p class="err">Lien invalide (token manquant).</p>`;
      return html(400, page('Lien de suivi invalide', c));
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      const c = `<p class="err">Configuration serveur incomplète.</p>`;
      return html(500, page('Erreur serveur', c));
    }

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Vérifier le token
    const { data: link, error: linkErr } = await service
      .from('repair_public_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (linkErr || !link) {
      const c = `<p class="err">Lien introuvable ou expiré.</p>`;
      return html(404, page('Lien invalide', c));
    }

    const now = new Date();
    const exp = new Date(link.expires_at);
    if ((link as any).revoked_at || isNaN(exp.getTime()) || exp.getTime() < now.getTime()) {
      const c = `<p class="warn">Ce lien a expiré ou a été révoqué. Merci de contacter la boutique.</p>`;
      return html(410, page('Lien expiré', c));
    }

    // 2) Charger le ticket (champ minimaux, pas d'infos sensibles)
    const { data: ticket, error: tErr } = await service
      .from('repair_tickets')
      .select('id, created_at, device_brand, device_model')
      .eq('id', link.repair_id)
      .maybeSingle();

    if (tErr || !ticket) {
      const c = `<p class="err">Ticket introuvable.</p>`;
      return html(404, page('Ticket introuvable', c));
    }

    const shortId = String(ticket.id).slice(0, 8).toUpperCase();
    const created = ticket.created_at ? new Date(ticket.created_at) : null;
    const createdStr = created ? created.toLocaleString('fr-FR', { dateStyle:'full', timeStyle:'short' }) : '—';

    const rows = [
      `<div class="row"><div class="label">Ticket</div><div class="value">#${shortId}</div></div>`,
      `<div class="row"><div class="label">Appareil</div><div class="value">${ticket.device_brand || ''} ${ticket.device_model || ''}</div></div>`,
      `<div class="row"><div class="label">Déposé le</div><div class="value">${createdStr}</div></div>`,
      `<div class="muted">Pour toute question, appelez le magasin. Ce lien est temporaire et ne montre pas d'informations sensibles (codes PIN, etc.).</div>`
    ].join('');

    return html(200, page('Suivi de votre réparation', rows));
  } catch (e: any) {
    const c = `<p class="err">Erreur interne: ${String(e?.message || e)}</p>`;
    return html(500, page('Erreur interne', c));
  }
};
