/**
 * AgendaFilters - Composant de filtrage des événements
 * Filtre par source, statut, projet, et recherche textuelle
 */

import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import type { AgendaEvent } from '../../pages/Agenda';

interface AgendaFiltersProps {
  filters: {
    source: 'all' | 'roadmap' | 'rdv';
    status: 'all' | 'a_faire' | 'en_cours' | 'fait' | 'vu';
    project: string;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
  events: AgendaEvent[];
}

export function AgendaFilters({ filters, onFiltersChange, events }: AgendaFiltersProps) {
  console.log('[AgendaFilters] Rendu avec filtres:', filters);

  // Extraire les projets uniques des événements
  const projects = useMemo(() => {
    const projectSet = new Set<string>();
    events.forEach(event => {
      if (event.project) {
        projectSet.add(event.project);
      }
    });
    return Array.from(projectSet).sort();
  }, [events]);

  console.log('[AgendaFilters] Projets détectés:', projects);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Filtre source */}
      <div>
        <label htmlFor="filter-source" className="block text-sm font-medium text-gray-700 mb-1">
          Type
        </label>
        <select
          id="filter-source"
          value={filters.source}
          onChange={(e) => onFiltersChange({ ...filters, source: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Tous</option>
          <option value="roadmap">📌 Roadmap</option>
          <option value="rdv">📅 Rendez-vous</option>
        </select>
      </div>

      {/* Filtre statut */}
      <div>
        <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700 mb-1">
          Statut
        </label>
        <select
          id="filter-status"
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Tous</option>
          <option value="a_faire">À faire</option>
          <option value="en_cours">En cours</option>
          <option value="fait">Fait</option>
          <option value="vu">Vu</option>
        </select>
      </div>

      {/* Filtre projet */}
      <div>
        <label htmlFor="filter-project" className="block text-sm font-medium text-gray-700 mb-1">
          Projet
        </label>
        <select
          id="filter-project"
          value={filters.project}
          onChange={(e) => onFiltersChange({ ...filters, project: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={projects.length === 0}
        >
          <option value="all">Tous les projets</option>
          {projects.map(project => (
            <option key={project} value={project}>
              {project}
            </option>
          ))}
        </select>
        {projects.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">Aucun projet défini</p>
        )}
      </div>

      {/* Recherche textuelle */}
      <div>
        <label htmlFor="filter-search" className="block text-sm font-medium text-gray-700 mb-1">
          Recherche
        </label>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            id="filter-search"
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Titre ou description..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
