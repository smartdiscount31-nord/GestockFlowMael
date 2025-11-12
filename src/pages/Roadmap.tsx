/**
 * Roadmap Main Page
 * Weekly task management with Kanban and Calendar views
 */

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, LayoutGrid, ChevronLeft, ChevronRight, Plus, Bell } from 'lucide-react';
import { fetchRoadmapWeek, fetchMonth, saveEntries, fetchNotifications } from '../lib/roadmapApi';
import type { RoadmapWeekData, RoadmapMonthData, RoadmapEntry, RoadmapNotification } from '../types/roadmap';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ViewMode = 'kanban' | 'calendar';

export default function Roadmap() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [weekStart, setWeekStart] = useState<string>(getMonday(new Date()).toISOString().split('T')[0]);
  const [weekData, setWeekData] = useState<RoadmapWeekData | null>(null);
  const [monthData, setMonthData] = useState<RoadmapMonthData | null>(null);
  const [notifications, setNotifications] = useState<RoadmapNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  console.log('[Roadmap] Rendering, viewMode:', viewMode, 'weekStart:', weekStart);

  useEffect(() => {
    loadData();
    loadNotifications();
  }, [weekStart, viewMode]);

  const loadData = async () => {
    console.log('[Roadmap] Loading data');
    setLoading(true);
    try {
      if (viewMode === 'kanban') {
        const data = await fetchRoadmapWeek(weekStart);
        console.log('[Roadmap] Week data loaded:', data);
        setWeekData(data);
      } else {
        const date = new Date(weekStart);
        const data = await fetchMonth(date.getFullYear(), date.getMonth() + 1);
        console.log('[Roadmap] Month data loaded:', data);
        setMonthData(data);
      }
    } catch (error) {
      console.error('[Roadmap] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await fetchNotifications();
      console.log('[Roadmap] Notifications loaded:', data.length);
      setNotifications(data);
    } catch (error) {
      console.error('[Roadmap] Error loading notifications:', error);
    }
  };

  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  const previousWeek = () => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() - 7);
    setWeekStart(date.toISOString().split('T')[0]);
  };

  const nextWeek = () => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + 7);
    setWeekStart(date.toISOString().split('T')[0]);
  };

  const thisWeek = () => {
    setWeekStart(getMonday(new Date()).toISOString().split('T')[0]);
  };

  // Quick add minimal: prompt for a title, create entry for today if in current week, else Monday (weekStart)
  const addQuickEntry = async () => {
    try {
      const title = window.prompt('Titre de la tâche');
      if (!title) return;

      const monday = new Date(weekStart);
      const friday = new Date(monday);
      friday.setDate(friday.getDate() + 4);

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Check if today is within current Mon-Fri range
      const inRange =
        today >= new Date(monday.toDateString()) &&
        today <= new Date(friday.toDateString());

      const dateStr = inRange ? todayStr : weekStart;

      await saveEntries(weekStart, [{
        date: dateStr,
        title,
        start_time: null,
        end_time: null,
        status: 'todo',
        position: 0
      }]);

      await loadData();
    } catch (e) {
      console.error('[Roadmap] Quick add error:', e);
      alert('Erreur lors de la création de la tâche');
    }
  };

  if (
    loading ||
    (viewMode === 'kanban' && !weekData) ||
    (viewMode === 'calendar' && !monthData)
  ) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Feuille de route</h1>
            <p className="text-gray-600">Planifiez et suivez vos tâches hebdomadaires</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = '/#roadmap/notifications'}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
            <button
              onClick={addQuickEntry}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendrier</span>
            </button>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={previousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={thisWeek}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Aujourd'hui
            </button>
            <div className="text-sm font-medium text-gray-900">
              {new Date(weekData?.week_start || weekStart).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <KanbanView data={weekData as RoadmapWeekData} onUpdate={loadData} />
      ) : (
        <CalendarView data={monthData} />
      )}
    </div>
  );
}

/**
 * Kanban View Component
 */
const KanbanView: React.FC<{
  data: RoadmapWeekData;
  onUpdate: () => void;
}> = ({ data, onUpdate }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('[Kanban] Drag end:', event);
    // TODO: Implement drag & drop logic
    await onUpdate();
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {data.days.filter(d => d.day_of_week <= 5).map(day => (
          <DayColumn key={day.date} day={day} onUpdate={onUpdate} />
        ))}
      </div>
    </DndContext>
  );
};

const DayColumn: React.FC<{
  day: any;
  onUpdate: () => void;
}> = ({ day, onUpdate }) => {
  const isToday = day.date === new Date().toISOString().split('T')[0];

  return (
    <div className={`rounded-lg border-2 ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'} p-4`}>
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">{day.day_name}</h3>
        <p className="text-xs text-gray-500">
          {new Date(day.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <SortableContext items={day.entries.map((e: RoadmapEntry) => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {day.entries.map((entry: RoadmapEntry) => (
            <TaskCard key={entry.id} entry={entry} onUpdate={onUpdate} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

const TaskCard: React.FC<{
  entry: RoadmapEntry;
  onUpdate: () => void;
}> = ({ entry, onUpdate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusColors = {
    todo: 'bg-white border-gray-300',
    vu: 'bg-blue-50 border-blue-300',
    fait: 'bg-green-50 border-green-300',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg border-2 ${statusColors[entry.status]} cursor-move shadow-sm hover:shadow-md transition-shadow`}
    >
      {entry.start_time && (
        <div className="text-xs text-gray-500 mb-1">{entry.start_time}</div>
      )}
      <div className="text-sm font-medium text-gray-900">{entry.title}</div>
      {entry.origin === 'template' && (
        <div className="mt-2">
          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">Hebdo</span>
        </div>
      )}
    </div>
  );
};

/**
 * Calendar View Component
 */
const CalendarView: React.FC<{ data: RoadmapMonthData | null }> = ({ data }) => {
  if (!data) {
    return <div className="text-center py-12 text-gray-500">Aucune donnée</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {data.weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-2 mb-2">
            {week.days.map((day, dayIdx) => {
              const density = day.entry_count + day.event_count;

              return (
                <div
                  key={dayIdx}
                  className={`min-h-24 p-2 border rounded-lg ${
                    day.is_current_month
                      ? 'bg-white border-gray-200 hover:border-blue-400 cursor-pointer'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className={`text-sm font-medium ${day.is_current_month ? 'text-gray-900' : 'text-gray-400'}`}>
                    {new Date(day.date).getDate()}
                  </div>
                  {density > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {density} tâche{density > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
