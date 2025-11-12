/**
 * Telegram Personal Bot Webhook Handler
 * Handles incoming webhook events from personal Telegram bots
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
}

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[TelegramPersonalWebhook] Received webhook event');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Extract user_id and secret from query params
  const params = event.queryStringParameters || {};
  const userId = params.user_id;
  const secret = params.secret;

  console.log('[TelegramPersonalWebhook] User ID:', userId);

  if (!userId || !secret) {
    console.error('[TelegramPersonalWebhook] Missing user_id or secret');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing parameters' }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify webhook secret
    const { data: botConfig, error: botError } = await supabase
      .from('user_telegram_bots')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (botError || !botConfig) {
      console.error('[TelegramPersonalWebhook] Bot config not found:', botError);
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' }),
      };
    }

    // Verify secret token
    const secretToken = event.headers['x-telegram-bot-api-secret-token'];
    if (secretToken !== botConfig.webhook_secret) {
      console.error('[TelegramPersonalWebhook] Invalid secret token');
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' }),
      };
    }

    const update: TelegramUpdate = JSON.parse(event.body || '{}');
    console.log('[TelegramPersonalWebhook] Update:', JSON.stringify(update));

    const message = update.message;
    if (!message || !message.text) {
      console.log('[TelegramPersonalWebhook] No text message, ignoring');
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    console.log('[TelegramPersonalWebhook] Chat ID:', chatId, 'Text:', text);

    // Handle /start command
    if (text === '/start') {
      console.log('[TelegramPersonalWebhook] /start command');

      // Update bot config with chat_id and set status to active
      const { error: updateError } = await supabase
        .from('user_telegram_bots')
        .update({
          chat_id: chatId.toString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[TelegramPersonalWebhook] Error updating bot config:', updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to update bot configuration' }),
        };
      }

      console.log('[TelegramPersonalWebhook] Bot activated successfully');

      // Send confirmation message
      await sendTelegramMessage(
        botConfig.bot_token,
        chatId,
        'Votre bot personnel est maintenant connecté ! Vous recevrez vos notifications de Feuille de route ici.'
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    // Handle /stop command
    if (text === '/stop') {
      console.log('[TelegramPersonalWebhook] /stop command');

      // Update settings to disable personal telegram
      const { error: settingsError } = await supabase
        .from('user_settings_roadmap')
        .update({
          telegram_mode: 'shared',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (settingsError) {
        console.error('[TelegramPersonalWebhook] Error updating settings:', settingsError);
      }

      // Send confirmation
      await sendTelegramMessage(
        botConfig.bot_token,
        chatId,
        'Notifications désactivées sur ce bot. Utilisez /start pour réactiver.'
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    // Unknown command
    console.log('[TelegramPersonalWebhook] Unknown command');
    await sendTelegramMessage(
      botConfig.bot_token,
      chatId,
      'Commandes disponibles:\n/start - Activer les notifications\n/stop - Désactiver les notifications'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error('[TelegramPersonalWebhook] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(botToken: string, chatId: number, text: string): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TelegramPersonalWebhook] Failed to send message:', error);
    } else {
      console.log('[TelegramPersonalWebhook] Message sent successfully');
    }
  } catch (error) {
    console.error('[TelegramPersonalWebhook] Exception sending message:', error);
  }
}
