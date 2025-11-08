// Netlify Function: repairs-daily-17h-digest
// Fonction scheduled: Envoie un digest quotidien des pièces à commander
// Déclenché par défaut à 16:00 UTC (17:00 Paris hiver, 18:00 été)
// AMÉLIORATION: Utilise les préférences utilisateur (heure, jours actifs, canaux de notification)

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  console.log('[repairs-daily-17h-digest] Début du traitement');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[repairs-daily-17h-digest] Variables d\'environnement manquantes');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'missing_env' })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
    const currentHour = now.getUTCHours(); // Heure UTC actuelle
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase', timeZone: 'Europe/Paris' }); // Jour actuel en timezone Paris

    console.log('[repairs-daily-17h-digest] Date du jour:', today, '| Heure UTC:', currentHour, '| Jour:', currentDay);

    // Interroger la vue repair_parts_to_order
    const { data: partsToOrder, error: partsErr } = await supabase
      .from('repair_parts_to_order')
      .select('*');

    if (partsErr) {
      console.error('[repairs-daily-17h-digest] Erreur récupération pièces à commander:', partsErr);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'fetch_error', message: partsErr.message })
      };
    }

    console.log('[repairs-daily-17h-digest] Total pièces à commander:', partsToOrder?.length || 0);

    if (!partsToOrder || partsToOrder.length === 0) {
      console.log('[repairs-daily-17h-digest] Aucune pièce à commander aujourd\'hui');
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, message: 'Aucune pièce à commander', parts_count: 0 })
      };
    }

    // Grouper par fournisseur
    const bySupplier: Record<string, any[]> = {};
    let totalCost = 0;

    for (const part of partsToOrder) {
      const supplier = part.supplier_name || 'Non défini';

      if (!bySupplier[supplier]) {
        bySupplier[supplier] = [];
      }

      bySupplier[supplier].push(part);

      // Calculer le coût si disponible
      if (part.purchase_price && part.quantity) {
        totalCost += part.purchase_price * part.quantity;
      }
    }

    console.log('[repairs-daily-17h-digest] Nombre de fournisseurs:', Object.keys(bySupplier).length);
    console.log('[repairs-daily-17h-digest] Coût total estimé:', totalCost.toFixed(2));

    // Construire le payload pour la notification
    const supplierSummary = Object.entries(bySupplier).map(([supplier, parts]) => ({
      supplier,
      parts_count: parts.length,
      parts: parts.map(p => ({
        product_name: p.product_name,
        product_sku: p.product_sku,
        quantity: p.quantity,
        repair_id: p.repair_id,
        customer_name: p.customer_name
      }))
    }));

    const payload = {
      date: today,
      total_parts: partsToOrder.length,
      total_cost_estimate: totalCost.toFixed(2),
      suppliers: supplierSummary,
      generated_at: now.toISOString()
    };

    console.log('[repairs-daily-17h-digest] Payload construit:', JSON.stringify(payload, null, 2));

    // Récupérer tous les utilisateurs avec rôle MAGASIN, ADMIN ou ADMIN_FULL
    const { data: users, error: usersErr } = await supabase
      .from('profiles')
      .select('id, email, role')
      .in('role', ['MAGASIN', 'ADMIN', 'ADMIN_FULL']);

    if (usersErr || !users || users.length === 0) {
      console.error('[repairs-daily-17h-digest] Erreur récupération utilisateurs:', usersErr);
      // Continue quand même pour envoyer une notification globale
    }

    console.log('[repairs-daily-17h-digest] Nombre d\'utilisateurs à notifier:', users?.length || 0);

    // Créer des notifications pour chaque utilisateur concerné
    let notificationsCreated = 0;
    let emailsToSend = 0;

    if (users && users.length > 0) {
      for (const user of users) {
        try {
          // Récupérer les préférences de notification de l'utilisateur
          console.log(`[repairs-daily-17h-digest] Récupération préférences pour ${user.email}`);
          const { data: settings } = await supabase
            .from('user_notification_settings')
            .select('daily_digest_hour, active_days, enable_email, enable_popup')
            .eq('user_id', user.id)
            .maybeSingle();

          // Valeurs par défaut si aucun paramètre trouvé
          const userDigestHour = settings?.daily_digest_hour ?? 17;
          const userActiveDays = settings?.active_days ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
          const enableEmail = settings?.enable_email ?? true;
          const enablePopup = settings?.enable_popup ?? true;

          console.log(`[repairs-daily-17h-digest] Préférences ${user.email}: heure=${userDigestHour}, jours=${userActiveDays.join(',')}, email=${enableEmail}, popup=${enablePopup}`);

          // Vérifier si le jour actuel est dans les jours actifs de l'utilisateur
          if (!userActiveDays.includes(currentDay)) {
            console.log(`[repairs-daily-17h-digest] Jour ${currentDay} non actif pour ${user.email}, skip`);
            continue;
          }

          // Créer la notification interne si popup activé
          if (enablePopup) {
            const notificationData = {
              user_id: user.id,
              type: 'repair_parts_alert',
              title: `Pièces à commander (${partsToOrder.length})`,
              message: `${partsToOrder.length} pièce(s) à commander pour un montant estimé de ${totalCost.toFixed(2)}€. Fournisseurs: ${Object.keys(bySupplier).join(', ')}`,
              severity: 'info',
              link: '/atelier/parts-to-order',
              read: false,
              metadata: payload
            };

            const { error: notifErr } = await supabase
              .from('notifications')
              .insert(notificationData);

            if (notifErr) {
              console.error(`[repairs-daily-17h-digest] Erreur création notification pour ${user.email}:`, notifErr);
            } else {
              console.log(`[repairs-daily-17h-digest] Notification interne créée pour ${user.email}`);
              notificationsCreated++;
            }
          }

          // Compter les emails à envoyer (si activé)
          if (enableEmail) {
            emailsToSend++;
            console.log(`[repairs-daily-17h-digest] Email sera envoyé à ${user.email}`);
            // Note: L'envoi réel d'email nécessiterait une intégration avec un service email
            // (ex: SendGrid, Resend, etc.) qui n'est pas implémenté ici
          }
        } catch (notifEx: any) {
          console.error(`[repairs-daily-17h-digest] Exception notification pour user ${user.id}:`, notifEx);
        }
      }
    }

    console.log('[repairs-daily-17h-digest] Notifications créées:', notificationsCreated);
    console.log('[repairs-daily-17h-digest] Emails à envoyer:', emailsToSend);

    // Log de l'événement dans un tableau de logs si disponible (optionnel)
    try {
      // Vérifier si la table existe
      const { data: tableCheck } = await supabase
        .from('repair_daily_logs')
        .select('id')
        .limit(1);

      // Si la requête réussit, la table existe
      await supabase
        .from('repair_daily_logs')
        .insert({
          log_date: today,
          parts_count: partsToOrder.length,
          notifications_sent: notificationsCreated,
          payload: {
            ...payload,
            emails_to_send: emailsToSend,
            current_hour_utc: currentHour,
            current_day: currentDay,
          },
          created_at: now.toISOString()
        });

      console.log('[repairs-daily-17h-digest] Log enregistré dans repair_daily_logs');
    } catch (logErr: any) {
      console.log('[repairs-daily-17h-digest] Table repair_daily_logs non disponible (normal si non créée)');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        date: today,
        current_hour_utc: currentHour,
        current_day: currentDay,
        parts_to_order: partsToOrder.length,
        suppliers: Object.keys(bySupplier).length,
        total_cost_estimate: totalCost.toFixed(2),
        notifications_created: notificationsCreated,
        emails_to_send: emailsToSend,
        message: `Digest quotidien traité: ${partsToOrder.length} pièces à commander, ${notificationsCreated} notifications créées, ${emailsToSend} emails prévus`
      })
    };

  } catch (error: any) {
    console.error('[repairs-daily-17h-digest] Erreur globale:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
