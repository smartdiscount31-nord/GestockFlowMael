/**
 * Email Template: Remerciement après Livraison
 * Envoyé au client après la récupération de l'appareil réparé
 */

export interface RepairDeliveredThanksEmailData {
  customerName: string;
  ticketId: string;
  deviceBrand: string;
  deviceModel: string;
  invoiceUrl?: string;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
}

export function generateRepairDeliveredThanksEmail(data: RepairDeliveredThanksEmailData): string {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Merci pour votre Confiance</title>
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .thank-you-box {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: #ffffff;
      padding: 30px;
      margin: 20px 0;
      border-radius: 8px;
      text-align: center;
    }
    .thank-you-box h2 {
      margin: 0 0 10px 0;
      font-size: 22px;
      font-weight: 600;
    }
    .info-box {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
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
      background-color: #667eea;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #5a67d8;
    }
    .warranty-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
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
      color: #667eea;
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
      <h1>🎉 Merci pour votre Confiance !</h1>
    </div>

    <div class="content">
      <div class="thank-you-box">
        <h2>Votre réparation est terminée</h2>
        <p style="margin: 10px 0; font-size: 16px;">
          Nous espérons que vous êtes satisfait(e) de notre service
        </p>
      </div>

      <p>Bonjour <strong>${data.customerName}</strong>,</p>

      <p>
        Nous vous remercions d'avoir choisi <strong>${data.companyName}</strong> pour la réparation de votre appareil.
        Votre confiance nous honore et nous motive à toujours fournir le meilleur service possible.
      </p>

      <div class="info-box">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Récapitulatif de votre intervention</h3>
        <div class="info-row">
          <span class="info-label">Numéro de ticket :</span> #${data.ticketId.substring(0, 8).toUpperCase()}
        </div>
        <div class="info-row">
          <span class="info-label">Appareil :</span> ${data.deviceBrand} ${data.deviceModel}
        </div>
        <div class="info-row">
          <span class="info-label">Statut :</span> <span style="color: #10b981; font-weight: 600;">✓ Livré</span>
        </div>
      </div>

      ${data.invoiceUrl ? `
      <center>
        <a href="${data.invoiceUrl}" class="button">
          📄 Consulter ma Facture
        </a>
      </center>
      <p style="text-align: center; font-size: 14px; color: #6b7280; margin-top: 5px;">
        Conservez votre facture pour toute réclamation ultérieure
      </p>
      ` : ''}

      <div class="warranty-box">
        <strong>⚠️ Garantie</strong><br>
        Les réparations effectuées bénéficient d'une garantie selon les conditions générales de vente remises lors de la récupération de votre appareil.
      </div>

      <p>
        <strong>Un problème avec votre appareil ?</strong><br>
        Si vous rencontrez le moindre problème avec votre appareil réparé, n'hésitez pas à nous contacter
        en mentionnant votre numéro de ticket. Nous serons ravis de vous assister.
      </p>

      <p style="margin-top: 30px;">
        <strong>Recommandez-nous !</strong><br>
        Si vous êtes satisfait(e) de notre service, n'hésitez pas à nous recommander à vos proches.
        Nous serions ravis de les accueillir !
      </p>

      <p style="margin-top: 30px;">
        À très bientôt,<br>
        <strong>L'équipe ${data.companyName}</strong>
      </p>
    </div>

    <div class="footer">
      ${data.companyName}
      ${data.companyWebsite ? `<br><a href="${data.companyWebsite}">${data.companyWebsite}</a>` : ''}
      ${data.companyPhone ? `<br>Téléphone : ${data.companyPhone}` : ''}
      ${data.companyEmail ? `<br>Email : <a href="mailto:${data.companyEmail}">${data.companyEmail}</a>` : ''}
    </div>
  </div>
</body>
</html>
  `;

  return html.trim();
}

export function generateRepairDeliveredThanksEmailPlainText(data: RepairDeliveredThanksEmailData): string {
  return `
Merci pour votre Confiance !

Bonjour ${data.customerName},

Nous vous remercions d'avoir choisi ${data.companyName} pour la réparation de votre appareil.
Votre confiance nous honore et nous motive à toujours fournir le meilleur service possible.

Récapitulatif de votre intervention:
- Numéro de ticket : #${data.ticketId.substring(0, 8).toUpperCase()}
- Appareil : ${data.deviceBrand} ${data.deviceModel}
- Statut : ✓ Livré

${data.invoiceUrl ? `Consultez votre facture : ${data.invoiceUrl}` : ''}

⚠️ Garantie
Les réparations effectuées bénéficient d'une garantie selon les conditions générales de vente remises lors de la récupération de votre appareil.

Un problème avec votre appareil ?
Si vous rencontrez le moindre problème avec votre appareil réparé, n'hésitez pas à nous contacter en mentionnant votre numéro de ticket. Nous serons ravis de vous assister.

Recommandez-nous !
Si vous êtes satisfait(e) de notre service, n'hésitez pas à nous recommander à vos proches. Nous serions ravis de les accueillir !

À très bientôt,
L'équipe ${data.companyName}
${data.companyWebsite ? `${data.companyWebsite}` : ''}
${data.companyPhone ? `Téléphone : ${data.companyPhone}` : ''}
${data.companyEmail ? `Email : ${data.companyEmail}` : ''}
  `.trim();
}
