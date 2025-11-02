import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../../lib/supabase';

/**
 * Fiche Magasin
 * - Reprend le visuel de "Fichier-fiche magasin.html"
 * - Génère un PDF A6 (1 produit) ou A4 (2 à 4 produits par page) avec pagination par 4
 * - Préremplit les données depuis Supabase à partir de ?ids=... (enfants/sérialisés)
 * - Permet aussi de coller plusieurs IMEI/numéros de série
 * - Enregistre la fiche en table "fiche_magasin" (JSONB)
 */

type ChildRow = {
  id: string;
  parent_id: string | null;
  retail_price: number | null;
  battery_level: number | null;
  product_note: string | null;
  imei: string | null;
  serial_number: string | null;
  vat_type?: 'normal' | 'margin' | string | null;
};

type ParentInfo = {
  id: string;
  // Catégorie/Marque/Modèle
  category?: { type?: string | null; brand?: string | null; model?: string | null } | null;
  // Champs éventuels (adapter si différents dans votre schéma)
  capacity?: string | null;
  sim?: string | null;
  grade_letter?: string | null;
  grade_label?: string | null;
};

type ResolvedFiche = {
  child: ChildRow;
  parent: ParentInfo | null;
  // Dérivés pour affichage
  title: string;          // CAT + MARQUE + MODELE
  storage: string;        // capacité
  sim: string;            // SIM
  reseau: string;         // texte par défaut "RESEAU : 4G 5G"
  appareil: string;       // "Reconditionné"
  batterie: string;       // "100%" etc.
  note: string;           // note courte
  grade_letter: string;   // "A"
  grade_label: string;    // "OR"
  price: number;          // retail_price enfant
  network4g?: boolean;    // case 4G cochée
  network5g?: boolean;    // case 5G cochée
};

const DEFAULT_PHRASE_1 = 'Cet appareil a été reconditionné et contrôlé par nos techniciens en boutique.';
const DEFAULT_PHRASE_2 = 'Ils lui ont attribué le grade :';
const DEFAULT_RESEAU = 'RESEAU : 4G 5G';
const DEFAULT_APPAREIL = 'Reconditionné';

function eur0(v?: number | null): string {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Math.round(v));
}

async function fileToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildTitle(p?: ParentInfo | null) {
  const cat = p?.category?.type ? String(p.category.type) : '';
  const brand = p?.category?.brand ? String(p.category.brand) : '';
  const model = p?.category?.model ? String(p.category.model) : '';
  return [cat, brand, model].filter(Boolean).join(' ').toUpperCase();
}

function resolveOne(child: ChildRow, parent: ParentInfo | null): ResolvedFiche {
  const title = buildTitle(parent);
  const storage = String(parent?.capacity || '').trim() || '';
  const sim = String(parent?.sim || '').trim() || '';
  const reseau = DEFAULT_RESEAU;
  const appareil = DEFAULT_APPAREIL;
  const batterie = typeof child.battery_level === 'number' ? `${Math.round(child.battery_level)}%` : '';
  const note = String(child.product_note || '').trim();
  const grade_letter = String(parent?.grade_letter || '').toUpperCase();
  const grade_label = String(parent?.grade_label || '').toUpperCase();
  const price = Number(child.retail_price ?? 0);

  return {
    child,
    parent,
    title,
    storage,
    sim,
    reseau,
    appareil,
    batterie,
    note,
    grade_letter,
    grade_label,
    price
  };
}

/**
 * Dessin d’une fiche A6 fidèlement au HTML existant
 * mm units: drawA6Card(doc, x, y, 105, 148)
 */
