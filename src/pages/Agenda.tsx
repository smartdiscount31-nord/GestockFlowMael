/**
 * Page Agenda - Module de gestion des tâches et rendez-vous
 * Affichage par Vue (Jour, Semaine, Mois)
 * Responsive : Vue Semaine sur desktop, Vue Jour sur mobile
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Filter, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AgendaEventCard } from '../components/Agenda/AgendaEventCard';
import { AgendaDrawer } from '../components/Agenda/AgendaDrawer';
import { AgendaFilters } from '../components/Agenda/AgendaFilters';

export type AgendaView = 'day' | 'week' | 'month';

export interface AgendaEvent {
  id: string;
  user_id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string | null;
  source: 'roadmap' | 'rdv';
  status: 'a_faire' | 'en_cours' | 'fait' | 'vu';
  important: boolean;
  project: string | null;
  custom_reminders: string[];
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export function Agenda() {
  console.log('[Agenda] Montage du composant');

  // États principaux
  const [view, setView] = useState<AgendaView>(() => {
    // Vue par défaut: Semaine sur desktop, Jour sur mobile
    const isMobile = window.innerWidth < 768;
    return isMobile ? 'day' : 'week';
  });

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // États de la modale/drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // États des filtres
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    source: 'all' as 'all' | 'roadmap' | 'rdv',
    status: 'all' as 'all' | 'a_faire' | 'en_cours' | 'fait' | 'vu',
    project: 'all' as string,
    search: ''
  });

  // Charger les événements depuis l'API
  const loadEvents = useCallback(async () => {
    console.log('[Agenda] Chargement des événements...');
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      // Calculer la plage de dates à charger (±30 jours autour de currentDate)
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 30);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log('[Agenda] Plage de dates:', startDateStr, 'à', endDateStr);

      // Construire l'URL avec les filtres
      const params = new URLSearchParams({
        start_date: startDateStr,
        end_date: endDateStr
      });

      if (filters.source !== 'all') {
        params.append('source', filters.source);
      }
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.project !== 'all') {
        params.append('project', filters.project);
      }
      if (filters.search.trim()) {
        params.append('search', filters.search.trim());
      }

      const url = `/.netlify/functions/agenda-events-list?${params.toString()}`;
      console.log('[Agenda] URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[Agenda] Réponse status:', response.status);
      console.log('[Agenda] Réponse headers:', Object.fromEntries(response.headers.entries()));

      // Lire le texte brut de la réponse avant de tenter de parser
      const responseText = await response.text();
      console.log('[Agenda] Réponse brute (100 premiers caractères):', responseText.substring(0, 100));

      if (!response.ok) {
        console.error('[Agenda] Erreur HTTP:', response.status, responseText);
        throw new Error(`Erreur ${response.status}: ${responseText.substring(0, 100)}`);
      }

      // Vérifier que la réponse n'est pas vide
      if (!responseText || responseText.trim() === '') {
        console.error('[Agenda] Réponse vide reçue');
        throw new Error('Réponse vide du serveur');
      }

      // Tenter de parser le JSON avec gestion d'erreur
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('[Agenda] JSON parsé avec succès:', result);
      } catch (parseError: any) {
        console.error('[Agenda] Erreur parsing JSON:', parseError);
        console.error('[Agenda] Contenu reçu:', responseText);
        throw new Error(`Réponse invalide du serveur (pas du JSON). Contenu: ${responseText.substring(0, 100)}`);
      }

      console.log('[Agenda] Événements chargés:', result.events?.length || 0);

      setEvents(result.events || []);

    } catch (err: any) {
      console.error('[Agenda] Erreur chargement:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [currentDate, filters]);

  // Charger les événements au montage et quand les filtres changent
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Recharger automatiquement toutes les 60 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[Agenda] Rechargement automatique');
      loadEvents();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadEvents]);

  // Handlers de navigation de dates
  const goToday = () => {
    console.log('[Agenda] Navigation vers aujourd\'hui');
    setCurrentDate(new Date());
  };

  const goBack = () => {
    console.log('[Agenda] Navigation précédente');
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goForward = () => {
    console.log('[Agenda] Navigation suivante');
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Handler de clic sur un événement
  const handleEventClick = (event: AgendaEvent) => {
    console.log('[Agenda] Clic sur événement:', event.id);
    setSelectedEvent(event);
    setIsCreating(false);
    setDrawerOpen(true);
  };

  // Handler d'ajout d'événement
  const handleAddEvent = () => {
    console.log('[Agenda] Ajout nouvel événement');
    setSelectedEvent(null);
    setIsCreating(true);
    setDrawerOpen(true);
  };

  // Handler de fermeture du drawer
  const handleCloseDrawer = () => {
    console.log('[Agenda] Fermeture drawer');
    setDrawerOpen(false);
    setSelectedEvent(null);
    setIsCreating(false);
  };

  // Handler de sauvegarde/modification d'événement
  const handleEventSaved = () => {
    console.log('[Agenda] Événement sauvegardé, rechargement...');
    loadEvents();
    handleCloseDrawer();
  };

  // Grouper les événements par date
  const eventsByDate = events.reduce((acc, event) => {
    const date = event.event_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, AgendaEvent[]>);

  // Tri des événements par heure
  Object.keys(eventsByDate).forEach(date => {
    eventsByDate[date].sort((a, b) => {
      const timeA = a.event_time || '00:00:00';
      const timeB = b.event_time || '00:00:00';
      return timeA.localeCompare(timeB);
    });
  });

  // Rendu selon la vue
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Titre et icône */}
            <div className="flex items-center gap-3">
              <Calendar size={28} className="text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            </div>

            {/* Boutons d'actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={goToday}
                className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Aujourd'hui
              </button>

              <button
                onClick={handleAddEvent}
                className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <Plus size={18} />
                Ajouter
              </button>

              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  filtersOpen
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter size={18} />
                Filtrer
              </button>
            </div>
          </div>

          {/* Filtres (si ouverts) */}
          {filtersOpen && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <AgendaFilters
                filters={filters}
                onFiltersChange={setFilters}
                events={events}
              />
            </div>
          )}

          {/* Navigation et sélecteur de vue */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Précédent"
              >
                <ChevronLeft size={20} />
              </button>

              <span className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                {view === 'day' && currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {view === 'week' && `Semaine du ${currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                {view === 'month' && currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>

              <button
                onClick={goForward}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Suivant"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Sélecteur de vue */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Jour
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semaine
              </button>
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mois
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Chargement...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
            <p className="font-medium">Erreur</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {view === 'week' && <WeekView currentDate={currentDate} eventsByDate={eventsByDate} onEventClick={handleEventClick} />}
            {view === 'day' && <DayView currentDate={currentDate} eventsByDate={eventsByDate} onEventClick={handleEventClick} />}
            {view === 'month' && <MonthView currentDate={currentDate} eventsByDate={eventsByDate} onEventClick={handleEventClick} />}
          </div>
        )}
      </main>

      {/* Drawer d'édition */}
      {drawerOpen && (
        <AgendaDrawer
          event={selectedEvent}
          isCreating={isCreating}
          onClose={handleCloseDrawer}
          onSave={handleEventSaved}
        />
      )}
    </div>
  );
}

// Composant Vue Semaine
function WeekView({ currentDate, eventsByDate, onEventClick }: {
  currentDate: Date;
  eventsByDate: Record<string, AgendaEvent[]>;
  onEventClick: (event: AgendaEvent) => void;
}) {
  console.log('[WeekView] Rendu');

  // Calculer les 7 jours de la semaine
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Lundi

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(day.getDate() + i);
    return day;
  });

  return (
    <div className="grid grid-cols-7 divide-x divide-gray-200">
      {weekDays.map((day, index) => {
        const dateStr = day.toISOString().split('T')[0];
        const dayEvents = eventsByDate[dateStr] || [];
        const isToday = dateStr === new Date().toISOString().split('T')[0];

        return (
          <div key={index} className="min-h-[400px]">
            {/* Header du jour */}
            <div className={`p-3 border-b border-gray-200 text-center ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <div className="text-xs font-medium text-gray-500 uppercase">
                {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                {day.getDate()}
              </div>
            </div>

            {/* Événements du jour */}
            <div className="p-2 space-y-2">
              {dayEvents.map(event => (
                <AgendaEventCard
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                  compact={true}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Composant Vue Jour
function DayView({ currentDate, eventsByDate, onEventClick }: {
  currentDate: Date;
  eventsByDate: Record<string, AgendaEvent[]>;
  onEventClick: (event: AgendaEvent) => void;
}) {
  console.log('[DayView] Rendu');

  const dateStr = currentDate.toISOString().split('T')[0];
  const dayEvents = eventsByDate[dateStr] || [];

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </h2>

      {dayEvents.length === 0 && (
        <p className="text-gray-500 text-center py-12">Aucun événement aujourd'hui</p>
      )}

      <div className="space-y-3">
        {dayEvents.map(event => (
          <AgendaEventCard
            key={event.id}
            event={event}
            onClick={() => onEventClick(event)}
            compact={false}
          />
        ))}
      </div>
    </div>
  );
}

// Composant Vue Mois
function MonthView({ currentDate, eventsByDate, onEventClick }: {
  currentDate: Date;
  eventsByDate: Record<string, AgendaEvent[]>;
  onEventClick: (event: AgendaEvent) => void;
}) {
  console.log('[MonthView] Rendu');

  // Calculer le premier et dernier jour du mois
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Ajuster pour commencer un lundi
  const startDay = new Date(firstDay);
  startDay.setDate(startDay.getDate() - (startDay.getDay() || 7) + 1);

  // Créer une grille de 6 semaines
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(startDay);
    day.setDate(day.getDate() + i);
    days.push(day);
  }

  return (
    <div>
      {/* En-têtes des jours */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-medium text-gray-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-200">
        {days.map((day, index) => {
          const dateStr = day.toISOString().split('T')[0];
          const dayEvents = eventsByDate[dateStr] || [];
          const isCurrentMonth = day.getMonth() === month;
          const isToday = dateStr === new Date().toISOString().split('T')[0];

          return (
            <div key={index} className="min-h-[100px] p-2">
              <div className={`text-sm font-medium mb-1 ${
                isToday ? 'text-blue-600 font-bold' :
                isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="w-full text-left text-xs px-1 py-0.5 rounded truncate hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor:
                        event.status === 'fait' ? '#10b981' :
                        event.status === 'en_cours' ? '#f59e0b' :
                        event.status === 'vu' ? '#3b82f6' : '#6b7280',
                      color: 'white'
                    }}
                  >
                    {event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 pl-1">+{dayEvents.length - 3} autre(s)</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
