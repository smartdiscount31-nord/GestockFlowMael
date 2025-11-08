import React from 'react';
import { useInvoiceStore } from '../../store/invoiceStore';
import { Toast } from '../../components/Notifications/Toast';

/**
 * CreditNoteCreateFromInvoice
 * - Pré-remplit un avoir depuis une facture existante
 * - Affiche la "quantité remboursable max" par ligne
 * - Crée un avoir brouillon puis propose la publication
 */
export default function CreditNoteCreateFromInvoice(props: { invoiceId?: string }) {
  const store = useInvoiceStore();

  // Récupération invoiceId via props ou query string
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
  const [maxRefundable, setMaxRefundable] = React.useState<Record<string, number>>({});
  const [draftQty, setDraftQty] = React.useState<Record<string, number>>({});
  const [creditNoteId, setCreditNoteId] = React.useState<string>('');
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  // Chargement initial
  React.useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      setLoading(true);
      try {
        const { invoice, items } = await store.getInvoiceWithItems(invoiceId);
        setInvoice(invoice);
        setItems(items || []);
        const max = await store.getRefundableQuantities(invoiceId);
        setMaxRefundable(max || {});
        const init: Record<string, number> = {};
        (items || []).forEach((it: any) => { init[it.id] = 0; });
        setDraftQty(init);
      } catch (e: any) {
        setToast({ type: 'error', message: String(e?.message || e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId, store]);

  const createDraft = async () => {
    if (!invoiceId) {
      setToast({ type: 'error', message: 'invoiceId manquant' });
      return;
    }
    const lines = (items || [])
      .filter((it: any) => (draftQty[it.id] || 0) > 0)
      .map((it: any) => ({
        invoice_item_id: it.id,
        product_id: it.product_id,
        qty: Math.min(draftQty[it.id] || 0, maxRefundable[it.id] || 0),
        unit_price: it.unit_price
      }));

    if (lines.length === 0) {
      setToast({ type: 'error', message: 'Aucune ligne sélectionnée' });
      return;
    }

    try {
      const res = await store.createCreditNoteDraftFromInvoice(invoiceId, lines);
      setCreditNoteId(res.creditNoteId);
      setToast({ type: 'success', message: 'Avoir créé en brouillon' });
    } catch (e: any) {
      setToast({ type: 'error', message: String(e?.message || e) });
    }
  };

  const publish = async () => {
    if (!creditNoteId) {
      setToast({ type: 'error', message: 'Créez d’abord l’avoir (brouillon)' });
      return;
    }
    const out = await store.publishCreditNote(creditNoteId);
    if (out.ok) {
      setToast({ type: 'success', message: 'Avoir publié' });
    } else {
      setToast({ type: 'error', message: out.error?.message || 'Échec publication' });
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
      <h2 className="text-xl font-semibold">Créer un avoir depuis la facture</h2>

      {loading && <div className="text-sm text-gray-500">Chargement…</div>}

      <div className="bg-white rounded shadow p-3">
        {(items || []).map((it) => {
          const max = maxRefundable[it.id] ?? 0;
          const current = draftQty[it.id] ?? 0;
          return (
            <div key={it.id} className="grid grid-cols-5 gap-3 py-2 items-center border-b">
              <div className="col-span-2">
                <div className="text-sm">
                  Ligne {it.id} — Produit <span className="font-mono">{it.product_id}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Facturé: {it.quantity} — Max remboursable: <span className="font-semibold">{max}</span>
                </div>
              </div>
              <div className="text-sm">Prix: € {Number(it.unit_price || 0).toFixed(2)}</div>
              <div>
                <input
                  type="number"
                  className="border rounded px-2 py-1 w-28"
                  min={0}
                  max={max}
                  value={current}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(Number(e.target.value || 0), max));
                    setDraftQty((s) => ({ ...s, [it.id]: v }));
                  }}
                />
              </div>
              <div className="text-xs text-gray-600">
                Total ligne: € {(current * Number(it.unit_price || 0)).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button className="px-4 py-2 rounded bg-gray-200" onClick={createDraft}>
          Créer l’avoir (brouillon)
        </button>
        <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={publish}>
          Publier l’avoir
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
