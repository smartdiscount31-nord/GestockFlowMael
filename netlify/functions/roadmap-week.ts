/**
 * Roadmap Week Function
 * GET: Fetch week data (merged templates + entries)
 * POST: Batch save/update entries
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Entry {
  id?: string;
  date: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  status?: 'todo' | 'vu' | 'fait';
  position?: number;
  template_id?: string | null;
}

/**
 * Get Monday of the week for a given date
 */
function getMonday(dateStr: string): Date {
  const date = new Date(dateStr + 'T00:00:00Z');
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get day of week name in French
 */
function getDayName(dayOfWeek: number): string {
  const names = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return names[dayOfWeek];
}

const handler: Handler = async (event: HandlerEvent) => {
  console.log('[roadmap-week] Request:', event.httpMethod, event.queryStringParameters);

  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[roadmap-week] Auth error:', authError);
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const userId = user.id;
    console.log('[roadmap-week] User:', userId);

    if (event.httpMethod === 'GET') {
      // GET: Fetch week data (merged templates + entries)
      const weekStartParam = event.queryStringParameters?.week_start;
      if (!weekStartParam) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing week_start parameter' }) };
      }

      const monday = getMonday(weekStartParam);
      const weekStart = formatDate(monday);

      // Generate 5 weekdays (Mon-Fri)
      const days: any[] = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setUTCDate(monday.getUTCDate() + i);
        const dateStr = formatDate(date);
        const dayOfWeek = date.getUTCDay();

        days.push({
          date: dateStr,
          day_of_week: dayOfWeek,
          day_name: getDayName(dayOfWeek),
          entries: [],
        });
      }

      console.log('[roadmap-week] Generated days:', days.map(d => d.date));

      // Fetch existing entries for this week
      const { data: entries, error: entriesError } = await supabase
        .from('roadmap_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', days[0].date)
        .lte('date', days[4].date)
        .order('position', { ascending: true });

      if (entriesError) {
        console.error('[roadmap-week] Error fetching entries:', entriesError);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch entries' }) };
      }

      console.log('[roadmap-week] Found existing entries:', entries?.length || 0);

      // Fetch active templates for weekdays
      const { data: templates, error: templatesError } = await supabase
        .from('roadmap_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .in('day_of_week', [1, 2, 3, 4, 5]) // Mon-Fri
        .order('position', { ascending: true });

      if (templatesError) {
        console.error('[roadmap-week] Error fetching templates:', templatesError);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch templates' }) };
      }

      console.log('[roadmap-week] Found templates:', templates?.length || 0);

      // Merge templates into days (only if no entry exists from that template)
      for (const day of days) {
        const dayTemplates = (templates || []).filter(
          t => t.day_of_week === day.day_of_week && new Date(day.date) >= new Date(t.applies_from)
        );

        for (const template of dayTemplates) {
          // Check if entry from this template already exists for this date
          const existingEntry = (entries || []).find(
            e => e.template_id === template.id && e.date === day.date
          );

          if (!existingEntry) {
            // Add template as virtual entry (not persisted)
            day.entries.push({
              id: `template-${template.id}-${day.date}`,
              user_id: userId,
              date: day.date,
              title: template.title,
              start_time: template.start_time,
              end_time: template.end_time,
              status: 'todo',
              origin: 'template',
              template_id: template.id,
              position: template.position,
              created_at: template.created_at,
              updated_at: template.updated_at,
              _is_template: true,
            });
          }
        }

        // Add actual entries
        const dayEntries = (entries || []).filter(e => e.date === day.date);
        day.entries.push(...dayEntries);

        // Sort by position
        day.entries.sort((a: any, b: any) => a.position - b.position);
      }

      // Calculate summary
      const allEntries = days.flatMap(d => d.entries.filter((e: any) => !e._is_template));
      const summary = {
        total: allEntries.length,
        done: allEntries.filter((e: any) => e.status === 'fait').length,
        seen: allEntries.filter((e: any) => e.status === 'vu').length,
        remaining: allEntries.filter((e: any) => e.status === 'todo').length,
      };

      console.log('[roadmap-week] Summary:', summary);

      const weekEnd = formatDate(new Date(Date.UTC(
        monday.getUTCFullYear(),
        monday.getUTCMonth(),
        monday.getUTCDate() + 4
      )));

      return {
        statusCode: 200,
        body: JSON.stringify({
          week_start: weekStart,
          week_end: weekEnd,
          days,
          summary,
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      // POST: Batch save/update entries
      if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }) };
      }

      const { week_start, entries: inputEntries } = JSON.parse(event.body) as {
        week_start: string;
        entries: Entry[];
      };

      console.log('[roadmap-week] Saving entries:', inputEntries.length);

      const results = [];

      for (const entry of inputEntries) {
        if (entry.id && entry.id.startsWith('template-')) {
          // Convert template to real entry
          const templateId = entry.id.split('-')[1];
          const { data, error } = await supabase
            .from('roadmap_entries')
            .insert({
              user_id: userId,
              date: entry.date,
              title: entry.title,
              start_time: entry.start_time,
              end_time: entry.end_time,
              status: entry.status || 'todo',
              origin: 'template',
              template_id: templateId,
              position: entry.position || 0,
            })
            .select()
            .single();

          if (error) {
            console.error('[roadmap-week] Error creating entry from template:', error);
          } else {
            results.push(data);
          }
        } else if (entry.id) {
          // Update existing entry
          const { data, error } = await supabase
            .from('roadmap_entries')
            .update({
              title: entry.title,
              start_time: entry.start_time,
              end_time: entry.end_time,
              status: entry.status,
              position: entry.position,
              updated_at: new Date().toISOString(),
            })
            .eq('id', entry.id)
            .eq('user_id', userId)
            .select()
            .single();

          if (error) {
            console.error('[roadmap-week] Error updating entry:', error);
          } else {
            results.push(data);
          }
        } else {
          // Create new entry
          const { data, error } = await supabase
            .from('roadmap_entries')
            .insert({
              user_id: userId,
              date: entry.date,
              title: entry.title,
              start_time: entry.start_time,
              end_time: entry.end_time,
              status: entry.status || 'todo',
              origin: 'manual',
              template_id: entry.template_id || null,
              position: entry.position || 0,
            })
            .select()
            .single();

          if (error) {
            console.error('[roadmap-week] Error creating entry:', error);
          } else {
            results.push(data);
          }
        }
      }

      console.log('[roadmap-week] Saved entries:', results.length);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: results,
        }),
      };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error: any) {
    console.error('[roadmap-week] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

export { handler };
