/**
 * Roadmap Notification Processor (CRON)
 * Runs every hour to generate reminders and end-of-day summaries
 * Handles timezone conversion (Europe/Paris to UTC)
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sharedBotToken = process.env.TELEGRAM_BOT_TOKEN || '';

export const handler: Handler = async () => {
  console.log('[RoadmapCRON] Processing notifications');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get current time in UTC
    const now = new Date();
    const currentHourUTC = now.getUTCHours();
    console.log('[RoadmapCRON] Current UTC hour:', currentHourUTC);

    // Get all users with roadmap settings
    const { data: users, error: usersError } = await supabase
      .from('user_settings_roadmap')
      .select('*');

    if (usersError) {
      console.error('[RoadmapCRON] Error fetching users:', usersError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch users' }),
      };
    }

    console.log('[RoadmapCRON] Processing', users?.length || 0, 'users');

    for (const userSettings of users || []) {
      await processUserNotifications(supabase, userSettings, now);
    }

    console.log('[RoadmapCRON] Processing complete');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, processed: users?.length || 0 }),
    };
  } catch (error) {
    console.error('[RoadmapCRON] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Process notifications for a single user
 */
async function processUserNotifications(supabase: any, userSettings: any, now: Date) {
  const userId = userSettings.user_id;
  console.log('[RoadmapCRON] Processing user:', userId);

  // Convert current UTC time to Europe/Paris time
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const currentHourParis = parisTime.getHours();
  const currentDate = parisTime.toISOString().split('T')[0];

  console.log('[RoadmapCRON] Paris time:', parisTime.toISOString(), 'Hour:', currentHourParis);

  // Check if it's time for EOD summary
  const eodHour = userSettings.eod_hour || 17; // Default 17h
  if (currentHourParis === eodHour) {
    await generateEODSummary(supabase, userId, currentDate, userSettings);
  }

  // Check for upcoming events that need reminders
  const reminderDays = userSettings.default_reminder_days || [1]; // Default J-1
  await generateEventReminders(supabase, userId, currentDate, reminderDays, userSettings);
}

/**
 * Generate end-of-day summary notification
 */
