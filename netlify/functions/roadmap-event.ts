/**
 * Roadmap Event Management
 * Create, update, and delete calendar events with reminders
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[RoadmapEvent] Request:', event.httpMethod);

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[RoadmapEvent] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[RoadmapEvent] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    if (event.httpMethod === 'POST') {
      return await createEvent(supabase, user.id, event.body || '{}');
    } else if (event.httpMethod === 'PUT') {
      return await updateEvent(supabase, user.id, event.queryStringParameters, event.body || '{}');
    } else if (event.httpMethod === 'DELETE') {
      return await deleteEvent(supabase, user.id, event.queryStringParameters);
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
  } catch (error) {
    console.error('[RoadmapEvent] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Create a new event
 */
async function createEvent(supabase: any, userId: string, bodyStr: string) {
  const body = JSON.parse(bodyStr);
  const {
    title,
    date,
    start_time,
    end_time,
    location,
    notes,
    recurrence,
    reminders,
  } = body;

  console.log('[RoadmapEvent] Create event:', { title, date, recurrence });

  if (!title || !date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: title, date' }),
    };
  }

  // Create event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      user_id: userId,
      title,
      date,
      start_time: start_time || null,
      end_time: end_time || null,
      location: location || null,
      notes: notes || null,
      recurrence: recurrence || null,
    })
    .select()
    .single();

  if (eventError) {
    console.error('[RoadmapEvent] Error creating event:', eventError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create event' }),
    };
  }

  console.log('[RoadmapEvent] Event created:', event.id);

  // Create reminders if provided
  if (reminders && Array.isArray(reminders) && reminders.length > 0) {
    const reminderData = reminders.map((r: any) => ({
      event_id: event.id,
      days_before: r.days_before,
      at: r.at,
      channel: r.channel || 'in_app',
      active: true,
    }));

    const { error: reminderError } = await supabase
      .from('event_reminders')
      .insert(reminderData);

    if (reminderError) {
      console.error('[RoadmapEvent] Error creating reminders:', reminderError);
      // Non-critical, continue
    } else {
      console.log('[RoadmapEvent] Reminders created:', reminderData.length);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: event,
    }),
  };
}

/**
 * Update an existing event
 */
async function updateEvent(supabase: any, userId: string, params: any, bodyStr: string) {
  const eventId = params?.id;
  const body = JSON.parse(bodyStr);

  console.log('[RoadmapEvent] Update event:', eventId);

  if (!eventId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing event id' }),
    };
  }

  const {
    title,
    date,
    start_time,
    end_time,
    location,
    notes,
    recurrence,
    reminders,
  } = body;

  // Update event
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (title !== undefined) updateData.title = title;
  if (date !== undefined) updateData.date = date;
  if (start_time !== undefined) updateData.start_time = start_time;
  if (end_time !== undefined) updateData.end_time = end_time;
  if (location !== undefined) updateData.location = location;
  if (notes !== undefined) updateData.notes = notes;
  if (recurrence !== undefined) updateData.recurrence = recurrence;

  const { data: event, error: eventError } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .eq('user_id', userId)
    .select()
    .single();

  if (eventError) {
    console.error('[RoadmapEvent] Error updating event:', eventError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update event' }),
    };
  }

  console.log('[RoadmapEvent] Event updated:', event.id);

  // Update reminders if provided
  if (reminders !== undefined && Array.isArray(reminders)) {
    // Delete existing reminders
    await supabase
      .from('event_reminders')
      .delete()
      .eq('event_id', eventId);

    // Create new reminders
    if (reminders.length > 0) {
      const reminderData = reminders.map((r: any) => ({
        event_id: eventId,
        days_before: r.days_before,
        at: r.at,
        channel: r.channel || 'in_app',
        active: true,
      }));

      const { error: reminderError } = await supabase
        .from('event_reminders')
        .insert(reminderData);

      if (reminderError) {
        console.error('[RoadmapEvent] Error creating reminders:', reminderError);
        // Non-critical, continue
      } else {
        console.log('[RoadmapEvent] Reminders updated:', reminderData.length);
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: event,
    }),
  };
}

/**
 * Delete an event
 */
async function deleteEvent(supabase: any, userId: string, params: any) {
  const eventId = params?.id;

  console.log('[RoadmapEvent] Delete event:', eventId);

  if (!eventId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing event id' }),
    };
  }

  // Delete event (reminders will be cascade deleted)
  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', userId);

  if (deleteError) {
    console.error('[RoadmapEvent] Error deleting event:', deleteError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete event' }),
    };
  }

  console.log('[RoadmapEvent] Event deleted successfully');

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Event deleted successfully',
    }),
  };
}
