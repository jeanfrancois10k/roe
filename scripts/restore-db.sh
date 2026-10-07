#!/usr/bin/env bash
# ==============================================================================
# ROE BOLET - Script de Restauration PostgreSQL
# Restaure un fichier .sql ou .sql.gz dans le conteneur PostgreSQL
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <chemin_vers_fichier_backup>"
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${CONTAINER_NAME:-roe_prod_postgres}"
POSTGRES_USER="${POSTGRES_USER:-roe_admin}"
POSTGRES_DB="${POSTGRES_DB:-roe_bolet_db}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Erreur : Fichier '${BACKUP_FILE}' introuvable."
    exit 1
fi

echo "======================================================================"
echo "[ROE BOLET] ATTENTION : Restauration de la base de données !"
echo "Base cible : ${POSTGRES_DB} sur conteneur ${CONTAINER_NAME}"
echo "Source : ${BACKUP_FILE}"
echo "======================================================================"

if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
else
    docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${BACKUP_FILE}"
fi

echo "[ROE BOLET] Restauration terminée avec succès !"