async function generateEODSummary(supabase: any, userId: string, currentDate: string, userSettings: any) {
  console.log('[RoadmapCRON] Generating EOD summary for user:', userId, 'date:', currentDate);

  // Check if summary already generated today
  const { data: existing } = await supabase
    .from('roadmap_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'summary')
    .gte('scheduled_at', `${currentDate}T00:00:00`)
    .lt('scheduled_at', `${currentDate}T23:59:59`)
    .maybeSingle();

  if (existing) {
    console.log('[RoadmapCRON] EOD summary already generated today');
    return;
  }

  // Get today's entries
  const { data: todayEntries } = await supabase
    .from('roadmap_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', currentDate)
    .order('position');

  const total = todayEntries?.length || 0;
  const done = todayEntries?.filter((e: any) => e.status === 'fait').length || 0;
  const remaining = total - done;

  console.log('[RoadmapCRON] Today stats:', { total, done, remaining });

  // Get tomorrow's entries count
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  const { data: tomorrowEntries } = await supabase
    .from('roadmap_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', tomorrowDate);

  const tomorrowCount = tomorrowEntries?.length || 0;

  // Create notification
  const payload = {
    title: 'Bilan de la journée',
    message: `Aujourd'hui: ${done}/${total} tâches terminées. ${remaining} restantes.`,
    items: todayEntries?.slice(0, 5).map((e: any) => ({
      id: e.id,
      title: e.title,
      time: e.start_time,
      status: e.status,
    })),
    summary: {
      total,
      done,
      remaining,
      tomorrow: tomorrowCount,
    },
  };

  const { data: notification, error: notifError } = await supabase
    .from('roadmap_notifications')
    .insert({
      user_id: userId,
      type: 'summary',
      payload,
      scheduled_at: new Date().toISOString(),
      channel: 'in_app',
      status: 'pending',
    })
    .select()
    .single();

  if (notifError) {
    console.error('[RoadmapCRON] Error creating EOD notification:', notifError);
    return;
  }

  console.log('[RoadmapCRON] EOD notification created:', notification.id);

  // Send via Telegram if enabled
  if (userSettings.telegram_enabled) {
    await sendTelegramNotification(supabase, userId, userSettings, payload.title, payload.message);
  }
}

/**
 * Generate event reminder notifications
 */
async function generateEventReminders(
  supabase: any,
  userId: string,
  currentDate: string,
  reminderDays: number[],
  userSettings: any
) {
  console.log('[RoadmapCRON] Checking event reminders for user:', userId);

  for (const daysAhead of reminderDays) {
    const targetDate = new Date(currentDate);
    targetDate.setDate(targetDate.getDate() + daysAhead);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    console.log('[RoadmapCRON] Checking events for J+', daysAhead, ':', targetDateStr);

    // Get events for target date
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('date', targetDateStr);

    if (!events || events.length === 0) {
      continue;
    }

    console.log('[RoadmapCRON] Found', events.length, 'events');

    for (const event of events) {
      // Check if reminder already generated
      const { data: existing } = await supabase
        .from('roadmap_notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'reminder')
        .gte('scheduled_at', `${currentDate}T00:00:00`)
        .lt('scheduled_at', `${currentDate}T23:59:59`)
        .contains('payload', { event_id: event.id })
        .maybeSingle();

      if (existing) {
        console.log('[RoadmapCRON] Reminder already generated for event:', event.id);
        continue;
      }

      // Create reminder notification
      const daysLabel = daysAhead === 1 ? 'demain' : `dans ${daysAhead} jours`;
      const payload = {
        title: 'Rappel d\'événement',
        message: `${event.title} - ${daysLabel}`,
        event_id: event.id,
        items: [{
          id: event.id,
          title: event.title,
          time: event.start_time,
        }],
      };

      const { data: notification, error: notifError } = await supabase
        .from('roadmap_notifications')
        .insert({
          user_id: userId,
          type: 'reminder',
          payload,
          scheduled_at: new Date().toISOString(),
          channel: 'in_app',
          status: 'pending',
        })
        .select()
        .single();

      if (notifError) {
        console.error('[RoadmapCRON] Error creating reminder:', notifError);
        continue;
      }

      console.log('[RoadmapCRON] Reminder created:', notification.id);

      // Send via Telegram if enabled
      if (userSettings.telegram_enabled) {
        await sendTelegramNotification(supabase, userId, userSettings, payload.title, payload.message);
      }
    }
  }
}

/**
 * Send notification via Telegram (shared or personal bot)
 */
async function sendTelegramNotification(
  supabase: any,
  userId: string,
  userSettings: any,
  title: string,
  message: string
) {
  const mode = userSettings.telegram_mode || 'shared';
  console.log('[RoadmapCRON] Sending Telegram notification, mode:', mode);

  try {
    if (mode === 'shared') {
      // Use shared bot
      if (!userSettings.telegram_chat_id || !sharedBotToken) {
        console.log('[RoadmapCRON] Shared bot not configured');
        return;
      }

      const url = `https://api.telegram.org/bot${sharedBotToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: parseInt(userSettings.telegram_chat_id),
          text: `<b>${title}</b>\n\n${message}`,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        console.error('[RoadmapCRON] Failed to send shared bot message');
      } else {
        console.log('[RoadmapCRON] Shared bot message sent');
      }
    } else {
      // Use personal bot
      const { data: botConfig } = await supabase
        .from('user_telegram_bots')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!botConfig || !botConfig.chat_id || botConfig.status !== 'active') {
        console.log('[RoadmapCRON] Personal bot not configured or inactive');
        return;
      }

      const url = `https://api.telegram.org/bot${botConfig.bot_token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: parseInt(botConfig.chat_id),
          text: `<b>${title}</b>\n\n${message}`,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        console.error('[RoadmapCRON] Failed to send personal bot message');
      } else {
        console.log('[RoadmapCRON] Personal bot message sent');
      }
    }
  } catch (error) {
    console.error('[RoadmapCRON] Error sending Telegram message:', error);
  }
}
