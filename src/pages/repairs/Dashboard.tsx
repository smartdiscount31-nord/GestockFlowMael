/**
 * Workshop Dashboard Page (List view only, counters fixed, instant refresh)
 * - Header with title, total, and "Ajouter un ticket"
 * - Sticky status tabs with counts and animated underline (counters computed reliably)
 * - Filters row with search + quick chips (UI-ready)
 * - Desktop table + Mobile cards
 * - Kanban view removed as requested
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Archive, Search, User as UserIcon, CalendarDays, CalendarRange, Smartphone, Laptop, Tablet, Printer, Trash2 } from 'lucide-react';
import { RepairModal } from '../../components/repairs/RepairModal';
import RepairMediaGallery from '../../components/repairs/RepairMediaGallery';
import { Toast } from '../../components/Notifications/Toast';
import { supabase } from '../../lib/supabase';
import useNavigate from '../../hooks/useNavigate';

interface Ticket {
  id: string;
  repair_number?: string; // numéro lisible, ex: 101125-001
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_color?: string;
  imei?: string;
  serial_number?: string;
  pin_code?: string;
  issue_description: string;
  power_state: string;
  status: string;
  assigned_tech?: string;
  cgv_accepted_at?: string;
  signature_url?: string;
  invoice_id?: string;
  label_client_url?: string;
  label_tech_url?: string;
  has_media: boolean;
  reserved_parts_count: number;
  to_order_parts_count: number;
  // Séchage
  drying_start_at?: string | null;
  drying_duration_min?: number | null;
  drying_end_at?: string | null;
  drying_acknowledged_at?: string | null;
  // Helper client-side (ms epoch)
  drying_end_time?: number;
}

interface StatusCount { status: string; count: number }

const STATUS_UI: Record<string, { label: string; tabColor: string; badgeBg: string; badgeText: string }> = {
  quote_todo:       { label: 'Devis à faire',       tabColor: 'text-blue-600',   badgeBg: 'bg-blue-100 dark:bg-blue-900/50',     badgeText: 'text-blue-800 dark:text-blue-300' },
  parts_to_order:   { label: 'Pièces à commander',  tabColor: 'text-amber-600',  badgeBg: 'bg-amber-100 dark:bg-amber-900/50',   badgeText: 'text-amber-800 dark:text-amber-300' },
  waiting_parts:    { label: 'Attente pièces',      tabColor: 'text-yellow-600', badgeBg: 'bg-yellow-100 dark:bg-yellow-900/50', badgeText: 'text-yellow-800 dark:text-yellow-300' },
  to_repair:        { label: 'À réparer',           tabColor: 'text-indigo-600', badgeBg: 'bg-indigo-100 dark:bg-indigo-900/50', badgeText: 'text-indigo-800 dark:text-indigo-300' },
  in_repair:        { label: 'En réparation',       tabColor: 'text-violet-600', badgeBg: 'bg-violet-100 dark:bg-violet-900/50', badgeText: 'text-violet-800 dark:text-violet-300' },
  drying:           { label: 'Séchage',             tabColor: 'text-cyan-600',   badgeBg: 'bg-cyan-100 dark:bg-cyan-900/50',     badgeText: 'text-cyan-800 dark:text-cyan-300' },
  ready_to_return:  { label: 'Prêt à rendre',       tabColor: 'text-emerald-600',badgeBg: 'bg-emerald-100 dark:bg-emerald-900/50',badgeText: 'text-emerald-800 dark:text-emerald-300' },

  delivered:        { label: 'Livré',               tabColor: 'text-gray-600',   badgeBg: 'bg-gray-200 dark:bg-gray-700/50',     badgeText: 'text-gray-800 dark:text-gray-300' },
  archived:         { label: 'Archivé',             tabColor: 'text-gray-600',   badgeBg: 'bg-gray-200 dark:bg-gray-700/50',     badgeText: 'text-gray-800 dark:text-gray-300' },
};

const ALL_STATUSES = [
  'quote_todo','parts_to_order','waiting_parts','to_repair','in_repair','drying','ready_to_return','delivered','archived'
];

export default function Dashboard() {
  const { navigateToProduct } = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryTicketId, setGalleryTicketId] = useState<string | null>(null);

  const [activeStatus, setActiveStatus] = useState<string>('to_repair');
  // Filtres avancés
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [filterMyAssigned, setFilterMyAssigned] = useState<boolean>(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'custom' | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  // Chrono séchage: état UI
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [alertTicket, setAlertTicket] = useState<Ticket | null>(null);
  const [durationByTicket, setDurationByTicket] = useState<Record<string, number>>({});
  const notifiedRef = React.useRef<Set<string>>(new Set());
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [urgencyById, setUrgencyById] = useState<Record<string, number>>({}); // 0 | 7 | 30
  const [lastCallByTicket, setLastCallByTicket] = useState<Record<string, string>>({});

  const displayedStatuses = showArchived
    ? ALL_STATUSES
    : ALL_STATUSES.filter(s => s !== 'archived');

  const computeCounts = useCallback((list: Ticket[]): StatusCount[] => {
    const map: Record<string, number> = {};
    for (const k of ALL_STATUSES) map[k] = 0;
    for (const t of list) {
      if (map[t.status] !== undefined) map[t.status] += 1;
    }
    return ALL_STATUSES.map(s => ({ status: s, count: map[s] }));
  }, []);

  const loadCounts = useCallback(async (fallbackFrom?: Ticket[]) => {
    try {
      const { data, error } = await supabase.rpc('fn_repair_counts');
      if (!error && Array.isArray(data) && data.length > 0) {
        const norm: StatusCount[] = ALL_STATUSES.map(s => ({
          status: s,
          count: Number((data.find((r: any) => String(r.status) === s)?.count) || 0)
        }));
        setStatusCounts(norm);
        return;
      }
    } catch {
      // ignore, fallback below
    }
    // Fallback local: toujours calculer depuis la liste fournie (ou vide)
    const base = Array.isArray(fallbackFrom) ? fallbackFrom : [];
    setStatusCounts(computeCounts(base));
  }, [computeCounts]);

  // Démarrer un chrono de séchage
  const startDrying = async (repair_id: string, duration_min?: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');
      const response = await fetch('/.netlify/functions/repairs-drying-start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_id, duration_min })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || 'Erreur démarrage séchage');
      }
      setToast({ message: 'Séchage démarré', type: 'success' });
      await loadTickets();
    } catch (e: any) {
      setToast({ message: e?.message || 'Erreur inconnue', type: 'error' });
    }
  };

  // Acquitter fin de séchage
  const ackDrying = async (repair_id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');
      const response = await fetch('/.netlify/functions/repairs-drying-ack', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_id })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || 'Erreur d\'acquittement');
      }
      setToast({ message: 'Fin de séchage prise en compte', type: 'success' });
      setAlertTicket(null);
      await loadTickets();
    } catch (e: any) {
      setToast({ message: e?.message || 'Erreur inconnue', type: 'error' });
    }
  };

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('repair_tickets')
        .select(`*, customer:customers(name, phone)`) 
        .order('created_at', { ascending: false });

      if (ticketsError) {
        setIsLoading(false);
        return;
      }

      const { data: mediaData } = await supabase.from('repair_media').select('repair_id');
      const { data: partsData } = await supabase.from('repair_items').select('repair_id, reserved');

      const mediaByTicket = (mediaData || []).reduce((acc: Record<string, number>, m: any) => {
        acc[m.repair_id] = (acc[m.repair_id] || 0) + 1;
        return acc;
      }, {});

      const partsByTicket = (partsData || []).reduce((acc: Record<string, { reserved: number; toOrder: number }>, p: any) => {
        if (!acc[p.repair_id]) acc[p.repair_id] = { reserved: 0, toOrder: 0 };
        if (p.reserved) acc[p.repair_id].reserved++; else acc[p.repair_id].toOrder++;
        return acc;
      }, {});

      const enriched: Ticket[] = (ticketsData || []).map((t: any) => ({
        id: t.id,
        repair_number: t.repair_number,
        created_at: t.created_at,
        customer_id: t.customer_id,
        customer_name: t.customer?.name || 'Client inconnu',
        customer_phone: t.customer?.phone || '',
        device_brand: t.device_brand,
        device_model: t.device_model,
        device_color: t.device_color,
        imei: t.imei,
        serial_number: t.serial_number,
        pin_code: t.pin_code,
        issue_description: t.issue_description,
        power_state: t.power_state,
        status: t.status,
        assigned_tech: t.assigned_tech,
        cgv_accepted_at: t.cgv_accepted_at,
        signature_url: t.signature_url,
        invoice_id: t.invoice_id,
        label_client_url: t.label_client_url,
        label_tech_url: t.label_tech_url,
        has_media: (mediaByTicket[t.id] || 0) > 0,
        reserved_parts_count: partsByTicket[t.id]?.reserved || 0,
        to_order_parts_count: partsByTicket[t.id]?.toOrder || 0,
        // Séchage
        drying_start_at: t.drying_start_at || null,
        drying_duration_min: typeof t.drying_duration_min === 'number' ? t.drying_duration_min : null,
        drying_end_at: t.drying_end_at || null,
        drying_acknowledged_at: t.drying_acknowledged_at || null,
        drying_end_time: t.drying_end_at ? new Date(t.drying_end_at).getTime() : undefined,
      }));

      // Charger historique d'appels (pour dernier/premier appel)
      let calls: any[] = [];
      try {
        const { data: callsData } = await supabase
          .from('repair_call_logs')
          .select('repair_id, created_at')
          .order('created_at', { ascending: true });
        calls = callsData || [];
      } catch {}

      // Charger première date de ready_to_return
      let ready: any[] = [];
      try {
        const { data: readyData } = await supabase
          .from('repair_status_history')
          .select('repair_id, new_status, changed_at')
          .eq('new_status', 'ready_to_return')
          .order('changed_at', { ascending: true });
        ready = readyData || [];
      } catch {}

      const firstCall: Record<string, number> = {};
      const lastCall: Record<string, number> = {};
      for (const c of calls) {
        const ts = new Date(c.created_at).getTime();
        const id = c.repair_id as string;
        if (firstCall[id] == null) firstCall[id] = ts;
        lastCall[id] = ts;
      }
      const firstReady: Record<string, number> = {};
      for (const r of ready) {
        const ts = new Date(r.changed_at).getTime();
        const id = r.repair_id as string;
        if (firstReady[id] == null) firstReady[id] = ts;
      }

      const nowMs = Date.now();
      const urg: Record<string, number> = {};
      for (const t of enriched) {
        let level = 0;
        if (t.status === 'ready_to_return' && !t.invoice_id) {
          const ref = firstCall[t.id] ?? firstReady[t.id] ?? new Date(t.created_at).getTime();
          const days = (nowMs - ref) / 86400000;
          if (days >= 30) level = 30; else if (days >= 7) level = 7;
        }
        urg[t.id] = level;
      }

      // Mettre à jour états dérivés
      setUrgencyById(urg);
      setLastCallByTicket(Object.fromEntries(Object.entries(lastCall).map(([k,v]) => [k, new Date(v).toISOString()])));

      setTickets(enriched);
      setFilteredTickets(enriched);
      // Compteurs: tenter RPC sinon fallback liste locale
      await loadCounts(enriched);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [loadCounts]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleStatusChange = async (repair_id: string, new_status: string) => {
    // Optimistic update: appliquer immédiatement côté UI
    const prevTickets = tickets;
    const optimistic = prevTickets.map(t => t.id === repair_id ? { ...t, status: new_status } : t);
    setTickets(optimistic);
    // Rejouer filtre courant
    setFilteredTickets(curr => curr.map(t => t.id === repair_id ? { ...t, status: new_status } : t));
    // Recalculer compteurs immédiatement
    setStatusCounts(computeCounts(optimistic));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');
      const response = await fetch('/.netlify/functions/repairs-status-update', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_id, new_status })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || 'Erreur lors du changement de statut');
      }
      setToast({ message: 'Statut mis à jour avec succès', type: 'success' });
      // Synchroniser avec le backend
      await loadTickets();
    } catch (e: any) {
      // Rollback en cas d’erreur
      setTickets(prevTickets);
      setFilteredTickets(prevTickets);
      setStatusCounts(computeCounts(prevTickets));
      setToast({ message: e?.message || 'Erreur inconnue', type: 'error' });
    }
  };

  const totalCount = filteredTickets.filter(t => showArchived ? true : t.status !== 'archived').length;

  useEffect(() => { loadTickets(); }, []);

  // Auto-archivage quotidien à 19:00 (heure locale)
  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const hours = now.getHours();
        if (hours < 19) return; // avant 19:00 → on ne fait rien

        // Vérifier clé de verrouillage (ui_preferences.auto_archive_last_run)
        let lastRun: string | null = null;
        try {
          const { data } = await supabase
            .from('ui_preferences')
            .select('value')
            .eq('key', 'auto_archive_last_run')
            .maybeSingle();
          const val: any = (data as any)?.value;
          if (val) lastRun = JSON.parse(val);
        } catch {}

        const todayKey = now.toISOString().slice(0, 10);
        if (lastRun === todayKey) return; // déjà exécuté aujourd'hui

        // Appel unique de la Netlify Function batch (backend)
        const { data: { session } } = await supabase.auth.getSession();
        try {
          const res = await fetch('/.netlify/functions/repairs-auto-archive-run', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
            },
            body: JSON.stringify({})
          });
          if (!res.ok) {
            console.warn('[Auto-archive] Batch function failed:', res.status);
          }
        } catch (e) {
          console.warn('[Auto-archive] Batch call exception:', e);
        }

        // Enregistrer le verrou
        try {
          await supabase
            .from('ui_preferences')
            .upsert({ key: 'auto_archive_last_run', value: JSON.stringify(todayKey) });
        } catch {}

        // Rafraîchir la liste après l'archivage
        await loadTickets();
      } catch (e) {
        console.warn('[Auto-archive] Erreur globale:', e);
      }
    })();
  }, []);
  // Charger l'utilisateur courant pour le filtre "Moi"
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);
        setCurrentUserEmail(user?.email || null);
      } catch {}
    })();
  }, []);
  // Recalculer les filtres combinés
  useEffect(() => {
    let list = tickets;
    // Texte
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        t.customer_name.toLowerCase().includes(q) ||
        (t.customer_phone || '').includes(searchQuery) ||
        t.id.toLowerCase().includes(q) ||
        t.device_brand.toLowerCase().includes(q) ||
        t.device_model.toLowerCase().includes(q)
      );
    }
    // Moi (assigné)
    if (filterMyAssigned && (currentUserId || currentUserEmail)) {
      list = list.filter(t => {
        const a = (t.assigned_tech || '').toLowerCase();
        return (currentUserId && a === currentUserId.toLowerCase()) || (currentUserEmail && a === currentUserEmail.toLowerCase());
      });
    }
    // Plage de dates
    if (dateFilter === 'today' || dateFilter === 'week' || (dateFilter === 'custom' && startDate && endDate)) {
      const now = new Date();
      let start: Date;
      let end: Date;
      if (dateFilter === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
      } else if (dateFilter === 'week') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
        const weekStart = new Date(todayStart);
        const d = (todayStart.getDay() + 6) % 7; // lundi=0
        weekStart.setDate(todayStart.getDate() - d);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23,59,59,999);
        start = weekStart; end = weekEnd;
      } else {
        start = new Date(`${startDate}T00:00:00`);
        end = new Date(`${endDate}T23:59:59.999`);
      }
      list = list.filter(t => {
        const d = new Date(t.created_at);
        return d >= start && d <= end;
      });
    }
    setFilteredTickets(list);
  }, [tickets, searchQuery, filterMyAssigned, dateFilter, startDate, endDate, currentUserId, currentUserEmail]);

  // Filtre urgences
  useEffect(() => {
    setFilteredTickets((curr) => {
      let list = curr;
      if (urgentOnly) list = list.filter(t => (urgencyById[t.id] || 0) >= 7);
      else list = tickets; // réinitialiser sur tickets complets quand on sort du filtre
      return list;
    });
  }, [urgentOnly, urgencyById, tickets]);

  // Tick chaque seconde uniquement en onglet Séchage
  useEffect(() => {
    if (activeStatus !== 'drying') return;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeStatus]);

  // Alerte sonore + pop-up à la fin du séchage (une seule fois par ticket)
  const playBeep = () => {
    try {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 1000;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      o.start();
      o.stop(ctx.currentTime + 0.2);
    } catch {}
  };

  useEffect(() => {
    if (activeStatus !== 'drying') return;
    const expired = tickets.filter(t => t.status === 'drying' && t.drying_end_time && nowTs >= t.drying_end_time && !t.drying_acknowledged_at);
    for (const t of expired) {
      if (!notifiedRef.current.has(t.id)) {
        notifiedRef.current.add(t.id);
        playBeep();
        setAlertTicket(t);
      }
    }
  }, [nowTs, tickets, activeStatus]);

  // Impression des étiquettes (ouvre si existantes, sinon génère et persiste)
  const handlePrint = async (t: Ticket) => {
    let clientWin: Window | null = null;
    let techWin: Window | null = null;
    try {
      // Ouvrir 2 onglets placeholders immédiatement (anti popup-blocker)
      clientWin = window.open('', '_blank');
      techWin = window.open('', '_blank');
      try { if (clientWin?.document) { clientWin.document.write('<p style="font:14px sans-serif">Ouverture de l’étiquette client…</p>'); clientWin.document.close(); } } catch {}
      try { if (techWin?.document) { techWin.document.write('<p style="font:14px sans-serif">Ouverture de l’étiquette technicien…</p>'); techWin.document.close(); } } catch {}
      if (!clientWin || !techWin) {
        setToast({ message: 'Votre navigateur a bloqué un onglet. Si besoin, réessayez ou ouvrez manuellement la 2e étiquette.', type: 'info' });
      }

      if (t.label_client_url && t.label_tech_url) {
        const existingClientUrl = t.label_client_url as string;
        const existingTechUrl = t.label_tech_url as string;
        setTimeout(() => { try { if (clientWin) clientWin.location.href = existingClientUrl; } catch {} }, 30);
        setTimeout(() => { try { if (techWin) techWin.location.href = existingTechUrl; } catch {} }, 60);
        return;
      }

      // Charger info ticket depuis DB (customer phone et created_at fiables)
      const { data: rows } = await supabase
        .from('repair_tickets')
        .select(`*, customer:customers(name, phone)`) 
        .eq('id', t.id)
        .limit(1);
      const row: any = Array.isArray(rows) ? rows[0] : null;

      const { generateRepairLabels } = await import('../../utils/repairLabels');
      const labelTicket: any = {
        id: t.id,
        repair_number: row?.repair_number ?? t.repair_number ?? null,
        created_at: row?.created_at ?? t.created_at,
        customer: { name: row?.customer?.name || t.customer_name || '', phone: row?.customer?.phone || t.customer_phone || '' },
        device_brand: t.device_brand,
        device_model: t.device_model,
        issue_description: t.issue_description,
        assigned_tech: row?.assigned_tech || t.assigned_tech || null,
        pin_code: t.pin_code || row?.pin_code || null,
        estimate_amount: row?.estimate_amount ?? null,
      };

      const { clientUrl, techUrl, persisted } = await generateRepairLabels(labelTicket);
      if (persisted) {
        await supabase.from('repair_tickets').update({ label_client_url: clientUrl, label_tech_url: techUrl }).eq('id', t.id);
      }

      setTimeout(() => { try { if (clientWin) clientWin.location.href = clientUrl; } catch {} }, 30);
      setTimeout(() => { try { if (techWin) techWin.location.href = techUrl; } catch {} }, 60);
    } catch (e) {
      try { if (clientWin) clientWin.close(); } catch {}
      try { if (techWin) techWin.close(); } catch {}
      console.error('[Dashboard] Erreur impression étiquettes:', e);
      setToast({ message: 'Erreur lors de la génération des étiquettes', type: 'error' });
    }
  };

  // Suppression d'un ticket (ADMIN uniquement)
  const handleDelete = async (t: Ticket) => {
    try {
      if (!window.confirm('Supprimer définitivement ce dossier de réparation ? Cette action est irréversible.')) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');
      const res = await fetch('/.netlify/functions/repairs-delete', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_id: t.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Erreur suppression');
      }
      setToast({ message: 'Dossier supprimé', type: 'success' });
      await loadTickets();
    } catch (e: any) {
      setToast({ message: e?.message || 'Erreur lors de la suppression', type: 'error' });
    }
  };

  const tabTickets = filteredTickets.filter(t => {
    if (!showArchived && t.status === 'archived') return false;
    return activeStatus ? t.status === activeStatus : true;
  });

  const deviceIconFor = (brandOrType: string) => {
    const low = (brandOrType || '').toLowerCase();
    if (low.includes('mac') || low.includes('laptop')) return <Laptop className="inline -mt-0.5" size={16} />;
    if (low.includes('tab') || low.includes('tablet')) return <Tablet className="inline -mt-0.5" size={16} />;
    return <Smartphone className="inline -mt-0.5" size={16} />;
  };

  const getStatusCount = (status: string) => (statusCounts.find(c => c.status === status)?.count || 0);
  // Compteurs Jour / Semaine / Mois (basés sur created_at, tous statuts confondus)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
  const dayCount = tickets.filter(t => { const d = new Date(t.created_at); return d >= todayStart && d <= todayEnd; }).length;
  const weekStart = new Date(todayStart);
  const d0 = (todayStart.getDay() + 6) % 7; // lundi=0
  weekStart.setDate(todayStart.getDate() - d0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23,59,59,999);
  const weekCount = tickets.filter(t => { const d = new Date(t.created_at); return d >= weekStart && d <= weekEnd; }).length;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999);
  const monthCount = tickets.filter(t => { const d = new Date(t.created_at); return d >= monthStart && d <= monthEnd; }).length;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-[#111817] dark:text-gray-200">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h1 className="text-[#111817] dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.03em] w-full md:w-auto">
            Tickets de Réparation
          </h1>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="hidden md:flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Jour {dayCount}</span>
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Semaine {weekCount}</span>
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Mois {monthCount}</span>
            </div>
            <button
              onClick={() => navigateToProduct('atelier-prise-en-charge')}
              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-primary text-[#111817] text-base font-bold tracking-[0.015em] hover:opacity-90 flex-grow md:flex-grow-0"
            >
              Ajouter une prise en charge
            </button>
          </div>
        </div>

        {/* Search + quick filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-grow">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618986] dark:text-gray-400"><Search size={18} /></span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="form-input w-full h-12 rounded-xl pl-10 pr-3 text-base bg-white dark:bg-[#182c2a] border-none text-[#111817] dark:text-white placeholder:text-[#618986] dark:placeholder:text-gray-500 shadow-sm"
                />
              </div>
            </div>
            <div className="hidden sm:flex gap-3 items-center">
              <button
                onClick={() => setUrgentOnly(v => !v)}
                className={`flex h-12 items-center gap-x-2 rounded-xl px-4 shadow-sm ${urgentOnly ? 'bg-red-600 text-white' : 'bg-white dark:bg-[#182c2a] text-[#111817] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <UserIcon size={16} /> Urgences <span className={urgentOnly ? 'ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-white/20' : 'ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700'}>{tickets.filter(t => (urgencyById[t.id] || 0) >= 7).length}</span>
              </button>
              <button
                onClick={() => setDateFilter(dateFilter === 'today' ? null : 'today')}
                className={`flex h-12 items-center gap-x-2 rounded-xl px-4 shadow-sm ${dateFilter === 'today' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#182c2a] text-[#111817] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <CalendarDays size={16} /> Aujourd'hui
              </button>
              <button
                onClick={() => setDateFilter(dateFilter === 'week' ? null : 'week')}
                className={`flex h-12 items-center gap-x-2 rounded-xl px-4 shadow-sm ${dateFilter === 'week' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#182c2a] text-[#111817] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <CalendarRange size={16} /> Cette semaine
              </button>
              <button
                onClick={() => setDateFilter(dateFilter === 'custom' ? null : 'custom')}
                className={`flex h-12 items-center gap-x-2 rounded-xl px-4 shadow-sm ${dateFilter === 'custom' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#182c2a] text-[#111817] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <CalendarRange size={16} /> Période
              </button>
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-sm" />
                  <span className="text-[#618986]">–</span>
                  <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-sm" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky tabs */}
        <div className="sticky top-0 z-20 bg-background-light dark:bg-background-dark -mx-4 px-4 md:m-0 md:p-0">
          <div className="flex items-end border-b border-gray-200 dark:border-gray-700">
            <div className="flex-grow overflow-x-auto">
              <div className="flex gap-1">
                {displayedStatuses.map(st => {
                  const ui = STATUS_UI[st] || { label: st, tabColor: 'text-gray-600', badgeBg: 'bg-gray-200', badgeText: 'text-gray-800' } as any;
                  const isActive = activeStatus === st;
                  return (
                    <button
                      key={st}
                      onClick={() => setActiveStatus(st)}
                      className={`group relative flex items-center gap-2.5 whitespace-nowrap px-4 pt-4 pb-3 rounded-t-xl ${isActive ? 'z-10 border-x border-t border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-[#182c2a] ' + ui.tabColor : 'text-[#618986] dark:text-gray-400 hover:' + ui.tabColor}`}
                    >
                      <span className={`text-sm font-bold ${isActive ? ui.tabColor : ''}`}>{ui.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ui.badgeBg} ${ui.badgeText}`}>{getStatusCount(st)}</span>
                      <div className={`tab-underline absolute bottom-0 left-0 h-1 w-full rounded-full ${isActive ? 'scale-x-100' : 'scale-x-0'} transition-transform`} style={{ backgroundColor: 'currentColor' }} />
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => setShowArchived(v => !v)}
              className="ml-auto mb-1 hidden md:flex items-center gap-2 h-10 px-4 text-sm font-medium text-[#618986] dark:text-gray-400 hover:text-[#111817] dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Archive size={16} /> {showArchived ? 'Masquer archivés' : 'Afficher archivés'}
            </button>
          </div>
        </div>

        {/* LIST VIEW */}
        <div className="mt-4 md:bg-white md:dark:bg-[#182c2a] md:rounded-b-xl md:rounded-tr-xl md:shadow-sm md:overflow-hidden">
          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-[#102220] text-xs text-[#618986] dark:text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Date de création</th>
                  <th className="px-6 py-4">N° réparation</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Appareil</th>
                  <th className="px-6 py-4">Panne constatée</th>
                  <th className="px-6 py-4">Statut</th>
                  {activeStatus === 'drying' && (
                    <th className="px-6 py-4">Chrono</th>
                  )}
                  <th className="px-6 py-4">Historique d’appel</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tabTickets.map((t) => {
                  const date = new Date(t.created_at);
                  const created = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                  return (
                    <tr key={t.id} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#102220] ${((urgencyById[t.id]||0) >= 7) ? 'bg-red-50' : ''} ${((urgencyById[t.id]||0) >= 30) ? 'ring-2 ring-red-600' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">{created}</td>
                      <td className="px-6 py-4">
                        <button className="font-medium text-primary hover:underline" onClick={() => { setGalleryTicketId(t.id); setShowGallery(true); }}>#{t.repair_number ? t.repair_number : t.id.substring(0,8)}</button>
                        <div className="text-xs">
                          <button
                            className="text-blue-600 hover:underline"
                            onClick={() => { setGalleryTicketId(t.id); setShowGallery(true); }}
                          >
                            Ouvrir la galerie
                          </button>
                          <span className="text-[#618986] mx-1">•</span>
                          <button
                            className="text-gray-700 hover:underline"
                            onClick={() => setSelectedTicket(t)}
                          >
                            Ouvrir la prise en charge
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{t.customer_name}</p>
                        <p className="text-xs text-[#618986]">{t.customer_phone || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {deviceIconFor(t.device_brand)}
                          <div>
                            <p className="font-medium">{t.device_model}</p>
                            <p className="text-xs text-[#618986]">{t.device_brand}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate" title={t.issue_description}>{t.issue_description || '—'}</td>
                      <td className="px-6 py-4">
                        <select
                          className="form-select w-full text-sm bg-gray-100 dark:bg-[#102220] border-none rounded-lg focus:ring-2 focus:ring-primary/50"
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        >
                          {displayedStatuses.map(s => (
                            <option key={s} value={s}>{STATUS_UI[s]?.label || s}</option>
                          ))}
                        </select>
                      </td>
                      {activeStatus === 'drying' && (
                        <td className="px-6 py-4">
                          {t.status !== 'drying' ? (
                            <span className="text-[#618986]">—</span>
                          ) : t.drying_end_time ? (
                            (() => {
                              const remainingMs = (t.drying_end_time || 0) - nowTs;
                              if (remainingMs <= 0) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-red-600">Terminé</span>
                                    <button
                                      onClick={() => ackDrying(t.id)}
                                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      J’ai pris en compte
                                    </button>
                                  </div>
                                );
                              }
                              const minutes = Math.floor(remainingMs / 60000);
                              const seconds = Math.floor((remainingMs % 60000) / 1000);
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-blue-600">{minutes}:{String(seconds).padStart(2,'0')}</span>
                                  <button
                                    onClick={() => ackDrying(t.id)}
                                    className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                    title="Arrêter le séchage"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={480}
                                value={durationByTicket[t.id] ?? 60}
                                onChange={(e) => setDurationByTicket(prev => ({ ...prev, [t.id]: Math.max(1, Math.min(480, Number(e.target.value) || 60)) }))}
                                className="w-20 px-2 py-1 border border-gray-300 rounded"
                              />
                              <span className="text-xs text-[#618986]">min</span>
                              <button
                                onClick={() => startDrying(t.id, durationByTicket[t.id] ?? 60)}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Démarrer
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-[#618986]">{lastCallByTicket[t.id] ? new Date(lastCallByTicket[t.id]).toLocaleString('fr-FR') : '—'}{((urgencyById[t.id]||0) >= 30) && <div className="text-red-700 text-xs font-semibold">Récupérez vos pièces</div>}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrint(t)}
                            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[#102220] dark:hover:bg-gray-700 text-[#111817] dark:text-gray-200"
                            title="Imprimer les étiquettes"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            title="Supprimer le dossier"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tabTickets.length === 0 && (
                  <tr>
                    <td colSpan={activeStatus === 'drying' ? 10 : 9} className="px-6 py-10 text-center text-[#618986]">Aucun ticket</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-4 md:hidden mt-4">
            {tabTickets.map(t => (
              <div key={t.id} className="bg-white dark:bg-[#182c2a] rounded-xl shadow-sm p-4 flex flex-col gap-4">
                <div className="flex justify-between items-center text-sm">
                  <p className="text-[#618986] dark:text-gray-400">{new Date(t.created_at).toLocaleDateString('fr-FR')} {new Date(t.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</p>
                  <button className="font-bold text-primary hover:underline" onClick={() => { setGalleryTicketId(t.id); setShowGallery(true); }}>#{t.repair_number ? t.repair_number : t.id.substring(0,8)}</button>
                </div>
                <div className="text-base">
                  <p className="font-medium text-[#111817] dark:text-white">{t.customer_name}</p>
                  <p className="text-[#618986] dark:text-gray-400">{t.customer_phone || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {deviceIconFor(t.device_brand)}
                  <div>
                    <p className="font-medium">{t.device_model} <span className="text-sm font-normal text-[#618986] dark:text-gray-400">({t.device_brand})</span></p>
                  </div>
                </div>
                <p className="text-sm text-[#618986] dark:text-gray-400 truncate">Panne: {t.issue_description || '—'}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <select
                    className="form-select flex-grow text-sm bg-gray-100 dark:bg-[#102220] border-none rounded-lg focus:ring-2 focus:ring-primary/50 h-11 min-w-[150px]"
                    value={t.status}
                    onChange={(e) => handleStatusChange(t.id, e.target.value)}
                  >
                    {displayedStatuses.map(s => (
                      <option key={s} value={s}>{STATUS_UI[s]?.label || s}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrint(t)}
                      className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[#102220] dark:hover:bg-gray-700 text-[#111817] dark:text-gray-200"
                    >
                      <Printer size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {tabTickets.length === 0 && (
              <div className="text-center text-[#618986]">Aucun ticket</div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 mt-3">
          <button
            onClick={() => loadTickets()}
            disabled={isLoading}
            className="flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {selectedTicket && (
        <RepairModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={() => { loadTickets(); }}
        />
      )}

      {showGallery && galleryTicketId && (
        <RepairMediaGallery
          ticketId={galleryTicketId}
          isOpen={showGallery}
          onClose={() => { setShowGallery(false); setGalleryTicketId(null); }}
        />
      )}

      {/* Pop-up fin de séchage */}
      {alertTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
            <h3 className="text-lg font-bold text-gray-900">Fin de séchage</h3>
            <p className="mt-2 text-sm text-gray-700">Ticket #{alertTicket.id.substring(0,8)} — Le séchage est terminé.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAlertTicket(null)} className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Fermer</button>
              <button onClick={() => ackDrying(alertTicket.id)} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">J’ai pris en compte</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
