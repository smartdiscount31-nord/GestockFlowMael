// Netlify Function: repairs-order-batch
// Traite les commandes groupées de pièces pour plusieurs tickets

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
  console.log('[repairs-order-batch] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-order-batch] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-order-batch] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-order-batch] Erreur authentification:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }
    const userId = userWrap.user.id;
    console.log('[repairs-order-batch] Utilisateur authentifié:', userId);

    // Vérifier le rôle
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.log('[repairs-order-batch] Erreur récupération profil:', profileErr);
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    console.log('[repairs-order-batch] Rôle utilisateur:', profile.role);

    // Vérifier les permissions
    const allowedRoles = ['MAGASIN', 'ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('[repairs-order-batch] Rôle non autorisé:', profile.role);
      return resp(403, {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permissions insuffisantes pour commander des pièces'
        }
      });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-order-batch] Erreur parsing JSON');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    console.log('[repairs-order-batch] Données reçues');

    const { items } = parsed;

    // Valider que items est un tableau
    if (!Array.isArray(items) || items.length === 0) {
      console.log('[repairs-order-batch] Items manquants ou invalides');
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Le champ items doit être un tableau non vide'
        }
      });
    }

    console.log('[repairs-order-batch] Nombre d\'items à traiter:', items.length);

    // Valider chaque item
    const errors: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.repair_id || !item.product_id || !item.supplier_name || !item.expected_date || item.purchase_price === undefined) {
        errors.push(`Item ${i}: champs obligatoires manquants (repair_id, product_id, supplier_name, expected_date, purchase_price)`);
      }
    }

    if (errors.length > 0) {
      console.log('[repairs-order-batch] Erreurs de validation:', errors);
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Erreurs de validation',
          details: errors
        }
      });
    }

    // Traiter chaque item
    const results: any[] = [];
    const ticketsToUpdate = new Set<string>();
    let totalCost = 0;

    for (const item of items) {
      console.log('[repairs-order-batch] Traitement item:', item.repair_id, item.product_id);

      const {
        repair_id,
        product_id,
        supplier_name,
        expected_date,
        purchase_price,
        vat_regime,
        quantity
      } = item;

      const qty = quantity ? parseInt(String(quantity), 10) : 1;
      const price = parseFloat(String(purchase_price));

      // Mise à jour ou insertion de repair_items
      const updateData: any = {
        supplier_name,
        expected_date,
        purchase_price: price,
        quantity: qty
      };

      if (vat_regime && ['normal', 'margin'].includes(vat_regime)) {
        updateData.vat_regime = vat_regime;
      }

      // Chercher l'item existant
      const { data: existingItems, error: findErr } = await supabase
        .from('repair_items')
        .select('id')
        .eq('repair_id', repair_id)
        .eq('product_id', product_id)
        .eq('reserved', false);

      if (findErr) {
        console.log('[repairs-order-batch] Erreur recherche item:', findErr);
        results.push({
          repair_id,
          product_id,
          success: false,
          error: findErr.message
        });
        continue;
      }

      if (existingItems && existingItems.length > 0) {
        // Mise à jour
        console.log('[repairs-order-batch] Mise à jour item existant:', existingItems[0].id);
        const { error: updateErr } = await supabase
          .from('repair_items')
          .update(updateData)
          .eq('id', existingItems[0].id);

        if (updateErr) {
          console.log('[repairs-order-batch] Erreur mise à jour:', updateErr);
          results.push({
            repair_id,
            product_id,
            success: false,
            error: updateErr.message
          });
          continue;
        }

        results.push({
          repair_id,
          product_id,
          success: true,
          action: 'updated'
        });
      } else {
        // Insertion
        console.log('[repairs-order-batch] Création nouvel item');
        const insertData = {
          repair_id,
          product_id,
          stock_id: null,
          reserved: false,
          ...updateData
        };

        const { error: insertErr } = await supabase
          .from('repair_items')
          .insert(insertData);

        if (insertErr) {
          console.log('[repairs-order-batch] Erreur insertion:', insertErr);
          results.push({
            repair_id,
            product_id,
            success: false,
            error: insertErr.message
          });
          continue;
        }

        results.push({
          repair_id,
          product_id,
          success: true,
          action: 'created'
        });
      }

      ticketsToUpdate.add(repair_id);
      totalCost += price * qty;
    }

    console.log('[repairs-order-batch] Items traités:', results.length);
    console.log('[repairs-order-batch] Tickets à mettre à jour:', ticketsToUpdate.size);

    // Mettre à jour le statut des tickets en 'waiting_parts'
    if (ticketsToUpdate.size > 0) {
      const ticketIds = Array.from(ticketsToUpdate);
      console.log('[repairs-order-batch] Mise à jour statuts tickets:', ticketIds);

      const { error: statusErr } = await supabase
        .from('repair_tickets')
        .update({ status: 'waiting_parts' })
        .in('id', ticketIds);

      if (statusErr) {
        console.log('[repairs-order-batch] Erreur mise à jour statuts:', statusErr);
        // Non bloquant
      } else {
        console.log('[repairs-order-batch] Statuts tickets mis à jour: waiting_parts');
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log('[repairs-order-batch] Résumé - Succès:', successCount, 'Erreurs:', errorCount);

    return resp(200, {
      ok: true,
      data: {
        processed: results.length,
        success: successCount,
        errors: errorCount,
        tickets_updated: ticketsToUpdate.size,
        total_cost_estimate: totalCost.toFixed(2),
        results,
        message: `${successCount} pièce(s) commandée(s) avec succès, ${ticketsToUpdate.size} ticket(s) mis à jour`
      }
    });

  } catch (e: any) {
    console.log('[repairs-order-batch] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
