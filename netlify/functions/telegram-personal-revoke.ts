/**
 * Telegram Personal Bot Revoke
 * Revokes a user's personal Telegram bot
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[TelegramPersonalRevoke] Revoking personal bot');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[TelegramPersonalRevoke] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[TelegramPersonalRevoke] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    console.log('[TelegramPersonalRevoke] User:', user.id);

    // Get personal bot configuration
    const { data: botConfig, error: botError } = await supabase
      .from('user_telegram_bots')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (botError || !botConfig) {
      console.error('[TelegramPersonalRevoke] Bot config not found:', botError);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'No personal bot configuration found'
        }),
      };
    }

    console.log('[TelegramPersonalRevoke] Deleting webhook for bot:', botConfig.bot_username);

    // Delete webhook on Telegram
    const telegramUrl = `https://api.telegram.org/bot${botConfig.bot_token}/deleteWebhook`;
    const webhookResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!webhookResponse.ok) {
      const error = await webhookResponse.text();
      console.error('[TelegramPersonalRevoke] Failed to delete webhook:', error);
      // Continue anyway to update database status
    } else {
      const result = await webhookResponse.json();
      console.log('[TelegramPersonalRevoke] Webhook deleted:', result);
    }

    // Update bot status to revoked
    const { error: updateError } = await supabase
      .from('user_telegram_bots')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[TelegramPersonalRevoke] Error updating bot status:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to update bot status'
        }),
      };
    }

    // Switch user back to shared mode
    const { error: settingsError } = await supabase
      .from('user_settings_roadmap')
      .update({
        telegram_mode: 'shared',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (settingsError) {
      console.error('[TelegramPersonalRevoke] Error updating settings:', settingsError);
      // Non-critical error, continue
    }

    console.log('[TelegramPersonalRevoke] Bot revoked successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Bot personnel révoqué avec succès'
      }),
    };
  } catch (error) {
    console.error('[TelegramPersonalRevoke] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    };
  }
};
