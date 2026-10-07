# ==============================================================================
# ROE BOLET - Production Dockerfile for NestJS Transactional Backend
# Multi-stage build for minimal image size and hardened security
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Dependencies
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Installer OpenSSL (requis par Prisma sur Alpine)
RUN apk add --no-cache openssl libc6-compat

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installation des dépendances (y compris dev pour la compilation)
RUN npm ci

# Génération du client Prisma typé
RUN npx prisma generate

# Copier le reste du code source
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

# Compiler l'application NestJS
RUN npm run build

# Éliminer les dépendances de développement pour la production
RUN npm prune --omit=dev

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Dépendances système d'exécution (OpenSSL pour Prisma Engine)
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3000

# Utiliser l'utilisateur non-privilégié 'node' inclus dans l'image node:alpine
RUN chown -R node:node /usr/src/app

USER node

# Copier les dépendances de production et le client Prisma généré
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./

EXPOSE 3000

# Démarrage direct du binaire compilé NestJS
CMD ["node", "dist/main.js"]
