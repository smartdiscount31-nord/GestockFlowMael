/**
 * Email Template: Pièce Commandée
 * Envoyé au client lorsqu'une pièce est commandée pour sa réparation
 */

export interface RepairPartOrderedEmailData {
  customerName: string;
  ticketId: string;
  deviceBrand: string;
  deviceModel: string;
  partName: string;
  supplierName: string;
  expectedDate: string | null;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
}

export function generateRepairPartOrderedEmail(data: RepairPartOrderedEmailData): string {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pièce Commandée</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #f97316;
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .update-box {
      background-color: #fff7ed;
      border-left: 4px solid #f97316;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .update-box h2 {
      margin: 0 0 10px 0;
      font-size: 18px;
      color: #c2410c;
    }
    .info-row {
      margin: 10px 0;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .timeline {
      margin: 20px 0;
      padding-left: 20px;
      border-left: 3px solid #fed7aa;
    }
    .timeline-item {
      margin: 15px 0;
      padding-left: 20px;
      position: relative;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -26px;
      top: 5px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #f97316;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #f97316;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .content {
        padding: 20px 15px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔧 Mise à Jour de votre Réparation</h1>
    </div>

    <div class="content">
      <p>Bonjour <strong>${data.customerName}</strong>,</p>

      <p>
        Nous vous informons qu'une pièce nécessaire à la réparation de votre appareil a été commandée.
      </p>

      <div class="update-box">
        <h2>Informations de commande</h2>
        <div class="info-row">
          <span class="info-label">Numéro de ticket :</span> #${data.ticketId.substring(0, 8).toUpperCase()}
        </div>
        <div class="info-row">
          <span class="info-label">Appareil :</span> ${data.deviceBrand} ${data.deviceModel}
        </div>
        <div class="info-row">
          <span class="info-label">Pièce commandée :</span> ${data.partName}
        </div>
        <div class="info-row">
          <span class="info-label">Fournisseur :</span> ${data.supplierName}
        </div>
        ${data.expectedDate ? `
        <div class="info-row">
          <span class="info-label">Date de réception prévue :</span> ${new Date(data.expectedDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        ` : ''}
      </div>

      <div class="timeline">
        <div class="timeline-item">
          <strong>✓ Prise en charge</strong><br>
          <small style="color: #6b7280;">Votre appareil a été enregistré</small>
        </div>
        <div class="timeline-item">
          <strong>✓ Diagnostic effectué</strong><br>
          <small style="color: #6b7280;">Le problème a été identifié</small>
        </div>
        <div class="timeline-item">
          <strong>🔶 Pièce commandée</strong><br>
          <small style="color: #6b7280;">En attente de réception ${data.expectedDate ? `(prévue le ${new Date(data.expectedDate).toLocaleDateString('fr-FR')})` : ''}</small>
        </div>
        <div class="timeline-item" style="opacity: 0.5;">
          <strong>⏳ Réparation en cours</strong><br>
          <small style="color: #6b7280;">Dès réception de la pièce</small>
        </div>
        <div class="timeline-item" style="opacity: 0.5;">
          <strong>⏳ Prêt à récupérer</strong><br>
          <small style="color: #6b7280;">Vous serez notifié(e)</small>
        </div>
      </div>

      <p>
        Nous vous tiendrons informé(e) dès la réception de la pièce et du début de la réparation.
      </p>

      <p style="margin-top: 30px;">
        Si vous avez des questions, n'hésitez pas à nous contacter en mentionnant votre numéro de ticket.
      </p>

      <p>
        Cordialement,<br>
        <strong>L'équipe ${data.companyName}</strong>
      </p>
    </div>

    <div class="footer">
      ${data.companyName}
      ${data.companyPhone ? `<br>Téléphone : ${data.companyPhone}` : ''}
      ${data.companyEmail ? `<br>Email : <a href="mailto:${data.companyEmail}">${data.companyEmail}</a>` : ''}
    </div>
  </div>
</body>
</html>
  `;

  return html.trim();
}

export function generateRepairPartOrderedEmailPlainText(data: RepairPartOrderedEmailData): string {
  return `
Mise à Jour de votre Réparation

Bonjour ${data.customerName},

Nous vous informons qu'une pièce nécessaire à la réparation de votre appareil a été commandée.

Informations de commande:
- Numéro de ticket : #${data.ticketId.substring(0, 8).toUpperCase()}
- Appareil : ${data.deviceBrand} ${data.deviceModel}
- Pièce commandée : ${data.partName}
- Fournisseur : ${data.supplierName}
${data.expectedDate ? `- Date de réception prévue : ${new Date(data.expectedDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}

Étapes de votre réparation:
✓ Prise en charge
✓ Diagnostic effectué
🔶 Pièce commandée (en cours)
⏳ Réparation en cours
⏳ Prêt à récupérer

Nous vous tiendrons informé(e) dès la réception de la pièce et du début de la réparation.

Si vous avez des questions, n'hésitez pas à nous contacter en mentionnant votre numéro de ticket.

Cordialement,
L'équipe ${data.companyName}
${data.companyPhone ? `Téléphone : ${data.companyPhone}` : ''}
${data.companyEmail ? `Email : ${data.companyEmail}` : ''}
  `.trim();
}
