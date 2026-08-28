# Restauración de una copia de seguridad.
#
# Existe sobre todo para poder *comprobar* que las copias sirven: una copia que
# nunca se ha restaurado es una suposición, no una copia de seguridad. Conviene
# hacerlo sobre una base de datos de usar y tirar cada pocos meses.
#
# Uso:
#   .\scripts\restore-db.ps1 -Archivo .\backups\backup_xxx.sql.gz -BaseDatos desamparados_prueba
#
# Windows PowerShell 5.1: nada de operadores de PowerShell 7 en este fichero.

param(
    [Parameter(Mandatory = $true)][string]$Archivo,
    [Parameter(Mandatory = $true)][string]$BaseDatos,
    # Sin este interruptor, el script se niega a escribir sobre la base de datos
    # de producción: restaurar encima de ella borra lo que haya después de la copia.
    [switch]$PermitirSobrescribirProduccion
)

$ErrorActionPreference = 'Stop'

if (-Not (Test-Path $Archivo)) { throw "No se encuentra el archivo $Archivo" }

# --- Cargar configuración desde .env ---
$envFile = Join-Path $PSScriptRoot '..\.env'
if (-Not (Test-Path $envFile)) { throw "No se encuentra .env en $(Split-Path $envFile -Parent)" }

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]+)"?\s*$') {
        Set-Variable -Name "Env_$($Matches[1])" -Value $Matches[2] -Scope Script
    }
}

$DbHost = if ($Env_DATABASE_HOST) { $Env_DATABASE_HOST } else { 'localhost' }
$DbUser = if ($Env_DATABASE_USER) { $Env_DATABASE_USER } else { 'root' }
$DbPass = $Env_DATABASE_PASSWORD

if ($BaseDatos -eq $Env_DATABASE_NAME -and -Not $PermitirSobrescribirProduccion) {
    throw "«$BaseDatos» es la base de datos que usa la aplicación. Restaura sobre una de prueba, o pasa -PermitirSobrescribirProduccion si es lo que quieres."
}

# --- Localizar el cliente mysql ---
$mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
$candidates = @(
    $(if ($mysqlCmd) { $mysqlCmd.Source } else { $null }),
    "C:\Program Files\MariaDB 12.0\bin\mysql.exe",
    "C:\Program Files\MariaDB 11.4\bin\mysql.exe",
    "C:\Program Files\MariaDB 10.11\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if (-Not $candidates) { throw "cliente mysql no encontrado. Instala MariaDB/MySQL client o añade su ruta a PATH." }
$mysql = $candidates[0]

# --- Descomprimir a un temporal ---
$temporal = Join-Path $env:TEMP "restore_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$entrada = [System.IO.File]::OpenRead((Resolve-Path $Archivo))
$gzip    = New-Object System.IO.Compression.GZipStream($entrada, [System.IO.Compression.CompressionMode]::Decompress)
$salida  = [System.IO.File]::Create($temporal)
try {
    $gzip.CopyTo($salida)
} finally {
    $salida.Dispose()
    $gzip.Dispose()
    $entrada.Dispose()
}

try {
    $env:MYSQL_PWD = $DbPass

    Write-Host "Creando la base de datos «$BaseDatos» si no existe..."
    "CREATE DATABASE IF NOT EXISTS ``$BaseDatos`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" |
        & $mysql --host=$DbHost --user=$DbUser

    Write-Host "Restaurando $Archivo ..."
    Get-Content $temporal -Raw | & $mysql --host=$DbHost --user=$DbUser $BaseDatos

    # --- Comprobación: la restauración tiene que dejar tablas con datos ---
    $tablas = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$BaseDatos';" |
        & $mysql --host=$DbHost --user=$DbUser --skip-column-names
    $tablas = [int]($tablas | Select-Object -Last 1)

    if ($tablas -lt 10) {
        throw "La restauración dejó solo $tablas tablas: la copia no sirve."
    }

    Write-Host "Restauración correcta: $tablas tablas en «$BaseDatos»."
    Write-Host "Recuerda borrar la base de datos de prueba cuando termines:"
    Write-Host "  DROP DATABASE ``$BaseDatos``;"
} finally {
    $env:MYSQL_PWD = $null
    Remove-Item $temporal -Force -ErrorAction SilentlyContinue
}
