// Theme utilities: applyTheme, color conversions, local storage, contrast helpers
// Values use HSL components string (e.g. "210 90% 56%") compatible with hsl(var(--primary)) usage.

export type ThemeHSL = {
  primary: string; // "h s% l%"
  header: string;  // "h s% l%"
  sidebar: string; // "h s% l%"
};

export const DEFAULT_THEME: ThemeHSL = {
  primary: '210 90% 56%',   // blue-ish
  header:  '208 84% 53%',   // header blue
  sidebar: '210 22% 15%',   // dark sidebar
};

const LS_KEY = 'ui_theme';

export function applyTheme(theme: Partial<ThemeHSL>) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme.primary) root.style.setProperty('--primary', theme.primary);
  if (theme.header) root.style.setProperty('--header-bg', theme.header);
  if (theme.sidebar) root.style.setProperty('--sidebar-bg', theme.sidebar);
}

export function loadThemeFromLocalStorage(): ThemeHSL | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        primary: typeof parsed.primary === 'string' ? parsed.primary : DEFAULT_THEME.primary,
        header: typeof parsed.header === 'string' ? parsed.header : DEFAULT_THEME.header,
        sidebar: typeof parsed.sidebar === 'string' ? parsed.sidebar : DEFAULT_THEME.sidebar,
      };
    }
  } catch {}
  return null;
}

export function saveThemeToLocalStorage(theme: ThemeHSL) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(theme));
  } catch {}
}

// Debounce helper
export function debounce<T extends (...args: any[]) => any>(fn: T, wait = 500) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Color conversions
export function hexToHslComponents(hex: string): string {
  // hex like #RRGGBB
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslComponentsToHex(hsl: string): string {
  // "h s% l%"
  const parts = hsl.trim().split(/\s+/);
  const h = parseFloat(parts[0]);
  const s = parseFloat((parts[1] || '0').replace('%','')) / 100;
  const l = parseFloat((parts[2] || '0').replace('%','')) / 100;
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#','').trim();
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(clamp255(r))}${toHex(clamp255(g))}${toHex(clamp255(b))}`;
}

function clamp255(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h/60) % 2) - 1));
  const m = l - c/2;
  let r1=0, g1=0, b1=0;
  if (0 <= h && h < 60) { r1=c; g1=x; b1=0; }
  else if (60 <= h && h < 120) { r1=x; g1=c; b1=0; }
  else if (120 <= h && h < 180) { r1=0; g1=c; b1=x; }
  else if (180 <= h && h < 240) { r1=0; g1=x; b1=c; }
  else if (240 <= h && h < 300) { r1=x; g1=0; b1=c; }
  else { r1=c; g1=0; b1=x; }
  return { r: (r1+m)*255, g: (g1+m)*255, b: (b1+m)*255 };
}

// Contrast helpers (WCAG)
function luminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
}

export function getContrastRatio(hexFg: string, hexBg: string): number {
  const { r: r1, g: g1, b: b1 } = hexToRgb(hexFg);
  const { r: r2, g: g2, b: b2 } = hexToRgb(hexBg);
  const L1 = luminance(r1,g1,b1) + 0.05;
  const L2 = luminance(r2,g2,b2) + 0.05;
  const ratio = L1 > L2 ? (L1/L2) : (L2/L1);
  return Math.round(ratio * 100) / 100;
}

export function hslToCss(hsl: string): string {
  return `hsl(${hsl})`;
}
