/**
 * Telegram Shared Bot Webhook Handler
 * Handles incoming webhook events from the shared Telegram bot
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET!;

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
  console.log('[TelegramSharedWebhook] Received webhook event');

  // Verify webhook secret
  const secretToken = event.headers['x-telegram-bot-api-secret-token'];
  if (secretToken !== webhookSecret) {
    console.error('[TelegramSharedWebhook] Invalid secret token');
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const update: TelegramUpdate = JSON.parse(event.body || '{}');
    console.log('[TelegramSharedWebhook] Update:', JSON.stringify(update));

    const message = update.message;
    if (!message || !message.text) {
      console.log('[TelegramSharedWebhook] No text message, ignoring');
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    console.log('[TelegramSharedWebhook] Chat ID:', chatId, 'Text:', text);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle /start {user_id} command
    if (text.startsWith('/start ')) {
      const userId = text.substring(7).trim();
      console.log('[TelegramSharedWebhook] /start command for user:', userId);

      // Save telegram_chat_id for this user
      const { error } = await supabase
        .from('user_settings_roadmap')
        .upsert({
          user_id: userId,
          telegram_chat_id: chatId.toString(),
          telegram_enabled: true,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[TelegramSharedWebhook] Error saving chat_id:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to save chat ID' }),
        };
      }

      console.log('[TelegramSharedWebhook] Chat ID saved successfully');
      // Verify persisted settings (debug)
      const { data: verify, error: verifyErr } = await supabase
        .from('user_settings_roadmap')
        .select('user_id, telegram_chat_id, telegram_enabled, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (verifyErr) {
        console.error('[TelegramSharedWebhook] Verify select error:', verifyErr);
      } else {
        console.log('[TelegramSharedWebhook] Verify persisted row:', verify);
      }

      // Send confirmation message
      await sendTelegramMessage(
        chatId,
        'Connexion réussie ! Vous recevrez maintenant vos notifications de Feuille de route.'
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    // Handle /stop command
    if (text === '/stop') {
      console.log('[TelegramSharedWebhook] /stop command');

      // Find user by chat_id and disable telegram
      const { error } = await supabase
        .from('user_settings_roadmap')
        .update({
          telegram_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('telegram_chat_id', chatId.toString());

      if (error) {
        console.error('[TelegramSharedWebhook] Error disabling telegram:', error);
      }

      // Send confirmation
      await sendTelegramMessage(
        chatId,
        'Notifications Telegram désactivées. Utilisez /start pour réactiver.'
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    // Unknown command
    console.log('[TelegramSharedWebhook] Unknown command');
    await sendTelegramMessage(
      chatId,
      'Commandes disponibles:\n/start <user_id> - Connecter votre compte\n/stop - Désactiver les notifications'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error('[TelegramSharedWebhook] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[TelegramSharedWebhook] Missing TELEGRAM_BOT_TOKEN');
    return;
  }

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
      console.error('[TelegramSharedWebhook] Failed to send message:', error);
    } else {
      console.log('[TelegramSharedWebhook] Message sent successfully');
    }
  } catch (error) {
    console.error('[TelegramSharedWebhook] Exception sending message:', error);
  }
}
