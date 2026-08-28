# Copia de seguridad de la base de datos (MariaDB/MySQL)
# Uso:
#   .\scripts\backup-db.ps1                    → backup en .\backups\ con retención de 30 días
#   .\scripts\backup-db.ps1 -RetentionDays 60  → retención personalizada
#
# Programación recomendada (Task Scheduler de Windows, diario a las 04:00):
#   schtasks /Create /SC DAILY /ST 04:00 /TN "Backup Desamparados DB" ^
#     /TR "powershell -File C:\ruta\backend-desamparados\scripts\backup-db.ps1"
#
# Para comprobar que una copia sirve, restáurala sobre una base de datos vacía:
#   .\scripts\restore-db.ps1 -Archivo .\backups\backup_xxx.sql.gz -BaseDatos desamparados_prueba
#
# En Linux: instala mysqldump y adapta este script si necesitas automatizarlo.
#
# IMPORTANTE: este fichero debe funcionar en Windows PowerShell 5.1, que es el
# que trae Windows de serie. Nada de operadores de PowerShell 7 (?., ??,
# ternario): con ellos el script no llega ni a parsearse y la copia falla antes
# de empezar, en silencio y de madrugada.

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
$mysqldumpCmd = Get-Command mysqldump -ErrorAction SilentlyContinue
$candidates = @(
    $(if ($mysqldumpCmd) { $mysqldumpCmd.Source } else { $null }),
    "C:\Program Files\MariaDB 12.0\bin\mysqldump.exe",
    "C:\Program Files\MariaDB 11.4\bin\mysqldump.exe",
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
$plainFile = Join-Path $backupDir "backup_${DbName}_${timestamp}.sql"

# Con --single-transaction el dump no bloquea la BD (InnoDB) y es consistente.
# Se vuelca primero sin comprimir para poder comprobar que está entero.
$env:MYSQL_PWD = $DbPass
try {
    & $mysqldump --host=$DbHost --user=$DbUser --single-transaction --routines --triggers $DbName |
        Out-File -FilePath $plainFile -Encoding utf8
} finally {
    $env:MYSQL_PWD = $null
}

if (-Not (Test-Path $plainFile) -or (Get-Item $plainFile).Length -eq 0) {
    throw "El backup se generó vacío. Revisa credenciales y estado de la BD."
}

# --- Verificación de integridad ---
# Un volcado cortado a medias (disco lleno, conexión perdida) pesa más de cero y
# parece válido: sin esta comprobación solo se descubre el día que hace falta
# restaurarlo. mysqldump cierra siempre con la marca 'Dump completed'.
$ultimasLineas = Get-Content $plainFile -Tail 5
if (-Not ($ultimasLineas -match 'Dump completed')) {
    Remove-Item $plainFile -Force
    throw "El volcado está truncado (falta la marca 'Dump completed'). Copia descartada."
}

$tablas = (Select-String -Path $plainFile -Pattern '^CREATE TABLE').Count
if ($tablas -lt 10) {
    Remove-Item $plainFile -Force
    throw "El volcado solo contiene $tablas tablas y el esquema tiene bastantes más. Copia descartada."
}

# --- Comprimir con .NET (gzip no viene con Windows) ---
Add-Type -AssemblyName System.IO.Compression.FileSystem
$entrada = [System.IO.File]::OpenRead($plainFile)
$salida  = [System.IO.File]::Create($outFile)
$gzip    = New-Object System.IO.Compression.GZipStream($salida, [System.IO.Compression.CompressionMode]::Compress)
try {
    $entrada.CopyTo($gzip)
} finally {
    $gzip.Dispose()
    $salida.Dispose()
    $entrada.Dispose()
}
Remove-Item $plainFile -Force

$sizeMB = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "Backup OK: $outFile ($sizeMB MB, $tablas tablas, volcado completo)"

# --- Retención: eliminar copias más antiguas que N días ---
Get-ChildItem $backupDir -Filter 'backup_*.sql.gz' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
    Remove-Item -Force

Write-Host "Retención aplicada: $RetentionDays días."
