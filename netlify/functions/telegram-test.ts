/**
 * Telegram Test
 * Sends a test message via Telegram (shared or personal based on current mode)
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sharedBotToken = process.env.TELEGRAM_BOT_TOKEN || '';

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[TelegramTest] Testing Telegram connection');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[TelegramTest] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[TelegramTest] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    console.log('[TelegramTest] User:', user.id);

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings_roadmap')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) {
      console.error('[TelegramTest] Error fetching settings:', settingsError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          message: 'Erreur lors de la récupération des paramètres'
        }),
      };
    }

    if (!settings) {
      console.log('[TelegramTest] No settings found');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Aucune configuration trouvée'
        }),
      };
    }

    const mode = settings.telegram_mode || 'shared';
    console.log('[TelegramTest] Mode:', mode);

    // Test based on current mode
    if (mode === 'shared') {
      return await testSharedBot(supabase, user.id, settings);
    } else {
      return await testPersonalBot(supabase, user.id);
    }
  } catch (error) {
    console.error('[TelegramTest] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Erreur lors du test'
      }),
    };
  }
};

/**
 * Test shared bot
 */
async function testSharedBot(supabase: any, userId: string, settings: any) {
  console.log('[TelegramTest] Testing shared bot');

  if (!settings.telegram_chat_id) {
    console.log('[TelegramTest] No chat_id configured');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Vous devez d\'abord connecter Telegram avec le bot partagé'
      }),
    };
  }

  if (!settings.telegram_enabled) {
    console.log('[TelegramTest] Telegram not enabled');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Les notifications Telegram sont désactivées'
      }),
    };
  }

  if (!sharedBotToken) {
    console.error('[TelegramTest] Missing TELEGRAM_BOT_TOKEN');
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Configuration du bot partagé manquante'
      }),
    };
  }

  console.log('[TelegramTest] Sending test message to chat:', settings.telegram_chat_id);

  // Send test message
  const url = `https://api.telegram.org/bot${sharedBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: parseInt(settings.telegram_chat_id),
      text: '🧪 <b>Message de test</b>\n\nVotre connexion Telegram fonctionne correctement ! Vous recevrez vos notifications de Feuille de route ici.',
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[TelegramTest] Failed to send message:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Échec de l\'envoi du message de test'
      }),
    };
  }

  console.log('[TelegramTest] Test message sent successfully');

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Message de test envoyé avec succès !',
      chat_id: settings.telegram_chat_id,
    }),
  };
}

/**
 * Test personal bot
 */
async function testPersonalBot(supabase: any, userId: string) {
  console.log('[TelegramTest] Testing personal bot');

  // Get personal bot configuration
  const { data: botConfig, error: botError } = await supabase
    .from('user_telegram_bots')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (botError || !botConfig) {
    console.error('[TelegramTest] Bot config not found:', botError);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Aucun bot personnel configuré'
      }),
    };
  }

  if (!botConfig.chat_id) {
    console.log('[TelegramTest] No chat_id, bot not linked yet');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Vous devez d\'abord connecter votre bot avec /start'
      }),
    };
  }

  if (botConfig.status !== 'active') {
    console.log('[TelegramTest] Bot not active');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Votre bot n\'est pas actif. Utilisez /start dans Telegram.'
      }),
    };
  }

  console.log('[TelegramTest] Sending test message to chat:', botConfig.chat_id);

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
    console.error('[TelegramTest] Failed to send message:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Échec de l\'envoi du message de test'
      }),
    };
  }

  console.log('[TelegramTest] Test message sent successfully');

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Message de test envoyé avec succès !',
      chat_id: botConfig.chat_id,
    }),
  };
}
