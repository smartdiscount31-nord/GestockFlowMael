/**
 * Roadmap System Types
 * Types for Feuille de route + Calendrier + Rappels module
 */

export type RoadmapStatus = 'todo' | 'vu' | 'fait';
export type RoadmapOrigin = 'template' | 'manual';
export type TelegramMode = 'shared' | 'personal';
export type NotificationType = 'reminder' | 'summary';
export type NotificationChannel = 'in_app' | 'telegram';
export type NotificationStatus = 'pending' | 'sent' | 'failed';
export type TelegramBotStatus = 'pending' | 'active' | 'revoked';

/**
 * User settings for roadmap module
 */
export interface RoadmapSettings {
  user_id: string;
  default_reminder_days: number[]; // e.g., [2, 3] for J-2, J-3
  eod_hour: number; // End of day hour (0-23) for daily summary in Europe/Paris
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  telegram_mode: TelegramMode;
  created_at: string;
  updated_at: string;
}

/**
 * Weekly recurring task template (e.g., "Monday 9am meeting")
 */
export interface RoadmapTemplateItem {
  id: string;
  user_id: string;
  day_of_week: number; // 1=Monday, 7=Sunday
  title: string;
  start_time: string | null; // time format "HH:MM"
  end_time: string | null;
  position: number;
  active: boolean;
  applies_from: string; // date format "YYYY-MM-DD"
  created_at: string;
  updated_at: string;
}

/**
 * Actual task entry for a specific date
 */
export interface RoadmapEntry {
  id: string;
  user_id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  start_time: string | null;
  end_time: string | null;
  status: RoadmapStatus;
  origin: RoadmapOrigin;
  template_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * Calendar event with optional recurrence
 */
export interface RoadmapEvent {
  id: string;
  user_id: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  start_time: string | null;
  end_time: string | null;
  recurrence: RoadmapEventRecurrence | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Event recurrence configuration
 */
export interface RoadmapEventRecurrence {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g., every 2 weeks
  end_date?: string | null; // "YYYY-MM-DD"
  days_of_week?: number[]; // for weekly: [1,3,5] = Mon, Wed, Fri
}

/**
 * Reminder configuration for an event
 */
export interface EventReminder {
  id: string;
  event_id: string;
  days_before: number;
  at: string; // time format "HH:MM"
  channel: NotificationChannel;
  active: boolean;
  created_at: string;
}

/**
 * Generated notification (in-app or Telegram)
 */
export interface RoadmapNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: RoadmapNotificationPayload;
  scheduled_at: string;
  sent_at: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  created_at: string;
}

/**
 * Notification payload (flexible structure)
 */
export interface RoadmapNotificationPayload {
  title: string;
  message: string;
  items?: Array<{
    id: string;
    title: string;
    time?: string;
    status?: RoadmapStatus;
  }>;
  summary?: {
    total: number;
    done: number;
    remaining: number;
    tomorrow?: number;
  };
}

/**
 * Personal Telegram bot configuration (secure)
 */
export interface UserTelegramBot {
  id: string;
  user_id: string;
  bot_username: string;
  bot_token: string; // NEVER exposed to client
  webhook_secret: string; // NEVER exposed to client
  webhook_url: string;
  chat_id: string | null;
  status: TelegramBotStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Public view of Telegram bot (safe for client)
 */
export interface UserTelegramBotPublic {
  id: string;
  user_id: string;
  bot_username: string;
  webhook_url: string;
  chat_id: string | null;
  status: TelegramBotStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for creating/updating a week of roadmap entries
 */
export interface RoadmapWeekPayload {
  week_start: string; // Monday date "YYYY-MM-DD"
  entries: Array<{
    id?: string; // omit for new entries
    date: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
    status: RoadmapStatus;
    position: number;
    template_id?: string | null;
  }>;
}

/**
 * Summary stats for roadmap widget
 */
export interface RoadmapSummary {
  total: number;
  done: number;
  seen: number;
  remaining: number;
}

/**
 * Roadmap week data (merged templates + entries)
 */
export interface RoadmapWeekData {
  week_start: string;
  week_end: string;
  days: Array<{
    date: string;
    day_of_week: number;
    day_name: string;
    entries: RoadmapEntry[];
  }>;
  summary: RoadmapSummary;
}

/**
 * Month calendar data with density
 */
export interface RoadmapMonthData {
  year: number;
  month: number;
  weeks: Array<{
    days: Array<{
      date: string;
      is_current_month: boolean;
      entry_count: number;
      event_count: number;
      entries: Array<{
        id: string;
        title: string;
        time: string | null;
        status: RoadmapStatus;
      }>;
      events: Array<{
        id: string;
        title: string;
        time: string | null;
      }>;
    }>;
  }>;
}

/**
 * Form data for creating/editing template or entry
 */
export interface RoadmapItemFormData {
  id?: string;
  title: string;
  date?: string; // for entries
  day_of_week?: number; // for templates
  start_time: string | null;
  end_time: string | null;
  type: 'hebdo' | 'ponctuel';
  propagate_future?: boolean; // for templates
  recurrence?: 'weekly' | 'monthly' | null;
  reminder_days?: number[]; // [2, 3] for J-2, J-3
}

/**
 * Form data for creating/editing events
 */
export interface RoadmapEventFormData {
  id?: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  recurrence: RoadmapEventRecurrence | null;
  reminders: Array<{
    days_before: number;
    at: string;
    channel: NotificationChannel;
  }>;
}

/**
 * Telegram configuration form data
 */
export interface TelegramConfigFormData {
  // Shared bot
  telegram_enabled: boolean;

  // Personal bot
  bot_username?: string;
  bot_token?: string;
  telegram_mode: TelegramMode;
}

/**
 * API response types
 */
export interface RoadmapApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TelegramTestResponse {
  success: boolean;
  message: string;
  chat_id?: string;
}

export interface TelegramConnectionInfo {
  shared_bot_url: string;
  personal_bot_url?: string;
  personal_bot_status?: TelegramBotStatus | null;
  is_connected: boolean;
  mode: TelegramMode;
  chat_id: string | null;
}
