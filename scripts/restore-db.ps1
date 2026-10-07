# ==============================================================================
# ROE BOLET - Script PowerShell de Restauration PostgreSQL
# ==============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "roe_prod_postgres",
    [string]$PostgresUser = "roe_admin",
    [string]$PostgresDb = "roe_bolet_db"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Fichier de sauvegarde introuvable : $BackupFile"
}

Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host "[ROE BOLET] ATTENTION : Restauration de la base de données !" -ForegroundColor Yellow
Write-Host "Fichier source : $BackupFile" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Yellow

Get-Content $BackupFile | docker exec -i $ContainerName psql -U $PostgresUser -d $PostgresDb

Write-Host "[ROE BOLET] Restauration terminée avec succès !" -ForegroundColor Green
