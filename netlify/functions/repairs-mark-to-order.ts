// Netlify Function: repairs-mark-to-order
// Marque des pièces comme à commander (sans stock disponible)

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
  console.log('[repairs-mark-to-order] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-mark-to-order] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-mark-to-order] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-mark-to-order] Erreur authentification:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }
    const userId = userWrap.user.id;
    console.log('[repairs-mark-to-order] Utilisateur authentifié:', userId);

    // Vérifier le rôle
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.log('[repairs-mark-to-order] Erreur récupération profil:', profileErr);
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    console.log('[repairs-mark-to-order] Rôle utilisateur:', profile.role);

    // Vérifier les permissions
    const allowedRoles = ['MAGASIN', 'ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('[repairs-mark-to-order] Rôle non autorisé:', profile.role);
      return resp(403, {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permissions insuffisantes pour marquer des pièces à commander'
        }
      });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-mark-to-order] Erreur parsing JSON');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    console.log('[repairs-mark-to-order] Données reçues:', JSON.stringify(parsed, null, 2));

    const {
      repair_id,
      product_id,
      quantity,
      supplier_name,
      purchase_price,
      vat_regime
    } = parsed;

    // Valider les champs obligatoires
    if (!repair_id || !product_id || !quantity) {
      console.log('[repairs-mark-to-order] Champs obligatoires manquants');
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Champs obligatoires manquants: repair_id, product_id, quantity'
        }
      });
    }

    // Valider quantity
    const qty = parseInt(String(quantity), 10);
    if (isNaN(qty) || qty <= 0) {
      console.log('[repairs-mark-to-order] Quantité invalide:', quantity);
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'La quantité doit être un nombre entier positif'
        }
      });
    }

    // Vérifier que le ticket existe
    const { data: ticket, error: ticketErr } = await supabase
      .from('repair_tickets')
      .select('id, status')
      .eq('id', repair_id)
      .single();

    if (ticketErr || !ticket) {
      console.log('[repairs-mark-to-order] Ticket introuvable:', repair_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket de réparation ${repair_id} introuvable`
        }
      });
    }

    console.log('[repairs-mark-to-order] Ticket trouvé, statut:', ticket.status);

    // Vérifier que le produit existe
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('id', product_id)
      .single();

    if (productErr || !product) {
      console.log('[repairs-mark-to-order] Produit introuvable:', product_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Produit ${product_id} introuvable`
        }
      });
    }

    console.log('[repairs-mark-to-order] Produit trouvé:', product.name);

    // Créer ou mettre à jour repair_items avec reserved=false
    const itemData: any = {
      repair_id,
      product_id,
      stock_id: null, // Pas de stock associé car à commander
      quantity: qty,
      reserved: false,
      supplier_name: supplier_name || null,
      purchase_price: purchase_price ? parseFloat(String(purchase_price)) : null,
      vat_regime: (vat_regime && ['normal', 'margin'].includes(vat_regime)) ? vat_regime : null
    };

    console.log('[repairs-mark-to-order] Données repair_item:', JSON.stringify(itemData, null, 2));

    // Insert ou update repair_items
    // Utiliser une logique de recherche puis insert/update car on n'a pas de stock_id
    const { data: existingItem, error: findErr } = await supabase
      .from('repair_items')
      .select('id')
      .eq('repair_id', repair_id)
      .eq('product_id', product_id)
      .is('stock_id', null)
      .maybeSingle();

    let repairItem: any;

    if (existingItem) {
      console.log('[repairs-mark-to-order] Item existant trouvé, mise à jour:', existingItem.id);
      const { data: updated, error: updateErr } = await supabase
        .from('repair_items')
        .update(itemData)
        .eq('id', existingItem.id)
        .select()
        .single();

      if (updateErr) {
        console.log('[repairs-mark-to-order] Erreur mise à jour item:', updateErr);
        return resp(500, {
          ok: false,
          error: {
            code: 'INTERNAL',
            message: `Erreur lors de la mise à jour de la pièce: ${updateErr.message}`
          }
        });
      }

      repairItem = updated;
    } else {
      console.log('[repairs-mark-to-order] Création nouvel item');
      const { data: created, error: createErr } = await supabase
        .from('repair_items')
        .insert(itemData)
        .select()
        .single();

      if (createErr) {
        console.log('[repairs-mark-to-order] Erreur création item:', createErr);
        return resp(500, {
          ok: false,
          error: {
            code: 'INTERNAL',
            message: `Erreur lors de la création de la pièce: ${createErr.message}`
          }
        });
      }

      repairItem = created;
    }

    console.log('[repairs-mark-to-order] Repair_item créé/mis à jour:', repairItem.id);

    // Mettre à jour le statut du ticket en 'parts_to_order'
    const { error: statusErr } = await supabase
      .from('repair_tickets')
      .update({ status: 'parts_to_order' })
      .eq('id', repair_id);

    if (statusErr) {
      console.log('[repairs-mark-to-order] Erreur mise à jour statut ticket:', statusErr);
      // On continue quand même, ce n'est pas bloquant
    } else {
      console.log('[repairs-mark-to-order] Statut ticket mis à jour: parts_to_order');
    }

    // Récupérer toutes les pièces à commander pour ce ticket
    const { data: itemsToOrder, error: itemsErr } = await supabase
      .from('repair_items')
      .select(`
        *,
        product:products(id, name, sku)
      `)
      .eq('repair_id', repair_id)
      .eq('reserved', false);

    if (itemsErr) {
      console.log('[repairs-mark-to-order] Erreur récupération items à commander:', itemsErr);
    }

    console.log('[repairs-mark-to-order] Total pièces à commander pour ce ticket:', itemsToOrder?.length || 0);

    return resp(200, {
      ok: true,
      data: {
        repair_item: repairItem,
        items_to_order: itemsToOrder || [],
        message: `Pièce ${product.name} marquée à commander`
      }
    });

  } catch (e: any) {
    console.log('[repairs-mark-to-order] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
