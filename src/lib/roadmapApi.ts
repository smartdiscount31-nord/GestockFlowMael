/**
 * Roadmap API Client
 * Client-side functions for interacting with roadmap serverless functions
 */

import { supabase } from './supabase';
import type {
  RoadmapSettings,
  RoadmapWeekData,
  RoadmapMonthData,
  RoadmapNotification,
  RoadmapTemplateItem,
  RoadmapEntry,
  RoadmapEvent,
  RoadmapEventFormData,
  RoadmapItemFormData,
  TelegramConfigFormData,
  TelegramTestResponse,
  TelegramConnectionInfo,
  RoadmapApiResponse,
} from '../types/roadmap';

/**
 * Get auth headers for serverless function calls
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch roadmap week data (merged templates + entries)
 * @param weekStart Monday date in YYYY-MM-DD format
 */
export async function fetchRoadmapWeek(weekStart: string): Promise<RoadmapWeekData> {
  console.log('[RoadmapAPI] Fetching week:', weekStart);
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/.netlify/functions/roadmap-week?week_start=${encodeURIComponent(weekStart)}`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error fetching week:', error);
    throw new Error(`Failed to fetch week: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Week data loaded:', data);
  return data;
}

/**
 * Save batch of roadmap entries (create/update/delete)
 * @param weekStart Monday date
 * @param entries Array of entries to save
 */
