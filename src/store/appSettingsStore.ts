/**
 * App Settings Store (company settings)
 * Persists and reads settings from Supabase table: company_settings
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface CompanySettings {
  id?: string;
  company_name: string;
  address_line1: string;
  address_line2?: string | null;
  zip: string;
  city: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  siren?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  logo_url?: string | null;
  // Footer and Terms
  footer_text?: string | null;
  terms_and_conditions?: string | null;
  // Credit Note specific settings
  credit_note_footer_text?: string | null;
  credit_note_terms?: string | null;
  // Bank information (split fields)
  bank_name?: string | null;
  bank_iban?: string | null;
  bank_bic?: string | null;
  // CGV QR Code URL
  cgv_qr_url?: string | null;
}

interface AppSettingsStore {
  settings: CompanySettings | null;
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;

  // Overloaded updateSettings:
  // - updateSettings(partial)
  // - updateSettings('field', value)
  updateSettings: ((partial: Partial<CompanySettings>) => Promise<void>) &
                  ((key: keyof CompanySettings, value: any) => Promise<void>);

  uploadLogo: (file: File) => Promise<void>;
  clearError: () => void;
}

const defaultSettings: CompanySettings = {
  company_name: '',
  address_line1: '',
  address_line2: null,
  zip: '',
  city: '',
  country: 'France',
  phone: null,
  email: null,
  website: null,
  siren: null,
  siret: null,
  vat_number: null,
  logo_url: null,
  footer_text: null,
  terms_and_conditions: null,
  credit_note_footer_text: null,
  credit_note_terms: null,
  bank_name: null,
  bank_iban: null,
  bank_bic: null,
  cgv_qr_url: 'https://smartdiscount31.com/',
};

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      // Try to fetch a single row
      let { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

      // If table empty, insert a default row
      if (error) {
        // Some clients return error code when 0 rows; attempt insert
        const { data: inserted, error: insertError } = await supabase
          .from('company_settings')
          .insert([defaultSettings])
          .select('*')
          .single();

        if (insertError) throw insertError;
        data = inserted;
      }

      set({ settings: data as CompanySettings, isLoading: false });
    } catch (err: any) {
      console.error('[AppSettingsStore] Error fetching settings:', err);
      set({
        error: err instanceof Error ? err.message : 'Erreur lors de la récupération des paramètres',
        isLoading: false,
      });
    }
  },

  updateSettings: (async (arg1: any, value?: any) => {
    set({ isLoading: true, error: null });
    try {
      const current = get().settings;
      if (!current) {
        await get().fetchSettings();
      }
      const settings = get().settings;

      const patch: Partial<CompanySettings> =
        typeof arg1 === 'string' ? { [arg1]: value } as any : (arg1 || {});

      if (!settings?.id) {
        // No id yet? create one row first
        const { data: created, error: createError } = await supabase
          .from('company_settings')
          .insert([ { ...defaultSettings, ...patch } ])
          .select('*')
          .single();
        if (createError) throw createError;
        set({ settings: created as CompanySettings, isLoading: false });
        return;
      }

      const { data: updated, error: updateError } = await supabase
        .from('company_settings')
        .update(patch)
        .eq('id', settings.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      set({ settings: updated as CompanySettings, isLoading: false });
    } catch (err: any) {
      console.error('[AppSettingsStore] Error updating settings:', err);
      set({
        error: err instanceof Error ? err.message : 'Erreur lors de la mise à jour des paramètres',
        isLoading: false,
      });
    }
  }) as any,

  uploadLogo: async (file: File) => {
    set({ isLoading: true, error: null });
    try {
      console.log('[AppSettingsStore] Starting logo upload process...', { fileName: file.name, fileSize: file.size });

      // Ensure settings row exists
      if (!get().settings) {
        console.log('[AppSettingsStore] Settings not found, fetching...');
        await get().fetchSettings();
      }

      const path = `logos/company-logo-${Date.now()}-${file.name}`;
      console.log('[AppSettingsStore] Upload path:', path);
      console.log('[AppSettingsStore] Using bucket: app-assets');

      const { error: uploadError } = await supabase
        .storage
        .from('app-assets')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error('[AppSettingsStore] Upload error:', uploadError);
        throw uploadError;
      }

      console.log('[AppSettingsStore] File uploaded successfully, generating public URL...');
      const { data: pub } = supabase.storage.from('app-assets').getPublicUrl(path);
      const publicUrl = pub?.publicUrl || null;
      console.log('[AppSettingsStore] Public URL generated:', publicUrl);

      if (!publicUrl) throw new Error('Impossible de générer l\'URL publique du logo');

      console.log('[AppSettingsStore] Updating settings with new logo URL...');
      await get().updateSettings('logo_url', publicUrl);
      console.log('[AppSettingsStore] Logo upload completed successfully');
      set({ isLoading: false });
    } catch (err: any) {
      console.error('[AppSettingsStore] Error uploading logo:', err);
      set({
        error: err instanceof Error ? err.message : 'Erreur lors de l\'upload du logo',
        isLoading: false,
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
