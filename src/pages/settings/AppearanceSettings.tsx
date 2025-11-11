import React, { useMemo, useState } from 'react';
import { applyTheme, DEFAULT_THEME, ThemeHSL, hexToHslComponents, hslComponentsToHex, getContrastRatio, debounce, saveThemeToLocalStorage } from '../../utils/theme';
import { supabase } from '../../lib/supabase';

function toHexSafe(hsl: string) {
  try { return hslComponentsToHex(hsl); } catch { return '#000000'; }
}

function toHslSafe(hex: string) {
  try { return hexToHslComponents(hex); } catch { return DEFAULT_THEME.primary; }
}

export default function AppearanceSettings() {
  const [theme, setTheme] = useState<ThemeHSL>({ ...DEFAULT_THEME, ...(JSON.parse(localStorage.getItem('ui_theme') || 'null') || {}) });
  const [pending, setPending] = useState(false);

  const saveRemoteDebounced = useMemo(() => debounce(async (t: ThemeHSL) => {
    try {
      saveThemeToLocalStorage(t);
      await supabase.from('ui_preferences').upsert({ key: 'theme', value: JSON.stringify(t) });
    } catch {}
    setPending(false);
  }, 500), []);

  const headerContrast = useMemo(() => getContrastRatio('#ffffff', toHexSafe(theme.header)), [theme.header]);
  const sidebarContrast = useMemo(() => getContrastRatio('#ffffff', toHexSafe(theme.sidebar)), [theme.sidebar]);
  const primaryContrast = useMemo(() => getContrastRatio('#ffffff', toHexSafe(theme.primary)), [theme.primary]);

  const hasLowContrast = headerContrast < 4.5 || sidebarContrast < 4.5 || primaryContrast < 4.5;

  const handleChange = (key: keyof ThemeHSL, hex: string) => {
    const hsl = toHslSafe(hex);
    const next = { ...theme, [key]: hsl } as ThemeHSL;
    setTheme(next);
    applyTheme({ [key]: hsl });
    setPending(true);
    // Auto-save en arrière-plan uniquement si les trois contrastes sont >= 4.5
    try {
      const headHex = toHexSafe(next.header);
      const sideHex = toHexSafe(next.sidebar);
      const primHex = toHexSafe(next.primary);
      const ok = getContrastRatio('#ffffff', headHex) >= 4.5 && getContrastRatio('#ffffff', sideHex) >= 4.5 && getContrastRatio('#ffffff', primHex) >= 4.5;
      if (ok) {
        saveRemoteDebounced(next);
      }
    } catch {}
  };

  const handleSaveWithAccessibility = async () => {
    if (hasLowContrast) {
      const ok = window.confirm('Attention: Le contraste texte/fond est inférieur à 4.5:1 sur au moins une zone (header, sidebar ou couleur principale). Voulez-vous enregistrer quand même ?');
      if (!ok) return;
    }
    setPending(true);
    const t = theme;
    saveRemoteDebounced(t);
  };

  const handleReset = () => {
    const next = { ...DEFAULT_THEME };
    setTheme(next);
    applyTheme(next);
    setPending(true);
    saveRemoteDebounced(next);
  };

  const handleDefault = () => {
    try { localStorage.removeItem('ui_theme'); } catch {}
    const next = { ...DEFAULT_THEME };
    setTheme(next);
    applyTheme(next);
    setPending(true);
    saveRemoteDebounced(next);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Apparence / Thème</h2>

      <div className="space-y-6 bg-white rounded-xl border border-gray-200 p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Couleur principale</label>
          <input
            type="color"
            value={toHexSafe(theme.primary)}
            onChange={(e) => handleChange('primary', e.target.value)}
            className="h-10 w-20 cursor-pointer"
          />
          <p className="text-xs text-gray-500 mt-1">Affecte les éléments primaires (boutons, accents)</p>
          <p className="text-xs mt-1">Contraste sur fond blanc: <span className={primaryContrast < 4.5 ? 'text-red-600' : 'text-green-600'}>{primaryContrast}:1</span></p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Barre du haut</label>
          <input
            type="color"
            value={toHexSafe(theme.header)}
            onChange={(e) => handleChange('header', e.target.value)}
            className="h-10 w-20 cursor-pointer"
          />
          <p className="text-xs text-gray-500 mt-1">Arrière-plan de la barre supérieure (texte blanc)</p>
          <p className="text-xs mt-1">Contraste texte blanc: <span className={headerContrast < 4.5 ? 'text-red-600' : 'text-green-600'}>{headerContrast}:1</span></p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sidebar</label>
          <input
            type="color"
            value={toHexSafe(theme.sidebar)}
            onChange={(e) => handleChange('sidebar', e.target.value)}
            className="h-10 w-20 cursor-pointer"
          />
          <p className="text-xs text-gray-500 mt-1">Arrière-plan de la barre latérale (texte blanc)</p>
          <p className="text-xs mt-1">Contraste texte blanc: <span className={sidebarContrast < 4.5 ? 'text-red-600' : 'text-green-600'}>{sidebarContrast}:1</span></p>
        </div>

        {hasLowContrast && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Avertissement: au moins une combinaison texte/fond est <strong>inférieure à 4.5:1</strong>. Veuillez confirmer avant d'enregistrer.
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={handleSaveWithAccessibility} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" disabled={pending && false}>Enregistrer</button>
          <button onClick={handleReset} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Réinitialiser</button>
          <button onClick={handleDefault} className="ml-auto px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100">Revenir au thème par défaut</button>
        </div>
      </div>
    </div>
  );
}