export async function saveEntries(
  weekStart: string,
  entries: Array<Partial<RoadmapEntry> & { date: string; title: string }>
): Promise<RoadmapApiResponse> {
  console.log('[RoadmapAPI] Saving entries:', { weekStart, count: entries.length });
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/roadmap-week', {
    method: 'POST',
    headers,
    body: JSON.stringify({ week_start: weekStart, entries }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error saving entries:', error);
    throw new Error(`Failed to save entries: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Entries saved successfully');
  return data;
}

/**
 * Create or update a template item (hebdo recurring task)
 * @param template Template data
 * @param propagateFuture If true, update future entries from this template
 */
export async function createOrUpdateTemplateItem(
  template: RoadmapItemFormData,
  propagateFuture: boolean = false
): Promise<RoadmapTemplateItem> {
  console.log('[RoadmapAPI] Saving template:', { template, propagateFuture });
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/roadmap-template', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...template, propagate_future: propagateFuture }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error saving template:', error);
    throw new Error(`Failed to save template: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Template saved successfully:', data);
  return data.data;
}

/**
 * Create a new event
 */
export async function createEvent(event: RoadmapEventFormData): Promise<RoadmapEvent> {
  console.log('[RoadmapAPI] Creating event:', event);
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/roadmap-event', {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error creating event:', error);
    throw new Error(`Failed to create event: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Event created successfully:', data);
  return data.data;
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string,
  event: Partial<RoadmapEventFormData>
): Promise<RoadmapEvent> {
  console.log('[RoadmapAPI] Updating event:', { eventId, event });
  const headers = await getAuthHeaders();
  const response = await fetch(`/.netlify/functions/roadmap-event?id=${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error updating event:', error);
    throw new Error(`Failed to update event: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Event updated successfully:', data);
  return data.data;
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<void> {
  console.log('[RoadmapAPI] Deleting event:', eventId);
  const headers = await getAuthHeaders();
  const response = await fetch(`/.netlify/functions/roadmap-event?id=${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error deleting event:', error);
    throw new Error(`Failed to delete event: ${response.status}`);
  }

  console.log('[RoadmapAPI] Event deleted successfully');
}

/**
 * Fetch month calendar data with events and entry density
 */
export async function fetchMonth(year: number, month: number): Promise<RoadmapMonthData> {
  console.log('[RoadmapAPI] Fetching month:', { year, month });
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/.netlify/functions/roadmap-month?year=${year}&month=${month}`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error fetching month:', error);
    throw new Error(`Failed to fetch month: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Month data loaded:', data);
  return data;
}

/**
 * Fetch unread notifications
 */
export async function fetchNotifications(): Promise<RoadmapNotification[]> {
  console.log('[RoadmapAPI] Fetching notifications');
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/roadmap-notifications', { headers });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error fetching notifications:', error);
    throw new Error(`Failed to fetch notifications: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Notifications loaded:', data.notifications?.length || 0);
  return data.notifications || [];
}

/**
 * Mark notifications as seen
 */
export async function markAsSeen(notificationIds: string[]): Promise<void> {
  console.log('[RoadmapAPI] Marking as seen:', notificationIds.length);
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/roadmap-notifications', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'mark_seen', ids: notificationIds }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error marking as seen:', error);
    throw new Error(`Failed to mark as seen: ${response.status}`);
  }

  console.log('[RoadmapAPI] Notifications marked as seen');
}

/**
 * Mark notifications as done (complete associated tasks)
 */
export async function markAsDone(notificationIds: string[]): Promise<void> {
  console.log('[RoadmapAPI] Marking as done:', notificationIds.length);
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/roadmap-notifications', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'mark_done', ids: notificationIds }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error marking as done:', error);
    throw new Error(`Failed to mark as done: ${response.status}`);
  }

  console.log('[RoadmapAPI] Notifications marked as done');
}

/**
 * Get user roadmap settings
 */
export async function getSettings(): Promise<RoadmapSettings | null> {
  console.log('[RoadmapAPI] Fetching settings');
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_settings_roadmap')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[RoadmapAPI] Error fetching settings:', error);
      return null;
    }

    console.log('[RoadmapAPI] Settings loaded:', data);
    return data;
  } catch (error) {
    console.error('[RoadmapAPI] Exception fetching settings:', error);
    return null;
  }
}

/**
 * Save user roadmap settings
 */
export async function saveSettings(settings: Partial<RoadmapSettings>): Promise<RoadmapSettings> {
  console.log('[RoadmapAPI] Saving settings:', settings);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No authenticated user');
  }

  const { data, error } = await supabase
    .from('user_settings_roadmap')
    .upsert({
      user_id: user.id,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[RoadmapAPI] Error saving settings:', error);
    throw new Error(`Failed to save settings: ${error.message}`);
  }

  console.log('[RoadmapAPI] Settings saved successfully:', data);
  return data;
}

/**
 * Test Telegram connection (sends a test message)
 */
export async function testTelegram(): Promise<TelegramTestResponse> {
  console.log('[RoadmapAPI] Testing Telegram connection');
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/telegram-test', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error testing Telegram:', error);
    return {
      success: false,
      message: `Test failed: ${response.status}`,
    };
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Telegram test result:', data);
  return data;
}

/**
 * Get Telegram connection info and start URL
 */
export async function getTelegramConnectionInfo(): Promise<TelegramConnectionInfo> {
  console.log('[RoadmapAPI] Getting Telegram connection info');
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/telegram-info', { headers });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error getting Telegram info:', error);
    throw new Error(`Failed to get Telegram info: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Telegram connection info:', data);
  return data;
}

/**
 * Setup personal Telegram bot
 */
export async function setupPersonalTelegramBot(
  botUsername: string,
  botToken: string
): Promise<RoadmapApiResponse> {
  console.log('[RoadmapAPI] Setting up personal Telegram bot:', botUsername);
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/telegram-personal-setup', {
    method: 'POST',
    headers,
    body: JSON.stringify({ bot_username: botUsername, bot_token: botToken }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error setting up personal bot:', error);
    throw new Error(`Failed to setup personal bot: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Personal bot setup successful:', data);
  return data;
}

/**
 * Test personal Telegram bot
 */
export async function testPersonalTelegramBot(): Promise<TelegramTestResponse> {
  console.log('[RoadmapAPI] Testing personal Telegram bot');
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/telegram-personal-test', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error testing personal bot:', error);
    return {
      success: false,
      message: `Test failed: ${response.status}`,
    };
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Personal bot test result:', data);
  return data;
}

/**
 * Revoke personal Telegram bot
 */
export async function revokePersonalTelegramBot(): Promise<RoadmapApiResponse> {
  console.log('[RoadmapAPI] Revoking personal Telegram bot');
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/telegram-personal-revoke', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error revoking personal bot:', error);
    throw new Error(`Failed to revoke personal bot: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Personal bot revoked successfully:', data);
  return data;
}

/**
 * Switch Telegram mode (shared/personal)
 */
export async function switchTelegramMode(mode: 'shared' | 'personal'): Promise<RoadmapApiResponse> {
  console.log('[RoadmapAPI] Switching Telegram mode to:', mode);
  const headers = await getAuthHeaders();
  const response = await fetch('/.netlify/functions/telegram-mode', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[RoadmapAPI] Error switching mode:', error);
    throw new Error(`Failed to switch mode: ${response.status}`);
  }

  const data = await response.json();
  console.log('[RoadmapAPI] Mode switched successfully:', data);
  return data;
}
