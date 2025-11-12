/**
 * Telegram Mode Switch
 * Switches between shared and personal Telegram bot mode
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[TelegramMode] Switching Telegram mode');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[TelegramMode] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[TelegramMode] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { mode } = body;

    console.log('[TelegramMode] User:', user.id, 'New mode:', mode);

    if (!mode || !['shared', 'personal'].includes(mode)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Invalid mode. Must be "shared" or "personal"'
        }),
      };
    }

    // If switching to personal mode, verify bot is configured and active
    if (mode === 'personal') {
      const { data: botConfig, error: botError } = await supabase
        .from('user_telegram_bots')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (botError || !botConfig) {
        console.error('[TelegramMode] No personal bot configured');
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'Vous devez d\'abord configurer un bot personnel'
          }),
        };
      }

      if (botConfig.status !== 'active') {
        console.error('[TelegramMode] Personal bot not active');
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'Votre bot personnel n\'est pas actif. Utilisez /start dans Telegram.'
          }),
        };
      }
    }

    // Update user settings
    const { error: updateError } = await supabase
      .from('user_settings_roadmap')
      .upsert({
        user_id: user.id,
        telegram_mode: mode,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('[TelegramMode] Error updating settings:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to update settings'
        }),
      };
    }

    console.log('[TelegramMode] Mode switched successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Mode Telegram basculé vers: ${mode === 'shared' ? 'bot partagé' : 'bot personnel'}`
      }),
    };
  } catch (error) {
    console.error('[TelegramMode] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    };
  }
};
