# syntax=docker/dockerfile:1

# ---- Build ----
# Angular CLI 22 exige Node >= 24.15.0 (vérifié en session : 24.12.0 insuffisant).
FROM node:24 AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# ---- Runtime : BFF Node (server/index.js) ----
# Remplace l'ancien nginx statique : le navigateur n'appelle plus jamais
# l'API actuator CAS directement (ni ses identifiants HTTP Basic), ce serveur
# sert l'appli ET proxy /api/* vers l'API actuator en y attachant l'Authorization
# côté serveur, derrière une session ouverte uniquement après validation
# réelle d'un ticket CAS (voir server/index.js et l'audit de sécurité).
FROM node:24 AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist/miam/browser ./dist/miam/browser

# CAS_BASE_URL (appels serveur à serveur) n'est joignable que par ce conteneur : une URL interne convient, même
# si le navigateur joint le CAS par une autre origine (CAS_PUBLIC_ORIGIN).
# ACTUATOR_USERNAME, ACTUATOR_PASSWORD et SESSION_SECRET n'ont volontairement
# PAS de valeur par défaut : en production (NODE_ENV=production) le BFF refuse
# de démarrer tant qu'ils ne sont pas fournis (docker run -e ...).
# COOKIE_SECURE=true nécessite d'être servi en HTTPS (reverse proxy TLS).
# NODE_ENV=production : Express n'inclut alors jamais de stack trace dans
# ses réponses d'erreur par défaut (défense en profondeur - le BFF a de
# toute façon son propre handler d'erreur générique, voir server/index.js).
# Adresse du CAS : CAS_BASE_URL (hôte + contexte, ex. http://cas.exemple.fr/sso) ; L'API Actuator et l'adresse
# vue du navigateur s'en déduisent (voir docs/exploitation/configuration.md). Aucune valeur figée ici.

ENV NODE_ENV=production
ENV PORT=80
ENV COOKIE_SECURE=true
ENV LOGO_URL=
# Pied de page - vide = valeurs par défaut (voir core/api-config.ts) :
# auteur "Laurent HADJADJ", version reprise de package.json.
ENV APP_AUTHOR=
ENV APP_VERSION=
# Environnement d'exécution : DEV (local), INT (intégration), REC (recette), PRD (production).
# Affiché dans l'en-tête de l'application (badge coloré à côté du logo MIAM).
ENV ENVIRONMENT=DEV

# Journal d'activité SQLite (server/data/audit.db) - à monter en volume pour
# survivre aux redémarrages/recréations du conteneur (ex. `docker run -v
# totp-audit-log:/app/server/data ...`), sinon il repart vide à chaque fois.
VOLUME ["/app/server/data"]

EXPOSE 80

# Santé : 200 = OK, 503 = journal SQLite ou CAS en défaut (voir docs/exploitation/deploiement.md).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||80)+'/api/public/healthcheck/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
