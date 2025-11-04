/**
 * Invoice Store
 * Gestion des factures (CRUD) + finalisation + publication d'avoirs
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'late' | 'cancelled';

export interface Invoice {
  id: string;
  invoice_number?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  total_ht?: number | null;
  total_ttc?: number | null;
  status: InvoiceStatus;
  issue_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  tax_rate?: number | null;
  total_price?: number | null;
}

interface FinalizeState {
  isFinalizing: boolean;
  errorFinalizing: string | null;
  lastFinalizeResult: any | null;
}

interface InvoiceStore extends FinalizeState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;

  fetchInvoices: () => Promise<void>;
  addInvoice: (invoice: Partial<Invoice>) => Promise<{ id: string } | null>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<{ id: string } | null>;
  deleteInvoice: (id: string) => Promise<void>;

  // Helpers
  getInvoiceWithItems: (invoiceId: string) => Promise<{ invoice: any; items: any[] }>;
  getProductInfo: (productId: string) => Promise<any>;
  getStockAvailability: (productId: string) => Promise<Array<{ stock_id: string; quantite: number }>>;
  getRefundableQuantities: (invoiceId: string) => Promise<Record<string, number>>;

  // Actions Netlify Functions
  finalize: (invoiceId: string, idempotencyKey: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  publishCreditNote: (creditNoteId: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  createCreditNoteDraftFromInvoice: (
    invoiceId: string,
    itemsDraft: Array<{ invoice_item_id?: string; product_id: string; qty: number; unit_price: number }>
  ) => Promise<{ creditNoteId: string }>;
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: [],
  isLoading: false,
  error: null,

  // Finalize state
  isFinalizing: false,
  errorFinalizing: null,
  lastFinalizeResult: null,

  // CRUD de base
  fetchInvoices: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ invoices: data as any[], isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Erreur lors de la récupération des factures' });
    }
  },

  addInvoice: async (invoice) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .insert([invoice as any])
        .select('id')
        .single();
      if (error) throw error;
      try { await get().fetchInvoices(); } catch {}
      return data as any;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erreur lors de la création de la facture' });
      return null;
    }
  },

  updateInvoice: async (id, invoice) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update(invoice as any)
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
      try { await get().fetchInvoices(); } catch {}
      return data as any;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erreur lors de la mise à jour de la facture' });
      return null;
    }
  },

  deleteInvoice: async (id) => {
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      try { await get().fetchInvoices(); } catch {}
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erreur lors de la suppression de la facture' });
    }
  },

  // Helpers pour l'UI
  getInvoiceWithItems: async (invoiceId: string) => {
    const { data: inv } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
    return { invoice: inv, items: (items as any[]) || [] };
  },

  getProductInfo: async (productId: string) => {
    const { data } = await supabase
      .from('products')
      .select('id,parent_id,serial_number,vat_type')
      .eq('id', productId)
      .maybeSingle();
    return data;
  },

  getStockAvailability: async (productId: string) => {
    // miroir -> parent
    const p = await get().getProductInfo(productId);
    const effectiveId = (p?.parent_id && !p?.serial_number) ? p.parent_id : productId;
    const { data, error } = await supabase
      .from('stock_produit')
      .select('stock_id, quantite')
      .eq('produit_id', effectiveId);
    if (error) return [];
    return (data as any[]) || [];
  },

  getRefundableQuantities: async (invoiceId: string) => {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('id, quantity')
      .eq('invoice_id', invoiceId);

    const { data: notes } = await supabase
      .from('credit_notes')
      .select('id')
      .eq('invoice_id', invoiceId);

    const noteIds = ((notes as any[]) || []).map(n => n.id);
    const refundedByItem: Record<string, number> = {};

    if (noteIds.length > 0) {
      const { data: cnItems } = await supabase
        .from('credit_note_items')
        .select('invoice_item_id, qty')
        .in('credit_note_id', noteIds);
      (cnItems as any[] || []).forEach(r => {
        const k = String(r.invoice_item_id || '');
        refundedByItem[k] = (refundedByItem[k] || 0) + Number(r.qty || 0);
      });
    }

    const out: Record<string, number> = {};
    (items as any[] || []).forEach(it => {
      const k = String(it.id);
      out[k] = Math.max(0, Number(it.quantity || 0) - Number(refundedByItem[k] || 0));
    });
    return out;
  },

  // Actions Netlify Functions
  finalize: async (invoiceId: string, idempotencyKey: string) => {
    set({ isFinalizing: true, errorFinalizing: null, lastFinalizeResult: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const resp = await fetch('/.netlify/functions/billing-finalize-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoiceId, idempotencyKey })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        const message = json?.error?.message || `finalize_failed (HTTP_${resp.status})`;
        set({ isFinalizing: false, errorFinalizing: message });
        return { ok: false, error: json?.error || { code: 'HTTP_'+resp.status, message } };
      }
      set({ isFinalizing: false, lastFinalizeResult: json.data });
      // Rafraîchir la liste
      try { await get().fetchInvoices(); } catch {}
      return { ok: true, data: json.data };
    } catch (e: any) {
      set({ isFinalizing: false, errorFinalizing: String(e?.message || e) });
      return { ok: false, error: { code: 'NETWORK', message: String(e?.message || e) } };
    }
  },

  publishCreditNote: async (creditNoteId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const resp = await fetch('/.netlify/functions/billing-credit-note-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creditNoteId })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        return { ok: false, error: json?.error || { code: 'HTTP_'+resp.status } };
      }
      // éventuellement rafraîchir contextes liés
      return { ok: true, data: json.data };
    } catch (e: any) {
      return { ok: false, error: { code: 'NETWORK', message: String(e?.message || e) } };
    }
  },

  createCreditNoteDraftFromInvoice: async (invoiceId, itemsDraft) => {
    const { data: cn, error: e1 } = await supabase
      .from('credit_notes')
      .insert([{ invoice_id: invoiceId, status: 'draft' }])
      .select('id')
      .single();
    if (e1) throw e1;

    const rows = (itemsDraft || []).map(it => ({
      credit_note_id: (cn as any).id,
      invoice_item_id: it.invoice_item_id || null,
      product_id: it.product_id,
      qty: it.qty,
      unit_price: it.unit_price
    }));

    if (rows.length) {
      const { error: e2 } = await supabase.from('credit_note_items').insert(rows as any);
      if (e2) throw e2;
    }

    return { creditNoteId: (cn as any).id as string };
  },
}));

// Rétablit l'export nommé attendu par InvoiceList.tsx
export async function getDocumentTypes() {
  try {
    const { data, error } = await supabase
      .from('billing_document_types')
      .select('*')
      .eq('is_active', true)
      .order('label', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[InvoiceStore] Error getting document types:', error);
    return [];
  }
}
