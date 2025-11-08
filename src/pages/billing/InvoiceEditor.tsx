import React from 'react';
import { useInvoiceStore } from '../../store/invoiceStore';
import { supabase } from '../../lib/supabase';
import { Toast } from '../../components/Notifications/Toast';

type StockRow = { id: string; name: string };

function uuidv4(): string {
  // Utilise crypto.randomUUID si dispo, sinon fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * InvoiceEditor
 * - Edition d'une facture en brouillon
 * - Sélection de dépôt par ligne (informative; le RPC côté SQL résout côté parent/stock)
 * - Vérification de stock (warning UI)
 * - Finalisation (appel Netlify Function -> RPC finalize_invoice)
 *
 * Note: Ce composant attend un invoiceId via props ou via ?invoiceId= dans l'URL.
 */
export default function InvoiceEditor(props: { invoiceId?: string }) {
  const store = useInvoiceStore();

  // 1) Récupération de l'ID via props OU query string
  const [invoiceId, setInvoiceId] = React.useState<string>('');
  React.useEffect(() => {
    if (props.invoiceId) {
      setInvoiceId(props.invoiceId);
      return;
    }
    const url = new URL(window.location.href);
    const qid = url.searchParams.get('invoiceId') || url.searchParams.get('id') || '';
    if (qid) setInvoiceId(qid);
  }, [props.invoiceId]);

  const [invoice, setInvoice] = React.useState<any>(null);
  const [items, setItems] = React.useState<any[]>([]);
  const [stocks, setStocks] = React.useState<StockRow[]>([]);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // état par ligne: dépôt choisi + disponibilités lues
  const [lineState, setLineState] = React.useState<Record<string, { stock_id?: string; availability?: Array<{ stock_id: string; quantite: number }>; productInfo?: any }>>({});

  // Chargement initial
  React.useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      const { invoice, items } = await store.getInvoiceWithItems(invoiceId);
      setInvoice(invoice);
      setItems(items);

      const { data: st } = await supabase.from('stocks').select('id,name').order('name');
      setStocks((st as any[])?.map((r: any) => ({ id: r.id, name: r.name })) || []);

      // Précharger infos produit pour chaque ligne (miroir/sérialisé)
      const next: Record<string, any> = {};
      for (const it of items || []) {
        const p = await store.getProductInfo(it.product_id);
        next[it.id] = { productInfo: p };
      }
      setLineState((prev) => ({ ...prev, ...next }));
    })();
  }, [invoiceId, store]);

  const isMirror = (p?: any) => !!(p?.parent_id && !p?.serial_number);
  const isSerializedChild = (p?: any) => !!p?.serial_number;

  // Vérifier stock pour une ligne
  const checkStock = async (it: any) => {
    const av = await store.getStockAvailability(it.product_id);
    setLineState((s) => ({ ...s, [it.id]: { ...(s[it.id] || {}), availability: av } }));

    const chosenStock = lineState[it.id]?.stock_id;
    if (!chosenStock) {
      // Si aucun dépôt choisi, on n'émet qu'une info
      setToast({ type: 'success', message: `Disponibilités chargées (${av.length} dépôts)` });
      return;
    }
    const q = (av || []).find((a) => a.stock_id === chosenStock)?.quantite || 0;
    if (q < (it.quantity || 0)) {
      setToast({ type: 'error', message: `Stock insuffisant sur le dépôt choisi (dispo ${q} < qty ${it.quantity})` });
    } else {
      setToast({ type: 'success', message: 'Stock suffisant sur le dépôt choisi' });
    }
  };

  // Vérifie la contrainte "serial requis" avant finalisation
  const ensureSerialsSelected = async (): Promise<{ ok: boolean; message?: string }> => {
    for (const it of items || []) {
      const p = lineState[it.id]?.productInfo || (await store.getProductInfo(it.product_id));
      // Règle: si le produit possède un serial_number -> c'est un enfant sérialisé => OK
      // Si le produit n'est pas sérialisé mais qu'il s'agit d'un parent pouvant accueillir des sérialisés,
      // on pourrait exiger la sélection d'un enfant; faute d'UI dédiée, on bloque et on invite à sélectionner le numéro de série.
      if (!isSerializedChild(p)) {
        // Heuristique: existe-t-il des enfants sérialisés pour ce parent ?
        if (!p?.parent_id) {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('parent_id', p?.id as any)
            .not('serial_number', 'is', null);
          if ((count || 0) > 0) {
            return { ok: false, message: `Ligne ${it.id}: numéro de série requis (sélectionnez un enfant sérialisé)` };
          }
        }
      }
    }
    return { ok: true };
  };

  const finalize = async () => {
    // Avertissements UI si des dépôts choisis semblent insuffisants
    for (const it of items || []) {
      const chosen = lineState[it.id]?.stock_id;
      if (chosen && Array.isArray(lineState[it.id]?.availability)) {
        const avail = lineState[it.id]?.availability || [];
        const q = (avail.find((a) => a.stock_id === chosen)?.quantite || 0);
        if (q < (it.quantity || 0)) {
          setToast({ type: 'error', message: `Ligne ${it.id}: stock insuffisant sur le dépôt sélectionné` });
          // On ne bloque pas ici (le blocage réel est côté RPC), mais on prévient l'utilisateur
        }
      }
    }

    // Blocage si serial requis
    const serialCheck = await ensureSerialsSelected();
    if (!serialCheck.ok) {
      setToast({ type: 'error', message: serialCheck.message || 'Numéro de série manquant' });
      return;
    }

    const key = uuidv4();
    const res = await store.finalize(invoiceId, key);
    if (res.ok) {
      setToast({ type: 'success', message: 'Facture finalisée' });
      // rechargement
      const reload = await store.getInvoiceWithItems(invoiceId);
      setInvoice(reload.invoice);
      setItems(reload.items);
    } else {
      setToast({ type: 'error', message: res.error?.message || 'Échec de finalisation' });
    }
  };

  if (!invoiceId) {
    return (
      <div className="p-4">
        <div className="text-red-600">invoiceId manquant (prop ou query ?invoiceId=...)</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Édition facture (brouillon)</h2>

      <div className="bg-white rounded shadow p-3">
        {(items || []).map((it) => {
          const p = lineState[it.id]?.productInfo;
          const mirror = isMirror(p);
          const serialChild = isSerializedChild(p);
          return (
            <div key={it.id} className="grid grid-cols-5 gap-3 py-2 items-center border-b">
              <div className="col-span-2">
                <div className="text-sm">
                  Produit: <span className="font-mono">{it.product_id}</span>
                </div>
                <div className="text-xs text-gray-500">Qté: {it.quantity}</div>
                <div className="mt-1 text-xs">
                  {mirror && (
                    <span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">
                      Stock parent (lecture seule)
                    </span>
                  )}
                  {serialChild && (
                    <span className="inline-block ml-2 px-2 py-0.5 rounded bg-green-100 text-green-700">
                      Sérialisé
                    </span>
                  )}
                </div>
              </div>

              <div>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={lineState[it.id]?.stock_id || ''}
                  disabled={mirror} // interdiction d'éditer côté enfant miroir
                  onChange={(e) =>
                    setLineState((s) => ({
                      ...s,
                      [it.id]: { ...(s[it.id] || {}), stock_id: e.target.value },
                    }))
                  }
                >
                  <option value="">Dépôt par défaut</option>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  className="px-3 py-1 text-sm bg-gray-100 border rounded"
                  onClick={() => checkStock(it)}
                >
                  Vérifier stock
                </button>
              </div>

              <div className="text-xs">
                {(lineState[it.id]?.availability || []).map((a) => (
                  <div key={a.stock_id}>
                    {a.stock_id.slice(0, 6)}…: {a.quantite}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          onClick={finalize}
          disabled={store.isFinalizing}
        >
          {store.isFinalizing ? 'Finalisation…' : 'Finaliser'}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
