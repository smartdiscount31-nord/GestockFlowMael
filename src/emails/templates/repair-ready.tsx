/**
 * Email Template: Appareil Prêt à Récupérer
 * Envoyé au client lorsque la réparation est terminée
 */

export interface RepairReadyEmailData {
  customerName: string;
  ticketId: string;
  deviceBrand: string;
  deviceModel: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  openingHours?: string;
}

export function generateRepairReadyEmail(data: RepairReadyEmailData): string {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appareil Prêt à Récupérer</title>
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
      background-color: #10b981;
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
    .success-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .success-box h2 {
      margin: 0 0 10px 0;
      font-size: 18px;
      color: #047857;
    }
    .info-row {
      margin: 10px 0;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .pickup-info {
      background-color: #fef3c7;
      border: 2px dashed #f59e0b;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .pickup-info h3 {
      margin: 0 0 15px 0;
      font-size: 16px;
      color: #92400e;
    }
    .highlight {
      background-color: #fef08a;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
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
      color: #10b981;
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
      <h1>✅ Votre Appareil est Prêt !</h1>
    </div>

    <div class="content">
      <p>Bonjour <strong>${data.customerName}</strong>,</p>

      <p style="font-size: 18px; color: #10b981; font-weight: 600;">
        Bonne nouvelle ! La réparation de votre appareil est terminée.
      </p>

      <div class="success-box">
        <h2>Informations de récupération</h2>
        <div class="info-row">
          <span class="info-label">Numéro de ticket :</span> #${data.ticketId.substring(0, 8).toUpperCase()}
        </div>
        <div class="info-row">
          <span class="info-label">Appareil :</span> ${data.deviceBrand} ${data.deviceModel}
        </div>
        <div class="info-row">
          <span class="info-label">Statut :</span> <span style="color: #10b981; font-weight: 600;">✓ Réparé et prêt</span>
        </div>
      </div>

      <div class="pickup-info">
        <h3>📍 Où récupérer votre appareil ?</h3>
        ${data.companyAddress ? `
        <div style="margin: 10px 0;">
          <strong>${data.companyName}</strong><br>
          ${data.companyAddress}
        </div>
        ` : `
        <div style="margin: 10px 0;">
          <strong>${data.companyName}</strong>
        </div>
        `}
        ${data.openingHours ? `
        <div style="margin: 10px 0;">
          <strong>Horaires d'ouverture :</strong><br>
          ${data.openingHours}
        </div>
        ` : ''}
        ${data.companyPhone ? `
        <div style="margin: 10px 0;">
          <strong>Téléphone :</strong> ${data.companyPhone}
        </div>
        ` : ''}
      </div>

      <p>
        <strong>⚠️ N'oubliez pas :</strong> Munissez-vous de votre <span class="highlight">ticket de prise en charge</span>
        et d'une <span class="highlight">pièce d'identité</span> pour récupérer votre appareil.
      </p>

      <p>
        La facture vous sera remise lors de la récupération de votre appareil.
      </p>

      <p style="margin-top: 30px;">
        Nous vous remercions de votre confiance et espérons vous revoir bientôt !
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

export function generateRepairReadyEmailPlainText(data: RepairReadyEmailData): string {
  return `
Votre Appareil est Prêt !

Bonjour ${data.customerName},

Bonne nouvelle ! La réparation de votre appareil est terminée.

Informations de récupération:
- Numéro de ticket : #${data.ticketId.substring(0, 8).toUpperCase()}
- Appareil : ${data.deviceBrand} ${data.deviceModel}
- Statut : ✓ Réparé et prêt

Où récupérer votre appareil ?
${data.companyName}
${data.companyAddress || ''}
${data.openingHours ? `Horaires d'ouverture : ${data.openingHours}` : ''}
${data.companyPhone ? `Téléphone : ${data.companyPhone}` : ''}

⚠️ N'oubliez pas : Munissez-vous de votre ticket de prise en charge et d'une pièce d'identité pour récupérer votre appareil.

La facture vous sera remise lors de la récupération de votre appareil.

Nous vous remercions de votre confiance et espérons vous revoir bientôt !

Cordialement,
L'équipe ${data.companyName}
${data.companyPhone ? `Téléphone : ${data.companyPhone}` : ''}
${data.companyEmail ? `Email : ${data.companyEmail}` : ''}
  `.trim();
}
