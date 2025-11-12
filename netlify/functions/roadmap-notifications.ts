/**
 * Roadmap Notifications Function
 * GET: Fetch unread notifications
 * POST: Mark notifications as seen or done
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler: Handler = async (event: HandlerEvent) => {
  console.log('[roadmap-notifications] Request:', event.httpMethod);

  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[roadmap-notifications] Auth error:', authError);
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const userId = user.id;
    console.log('[roadmap-notifications] User:', userId);

    if (event.httpMethod === 'GET') {
      // GET: Fetch unread in-app notifications
      const { data: notifications, error } = await supabase
        .from('roadmap_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('channel', 'in_app')
        .is('sent_at', null) // unread
        .order('scheduled_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[roadmap-notifications] Error fetching notifications:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch notifications' }) };
      }

      console.log('[roadmap-notifications] Found notifications:', notifications?.length || 0);

      return {
        statusCode: 200,
        body: JSON.stringify({
          notifications: notifications || [],
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      // POST: Mark as seen or done
      if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }) };
      }

      const { action, ids } = JSON.parse(event.body) as {
        action: 'mark_seen' | 'mark_done';
        ids: string[];
      };

      console.log('[roadmap-notifications] Action:', action, 'IDs:', ids.length);

      if (action === 'mark_seen') {
        // Mark notifications as seen (set sent_at = now)
        const { error } = await supabase
          .from('roadmap_notifications')
          .update({ sent_at: new Date().toISOString(), status: 'sent' })
          .in('id', ids)
          .eq('user_id', userId);

        if (error) {
          console.error('[roadmap-notifications] Error marking as seen:', error);
          return { statusCode: 500, body: JSON.stringify({ error: 'Failed to mark as seen' }) };
        }

        console.log('[roadmap-notifications] Marked as seen:', ids.length);

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, marked: ids.length }),
        };
      }

      if (action === 'mark_done') {
        // Mark notifications as seen AND mark associated entries as done
        const { data: notifications, error: fetchError } = await supabase
          .from('roadmap_notifications')
          .select('payload')
          .in('id', ids)
          .eq('user_id', userId);

        if (fetchError) {
          console.error('[roadmap-notifications] Error fetching notifications:', fetchError);
          return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch notifications' }) };
        }

        // Extract entry IDs from payloads
        const entryIds: string[] = [];
        for (const notif of notifications || []) {
          const payload = notif.payload as any;
          if (payload.items) {
            for (const item of payload.items) {
              if (item.id && !item.id.startsWith('template-')) {
                entryIds.push(item.id);
              }
            }
          }
        }

        console.log('[roadmap-notifications] Entries to mark as done:', entryIds.length);

        // Mark entries as done
        if (entryIds.length > 0) {
          const { error: updateError } = await supabase
            .from('roadmap_entries')
            .update({ status: 'fait', updated_at: new Date().toISOString() })
            .in('id', entryIds)
            .eq('user_id', userId);

          if (updateError) {
            console.error('[roadmap-notifications] Error updating entries:', updateError);
          }
        }

        // Mark notifications as seen
        const { error: notifUpdateError } = await supabase
          .from('roadmap_notifications')
          .update({ sent_at: new Date().toISOString(), status: 'sent' })
          .in('id', ids)
          .eq('user_id', userId);

        if (notifUpdateError) {
          console.error('[roadmap-notifications] Error marking notifications:', notifUpdateError);
          return { statusCode: 500, body: JSON.stringify({ error: 'Failed to mark as done' }) };
        }

        console.log('[roadmap-notifications] Marked as done:', ids.length, 'notifications,', entryIds.length, 'entries');

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            marked_notifications: ids.length,
            marked_entries: entryIds.length,
          }),
        };
      }

      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error: any) {
    console.error('[roadmap-notifications] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

export { handler };
