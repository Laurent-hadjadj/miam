// Valeurs de dev par défaut - aucun secret ici : les
// identifiants actuator vivent désormais côté serveur uniquement (voir
// server/index.js, variables d'environnement ACTUATOR_USERNAME/PASSWORD).
// En déploiement, ce fichier est remplacé par la route dynamique /env.js du
// BFF (voir server/index.js) - la même image sert donc dev/int/rec/prod
// sans rebuild, juste en changeant les variables d'environnement.
window.__env = {
  // casBaseUrl absent : contexte CAS par défaut (voir src/app/core/cas-defaults.ts). Autre contexte en
  // développement : casBaseUrl: '/cas', ou une adresse absolue ; vide = CAS à la racine du domaine.
  // Logo d'entreprise optionnel (URL ou chemin) - vide = aucun logo affiché.
  logoUrl: '',
  // Vide = valeurs par défaut du pied de page (voir core/api-config.ts).
  appAuthor: '',
  // Page /informations (RGPD) : vides = formulations neutres.
  privacyController: '',
  privacyDpoContact: '',
  privacyLegalBasis: '',
  auditRetentionMonths: 12,
};
