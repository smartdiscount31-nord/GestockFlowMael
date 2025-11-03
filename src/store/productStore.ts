/**
 * Product Store
 * Zustand store for managing products
 */

import { create } from 'zustand';
import type { Product, ProductWithStock } from '../types/supabase';
import { supabase } from '../lib/supabase';

interface ProductStore {
  products: ProductWithStock[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<ProductWithStock[] | null>;
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<{ id: string } | null>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<{ id: string } | null>;
  deleteProduct: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductStore>((set) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    console.log('[ProductStore] Fetching products');
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stocks:stock_produit (
            quantite,
            stock:stocks ( id, name )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = Array.isArray(data) ? (data as any[]) : [];
      set({ products: rows as any, isLoading: false });
      return rows as any;
    } catch (err: any) {
      console.error('[ProductStore] Error fetching products:', err);
      set({
        error: err?.message || 'Erreur lors de la récupération des produits',
        isLoading: false,
      });
      return null;
    }
  },

  addProduct: async (product) => {
    console.log('[ProductStore] Adding product:', product);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([product as any])
        .select('id')
        .single();
      if (error) throw error;

      // rafraîchir en arrière-plan
      try { await (useProductStore.getState().fetchProducts()); } catch {}

      return data as any;
    } catch (err: any) {
      console.error('[ProductStore] Error adding product:', err);
      set({ error: err?.message || 'Erreur lors de la création du produit' });
      return null;
    }
  },

  updateProduct: async (id, product) => {
    console.log('[ProductStore] Updating product:', id, product);
    try {
      const { data, error } = await supabase
        .from('products')
        .update(product as any)
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;

      // rafraîchir en arrière-plan
      try { await (useProductStore.getState().fetchProducts()); } catch {}

      return data as any;
    } catch (err: any) {
      console.error('[ProductStore] Error updating product:', err);
      set({ error: err?.message || 'Erreur lors de la mise à jour du produit' });
      return null;
    }
  },

  deleteProduct: async (id) => {
    console.log('[ProductStore] Deleting product:', id);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // rafraîchir en arrière-plan
      try { await (useProductStore.getState().fetchProducts()); } catch {}
    } catch (err: any) {
      console.error('[ProductStore] Error deleting product:', err);
      set({ error: err?.message || 'Erreur lors de la suppression du produit' });
    }
  },
}));
