/**
 * Telegram Personal Bot Setup
 * Configures a personal Telegram bot for a user
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const publicUrl = process.env.PUBLIC_URL || process.env.URL || '';

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[TelegramPersonalSetup] Configuring personal bot');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[TelegramPersonalSetup] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[TelegramPersonalSetup] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { bot_username, bot_token } = body;

    console.log('[TelegramPersonalSetup] User:', user.id, 'Bot:', bot_username);

    if (!bot_username || !bot_token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing bot_username or bot_token' }),
      };
    }

    // Validate bot token format
    if (!bot_token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid bot token format' }),
      };
    }

    // Generate webhook secret
    const webhookSecret = randomBytes(32).toString('hex');
    const webhookUrl = `${publicUrl}/.netlify/functions/telegram-personal-webhook?user_id=${user.id}&secret=${webhookSecret}`;

    console.log('[TelegramPersonalSetup] Webhook URL:', webhookUrl);

    // Set webhook on Telegram
    const telegramUrl = `https://api.telegram.org/bot${bot_token}/setWebhook`;
    const webhookResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message'],
      }),
    });

    if (!webhookResponse.ok) {
      const error = await webhookResponse.text();
      console.error('[TelegramPersonalSetup] Failed to set webhook:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Failed to configure bot webhook. Please verify your bot token.'
        }),
      };
    }

    const webhookResult = await webhookResponse.json();
    console.log('[TelegramPersonalSetup] Webhook set:', webhookResult);

    // Save bot configuration in database
    const { data, error: dbError } = await supabase
      .from('user_telegram_bots')
      .upsert({
        user_id: user.id,
        bot_username: bot_username,
        bot_token: bot_token,
        webhook_secret: webhookSecret,
        webhook_url: webhookUrl,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('[TelegramPersonalSetup] Database error:', dbError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to save bot configuration'
        }),
      };
    }

    console.log('[TelegramPersonalSetup] Bot configured successfully:', data.id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          id: data.id,
          bot_username: data.bot_username,
          webhook_url: data.webhook_url,
          status: data.status,
          connect_url: `https://t.me/${bot_username.replace('@', '')}`,
        },
      }),
    };
  } catch (error) {
    console.error('[TelegramPersonalSetup] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    };
  }
};
