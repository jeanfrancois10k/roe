# ==============================================================================
# ROE BOLET - Script PowerShell de Sauvegarde Automatisée PostgreSQL
# ==============================================================================

param(
    [string]$BackupDir = ".\backups",
    [string]$ContainerName = "roe_prod_postgres",
    [string]$PostgresUser = "roe_admin",
    [string]$PostgresDb = "roe_bolet_db",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "roe_bolet_backup_${Timestamp}.sql"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "[ROE BOLET] Démarrage de la sauvegarde de la base de données..." -ForegroundColor Cyan
Write-Host "Fichier cible : $BackupFile" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

docker exec -t $ContainerName pg_dump -U $PostgresUser -d $PostgresDb --clean --if-exists > $BackupFile

if (Test-Path $BackupFile) {
    $size = (Get-Item $BackupFile).Length / 1MB
    Write-Host "[ROE BOLET] Sauvegarde réussie ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
} else {
    Write-Error "[ROE BOLET] Échec de la génération du fichier de sauvegarde."
}

# Nettoyage des fichiers plus anciens que $RetentionDays
$limitDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "roe_bolet_backup_*.sql" | Where-Object { $_.LastWriteTime -lt $limitDate } | Remove-Item -Force
Write-Host "[ROE BOLET] Rétention appliquée avec succès." -ForegroundColor Green
