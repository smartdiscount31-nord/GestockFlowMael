/**
 * Quote Store
 * Zustand store for managing quotes/devis
 * This version provides the API expected by QuoteDetail:
 * - currentQuote
 * - getQuoteById
 * - sendQuote
 * - acceptQuote
 * - refuseQuote
 * Plus basic list CRUD placeholders.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { DocumentType } from '../types/billing';

export interface QuoteStore {
  quotes: any[];
  currentQuote: any | null;
  isLoading: boolean;
  error: string | null;

  // List operations
  fetchQuotes: () => Promise<void>;
  addQuote: (quote: any) => Promise<void>;
  updateQuote: (id: string, quote: Partial<any>) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;

  // Detail operations used by QuoteDetail UI
  getQuoteById: (id: string) => Promise<void>;
  sendQuote: (id: string) => Promise<void>;
  acceptQuote: (id: string) => Promise<void>;
  refuseQuote: (id: string) => Promise<void>;
}

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: [],
  currentQuote: null,
  isLoading: false,
  error: null,

  fetchQuotes: async () => {
    console.log('[QuoteStore] Fetching quotes');
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*),
          items:quote_items(*),
          document_type:billing_document_types(*)
        `)
        .order('date_issued', { ascending: false });

      if (error) throw error;
      set({ quotes: data || [], isLoading: false });
    } catch (error) {
      console.error('[QuoteStore] Error fetching quotes:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des devis',
        isLoading: false,
      });
    }
  },

  addQuote: async (quote) => {
    console.log('[QuoteStore] Adding quote:', quote);
    try {
      const { error } = await supabase.from('quotes').insert([quote]);
      if (error) throw error;
      await get().fetchQuotes();
    } catch (error) {
      console.error('[QuoteStore] Error adding quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la création du devis',
      });
    }
  },

  updateQuote: async (id, quote) => {
    console.log('[QuoteStore] Updating quote:', id, quote);
    try {
      const { error } = await supabase.from('quotes').update(quote).eq('id', id);
      if (error) throw error;
      // Refresh current if needed
      if (get().currentQuote?.id === id) {
        await get().getQuoteById(id);
      }
      await get().fetchQuotes();
    } catch (error) {
      console.error('[QuoteStore] Error updating quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour du devis',
      });
    }
  },

  deleteQuote: async (id) => {
    console.log('[QuoteStore] Deleting quote:', id);
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
      if (get().currentQuote?.id === id) {
        set({ currentQuote: null });
      }
      await get().fetchQuotes();
    } catch (error) {
      console.error('[QuoteStore] Error deleting quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la suppression du devis',
      });
    }
  },

  getQuoteById: async (id: string) => {
    console.log('[QuoteStore] Getting quote by id:', id);
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*),
          items:quote_items(*),
          document_type:billing_document_types(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      set({ currentQuote: data, isLoading: false });
    } catch (error) {
      console.error('[QuoteStore] Error getting quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors du chargement du devis',
        isLoading: false,
      });
    }
  },

  sendQuote: async (id: string) => {
    console.log('[QuoteStore] Sending quote:', id);
    try {
      const { error } = await supabase.from('quotes').update({ status: 'sent' }).eq('id', id);
      if (error) throw error;
      if (get().currentQuote?.id === id) {
        set({ currentQuote: { ...get().currentQuote, status: 'sent' } });
      }
      await get().fetchQuotes();
    } catch (error) {
      console.error('[QuoteStore] Error sending quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de l\'envoi du devis',
      });
    }
  },

  acceptQuote: async (id: string) => {
    console.log('[QuoteStore] Accepting quote:', id);
    try {
      const { error } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', id);
      if (error) throw error;
      if (get().currentQuote?.id === id) {
        set({ currentQuote: { ...get().currentQuote, status: 'accepted' } });
      }
      await get().fetchQuotes();
    } catch (error) {
      console.error('[QuoteStore] Error accepting quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de l\'acceptation du devis',
      });
    }
  },

  refuseQuote: async (id: string) => {
    console.log('[QuoteStore] Refusing quote:', id);
    try {
      const { error } = await supabase.from('quotes').update({ status: 'refused' }).eq('id', id);
      if (error) throw error;
      if (get().currentQuote?.id === id) {
        set({ currentQuote: { ...get().currentQuote, status: 'refused' } });
      }
      await get().fetchQuotes();
    } catch (error) {
      console.error('[QuoteStore] Error refusing quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors du refus du devis',
      });
    }
  },
}));

/**
 * Get document types for quotes (used by QuoteList)
 */
export async function getDocumentTypes(): Promise<DocumentType[]> {
  console.log('[QuoteStore] Getting document types');
  try {
    const { data, error } = await supabase
      .from('billing_document_types')
      .select('*')
      .eq('is_active', true)
      .order('label', { ascending: true });

    if (error) throw error;
    return (data || []) as DocumentType[];
  } catch (error) {
    console.error('[QuoteStore] Error getting document types:', error);
    return [];
  }
}
