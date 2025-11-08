/**
 * Notifications Library
 * Utilitaires pour créer et afficher des notifications internes et externes
 */

import { supabase } from '../supabase';

export type NotificationType =
  | 'repair_intake'
  | 'repair_part_ordered'
  | 'repair_ready'
  | 'repair_delivered'
  | 'repair_parts_alert'
  | 'repair_status_change'
  | 'general';

export type NotificationSeverity = 'urgent' | 'warning' | 'info';

export interface NotificationOptions {
  type: NotificationType;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  link?: string;
  userId?: string | null;
  metadata?: Record<string, any>;
  playSound?: boolean;
  showPopup?: boolean;
  sendEmail?: boolean;
}

/**
 * Créer une notification interne dans la base de données
 */
export async function createInternalNotification(options: NotificationOptions): Promise<string | null> {
  console.log('[Notifications] Création notification interne:', options);

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type: options.type,
        title: options.title,
        message: options.message,
        severity: options.severity || 'info',
        link: options.link || null,
        user_id: options.userId || null,
        read: false,
        metadata: options.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Notifications] Erreur création notification:', error);
      return null;
    }

    console.log('[Notifications] Notification créée avec ID:', data.id);
    return data.id;
  } catch (err) {
    console.error('[Notifications] Exception création notification:', err);
    return null;
  }
}

/**
 * Afficher un toast notification
 */
export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  duration: number = 3000
): void {
  console.log('[Notifications] Affichage toast:', { message, type, duration });

  // Créer un événement custom pour le toast
  const event = new CustomEvent('show-toast', {
    detail: { message, type, duration },
  });
  window.dispatchEvent(event);
}

/**
 * Afficher une notification popup dans l'application
 */
export function showPopup(options: {
  title: string;
  message: string;
  severity?: NotificationSeverity;
  link?: string;
  playSound?: boolean;
}): void {
  console.log('[Notifications] Affichage popup:', options);

  // Jouer un son si demandé
  if (options.playSound) {
    playNotificationSound(options.severity || 'info');
  }

  // Créer un événement custom pour le popup
  const event = new CustomEvent('show-notification-popup', {
    detail: options,
  });
  window.dispatchEvent(event);
}

/**
 * Jouer un son de notification
 */
export function playNotificationSound(severity: NotificationSeverity = 'info'): void {
  console.log('[Notifications] Lecture son:', severity);

  try {
    // Créer un contexte audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Fréquences différentes selon la sévérité
    const frequencies = {
      urgent: [800, 600, 800], // Son d'urgence (bip-bip-bip)
      warning: [600, 500], // Son d'avertissement (bip-bip)
      info: [400], // Son d'information (bip simple)
    };

    const freq = frequencies[severity] || frequencies.info;
    let currentTime = audioContext.currentTime;

    freq.forEach((f, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.value = f;
      osc.type = 'sine';

      gain.gain.setValueAtTime(0.3, currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.1);

      osc.start(currentTime);
      osc.stop(currentTime + 0.1);

      currentTime += 0.15;
    });
  } catch (err) {
    console.error('[Notifications] Erreur lecture son:', err);
  }
}

/**
 * Envoyer une notification complète (interne + toast + popup + son selon les préférences)
 */
export async function sendNotification(options: NotificationOptions): Promise<void> {
  console.log('[Notifications] Envoi notification complète:', options);

  // Créer la notification interne dans la BDD
  await createInternalNotification(options);

  // Récupérer les préférences utilisateur si un userId est spécifié
  let userPrefs = {
    enable_sound: true,
    enable_popup: true,
    enable_email: true,
  };

  if (options.userId) {
    try {
      const { data: settings } = await supabase
        .from('user_notification_settings')
        .select('enable_sound, enable_popup, enable_email')
        .eq('user_id', options.userId)
        .maybeSingle();

      if (settings) {
        userPrefs = settings;
      }
    } catch (err) {
      console.error('[Notifications] Erreur récupération préférences:', err);
    }
  }

  // Afficher un toast
  const toastType = options.severity === 'urgent' ? 'error' : options.severity === 'warning' ? 'info' : 'info';
  showToast(options.message, toastType);

  // Afficher un popup si activé
  if ((options.showPopup !== false) && userPrefs.enable_popup) {
    showPopup({
      title: options.title,
      message: options.message,
      severity: options.severity,
      link: options.link,
      playSound: (options.playSound !== false) && userPrefs.enable_sound,
    });
  }

  // Jouer un son si activé et pas déjà joué par le popup
  if ((options.playSound !== false) && userPrefs.enable_sound && !userPrefs.enable_popup) {
    playNotificationSound(options.severity || 'info');
  }

  console.log('[Notifications] Notification envoyée avec succès');
}

