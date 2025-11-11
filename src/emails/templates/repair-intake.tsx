/**
 * Email Template: Confirmation de Prise en Charge
 * Envoyé au client après la création du ticket de réparation
 */

export interface RepairIntakeEmailData {
  customerName: string;
  ticketId: string;
  deviceBrand: string;
  deviceModel: string;
  issueDescription: string;
  ticketPdfUrl: string;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
}

export function generateRepairIntakeEmail(data: RepairIntakeEmailData): string {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de Prise en Charge</title>
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
      background-color: #2563eb;
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
    .ticket-info {
      background-color: #f0f9ff;
      border-left: 4px solid #2563eb;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .ticket-info h2 {
      margin: 0 0 10px 0;
      font-size: 18px;
      color: #1e40af;
    }
    .info-row {
      margin: 10px 0;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #1d4ed8;
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
      color: #2563eb;
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
      <h1>✓ Prise en Charge Confirmée</h1>
    </div>

    <div class="content">
      <p>Bonjour <strong>${data.customerName}</strong>,</p>

      <p>
        Nous accusons réception de votre appareil pour réparation.
        Votre dossier a été créé et notre équipe technique va procéder à l'analyse de l'appareil.
      </p>

      <div class="ticket-info">
        <h2>Détails de votre dossier</h2>
        <div class="info-row">
          <span class="info-label">Numéro de ticket :</span> #${data.ticketId.substring(0, 8).toUpperCase()}
        </div>
        <div class="info-row">
          <span class="info-label">Appareil :</span> ${data.deviceBrand} ${data.deviceModel}
        </div>
        <div class="info-row">
          <span class="info-label">Problème signalé :</span><br>
          ${data.issueDescription}
        </div>
      </div>

      <p>
        Nous vous tiendrons informé(e) de l'avancement de la réparation à chaque étape importante.
      </p>

      <center>
        <a href="${data.ticketPdfUrl}" class="button">
          📄 Télécharger le Ticket de Prise en Charge
        </a>
      </center>

      <p>
        <strong>Conservez précieusement ce ticket</strong> - il vous sera demandé lors de la récupération de votre appareil.
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

export function generateRepairIntakeEmailPlainText(data: RepairIntakeEmailData): string {
  return `
Prise en Charge Confirmée

Bonjour ${data.customerName},

Nous accusons réception de votre appareil pour réparation.
Votre dossier a été créé et notre équipe technique va procéder à l'analyse de l'appareil.

Détails de votre dossier:
- Numéro de ticket : #${data.ticketId.substring(0, 8).toUpperCase()}
- Appareil : ${data.deviceBrand} ${data.deviceModel}
- Problème signalé : ${data.issueDescription}

Nous vous tiendrons informé(e) de l'avancement de la réparation à chaque étape importante.

Téléchargez votre ticket de prise en charge :
${data.ticketPdfUrl}

Conservez précieusement ce ticket - il vous sera demandé lors de la récupération de votre appareil.

Si vous avez des questions, n'hésitez pas à nous contacter en mentionnant votre numéro de ticket.

Cordialement,
L'équipe ${data.companyName}
${data.companyPhone ? `Téléphone : ${data.companyPhone}` : ''}
${data.companyEmail ? `Email : ${data.companyEmail}` : ''}
  `.trim();
}
