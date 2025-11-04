/**
 * Customer Store
 * Zustand store for managing customers (implemented with Supabase)
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface CustomerStore {
  customers: any[];
  isLoading: boolean;
  error: string | null;

  fetchCustomers: () => Promise<void>;
  addCustomer: (customer: any) => Promise<{ id: string } | null>;
  updateCustomer: (id: string, customer: Partial<any>) => Promise<{ id: string } | null>;
  deleteCustomer: (id: string) => Promise<void>;

  addAddress: (address: {
    customer_id: string;
    address_type: 'billing' | 'shipping';
    line1: string;
    line2?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    region?: string | null;
    is_default?: boolean;
  }) => Promise<boolean>;
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: [],
  isLoading: false,
  error: null,

  fetchCustomers: async () => {
    console.log('[CustomerStore] Fetching customers');
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, addresses:customer_addresses(*)')
        .order('name', { ascending: true });

      if (error) throw error;
      set({ customers: (data as any[]) || [], isLoading: false });
    } catch (error: any) {
      console.error('[CustomerStore] Error fetching customers:', error);
      set({
        error: error?.message || 'Erreur lors de la récupération des clients',
        isLoading: false,
      });
    }
  },

  addCustomer: async (customer: any) => {
    console.log('[CustomerStore] Adding customer:', customer);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select('id')
        .single();
      if (error) throw error;
      try {
        await get().fetchCustomers();
      } catch {}
      return (data as any) || null;
    } catch (error: any) {
      console.error('[CustomerStore] Error adding customer:', error);
      set({
        error: error?.message || 'Erreur lors de la création du client',
      });
      return null;
    }
  },

  updateCustomer: async (id: string, customer: Partial<any>) => {
    console.log('[CustomerStore] Updating customer:', id, customer);
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
      try {
        await get().fetchCustomers();
      } catch {}
      return (data as any) || null;
    } catch (error: any) {
      console.error('[CustomerStore] Error updating customer:', error);
      set({
        error: error?.message || 'Erreur lors de la mise à jour du client',
      });
      return null;
    }
  },

  deleteCustomer: async (id: string) => {
    console.log('[CustomerStore] Deleting customer:', id);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      try {
        await get().fetchCustomers();
      } catch {}
    } catch (error: any) {
      console.error('[CustomerStore] Error deleting customer:', error);
      set({
        error: error?.message || 'Erreur lors de la suppression du client',
      });
    }
  },

  addAddress: async (address) => {
    console.log('[CustomerStore] Adding address:', address);
    try {
      const payload = {
        ...address,
        line2: address.line2 ?? null,
        zip: address.zip ?? null,
        city: address.city ?? null,
        country: address.country ?? 'France',
        region: address.region ?? null,
        is_default: address.is_default ?? false,
      };
      const { error } = await supabase.from('customer_addresses').insert([payload]);
      if (error) throw error;
      try {
        await get().fetchCustomers();
      } catch {}
      return true;
    } catch (error: any) {
      console.error('[CustomerStore] Error adding address:', error);
      set({
        error: error?.message || 'Erreur lors de l’ajout de l’adresse client',
      });
      return false;
    }
  },
}));
