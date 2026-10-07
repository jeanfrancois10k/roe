# Guide de Déploiement Production — Plateforme ROE BOLET

Ce guide détaille la procédure complète de déploiement, de durcissement et d'exploitation de la plateforme **ROE BOLET** en environnement de production.

---

## 1. Architecture Déployée

L'infrastructure conteneurisée repose sur 5 services orchestrés via `docker-compose.prod.yml` sur un réseau isolé :

```
                  Internet (Android POS Terminals / Navigateurs Web)
                                      │
                                      ▼ [Ports 80 / 443]
                            ┌───────────────────┐
                            │    Nginx Proxy    │ (SSL, Rate-Limiting, Gzip, WebSockets)
                            └─────────┬─────────┘
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
         ┌─────────────────────┐             ┌─────────────────────┐
         │ Admin Web (Next.js) │             │   NestJS Backend    │ (Moteur de loterie)
         │    (Port 3001)      │             │    (Port 3000)      │
         └─────────────────────┘             └──────────┬──────────┘
                                                        │
                                   ┌────────────────────┴────────────────────┐
                                   ▼                                         ▼
                        ┌─────────────────────┐                   ┌─────────────────────┐
                        │  PostgreSQL 16 DB   │                   │    Redis 7 Cache    │
                        │ (Grand Livre / ACID)│                   │(Verrous & Pub/Sub)  │
                        └─────────────────────┘                   └─────────────────────┘
```

---

## 2. Prérequis Serveur

- **OS :** Linux Ubuntu 22.04 LTS / Debian 12 ou supérieur
- **Ressources recommandées :** 4 vCPU, 8 Go RAM, 50 Go SSD NVMe
- **Logiciels requis :**
  - Docker Engine v24.0+
  - Docker Compose v2.20+
  - OpenSSL

---

## 3. Procédure de Déploiement Étape par Étape

### Étape 1 : Cloner le Répertoire et Configurer l'Environnement

```bash
git clone <url-du-depot> /opt/roe-bolet
cd /opt/roe-bolet

# Copier et éditer le fichier d'environnement
cp .env.production.example .env.production
nano .env.production
```

> **Important :** Remplacez impérativement tous les mots de passe et clés secrètes par des clés à haute entropie générées via `openssl rand -base64 48`.

### Étape 2 : Lancement des Conteneurs en Production

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### Étape 3 : Application des Migrations de Base de Données

```bash
docker exec -it roe_prod_backend npx prisma migrate deploy
```

### Étape 4 : Initialisation des Jeux et du Compte Super-Administrateur

```bash
docker exec -it roe_prod_backend npm run prisma:seed
```

---

## 4. Configuration SSL/TLS HTTPS

Pour activer le protocole HTTPS sécurisé avec Let's Encrypt :

1. Installez Certbot sur l'hôte :
   ```bash
   sudo apt install -y certbot
   sudo certbot certonly --standalone -d roe-bolet.com -d admin.roe-bolet.com -d api.roe-bolet.com
   ```
2. Créez le dossier `docker/nginx/ssl` et copiez-y vos certificats :
   ```bash
   mkdir -p docker/nginx/ssl
   cp /etc/letsencrypt/live/roe-bolet.com/fullchain.pem docker/nginx/ssl/
   cp /etc/letsencrypt/live/roe-bolet.com/privkey.pem docker/nginx/ssl/
   ```
3. Activez le template SSL :
   ```bash
   cp docker/nginx/conf.d/ssl.conf.template docker/nginx/conf.d/ssl.conf
   docker compose -f docker-compose.prod.yml restart nginx
   ```

---

## 5. Stratégie de Sauvegarde & Restauration Automatisée

### Sauvegarde Quotidienne (Cron Job)
Ajoutez une tâche planifiée nocturne (`crontab -e`) :
```bash
0 3 * * * /opt/roe-bolet/scripts/backup-db.sh >> /var/log/roe-backup.log 2>&1
```

### Restauration en Cas de Désastre
```bash
# Rétablir à partir d'un dump compressé
./scripts/restore-db.sh ./backups/roe_bolet_backup_20261007_030000.sql.gz
```

---

## 6. Surveillance et Endpoints de Santé (Health Checks)

- **Vérification de l'état système :**
  ```bash
  curl -i http://localhost/api/v1/health
  ```
  Retourne :
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-07T13:50:00.000Z",
    "database": { "status": "up", "latencyMs": 2 },
    "memory": { "rssMb": 85, "heapUsedMb": 42 },
    "uptimeSeconds": 3600
  }
  ```
- **Console d'Audit Web :** accessible sur `/audit` avec traçabilité complète des transactions financières, des validations de tirages et de l'historique des vendeurs.
