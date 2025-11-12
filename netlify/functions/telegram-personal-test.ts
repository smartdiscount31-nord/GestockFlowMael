/**
 * Telegram Personal Bot Test
 * Sends a test message using the user's personal bot
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[TelegramPersonalTest] Testing personal bot');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[TelegramPersonalTest] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[TelegramPersonalTest] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    console.log('[TelegramPersonalTest] User:', user.id);

    // Get personal bot configuration
    const { data: botConfig, error: botError } = await supabase
      .from('user_telegram_bots')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (botError || !botConfig) {
      console.error('[TelegramPersonalTest] Bot config not found:', botError);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: 'Aucun bot personnel configuré'
        }),
      };
    }

    if (!botConfig.chat_id) {
      console.log('[TelegramPersonalTest] No chat_id, bot not linked yet');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Vous devez d\'abord connecter votre bot avec /start'
        }),
      };
    }

    if (botConfig.status !== 'active') {
      console.log('[TelegramPersonalTest] Bot not active');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Votre bot n\'est pas actif. Utilisez /start dans Telegram.'
        }),
      };
    }

    console.log('[TelegramPersonalTest] Sending test message to chat:', botConfig.chat_id);

    // Send test message
    const url = `https://api.telegram.org/bot${botConfig.bot_token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: parseInt(botConfig.chat_id),
        text: '🧪 <b>Message de test</b>\n\nVotre bot personnel fonctionne correctement ! Vous recevrez vos notifications de Feuille de route ici.',
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TelegramPersonalTest] Failed to send message:', error);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Échec de l\'envoi du message de test'
        }),
      };
    }

    console.log('[TelegramPersonalTest] Test message sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Message de test envoyé avec succès !',
        chat_id: botConfig.chat_id,
      }),
    };
  } catch (error) {
    console.error('[TelegramPersonalTest] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Erreur lors du test'
      }),
    };
  }
};
