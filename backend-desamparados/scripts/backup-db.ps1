# Copia de seguridad de la base de datos (MariaDB/MySQL)
# Uso:
#   .\scripts\backup-db.ps1                    → backup en .\backups\ con retención de 30 días
#   .\scripts\backup-db.ps1 -RetentionDays 60  → retención personalizada
#
# Programación recomendada (Task Scheduler de Windows, diario a las 04:00):
#   schtasks /Create /SC DAILY /ST 04:00 /TN "Backup Desamparados DB" ^
#     /TR "powershell -File C:\ruta\backend-desamparados\scripts\backup-db.ps1"
#
# En Linux: instala mysqldump y adapta este script si necesitas automatizarlo.

param(
    [int]$RetentionDays = 30
)

$ErrorActionPreference = 'Stop'

# --- Cargar configuración desde .env ---
$envFile = Join-Path $PSScriptRoot '..\.env'
if (-Not (Test-Path $envFile)) { throw "No se encuentra .env en $(Split-Path $envFile -Parent)" }

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]+)"?\s*$') {
        Set-Variable -Name "Env_$($Matches[1])" -Value $Matches[2] -Scope Script
    }
}

$DbHost   = if ($Env_DATABASE_HOST) { $Env_DATABASE_HOST } else { 'localhost' }
$DbUser   = if ($Env_DATABASE_USER) { $Env_DATABASE_USER } else { 'root' }
$DbPass   = $Env_DATABASE_PASSWORD
$DbName   = $Env_DATABASE_NAME
if (-Not $DbName) { throw "Falta DATABASE_NAME en .env" }

# --- Localizar mysqldump ---
$candidates = @(
    (Get-Command mysqldump -ErrorAction SilentlyContinue)?.Source,
    "C:\Program Files\MariaDB 10.11\bin\mysqldump.exe",
    "C:\Program Files\MariaDB 10.6\bin\mysqldump.exe",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if (-Not $candidates) {
    throw "mysqldump no encontrado. Instala MariaDB/MySQL client o añade su ruta a PATH."
}
$mysqldump = $candidates[0]

# --- Ejecutar backup ---
$backupDir = Join-Path $PSScriptRoot '..\backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outFile   = Join-Path $backupDir "backup_${DbName}_${timestamp}.sql.gz"

# Con --single-transaction el dump no bloquea la BD (InnoDB) y es consistente
$env:MYSQL_PWD = $DbPass
& $mysqldump --host=$DbHost --user=$DbUser --single-transaction --routines --triggers $DbName 2>$null |
    ForEach-Object { [Text.Encoding]::UTF8.GetBytes($_) } |
    & gzip > $outFile
$env:MYSQL_PWD = $null

if (-Not (Test-Path $outFile) -or (Get-Item $outFile).Length -eq 0) {
    throw "El backup se generó vacío. Revisa credenciales y estado de la BD."
}

$sizeMB = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "Backup OK: $outFile ($sizeMB MB)"

# --- Retención: eliminar copias más antiguas que N días ---
Get-ChildItem $backupDir -Filter 'backup_*.sql.gz' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
    Remove-Item -Force

Write-Host "Retención aplicada: $RetentionDays días."
