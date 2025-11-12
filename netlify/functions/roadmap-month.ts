/**
 * Roadmap Month Function
 * GET: Fetch month calendar data with events and entry density
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get first day of month
 */
function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Get last day of month
 */
function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

/**
 * Get Monday of the week containing the given date
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
}

const handler: Handler = async (event: HandlerEvent) => {
  console.log('[roadmap-month] Request:', event.queryStringParameters);

  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[roadmap-month] Auth error:', authError);
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const userId = user.id;

    const year = parseInt(event.queryStringParameters?.year || '');
    const month = parseInt(event.queryStringParameters?.month || '');

    if (!year || !month || month < 1 || month > 12) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid year or month' }) };
    }

    console.log('[roadmap-month] User:', userId, 'Year:', year, 'Month:', month);

    // Calculate calendar range (6 weeks starting from Monday before month start)
    const firstDay = getFirstDayOfMonth(year, month);
    const lastDay = getLastDayOfMonth(year, month);
    const calendarStart = getMonday(firstDay);

    // Generate 6 weeks (42 days)
    const weeks: any[] = [];
    let currentDate = new Date(calendarStart);

    for (let week = 0; week < 6; week++) {
      const days: any[] = [];

      for (let day = 0; day < 7; day++) {
        const dateStr = formatDate(currentDate);
        const isCurrentMonth =
          currentDate.getUTCFullYear() === year &&
          currentDate.getUTCMonth() === month - 1;

        days.push({
          date: dateStr,
          is_current_month: isCurrentMonth,
          entry_count: 0,
          event_count: 0,
          entries: [],
          events: [],
        });

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      weeks.push({ days });
    }

    const rangeStart = formatDate(calendarStart);
    const rangeEnd = formatDate(new Date(currentDate.getTime() - 86400000)); // subtract 1 day

    console.log('[roadmap-month] Calendar range:', rangeStart, 'to', rangeEnd);

    // Fetch entries in range
    const { data: entries, error: entriesError } = await supabase
      .from('roadmap_entries')
      .select('id, date, title, start_time, status')
      .eq('user_id', userId)
      .gte('date', rangeStart)
      .lte('date', rangeEnd)
      .order('start_time', { ascending: true });

    if (entriesError) {
      console.error('[roadmap-month] Error fetching entries:', entriesError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch entries' }) };
    }

    console.log('[roadmap-month] Found entries:', entries?.length || 0);

    // Fetch events in range
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, date, title, start_time')
      .eq('user_id', userId)
      .gte('date', rangeStart)
      .lte('date', rangeEnd)
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('[roadmap-month] Error fetching events:', eventsError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch events' }) };
    }

    console.log('[roadmap-month] Found events:', events?.length || 0);

    // Populate days with data
    for (const week of weeks) {
      for (const day of week.days) {
        // Add entries (limited to 3 for tooltip)
        const dayEntries = (entries || [])
          .filter((e: any) => e.date === day.date)
          .slice(0, 3);

        day.entries = dayEntries.map((e: any) => ({
          id: e.id,
          title: e.title,
          time: e.start_time,
          status: e.status,
        }));
        day.entry_count = dayEntries.length;

        // Add events (limited to 3 for tooltip)
        const dayEvents = (events || [])
          .filter((e: any) => e.date === day.date)
          .slice(0, 3);

        day.events = dayEvents.map((e: any) => ({
          id: e.id,
          title: e.title,
          time: e.start_time,
        }));
        day.event_count = dayEvents.length;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        year,
        month,
        weeks,
      }),
    };
  } catch (error: any) {
    console.error('[roadmap-month] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

export { handler };
