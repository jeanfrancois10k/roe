#!/usr/bin/env bash
# ==============================================================================
# ROE BOLET - Script de Sauvegarde Automatisée PostgreSQL
# Effectue un dump complet compressé de la base de données avec rétention
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/roe_bolet_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

CONTAINER_NAME="${CONTAINER_NAME:-roe_prod_postgres}"
POSTGRES_USER="${POSTGRES_USER:-roe_admin}"
POSTGRES_DB="${POSTGRES_DB:-roe_bolet_db}"

mkdir -p "${BACKUP_DIR}"

echo "======================================================================"
echo "[ROE BOLET] Démarrage de la sauvegarde de la base de données..."
echo "Date / Heure : $(date)"
echo "Fichier cible : ${BACKUP_FILE}"
echo "======================================================================"

# Exécution du pg_dump via docker exec
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists | gzip > "${BACKUP_FILE}"

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[ROE BOLET] Sauvegarde réussie avec succès ! (Taille: ${FILE_SIZE})"

# Purge des sauvegardes plus anciennes que RETENTION_DAYS
echo "[ROE BOLET] Nettoyage des anciennes sauvegardes (> ${RETENTION_DAYS} jours)..."
find "${BACKUP_DIR}" -name "roe_bolet_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;

echo "[ROE BOLET] Opération terminée avec succès."
