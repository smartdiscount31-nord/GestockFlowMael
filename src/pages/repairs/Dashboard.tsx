/**
 * Workshop Dashboard Page
 * Tableau de bord Atelier avec colonnes Kanban, drag & drop, recherche et rappels
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCorners } from '@dnd-kit/core';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';
import { StatusColumns } from '../../components/repairs/StatusColumns';
import { RepairCard } from '../../components/repairs/RepairCard';
import { RepairModal } from '../../components/repairs/RepairModal';
import { SearchBarWorkshop } from '../../components/repairs/SearchBarWorkshop';
import { Toast } from '../../components/Notifications/Toast';
import { supabase } from '../../lib/supabase';

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

interface StatusCount {
  status: string;
  count: number;
}

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [dryingTimers, setDryingTimers] = useState<Record<string, number>>({});

  console.log('[Dashboard] Component mounted');

  const statusConfigs = [
    { value: 'quote_todo', label: 'Devis à faire', color: 'bg-purple-50' },
    { value: 'parts_to_order', label: 'Pièces à commander', color: 'bg-orange-50' },
    { value: 'waiting_parts', label: 'Attente pièces', color: 'bg-yellow-50' },
    { value: 'to_repair', label: 'À réparer', color: 'bg-blue-50' },
    { value: 'in_repair', label: 'En réparation', color: 'bg-indigo-50' },
    { value: 'drying', label: 'Séchage', color: 'bg-cyan-50' },
    { value: 'ready_to_return', label: 'Prêt à rendre', color: 'bg-green-50' },
    { value: 'awaiting_customer', label: 'Attente client', color: 'bg-pink-50' },
    { value: 'delivered', label: 'Livré', color: 'bg-emerald-50' },
    { value: 'archived', label: 'Archivé', color: 'bg-gray-50' },
  ];

  const loadCounts = useCallback(async () => {
    console.log('[Dashboard] Loading status counts via RPC');
    try {
      const { data, error } = await supabase.rpc('fn_repair_counts');

      if (error) {
        console.error('[Dashboard] Error loading counts:', error);
        return;
      }

      console.log('[Dashboard] Counts loaded:', data);
      setStatusCounts(data || []);
    } catch (error) {
      console.error('[Dashboard] Exception loading counts:', error);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    console.log('[Dashboard] Loading tickets');
    setIsLoading(true);

    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('repair_tickets')
        .select(`
          *,
          customer:customers(name, phone)
        `)
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('[Dashboard] Error loading tickets:', ticketsError);
        setIsLoading(false);
        return;
      }

      console.log('[Dashboard] Tickets loaded:', ticketsData?.length);

      const { data: mediaData } = await supabase
        .from('repair_media')
        .select('repair_id');

      const { data: partsData } = await supabase
        .from('repair_items')
        .select('repair_id, reserved');

      const mediaByTicket = (mediaData || []).reduce((acc: Record<string, number>, m: any) => {
        acc[m.repair_id] = (acc[m.repair_id] || 0) + 1;
        return acc;
      }, {});

      const partsByTicket = (partsData || []).reduce((acc: Record<string, { reserved: number; toOrder: number }>, p: any) => {
        if (!acc[p.repair_id]) {
          acc[p.repair_id] = { reserved: 0, toOrder: 0 };
        }
        if (p.reserved) {
          acc[p.repair_id].reserved++;
        } else {
          acc[p.repair_id].toOrder++;
        }
        return acc;
      }, {});

      const enrichedTickets: Ticket[] = (ticketsData || []).map((t: any) => ({
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
        drying_end_time: dryingTimers[t.id],
      }));

      console.log('[Dashboard] Enriched tickets:', enrichedTickets.length);
      setTickets(enrichedTickets);
      setFilteredTickets(enrichedTickets);
    } catch (error) {
      console.error('[Dashboard] Exception loading tickets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dryingTimers]);

  const handleSearch = useCallback((query: string) => {
    console.log('[Dashboard] Search query:', query);
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredTickets(tickets);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = tickets.filter((t) => {
      return (
        t.customer_name.toLowerCase().includes(lowerQuery) ||
        t.customer_phone.includes(query) ||
        t.id.toLowerCase().includes(lowerQuery) ||
        t.device_brand.toLowerCase().includes(lowerQuery) ||
        t.device_model.toLowerCase().includes(lowerQuery)
      );
    });

    console.log('[Dashboard] Filtered tickets:', filtered.length);
    setFilteredTickets(filtered);
  }, [tickets]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveTicket(null);
      return;
    }

    const ticketId = active.id as string;
    const newStatus = over.id as string;

    console.log('[Dashboard] Drag ended:', ticketId, 'to', newStatus);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');

      const response = await fetch('/.netlify/functions/repairs-status-update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repair_id: ticketId,
          new_status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erreur lors du changement de statut');
      }

      console.log('[Dashboard] Status changed successfully');

      if (newStatus === 'drying') {
        const dryingEndTime = Date.now() + 60 * 60 * 1000;
        setDryingTimers(prev => ({ ...prev, [ticketId]: dryingEndTime }));
        setTimeout(() => {
          setToast({ message: `Fin de séchage pour le ticket #${ticketId.substring(0, 8)}`, type: 'info' });
        }, 60 * 60 * 1000);
      }

      setToast({ message: 'Statut mis à jour avec succès', type: 'success' });
      await loadTickets();
      await loadCounts();
    } catch (error: any) {
      console.error('[Dashboard] Error changing status:', error);
      setToast({ message: error.message, type: 'error' });
    } finally {
      setActiveTicket(null);
    }
  };

  const handleRefresh = () => {
    console.log('[Dashboard] Manual refresh triggered');
    loadTickets();
    loadCounts();
  };

  useEffect(() => {
    console.log('[Dashboard] Initial load');
    loadCounts();
    loadTickets();

    const interval = setInterval(() => {
      console.log('[Dashboard] Auto-refresh (30s)');
      loadCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadCounts, loadTickets]);

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, tickets, handleSearch]);

  const getTicketsByStatus = (status: string) => {
    return filteredTickets.filter(t => t.status === status);
  };

  const getStatusCount = (status: string) => {
    return statusCounts.find(c => c.status === status)?.count || 0;
  };

  const totalCount = filteredTickets.filter(t => t.status !== 'archived').length;

  const displayedStatuses = showArchived
    ? statusConfigs
    : statusConfigs.filter(s => s.value !== 'archived');

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Atelier</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showArchived ? (
                  <>
                    <EyeOff size={18} />
                    <span>Masquer archivés</span>
                  </>
                ) : (
                  <>
                    <Eye size={18} />
                    <span>Afficher archivés</span>
                  </>
                )}
              </button>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                <span>Actualiser</span>
              </button>
            </div>
          </div>

          <SearchBarWorkshop
            onSearch={handleSearch}
            totalCount={totalCount}
          />
        </div>

        {isLoading && tickets.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Chargement des tickets...</p>
            </div>
          </div>
        ) : (
          <DndContext
            collisionDetection={closestCorners}
            onDragStart={(event) => setActiveTicket(event.active.id as string)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {displayedStatuses.map((status) => (
                <StatusColumns
                  key={status.value}
                  status={status.value}
                  label={status.label}
                  count={getStatusCount(status.value)}
                  tickets={getTicketsByStatus(status.value)}
                  color={status.color}
                  onTicketClick={(ticket) => setSelectedTicket(ticket)}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTicket && (
                <div className="opacity-60">
                  <RepairCard
                    ticket={filteredTickets.find(t => t.id === activeTicket)!}
                    onClick={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {selectedTicket && (
        <RepairModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={() => {
            loadTickets();
            loadCounts();
          }}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
