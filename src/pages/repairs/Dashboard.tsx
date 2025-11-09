/**
 * Workshop Dashboard Page (List view only, counters fixed, instant refresh)
 * - Header with title, total, and "Ajouter un ticket"
 * - Sticky status tabs with counts and animated underline (counters computed reliably)
 * - Filters row with search + quick chips (UI-ready)
 * - Desktop table + Mobile cards
 * - Kanban view removed as requested
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Archive, Search, User as UserIcon, CalendarDays, CalendarRange, Smartphone, Laptop, Tablet } from 'lucide-react';
import { RepairModal } from '../../components/repairs/RepairModal';
import { Toast } from '../../components/Notifications/Toast';
import { supabase } from '../../lib/supabase';
import useNavigate from '../../hooks/useNavigate';

interface Ticket {
  id: string;
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
  has_media: boolean;
  reserved_parts_count: number;
  to_order_parts_count: number;
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
  awaiting_customer:{ label: 'Attente client',      tabColor: 'text-rose-600',   badgeBg: 'bg-rose-100 dark:bg-rose-900/50',     badgeText: 'text-rose-800 dark:text-rose-300' },
  delivered:        { label: 'Livré',               tabColor: 'text-gray-600',   badgeBg: 'bg-gray-200 dark:bg-gray-700/50',     badgeText: 'text-gray-800 dark:text-gray-300' },
  archived:         { label: 'Archivé',             tabColor: 'text-gray-600',   badgeBg: 'bg-gray-200 dark:bg-gray-700/50',     badgeText: 'text-gray-800 dark:text-gray-300' },
};

const ALL_STATUSES = [
  'quote_todo','parts_to_order','waiting_parts','to_repair','in_repair','drying','ready_to_return','awaiting_customer','delivered','archived'
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

  const [activeStatus, setActiveStatus] = useState<string>('to_repair');

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
        has_media: (mediaByTicket[t.id] || 0) > 0,
        reserved_parts_count: partsByTicket[t.id]?.reserved || 0,
        to_order_parts_count: partsByTicket[t.id]?.toOrder || 0,
        drying_end_time: undefined,
      }));

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
    if (!query.trim()) { setFilteredTickets(tickets); return; }
    const q = query.toLowerCase();
    setFilteredTickets(tickets.filter(t =>
      t.customer_name.toLowerCase().includes(q) ||
      t.customer_phone.includes(query) ||
      t.id.toLowerCase().includes(q) ||
      t.device_brand.toLowerCase().includes(q) ||
      t.device_model.toLowerCase().includes(q)
    ));
  }, [tickets]);

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
  useEffect(() => { handleSearch(searchQuery); }, [searchQuery, tickets, handleSearch]);

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

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-[#111817] dark:text-gray-200">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h1 className="text-[#111817] dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.03em] w-full md:w-auto">
            Tickets de Réparation
          </h1>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <p className="text-sm text-[#618986] dark:text-gray-400 font-medium hidden md:block">{totalCount} tickets</p>
            <button
              onClick={() => navigateToProduct('atelier-prise-en-charge')}
              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-primary text-[#111817] text-base font-bold tracking-[0.015em] hover:opacity-90 flex-grow md:flex-grow-0"
            >
              Ajouter un ticket
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
              <button className="flex h-12 items-center gap-x-2 rounded-xl bg-white dark:bg-[#182c2a] px-4 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm text-[#111817] dark:text-gray-300">
                <UserIcon size={16} /> Moi (assigné)
              </button>
              <button className="flex h-12 items-center gap-x-2 rounded-xl bg-white dark:bg-[#182c2a] px-4 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm text-[#111817] dark:text-gray-300">
                <CalendarDays size={16} /> Aujourd'hui
              </button>
              <button className="flex h-12 items-center gap-x-2 rounded-xl bg-white dark:bg-[#182c2a] px-4 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm text-[#111817] dark:text-gray-300">
                <CalendarRange size={16} /> Cette semaine
              </button>
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
                  <th className="px-6 py-4">Chrono</th>
                  <th className="px-6 py-4">Rappel client</th>
                </tr>
              </thead>
              <tbody>
                {tabTickets.map((t) => {
                  const date = new Date(t.created_at);
                  const created = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                  return (
                    <tr key={t.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#102220]">
                      <td className="px-6 py-4 whitespace-nowrap">{created}</td>
                      <td className="px-6 py-4">
                        <button className="font-medium text-primary hover:underline" onClick={() => setSelectedTicket(t)}>#{t.id.substring(0,8)}</button>
                        <p className="text-xs text-[#618986]">Ouvrir la prise en charge</p>
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
                      <td className="px-6 py-4 text-[#618986]">—</td>
                      <td className="px-6 py-4 text-[#618986]">—</td>
                    </tr>
                  );
                })}
                {tabTickets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-[#618986]">Aucun ticket</td>
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
                  <button className="font-bold text-primary hover:underline" onClick={() => setSelectedTicket(t)}>#{t.id.substring(0,8)}</button>
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

      {toast && (
        <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
