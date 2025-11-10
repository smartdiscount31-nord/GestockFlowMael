/**
 * RepairCard Component
 * Carte synthèse d'un ticket de réparation pour le tableau Kanban
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Phone, Wrench, Package, Camera, AlertCircle } from 'lucide-react';

interface RepairCardProps {
  ticket: {
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
  };
  onClick: () => void;
}

export function RepairCard({ ticket, onClick }: RepairCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  console.log('[RepairCard] Rendering ticket:', ticket.id.substring(0, 8));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      quote_todo: 'Devis à faire',
      parts_to_order: 'Pièces à commander',
      waiting_parts: 'Attente pièces',
      to_repair: 'À réparer',
      in_repair: 'En réparation',
      drying: 'Séchage',
      ready_to_return: 'Prêt à rendre',
      awaiting_customer: 'Attente client',
      delivered: 'Livré',
      archived: 'Archivé',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      quote_todo: 'bg-purple-100 text-purple-800',
      parts_to_order: 'bg-orange-100 text-orange-800',
      waiting_parts: 'bg-yellow-100 text-yellow-800',
      to_repair: 'bg-blue-100 text-blue-800',
      in_repair: 'bg-indigo-100 text-indigo-800',
      drying: 'bg-cyan-100 text-cyan-800',
      ready_to_return: 'bg-green-100 text-green-800',
      awaiting_customer: 'bg-pink-100 text-pink-800',
      delivered: 'bg-emerald-100 text-emerald-800',
      archived: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const isDryingExpired = ticket.status === 'drying' && ticket.drying_end_time && Date.now() > ticket.drying_end_time;

  const getRemainingDryingTime = () => {
    if (ticket.status !== 'drying' || !ticket.drying_end_time) return null;
    const remaining = ticket.drying_end_time - Date.now();
    if (remaining <= 0) return 'Terminé';
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-gray-500" />
            <span className="text-xs text-gray-600">{formatDate(ticket.created_at)} {formatTime(ticket.created_at)}</span>
          </div>
          <p className="text-xs font-mono text-gray-500">#{ticket.id.substring(0, 8)}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
          {getStatusLabel(ticket.status)}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <p className="font-semibold text-gray-900">{ticket.customer_name}</p>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Phone size={12} />
            <span>{ticket.customer_phone}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 text-sm font-medium text-gray-800">
            <Wrench size={14} />
            <span>{ticket.device_brand} {ticket.device_model}</span>
          </div>
          <p className="text-xs text-gray-600 line-clamp-2 mt-1">{ticket.issue_description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {ticket.reserved_parts_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
              <Package size={12} />
              {ticket.reserved_parts_count} réservée{ticket.reserved_parts_count > 1 ? 's' : ''}
            </span>
          )}
          {ticket.to_order_parts_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
              <AlertCircle size={12} />
              {ticket.to_order_parts_count} à commander
            </span>
          )}
        </div>
        {ticket.has_media && (
          <Camera size={16} className="text-gray-400" />
        )}
      </div>

      {ticket.status === 'drying' && (
        <div className={`mt-3 pt-3 border-t border-gray-100 ${isDryingExpired ? 'bg-red-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Séchage:</span>
            <span className={`text-sm font-bold ${isDryingExpired ? 'text-red-600' : 'text-blue-600'}`}>
              {getRemainingDryingTime()}
            </span>
          </div>
          {isDryingExpired && (
            <div className="flex items-center gap-1 mt-2 text-xs font-medium text-red-600">
              <AlertCircle size={14} />
              <span>Fin de séchage</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
