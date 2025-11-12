/**
 * Roadmap Widget for Dashboard
 * Compact view with 3 tabs: Day, Week, Month
 */

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { fetchRoadmapWeek, fetchMonth, saveEntries } from '../../lib/roadmapApi';
import type { RoadmapWeekData, RoadmapMonthData, RoadmapEntry } from '../../types/roadmap';

export const RoadmapWidget: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('day');
  const [weekData, setWeekData] = useState<RoadmapWeekData | null>(null);
  const [monthData, setMonthData] = useState<RoadmapMonthData | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('[RoadmapWidget] Rendering, activeTab:', activeTab);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    console.log('[RoadmapWidget] Loading data for tab:', activeTab);
    setLoading(true);
    try {
      const today = new Date();

      if (activeTab === 'day' || activeTab === 'week') {
        const monday = getMonday(today);
        const weekStart = monday.toISOString().split('T')[0];
        const data = await fetchRoadmapWeek(weekStart);
        console.log('[RoadmapWidget] Week data loaded:', data);
        setWeekData(data);
      } else {
        const data = await fetchMonth(today.getFullYear(), today.getMonth() + 1);
        console.log('[RoadmapWidget] Month data loaded:', data);
        setMonthData(data);
      }
    } catch (error) {
      console.error('[RoadmapWidget] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonday = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getTodayEntries = (): RoadmapEntry[] => {
    if (!weekData) return [];
    const today = new Date().toISOString().split('T')[0];
    const todayDay = weekData.days.find(d => d.date === today);
    return todayDay?.entries || [];
  };

  const toggleStatus = async (entry: RoadmapEntry) => {
    console.log('[RoadmapWidget] Toggling status for entry:', entry.id);
    const newStatus = entry.status === 'fait' ? 'todo' : 'fait';

    try {
      await saveEntries(weekData!.week_start, [{
        ...entry,
        status: newStatus,
      }]);
      await loadData();
    } catch (error) {
      console.error('[RoadmapWidget] Error updating status:', error);
    }
  };

  const goToRoadmap = () => {
    try {
      if ((window as any).__setCurrentPage) {
        (window as any).__setCurrentPage('roadmap');
        const u = new URL(window.location.href);
        u.searchParams.set('page', 'roadmap');
        window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
      } else {
        const u = new URL(window.location.href);
        u.searchParams.set('page', 'roadmap');
        window.location.assign(`${u.pathname}${u.search}${u.hash}`);
      }
    } catch {
      window.location.assign('/?page=roadmap');
    }
  };

  const handleQuickAdd = async () => {
    const title = window.prompt('Titre de la tâche');
    if (!title) return;
    try {
      const today = new Date();
      const monday = getMonday(today);
      const weekStart = monday.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      await saveEntries(weekStart, [{
        date: todayStr,
        title,
        start_time: null,
        end_time: null,
        status: 'todo',
        position: 0
      }]);

      await loadData();
    } catch (e) {
      console.error('[RoadmapWidget] Quick add failed:', e);
      alert('Erreur lors de la création de la tâche');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  const summary = weekData?.summary || { total: 0, done: 0, remaining: 0 };
  const todayEntries = getTodayEntries();

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Feuille de route</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickAdd}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Ajouter
            </button>
            <button
              onClick={goToRoadmap}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Voir tout →
            </button>
          </div>
        </div>

        {/* KPI Pills */}
        <div className="flex gap-3 flex-wrap">
          <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
            Total: {summary.total}
          </div>
          <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
            Fait: {summary.done}
          </div>
          <div className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium">
            Restant: {summary.remaining}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('day')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'day'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Jour
          </button>
          <button
            onClick={() => setActiveTab('week')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'week'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Semaine
          </button>
          <button
            onClick={() => setActiveTab('month')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'month'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Mois
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'day' && (
          <DayView entries={todayEntries} onToggle={toggleStatus} />
        )}
        {activeTab === 'week' && weekData && (
          <WeekView data={weekData} />
        )}
        {activeTab === 'month' && monthData && (
          <MonthView data={monthData} />
        )}
      </div>
    </div>
  );
};

/**
 * Day View: Mini Kanban with checkboxes
 */
const DayView: React.FC<{
  entries: RoadmapEntry[];
  onToggle: (entry: RoadmapEntry) => void;
}> = ({ entries, onToggle }) => {
  const columns = {
    todo: entries.filter(e => e.status === 'todo'),
    vu: entries.filter(e => e.status === 'vu'),
    fait: entries.filter(e => e.status === 'fait'),
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Column title="À faire" count={columns.todo.length} color="gray">
        {columns.todo.map(entry => (
          <TaskCard key={entry.id} entry={entry} onToggle={onToggle} />
        ))}
      </Column>
      <Column title="Vu" count={columns.vu.length} color="blue">
        {columns.vu.map(entry => (
          <TaskCard key={entry.id} entry={entry} onToggle={onToggle} />
        ))}
      </Column>
      <Column title="Fait" count={columns.fait.length} color="green">
        {columns.fait.map(entry => (
          <TaskCard key={entry.id} entry={entry} onToggle={onToggle} />
        ))}
      </Column>
    </div>
  );
};

const Column: React.FC<{
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}> = ({ title, count, color, children }) => {
  const colorClasses = {
    gray: 'bg-gray-50 border-gray-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
  };

  return (
    <div className={`rounded-lg border-2 ${colorClasses[color as keyof typeof colorClasses]} p-4`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {title} <span className="text-gray-500">({count})</span>
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
};

const TaskCard: React.FC<{
  entry: RoadmapEntry;
  onToggle: (entry: RoadmapEntry) => void;
}> = ({ entry, onToggle }) => {
  return (
    <div className="bg-white rounded p-3 shadow-sm border border-gray-200">
      <div className="flex items-start gap-2">
        <button
          onClick={() => onToggle(entry)}
          className="mt-0.5 flex-shrink-0"
        >
          {entry.status === 'fait' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {entry.start_time && (
            <div className="text-xs text-gray-500 mb-1">{entry.start_time}</div>
          )}
          <div className={`text-sm ${entry.status === 'fait' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {entry.title}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Week View: Heatmap + 3 next tasks per day
 */
const WeekView: React.FC<{ data: RoadmapWeekData }> = ({ data }) => {
  return (
    <div className="space-y-3">
      {data.days.filter(d => d.day_of_week <= 5).map(day => {
        const done = day.entries.filter(e => e.status === 'fait').length;
        const total = day.entries.length;
        const completion = total > 0 ? (done / total) * 100 : 0;

        return (
          <div key={day.date} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-900">{day.day_name}</div>
              <div className="text-sm text-gray-500">{done}/{total}</div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full mb-3">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="space-y-1">
              {day.entries.slice(0, 3).map(entry => (
                <div key={entry.id} className="text-sm text-gray-700 flex items-center gap-2">
                  {entry.start_time && (
                    <span className="text-xs text-gray-500">{entry.start_time}</span>
                  )}
                  <span className="truncate">{entry.title}</span>
                </div>
              ))}
              {day.entries.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{day.entries.length - 3} autres...
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Month View: Mini calendar with density dots
 */
const MonthView: React.FC<{ data: RoadmapMonthData }> = ({ data }) => {
  return (
    <div className="space-y-2">
      {/* Days header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {data.weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 gap-1">
          {week.days.map((day, dayIdx) => {
            const density = day.entry_count + day.event_count;
            const dotColor = density > 5 ? 'bg-red-500' : density > 2 ? 'bg-orange-500' : density > 0 ? 'bg-blue-500' : 'bg-gray-200';

            return (
              <div
                key={dayIdx}
                className={`aspect-square border rounded p-1 text-xs ${
                  day.is_current_month ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <div className={day.is_current_month ? 'text-gray-900' : 'text-gray-400'}>
                    {new Date(day.date).getDate()}
                  </div>
                  {density > 0 && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${dotColor}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
