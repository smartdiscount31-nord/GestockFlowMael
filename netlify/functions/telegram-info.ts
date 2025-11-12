/**
 * Telegram Connection Info
 * Returns connection information for Telegram (shared and personal)
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[TelegramInfo] Getting connection info');

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[TelegramInfo] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[TelegramInfo] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    console.log('[TelegramInfo] User:', user.id);

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings_roadmap')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) {
      console.error('[TelegramInfo] Error fetching settings:', settingsError);
    }

    // Get personal bot config (using public view)
    const { data: personalBot, error: botError } = await supabase
      .from('user_telegram_bots_public')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (botError && botError.code !== 'PGRST116') {
      console.error('[TelegramInfo] Error fetching bot config:', botError);
    }

    console.log('[TelegramInfo] Settings:', settings);
    console.log('[TelegramInfo] Personal bot:', personalBot);

    // Build shared bot URL
    const sharedBotUrl = botUsername
      ? `https://t.me/${botUsername.replace('@', '')}?start=${user.id}`
      : '';

    // Build personal bot URL
    const personalBotUrl = personalBot?.bot_username
      ? `https://t.me/${personalBot.bot_username.replace('@', '')}`
      : undefined;

    // Determine connection status
    const mode = settings?.telegram_mode || 'shared';
    let isConnected = false;
    let chatId: string | null = null;

    if (mode === 'shared') {
      isConnected = !!(settings?.telegram_chat_id && settings?.telegram_enabled);
      chatId = settings?.telegram_chat_id || null;
    } else if (mode === 'personal') {
      isConnected = personalBot?.status === 'active' && !!personalBot?.chat_id;
      chatId = personalBot?.chat_id || null;
    }

    console.log('[TelegramInfo] Connection status:', { mode, isConnected, chatId });

    return {
      statusCode: 200,
      body: JSON.stringify({
        shared_bot_url: sharedBotUrl,
        personal_bot_url: personalBotUrl,
        is_connected: isConnected,
        mode: mode,
        chat_id: chatId,
        personal_bot_status: personalBot?.status || null,
      }),
    };
  } catch (error) {
    console.error('[TelegramInfo] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
