/**
 * AgendaEventCard - Carte d'affichage d'un événement
 * Affiche la pastille de statut, le tag source, et le titre
 */

import React from 'react';
import { Calendar as CalendarIcon, Flag } from 'lucide-react';
import type { AgendaEvent } from '../../pages/Agenda';

interface AgendaEventCardProps {
  event: AgendaEvent;
  onClick: () => void;
  compact?: boolean;
}

export function AgendaEventCard({ event, onClick, compact = false }: AgendaEventCardProps) {
  console.log('[AgendaEventCard] Rendu événement:', event.id);

  // Couleurs selon le statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'a_faire':
        return 'bg-gray-400';
      case 'en_cours':
        return 'bg-orange-500';
      case 'fait':
        return 'bg-green-500';
      case 'vu':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  // Label du statut
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'a_faire':
        return 'À faire';
      case 'en_cours':
        return 'En cours';
      case 'fait':
        return 'Fait';
      case 'vu':
        return 'Vu';
      default:
        return status;
    }
  };

  // Icon et label du source
  const getSourceInfo = (source: string) => {
    if (source === 'rdv') {
      return { icon: '📅', label: 'RDV' };
    }
    return { icon: '📌', label: 'Roadmap' };
  };

  const statusColor = getStatusColor(event.status);
  const statusLabel = getStatusLabel(event.status);
  const sourceInfo = getSourceInfo(event.source);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-md border transition-all hover:shadow-md hover:scale-[1.02] ${
        compact ? 'p-2' : 'p-3'
      } ${
        event.important ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
      }`}
      aria-label={`Événement: ${event.title}`}
    >
      {/* Header avec pastille de statut et tag source */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {/* Pastille de statut */}
          <div
            className={`w-2 h-2 rounded-full ${statusColor}`}
            title={statusLabel}
            aria-label={`Statut: ${statusLabel}`}
          ></div>

          {/* Tag source */}
          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
            {sourceInfo.icon} {sourceInfo.label}
          </span>

          {/* Indicateur important */}
          {event.important && (
            <Flag size={14} className="text-red-500" title="Important" />
          )}
        </div>

        {/* Heure */}
        {event.event_time && (
          <span className="text-xs text-gray-500 font-mono">
            {event.event_time.substring(0, 5)}
          </span>
        )}
      </div>

      {/* Titre */}
      <div className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'} ${compact ? 'line-clamp-2' : 'line-clamp-1'}`}>
        {event.title}
      </div>

      {/* Projet (si présent et pas compact) */}
      {!compact && event.project && (
        <div className="mt-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon size={12} />
            {event.project}
          </span>
        </div>
      )}

      {/* Description (si pas compact et présente) */}
      {!compact && event.description && (
        <div className="mt-1 text-xs text-gray-600 line-clamp-2">
          {event.description}
        </div>
      )}
    </button>
  );
}
