/**
 * StatusColumns Component
 * Colonnes Kanban pour les différents statuts de réparation
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { RepairCard } from './RepairCard';

interface Ticket {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  issue_description: string;
  status: string;
  has_media: boolean;
  reserved_parts_count: number;
  to_order_parts_count: number;
  drying_end_time?: number;
}

interface StatusColumnsProps {
  status: string;
  label: string;
  count: number;
  tickets: Ticket[];
  color: string;
  onTicketClick: (ticket: Ticket) => void;
}

export function StatusColumns({ status, label, count, tickets, color, onTicketClick }: StatusColumnsProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  console.log('[StatusColumns] Rendering column:', status, 'with', tickets.length, 'tickets');

  return (
    <div className="flex-shrink-0 w-80 bg-gray-50 rounded-lg border border-gray-200">
      <div className={`${color} px-4 py-3 rounded-t-lg border-b border-gray-200`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <span className="px-2 py-1 bg-white/80 rounded-full text-sm font-bold text-gray-700">
            {count}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`p-4 min-h-[500px] max-h-[calc(100vh-280px)] overflow-y-auto space-y-3 transition-colors ${
          isOver ? 'bg-blue-50' : ''
        }`}
      >
        <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <RepairCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
            />
          ))}
        </SortableContext>

        {tickets.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucun ticket
          </div>
        )}
      </div>
    </div>
  );
}
