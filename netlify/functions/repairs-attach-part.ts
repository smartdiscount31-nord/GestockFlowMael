// Netlify Function: repairs-attach-part
// Attache une pièce à un ticket de réparation et réserve le stock

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
  console.log('[repairs-attach-part] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-attach-part] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-attach-part] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-attach-part] Erreur authentification:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }
    const userId = userWrap.user.id;
    console.log('[repairs-attach-part] Utilisateur authentifié:', userId);

    // Vérifier le rôle
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.log('[repairs-attach-part] Erreur récupération profil:', profileErr);
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    console.log('[repairs-attach-part] Rôle utilisateur:', profile.role);

    // Vérifier les permissions
    const allowedRoles = ['MAGASIN', 'ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('[repairs-attach-part] Rôle non autorisé:', profile.role);
      return resp(403, {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permissions insuffisantes pour attacher des pièces'
        }
      });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-attach-part] Erreur parsing JSON');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    console.log('[repairs-attach-part] Données reçues:', JSON.stringify(parsed, null, 2));

    const {
      repair_id,
      product_id,
      stock_id,
      quantity,
      purchase_price,
      vat_regime
    } = parsed;

    // Valider les champs obligatoires
    if (!repair_id || !product_id || !stock_id || !quantity) {
      console.log('[repairs-attach-part] Champs obligatoires manquants');
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Champs obligatoires manquants: repair_id, product_id, stock_id, quantity'
        }
      });
    }

    // Valider quantity
    const qty = parseInt(String(quantity), 10);
    if (isNaN(qty) || qty <= 0) {
      console.log('[repairs-attach-part] Quantité invalide:', quantity);
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
      .select('id, status, customer_id')
      .eq('id', repair_id)
      .single();

    if (ticketErr || !ticket) {
      console.log('[repairs-attach-part] Ticket introuvable:', repair_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket de réparation ${repair_id} introuvable`
        }
      });
    }

    console.log('[repairs-attach-part] Ticket trouvé, statut:', ticket.status);

    // Vérifier que le produit existe
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, sku, parent_id')
      .eq('id', product_id)
      .single();

    if (productErr || !product) {
      console.log('[repairs-attach-part] Produit introuvable:', product_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Produit ${product_id} introuvable`
        }
      });
    }

    console.log('[repairs-attach-part] Produit trouvé:', product.name, '(', product.sku, ')');

    // Vérifier que le stock existe
    const { data: stock, error: stockErr } = await supabase
      .from('stocks')
      .select('id, name')
      .eq('id', stock_id)
      .single();

    if (stockErr || !stock) {
      console.log('[repairs-attach-part] Stock introuvable:', stock_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Emplacement de stock ${stock_id} introuvable`
        }
      });
    }

    console.log('[repairs-attach-part] Stock trouvé:', stock.name);

    // Résoudre l'ID produit qui détient réellement le stock dans ce dépôt
    const candidateIds = new Set<string>();
    candidateIds.add(product.id);
    try {
      if (product.parent_id) {
        candidateIds.add(product.parent_id);
      } else {
        const { data: children, error: childErr } = await supabase
          .from('products')
          .select('id')
          .eq('parent_id', product.id);
        if (!childErr && Array.isArray(children)) {
          for (const c of children) {
            if (c?.id) candidateIds.add(c.id);
          }
        }
      }
    } catch {}

    const candidatesArr = Array.from(candidateIds);
    let chosenProductId: string | null = null;
    let stockRows: Array<{ product_id: string; quantity: number }> = [];
    if (candidatesArr.length > 0) {
      const { data: psRows, error: psErr } = await supabase
        .from('product_stocks')
        .select('product_id, stock_id, quantity')
        .eq('stock_id', stock_id)
        .in('product_id', candidatesArr as any);
      if (!psErr && Array.isArray(psRows)) {
        stockRows = (psRows as any[]).map(r => ({ product_id: r.product_id, quantity: Number(r.quantity || 0) }));
        stockRows.sort((a, b) => (b.quantity - a.quantity));
        const eligible = stockRows.find(r => r.quantity >= qty);
        if (eligible) {
          chosenProductId = eligible.product_id;
        } else if (stockRows.length > 0) {
          // Pas assez de quantité pour la demande
          const maxAvail = stockRows[0].quantity;
          return resp(422, {
            ok: false,
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: `Stock insuffisant pour ce produit/dépôt. Disponible: ${maxAvail}, Requis: ${qty}`,
              context: { candidates: stockRows }
            }
          });
        }
      }
    }

    if (!chosenProductId) {
      // Aucun enregistrement product_stocks pour ces IDs candidats dans ce dépôt
      return resp(422, {
        ok: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Aucun stock trouvé pour ce produit dans le dépôt sélectionné`,
          context: { candidates: candidatesArr }
        }
      });
    }

    // Créer ou mettre à jour repair_items
    const itemData: any = {
      repair_id,
      product_id: chosenProductId,
      stock_id,
      quantity: qty,
      reserved: false
    };

    if (purchase_price !== undefined && purchase_price !== null) {
      itemData.purchase_price = parseFloat(String(purchase_price));
    }

    if (vat_regime && ['normal', 'margin'].includes(vat_regime)) {
      itemData.vat_regime = vat_regime;
    }

    console.log('[repairs-attach-part] Données repair_item:', JSON.stringify(itemData, null, 2));

    // Upsert repair_items (si existe déjà, met à jour, sinon crée)
    const { data: repairItem, error: itemErr } = await supabase
      .from('repair_items')
      .upsert(itemData, {
        onConflict: 'repair_id,product_id,stock_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (itemErr || !repairItem) {
      console.log('[repairs-attach-part] Erreur upsert repair_item:', itemErr);
      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de l'ajout de la pièce: ${itemErr?.message || 'Erreur inconnue'}`
        }
      });
    }

    console.log('[repairs-attach-part] Repair_item créé/mis à jour:', repairItem.id);

    // Appeler la RPC fn_repair_reserve_stock pour réserver le stock
    console.log('[repairs-attach-part] Appel RPC fn_repair_reserve_stock');
    const { data: reservationResult, error: reserveErr } = await supabase.rpc('fn_repair_reserve_stock', {
      p_repair_id: repair_id,
      p_product_id: chosenProductId,
      p_stock_id: stock_id,
      p_qty: qty
    });

    if (reserveErr) {
      console.log('[repairs-attach-part] Erreur réservation stock:', reserveErr);

      // Vérifier si c'est une erreur de stock insuffisant
      const errMsg = String(reserveErr.message || '').toLowerCase();
      if (errMsg.includes('stock insuffisant') || errMsg.includes('insufficient stock')) {
        return resp(422, {
          ok: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: reserveErr.message || 'Stock insuffisant pour réserver cette pièce'
          }
        });
      }

      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de la réservation: ${reserveErr.message || 'Erreur inconnue'}`
        }
      });
    }

    console.log('[repairs-attach-part] Réservation réussie:', JSON.stringify(reservationResult, null, 2));

    // Récupérer toutes les réservations pour ce ticket
    const { data: reservations, error: reservationsErr } = await supabase
      .from('stock_reservations')
      .select(`
        *,
        product:products(id, name, sku),
        stock:stocks(id, name)
      `)
      .eq('repair_id', repair_id)
      .eq('released', false);

    if (reservationsErr) {
      console.log('[repairs-attach-part] Erreur récupération réservations:', reservationsErr);
    }

    console.log('[repairs-attach-part] Total réservations actives:', reservations?.length || 0);

    return resp(200, {
      ok: true,
      data: {
        repair_item: repairItem,
        reservation: reservationResult,
        all_reservations: reservations || [],
        message: `Pièce ${product.name} attachée et réservée avec succès`
      }
    });

  } catch (e: any) {
    console.log('[repairs-attach-part] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
