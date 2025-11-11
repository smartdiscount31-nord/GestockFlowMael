/*
 * Page CGV – Version 1.1 – En vigueur au 6 novembre 2025
 */
import React from 'react';

function getReturnTo(): string | null {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get('returnTo');
  } catch {
    return null;
  }
}

export default function CGV() {
  const onAccept = () => {
    try { localStorage.setItem('cgvAccepted', String(Date.now())); } catch {}
    try { window.opener?.postMessage({ type: 'CGV_ACCEPTED' }, window.location.origin); } catch {}
    try { window.close(); } catch {}
    const ret = getReturnTo();
    if (ret) {
      try { window.location.href = ret; } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#111817]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Conditions Générales de Vente – Service de Réparation de Smartphones et Électronique</h1>
        <p className="text-sm text-gray-600 mb-6">Version 1.1 – En vigueur au 6 novembre 2025</p>

        <div className="prose prose-sm max-w-none">
          <p>Smartdiscount31 EURL – Capital social : 6 500 €<br/>
          RCS TOULOUSE 514 893 338 – SIREN : 819 230 772 00017 – TVA : FR30819230772<br/>
          58 Avenue des États‑Unis – 31200 Toulouse – France – Tél. : 07 81 92 01 51 – contact@smartdiscount31.com</p>

          <h2>Article 1 – Objet et champ d’application</h2>
          <p>Les présentes CGV régissent toutes les ventes d’accessoires et prestations de diagnostic et de réparation d’équipements électroniques (smartphones, tablettes, etc.). Elles s’appliquent en boutique, à distance et via devis. Toute commande implique l’acceptation sans réserve des CGV en vigueur. Le Client reconnaît avoir pris connaissance des CGV avant validation de la commande, soit en cochant la case prévue à cet effet, soit en cliquant sur le bouton « J’accepte » au bas de la page CGV dédiée dans l’application.</p>

          <h2>Article 2 – Devis, commande et validation</h2>
          <p>Toute intervention peut faire l’objet d’un devis estimatif (valable 30 jours). La commande est réputée acceptée dès validation du devis, versement d’un acompte éventuel, ou remise de l’appareil avec accord sur l’intervention. Les commandes spécifiques (pièces à la demande) ne sont ni annulables ni remboursables.</p>

          <h2>Article 3 – Prix, TVA et régimes applicables</h2>
          <p>Les prix sont exprimés en euros. Le document commercial indique le régime fiscal applicable : TVA normale, TVA sur marge (biens d’occasion) ou exonération (export). En TVA marge, la TVA n’est pas récupérable et n’apparaît pas ligne par ligne.</p>

          <h2>Article 4 – Paiement</h2>
          <p>Sauf stipulation contraire, le paiement est exigible à la restitution de l’appareil réparé ou à la livraison du produit. Aucun escompte pour paiement anticipé. Les moyens de paiement acceptés sont indiqués en boutique.</p>

          <h2>Article 5 – Retard de paiement et pénalités</h2>
          <p>Tout retard génère des pénalités au taux directeur BCE + 10 points et une indemnité forfaitaire de 40 € pour frais de recouvrement par facture impayée. Des frais complémentaires peuvent être réclamés sur justificatifs.</p>

          <h2>Article 6 – Réserve de propriété</h2>
          <p>Les produits demeurent la propriété de Smartdiscount31 jusqu’au paiement intégral. Les risques sont transférés au Client dès la remise matérielle du bien.</p>

          <h2>Article 7 – Réparations, pièces et garantie d’intervention</h2>
          <p>Réparations selon les règles de l’art. Les pièces peuvent être d’origine, compatibles équivalentes ou reconditionnées selon disponibilité. Garantie commerciale de 6 mois sur la pièce remplacée et la main‑d’oeuvre (3 mois pour batteries et appareils oxydés), hors casse ultérieure, oxydation, choc, mauvaise utilisation ou intervention tierce. La garantie couvre uniquement l’élément réparé/remplacé et n’est pas étendue aux autres fonctions. Toute ouverture ultérieure par un tiers non autorisé annule la garantie.</p>

          <h2>Article 8 – Sauvegarde et données</h2>
          <p>Le Client est responsable de la sauvegarde de ses données. Sauf service de sauvegarde explicitement commandé, Smartdiscount31 n’est pas responsable des pertes de données liées aux opérations techniques ni de la divulgation de données restées sur l’appareil.</p>

          <h2>Article 9 – Diagnostic, frais et appareils irréparables</h2>
          <p>Des frais de diagnostic peuvent être facturés et restent dus en cas de refus du devis ou d’irréparabilité. En cas d’oxydation ou dommages étendus, un devis révisé peut être proposé ; à défaut d’accord, l’appareil est restitué en l’état.</p>

          <h2>Article 10 – Perte de garantie constructeur et étanchéité</h2>
          <p>Une réparation hors circuit agréé constructeur peut entraîner la perte définitive de la garantie fabricant et/ou distributeur restante. Sauf cas particuliers certifiés, l’étanchéité d’origine (normes IP) ne peut être garantie après ouverture ; le Client s’engage à ne pas exposer volontairement son appareil à l’eau après intervention.</p>

          <h2>Article 11 – Cas particuliers – appareils oxydés, tordus ou fragilisés</h2>
          <p>Toute intervention sur appareil oxydé/déformé comporte un risque accru : la réparation peut échouer, révéler de nouvelles pannes ou entraîner l’aggravation de dommages existants. La responsabilité du Prestataire n’est pas engagée pour ces conséquences inhérentes à l’état initial. La garantie est limitée (3 mois) et exclut les pannes non traitées.</p>

          <h2>Article 12 – Appareils non retirés</h2>
          <p>À défaut de retrait de l’appareil dans les 90 jours suivant notification, l’appareil pourra être considéré comme abandonné et traité selon le cadre légal (DEEE, revalorisation), après relances restées sans effet.</p>

          <h2>Article 13 – Droit de rétractation (ventes à distance)</h2>
          <p>Pour les ventes conclues à distance, le droit de rétractation de 14 jours peut s’appliquer, sauf exceptions prévues par la loi. En boutique, pas de droit de rétractation.</p>

          <h2>Article 14 – Garanties légales et retours</h2>
          <p>Les produits vendus bénéficient des garanties légales de conformité et des vices cachés. Tout retour nécessite accord préalable et présentation complète avec preuve d’achat.</p>

          <h2>Article 15 – Responsabilité – limitations</h2>
          <p>La responsabilité de Smartdiscount31 est limitée au montant TTC de la prestation concernée ; aucune indemnisation des préjudices immatériels (perte d’usage, données, manque à gagner) n’est due, sauf faute lourde ou dol.</p>

          <h2>Article 16 – Données personnelles (RGPD)</h2>
          <p>Les données sont traitées pour la gestion des devis, réparations, ventes et facturation. Droits d’accès, rectification, effacement, opposition et portabilité via contact@smartdiscount31.com. Politique de confidentialité disponible sur demande.</p>

          <h2>Article 17 – Force majeure</h2>
          <p>Aucune responsabilité en cas d’événement de force majeure (sinistre, grève, rupture d’approvisionnement critique, panne réseau majeure, etc.).</p>

          <h2>Article 18 – Propriété intellectuelle</h2>
          <p>Les marques, logos, contenus et visuels demeurent protégés. Toute reproduction non autorisée est interdite.</p>

          <h2>Article 19 – Droit applicable, médiation et juridiction</h2>
          <p>Droit français. En cas de litige, recherche préalable d’une solution amiable. Le Client consommateur peut recourir gratuitement à un médiateur de la consommation après réclamation écrite. À défaut, les tribunaux compétents seront saisis.</p>

          <p className="text-sm text-gray-600 mt-6">Dernière mise à jour : 6 novembre 2025</p>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
          En cliquant sur « J’accepte », vous confirmez avoir lu et accepté nos Conditions Générales de Vente. La garantie constructeur peut être perdue après ouverture de l’appareil.
        </div>

        <div className="mt-4">
          <button onClick={onAccept} className="px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">J’accepte</button>
        </div>
      </div>
    </div>
  );
}