function drawA6Card(doc: jsPDF, x: number, y: number, w = 105, h = 148, data: ResolvedFiche, logoDataUrl?: string | null) {
  const m = 6;
  const boxW = w - 2 * m;
  const left = x + m;
  const top = y + m;

  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.roundedRect(x + 2, y + 2, w - 4, h - 4, 3, 3);

  // Logo
  const logoH = 18;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', left, top, boxW, logoH);
    } catch {}
  }

  // Title (centré)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleTop = top + (logoDataUrl ? logoH + 4 : 0);
  const titleLines = doc.splitTextToSize(String(data.title || '').toUpperCase(), boxW) as string[];
  doc.text(titleLines as any, left + boxW / 2, titleTop + 14, { align: 'center' } as any);

  // Specs
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const specTop = titleTop + 16 + (titleLines.length - 1) * 6 + 6;
  const lh = 6;

  // Colonne gauche
  doc.text('STOCKAGE:', left, specTop);
  doc.setFont('helvetica', 'normal');
  doc.text(data.storage || '-', left + 22, specTop);

  doc.setFont('helvetica', 'bold');
  doc.text('SIM:', left, specTop + lh);
  doc.setFont('helvetica', 'normal');
  doc.text(data.sim || '-', left + 22, specTop + lh);

  // Réseau (deux cases à cocher à côté des libellés, sans libellé "RESEAU:")
  const netY = specTop + 2 * lh;
  const boxSize = 4;
  const yTop = netY - 3;
  doc.setDrawColor(0);
  // 4G
  doc.rect(left, yTop, boxSize, boxSize);
  if (data.network4g) {
    doc.setFont('helvetica', 'bold');
    doc.text('✓', left + 1.5, netY - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text('4G', left + boxSize + 4, netY);
  // 5G
  const x5g = left + boxSize + 4 + 18;
  doc.rect(x5g, yTop, boxSize, boxSize);
  if (data.network5g) {
    doc.setFont('helvetica', 'bold');
    doc.text('✓', x5g + 1.5, netY - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text('5G', x5g + boxSize + 4, netY);

  // Colonne droite
  const rightX = left + boxW / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('APPAREIL:', rightX, specTop);
  doc.setFont('helvetica', 'normal');
  doc.text(data.appareil, rightX + 20, specTop);

  doc.setFont('helvetica', 'bold');
  doc.text('BATTERIE:', rightX, specTop + lh);
  doc.setFont('helvetica', 'normal');
  doc.text(data.batterie || '-', rightX + 20, specTop + lh);

  doc.setFont('helvetica', 'bold');
  doc.text('NOTE:', rightX, specTop + 2 * lh);
  doc.setFont('helvetica', 'normal');
  doc.text(data.note || '-', rightX + 20, specTop + 2 * lh);

  // Paragraphe
  const paraTop = specTop + 2 * lh + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const wrapPara = (doc.splitTextToSize(DEFAULT_PHRASE_1, boxW) as string[]).slice(0, 3);
  doc.text(wrapPara as any, left + boxW / 2, paraTop, { align: 'center' } as any);

  // Grade (2 lignes au centre)
  const gradeTop = paraTop + wrapPara.length * 5 + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(DEFAULT_PHRASE_2, left + boxW / 2, gradeTop, { align: 'center' } as any);
  doc.text(`${data.grade_letter || ''} : ${data.grade_label || ''}`, left + boxW / 2, gradeTop + 6, { align: 'center' } as any);

  // Encadré prix (sans prix barré dans ce contexte)
  const priceTop = h - 36 + y;
  const priceBoxH = 26;
  doc.setDrawColor(0);
  doc.roundedRect(left, priceTop, boxW, priceBoxH, 3, 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(eur0(data.price) || '—', left + boxW / 2, priceTop + 18, { align: 'center' } as any);
}

export default function FicheMagasin() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [parentsById, setParentsById] = useState<Record<string, ParentInfo>>({});
  const [logo, setLogo] = useState<string | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [variantByChildId, setVariantByChildId] = useState<Record<string, { grade: string | null; capacity: string | null; sim_type: string | null }>>({});
  const [parentVariantsById, setParentVariantsById] = useState<Record<string, { color?: string | null; grade?: string | null; capacity?: string | null; sim_type?: string | null }[]>>({});
  const [overrides, setOverrides] = useState<Record<string, Partial<ResolvedFiche>>>({});
  const setOverride = React.useCallback((id: string, patch: Partial<ResolvedFiche>) => {
    setOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);
  const setVariantForChild = React.useCallback((childId: string, v: { grade?: string | null; capacity?: string | null; sim_type?: string | null }) => {
    setVariantByChildId(prev => ({
      ...prev,
      [childId]: {
        grade: (v.grade ?? null) as any,
        capacity: (v.capacity ?? null) as any,
        sim_type: (v.sim_type ?? null) as any
      }
    }));
  }, []);

  // Charger logo (localStorage si dispo, sinon fallback /logo-smartdiscount31.png)
  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem('ficheMagasin:logo');
        if (saved) {
          setLogo(saved);
          return;
        }
      } catch {}
      const d = await fileToDataUrl('/logo-smartdiscount31.png');
      setLogo(d);
    })();
  }, []);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = String(r.result || '');
        setLogo(dataUrl);
        try { localStorage.setItem('ficheMagasin:logo', dataUrl); } catch {}
      };
      r.readAsDataURL(f);
    } catch {}
  };

  const resetLogo = async () => {
    try { localStorage.removeItem('ficheMagasin:logo'); } catch {}
    const d = await fileToDataUrl('/logo-smartdiscount31.png');
    setLogo(d);
  };

  // Charger initialement selon ?ids=
  useEffect(() => {
    void loadByIdsParam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idsFromURL = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ids = (params.get('ids') || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      return ids;
    } catch {
      return [];
    }
  }, []);

  async function loadByIdsParam() {
    setLoading(true);
    setError(null);
    try {
      let rows: ChildRow[] = [];

      if (idsFromURL.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .select('id,parent_id,retail_price,battery_level,product_note,imei,serial_number,vat_type')
          .in('id', idsFromURL as any);
        if (error) throw error;
        rows = (data || []) as any;
      }

      if (!rows.length && serialInput.trim()) {
        const parts = serialInput
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        if (parts.length > 0) {
          const { data, error } = await supabase
            .from('products')
            .select('id,parent_id,retail_price,battery_level,product_note,imei,serial_number,vat_type')
            .in('serial_number', parts as any);
          if (error) throw error;
          rows = (data || []) as any;
        }
      }

      if (!rows.length) {
        setChildren([]);
        setParentsById({});
        setError('Aucun produit correspondant');
        return;
      }

      setChildren(rows);

      // Charger variantes depuis products_with_stock (par parent) et associer un défaut par enfant
      try {
        const parentIdsForVariants = Array.from(new Set(rows.map(r => r.parent_id).filter(Boolean))) as string[];
        if (parentIdsForVariants.length > 0) {
          const { data: vrows } = await supabase
            .from('products_with_stock')
            .select('id,variants')
            .in('id', parentIdsForVariants as any);
          const pv: Record<string, any[]> = {};
          (vrows || []).forEach((r: any) => {
            pv[r.id] = Array.isArray(r.variants) ? r.variants : [];
          });
          setParentVariantsById(pv);

          // Associer à chaque enfant une variante par défaut (première)
          const defMap: Record<string, { grade: string | null; capacity: string | null; sim_type: string | null }> = {};
          rows.forEach(ch => {
            const arr = pv[ch.parent_id || ''] || [];
            const first = arr[0] || {};
            defMap[ch.id] = {
              grade: (first.grade ?? null),
              capacity: (first.capacity ?? null),
              sim_type: (first.sim_type ?? null)
            };
          });
          setVariantByChildId(defMap);
        } else {
          setParentVariantsById({});
          setVariantByChildId({});
        }
      } catch {
        setParentVariantsById({});
        setVariantByChildId({});
      }

      // Charger parents
      const parentIds = Array.from(new Set(rows.map(r => r.parent_id).filter(Boolean))) as string[];
      if (parentIds.length > 0) {
        // Tenter un select direct (adapter au schéma si besoin)
        const { data: pr, error: pErr } = await supabase
          .from('products')
          .select(`
            id,
            capacity,
            sim,
            grade_letter,
            grade_label,
            category:product_categories!products_category_id_fkey (
              type,
              brand,
              model
            )
          `)
          .in('id', parentIds as any);
        if (pErr) throw pErr;

        const dict: Record<string, ParentInfo> = {};
        (pr as any[] || []).forEach((p: any) => {
          dict[p.id] = {
            id: p.id,
            capacity: p.capacity ?? null,
            sim: p.sim ?? null,
            grade_letter: p.grade_letter ?? null,
            grade_label: p.grade_label ?? null,
            category: p.category ?? null
          };
        });
        setParentsById(dict);
      } else {
        setParentsById({});
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  const resolved = useMemo<ResolvedFiche[]>(() => {
    return children.map(ch => {
      const base = resolveOne(ch, parentsById[ch.parent_id || ''] || null);
      const v = variantByChildId[ch.id];
      if (v) {
        if (v.capacity) base.storage = String(v.capacity).trim();
        if (v.sim_type) base.sim = String(v.sim_type).trim();
        if (v.grade) {
          base.grade_letter = String(v.grade).trim().toUpperCase();
          base.grade_label = base.grade_label || '';
        }
      }
      const ov = overrides[ch.id] || {};
      const merged: ResolvedFiche = {
        ...base,
        title: (ov as any).title ?? base.title,
        storage: (ov as any).storage ?? base.storage,
        sim: (ov as any).sim ?? base.sim,
        batterie: (ov as any).batterie ?? base.batterie,
        note: (ov as any).note ?? base.note,
        grade_letter: (ov as any).grade_letter ?? base.grade_letter,
        grade_label: (ov as any).grade_label ?? base.grade_label,
        price: typeof (ov as any).price === 'number' ? (ov as any).price : base.price,
        network4g: typeof (ov as any).network4g === 'boolean' ? (ov as any).network4g : false,
        network5g: typeof (ov as any).network5g === 'boolean' ? (ov as any).network5g : false,
      };
      return merged;
    });
  }, [children, parentsById, variantByChildId, overrides]);

  function preview() {
    if (!resolved.length) {
      setError('Aucun produit à prévisualiser');
      return;
    }

    if (resolved.length === 1) {
      const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
      drawA6Card(doc, 0, 0, 105, 148, resolved[0], logo);
      const pdfUrl = String(doc.output('bloburl'));
      if (frameRef.current) frameRef.current.src = pdfUrl;
      return;
    }

    // A4 multipage par 4
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const cells = [
      { x: 0, y: 0 },
      { x: 105, y: 0 },
      { x: 0, y: 148 },
      { x: 105, y: 148 }
    ];
    resolved.forEach((r, idx) => {
      if (idx > 0 && idx % 4 === 0) {
        doc.addPage('a4', 'portrait');
      }
      const slot = cells[idx % 4];
      drawA6Card(doc, slot.x, slot.y, 105, 148, r, logo);
    });
    const pdfUrl = String(doc.output('bloburl'));
    if (frameRef.current) frameRef.current.src = pdfUrl;
  }

  async function save() {
    try {
      if (!resolved.length) {
        window.alert('Rien à enregistrer');
        return;
      }
      const parentId = resolved[0].child.parent_id || null;
      const payload = {
        parent_id: parentId,
        fiche_data: {
          logo: !!logo,
          items: resolved
        }
      };
      const { error } = await supabase.from('fiche_magasin').insert(payload as any);
      if (error) throw error;
      window.alert('Fiche enregistrée.');
    } catch (e: any) {
      window.alert(`Enregistrement échoué: ${e?.message || e}`);
    }
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Fiche Magasin</h2>

        <div className="text-sm text-gray-600">
          - 1 produit: A6 • 2–4 produits: A4 (2x2) • {'>'} 4: pagination automatique (4 par page)
        </div>

        <textarea
          className="w-full border rounded p-2 text-sm"
          rows={3}
          placeholder="Coller IMEI/numéros de série séparés par des virgules (sinon, ids depuis l'URL sont utilisés)"
          value={serialInput}
          onChange={e => setSerialInput(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            onClick={loadByIdsParam}
            disabled={loading}
          >
            Charger
          </button>
          <button
            className="px-3 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
            onClick={preview}
            disabled={loading || !children.length}
          >
            Aperçu PDF
          </button>
          <button
            className="px-3 py-2 bg-emerald-700 text-white rounded disabled:opacity-50"
            onClick={save}
            disabled={!children.length}
          >
            Enregistrer
          </button>
        </div>

        {/* Logo: import et réinitialisation (persisté en localStorage) */}
        <div className="flex items-center gap-3 text-sm mt-3">
          <label className="font-medium">Logo:</label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleLogoFileChange}
            className="text-sm"
          />
          <button
            type="button"
            onClick={resetLogo}
            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Réinitialiser
          </button>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        {/* Édition des fiches */}
        {resolved.length > 0 && (
          <div className="space-y-4 mt-3">
            {resolved.map((r) => {
              const ov = overrides[r.child.id] || {};
              const arr = parentVariantsById[r.child.parent_id || ''] || [];
              const cur = variantByChildId[r.child.id] || {};
              const curIdx = Math.max(0, arr.findIndex(v => (v.grade||'')===(cur.grade||'') && (v.capacity||'')===(cur.capacity||'') && (v.sim_type||'')===(cur.sim_type||'')));
              return (
                <div key={r.child.id} className="border rounded p-3 space-y-2">
                  {arr.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium">Variante</label>
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={String(curIdx)}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value, 10);
                          const v = arr[idx] || {};
                          setVariantForChild(r.child.id, v as any);
                        }}
                      >
                        {arr.map((v, i) => (
                          <option key={i} value={i}>{`${v.grade || ''} ${v.capacity || ''} ${v.sim_type || ''}`.trim()}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex flex-col">
                      <span className="text-xs text-gray-600">Titre</span>
                      <input className="border rounded px-2 py-1"
                        value={String((ov as any).title ?? r.title)}
                        onChange={(e) => setOverride(r.child.id, { title: e.target.value } as any)}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-gray-600">Capacité</span>
                      <input className="border rounded px-2 py-1"
                        value={String((ov as any).storage ?? r.storage)}
                        onChange={(e) => setOverride(r.child.id, { storage: e.target.value } as any)}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-gray-600">SIM</span>
                      <input className="border rounded px-2 py-1"
                        value={String((ov as any).sim ?? r.sim)}
                        onChange={(e) => setOverride(r.child.id, { sim: e.target.value } as any)}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-gray-600">Batterie (%)</span>
                      <input className="border rounded px-2 py-1" type="number" min={0} max={100}
                        value={String((ov as any).batterie ?? r.batterie).replace('%','')}
                        onChange={(e) => setOverride(r.child.id, { batterie: `${e.target.value.replace(/[^0-9]/g,'')}%` } as any)}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-gray-600">Grade lettre</span>
                      <input className="border rounded px-2 py-1"
                        value={String((ov as any).grade_letter ?? r.grade_letter)}
                        onChange={(e) => setOverride(r.child.id, { grade_letter: e.target.value.toUpperCase() } as any)}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-gray-600">Grade libellé</span>
                      <input className="border rounded px-2 py-1"
                        value={String((ov as any).grade_label ?? r.grade_label)}
                        onChange={(e) => setOverride(r.child.id, { grade_label: e.target.value.toUpperCase() } as any)}
                      />
                    </label>
                    <label className="flex flex-col col-span-2">
                      <span className="text-xs text-gray-600">Note</span>
                      <textarea className="border rounded px-2 py-1 rows-2"
                        value={String((ov as any).note ?? r.note)}
                        onChange={(e) => setOverride(r.child.id, { note: e.target.value } as any)}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-gray-600">Prix (€)</span>
                      <input className="border rounded px-2 py-1" type="number" min={0}
                        value={String((ov as any).price ?? r.price)}
                        onChange={(e) => setOverride(r.child.id, { price: Number(e.target.value || 0) } as any)}
                      />
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-1 text-sm">
                        <input type="checkbox"
                          checked={Boolean((ov as any).network4g ?? false)}
                          onChange={(e) => setOverride(r.child.id, { network4g: e.target.checked } as any)}
                        />
                        <span>4G</span>
                      </label>
                      <label className="inline-flex items-center gap-1 text-sm">
                        <input type="checkbox"
                          checked={Boolean((ov as any).network5g ?? false)}
                          onChange={(e) => setOverride(r.child.id, { network5g: e.target.checked } as any)}
                        />
                        <span>5G</span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Récap minimal des éléments chargés */}
        <div className="text-xs text-gray-600">
          {resolved.length > 0 && (
            <ul className="list-disc pl-4">
              {resolved.slice(0, 6).map(r => (
                <li key={r.child.id}>
                  {r.title} — {r.child.serial_number || r.child.imei || r.child.id} — {eur0(r.price)}
                </li>
              ))}
              {resolved.length > 6 && <li>+ {resolved.length - 6} autres…</li>}
            </ul>
          )}
        </div>
      </div>

      <div className="border rounded overflow-hidden">
        <iframe ref={frameRef} className="w-full h-[85vh]" title="Aperçu PDF" />
      </div>
    </div>
  );
}
