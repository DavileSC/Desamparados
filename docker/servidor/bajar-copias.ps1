# Baja a este equipo la copia de seguridad más reciente del servidor y
# conserva las últimas -Conservar. Lo lanza el Programador de tareas de
# Windows una vez por semana (docs/servidor.md, «Copias de seguridad»).
#
# Es la copia que no se puede borrar desde el servidor: quien entre en él
# puede borrar las de Google Drive (el permiso de subir allí también deja
# borrar), pero no tiene ninguna llave de este equipo. Por eso la baja este
# equipo y no la sube el servidor.
#
# Entra con el usuario `copias`, que en el servidor solo puede leer la
# carpeta de las copias (sftp de solo lectura, encerrado en ella). Las copias
# llegan cifradas con age: aquí no hace falta la clave privada para guardarlas,
# solo para restaurar.
#
# Uso manual, para probar:
#   powershell -ExecutionPolicy Bypass -File docker\servidor\bajar-copias.ps1

param(
  [string]$Servidor = '51.255.45.220',
  [string]$Usuario = 'copias',
  [string]$Clave = "$env:USERPROFILE\.ssh\copias-desamparados",
  [string]$Destino = "$env:USERPROFILE\Copias Desamparados",
  [int]$Conservar = 8
)

$ErrorActionPreference = 'Stop'
$patron = '^desamparados_\d{8}T\d{6}Z\.tar\.gz\.age$'

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$registro = Join-Path $Destino 'registro.txt'

function Apuntar([string]$texto) {
  $linea = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto
  Write-Host $linea
  Add-Content -Path $registro -Value $linea -Encoding UTF8
}

# sftp en modo de lotes: las órdenes van en un fichero. BatchMode impide que
# se quede esperando una contraseña con la tarea en segundo plano, y
# StrictHostKeyChecking que se conecte a un servidor que no es el de siempre.
function Sftp([string[]]$ordenes) {
  $lote = New-TemporaryFile
  try {
    Set-Content -Path $lote -Value $ordenes -Encoding ASCII
    $salida = & sftp.exe -b $lote.FullName -i $Clave -o IdentitiesOnly=yes -o BatchMode=yes `
      -o StrictHostKeyChecking=yes "$Usuario@$Servidor" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "sftp terminó con error: $($salida -join ' | ')" }
    return $salida
  } finally {
    Remove-Item $lote -Force -ErrorAction SilentlyContinue
  }
}

try {
  if (-not (Test-Path $Clave)) { throw "No está la clave $Clave (ver docs/servidor.md)." }

  # ls -l da el tamaño, para comprobar que la copia ha llegado entera.
  $remotas = @{}
  foreach ($linea in (Sftp @('ls -l /copias'))) {
    $campos = "$linea" -split '\s+'
    $nombre = Split-Path -Leaf $campos[-1]
    if ($campos.Count -ge 9 -and $nombre -match $patron) { $remotas[$nombre] = [int64]$campos[4] }
  }
  if ($remotas.Count -eq 0) { throw 'En el servidor no hay ninguna copia.' }

  $ultima = $remotas.Keys | Sort-Object | Select-Object -Last 1
  $local = Join-Path $Destino $ultima

  if (Test-Path $local) {
    Apuntar "La última copia ($ultima) ya estaba bajada."
  } else {
    # Se baja con otro nombre y se renombra al final: una copia a medias nunca
    # lleva el nombre de una buena.
    $parcial = "$local.parcial"
    $origen = "/copias/$ultima"
    $haciaAqui = $parcial -replace '\\', '/'
    Sftp @("get `"$origen`" `"$haciaAqui`"") | Out-Null
    $tamano = (Get-Item $parcial).Length
    if ($tamano -ne $remotas[$ultima]) {
      Remove-Item $parcial -Force
      throw "La copia ha llegado incompleta: $tamano de $($remotas[$ultima]) bytes."
    }
    Move-Item $parcial $local
    Apuntar ("Bajada {0} ({1:N1} MB)." -f $ultima, ($tamano / 1MB))
  }

  # Rotación: los nombres llevan la fecha, así que por nombre van en orden.
  $sobran = Get-ChildItem -Path $Destino -File |
    Where-Object { $_.Name -match $patron } |
    Sort-Object Name -Descending |
    Select-Object -Skip $Conservar
  foreach ($vieja in $sobran) {
    Remove-Item $vieja.FullName -Force
    Apuntar "Borrada la copia antigua $($vieja.Name)."
  }
  Get-ChildItem -Path $Destino -Filter '*.parcial' -File | Remove-Item -Force
} catch {
  Apuntar "ERROR: $($_.Exception.Message)"
  exit 1
}