/**
 * Marquer une notification comme lue
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  console.log('[Notifications] Marquer notification comme lue:', notificationId);

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[Notifications] Erreur marquage lecture:', error);
      return false;
    }

    console.log('[Notifications] Notification marquée comme lue');
    return true;
  } catch (err) {
    console.error('[Notifications] Exception marquage lecture:', err);
    return false;
  }
}

/**
 * Récupérer les notifications non lues d'un utilisateur
 */
export async function getUnreadNotifications(userId: string): Promise<any[]> {
  console.log('[Notifications] Récupération notifications non lues pour:', userId);

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Notifications] Erreur récupération notifications:', error);
      return [];
    }

    console.log('[Notifications] Notifications non lues récupérées:', data.length);
    return data || [];
  } catch (err) {
    console.error('[Notifications] Exception récupération notifications:', err);
    return [];
  }
}

/**
 * Notifications spécifiques pour le module atelier
 */

export async function notifyRepairIntake(repairId: string, customerId: string, customerName: string): Promise<void> {
  console.log('[Notifications] Notification prise en charge:', { repairId, customerId, customerName });

  await sendNotification({
    type: 'repair_intake',
    title: 'Nouvelle prise en charge',
    message: `Prise en charge créée pour ${customerName}`,
    severity: 'info',
    link: `/atelier/repair/${repairId}`,
    metadata: {
      repair_id: repairId,
      customer_id: customerId,
      customer_name: customerName,
    },
  });
}

export async function notifyRepairPartOrdered(
  repairId: string,
  productName: string,
  supplierName: string,
  expectedDate: string | null
): Promise<void> {
  console.log('[Notifications] Notification pièce commandée:', { repairId, productName, supplierName });

  await sendNotification({
    type: 'repair_part_ordered',
    title: 'Pièce commandée',
    message: `${productName} commandée chez ${supplierName}${expectedDate ? ` - Réception prévue: ${expectedDate}` : ''}`,
    severity: 'info',
    link: `/atelier/repair/${repairId}`,
    metadata: {
      repair_id: repairId,
      product_name: productName,
      supplier_name: supplierName,
      expected_date: expectedDate,
    },
  });
}

export async function notifyRepairReady(repairId: string, customerName: string, customerEmail: string): Promise<void> {
  console.log('[Notifications] Notification réparation prête:', { repairId, customerName });

  await sendNotification({
    type: 'repair_ready',
    title: 'Réparation terminée',
    message: `La réparation de ${customerName} est prête à être récupérée`,
    severity: 'info',
    link: `/atelier/repair/${repairId}`,
    metadata: {
      repair_id: repairId,
      customer_name: customerName,
      customer_email: customerEmail,
    },
  });
}

export async function notifyRepairDelivered(
  repairId: string,
  customerName: string,
  invoiceId: string | null
): Promise<void> {
  console.log('[Notifications] Notification réparation livrée:', { repairId, customerName, invoiceId });

  await sendNotification({
    type: 'repair_delivered',
    title: 'Réparation livrée',
    message: `Réparation livrée à ${customerName}`,
    severity: 'info',
    link: invoiceId ? `/invoices/${invoiceId}` : `/atelier/repair/${repairId}`,
    metadata: {
      repair_id: repairId,
      customer_name: customerName,
      invoice_id: invoiceId,
    },
  });
}

export async function notifyRepairStatusChange(
  repairId: string,
  oldStatus: string,
  newStatus: string,
  userId?: string
): Promise<void> {
  console.log('[Notifications] Notification changement de statut:', { repairId, oldStatus, newStatus });

  await sendNotification({
    type: 'repair_status_change',
    title: 'Changement de statut',
    message: `Ticket de réparation passé de "${oldStatus}" à "${newStatus}"`,
    severity: 'info',
    link: `/atelier/repair/${repairId}`,
    userId: userId || null,
    metadata: {
      repair_id: repairId,
      old_status: oldStatus,
      new_status: newStatus,
    },
  });
}
