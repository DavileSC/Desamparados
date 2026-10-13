#!/usr/bin/env bash
# Actualiza una instalación a la última versión: copia de seguridad, código
# nuevo, imágenes nuevas, migraciones y comprobación de que la web responde.
#
#   sudo -u desamparados ./docker/actualizar.sh            # a lo último de main
#   sudo -u desamparados ./docker/actualizar.sh v1.4.0     # a una etiqueta o commit
#   ./docker/actualizar.sh --sin-copia                     # solo si la copia ya está hecha
#
# Qué hace, en orden, y por qué en ese orden:
#   1. Comprueba que el repositorio no tiene cambios a mano: un `git pull`
#      encima los mezclaría o se pararía a medias. Los datos de la corporación
#      (instalacion/) y el .env no cuentan: están fuera de git.
#   2. Hace la copia de seguridad ANTES de tocar nada. Las migraciones cambian
#      la base y no tienen vuelta atrás: si la versión nueva sale mal, lo único
#      que devuelve la base a como estaba es esta copia.
#   3. Trae el código (solo avance rápido: nunca mezcla ni reescribe historia).
#   4. Construye las imágenes con la web aún en marcha: así la parada se queda
#      en lo que tarda en cambiar de contenedor, y no en toda la compilación.
#   5. Levanta: el compose aplica las migraciones y, si fallan, no arranca la API.
#   6. Espera a que la API diga que está sana y a que la web haya escrito sus
#      datos al arrancar, y avisa si no lo consigue.
#
# No vuelve atrás solo: con la base ya migrada, volver al código anterior la
# dejaría con un esquema que ese código no conoce. Si falla, dice qué hacer.

set -Eeuo pipefail

log() { printf '%s [actualizar] %s\n' "$(date +%H:%M:%S)" "$*"; }
fallo() { log "ERROR: $*" >&2; exit 1; }

PROYECTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROYECTO_DIR"

SIN_COPIA=0
DESTINO=""
for arg in "$@"; do
  case "$arg" in
    --sin-copia) SIN_COPIA=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    -*) fallo "Opción desconocida: $arg" ;;
    *) DESTINO="$arg" ;;
  esac
done

[[ -f compose.yaml ]] || fallo "No estoy en la carpeta del proyecto ($PROYECTO_DIR)."
[[ -f .env ]] || fallo "Falta el .env: esta carpeta no es una instalación (ver docker/instalar.sh)."
# Desde que salieron de git, cada instalación tiene los suyos junto al .env.
# Sin ellos la web no se construye y la API no arranca: mejor parar antes de la copia.
[[ -f instalacion/datos-entidad.json ]] || fallo "Falta instalacion/datos-entidad.json, los datos de la corporación. Cópialo de shared/datos-entidad.ejemplo.json y rellénalo (docs/despliegue.md, «Los datos de la corporación»)."
command -v docker >/dev/null || fallo "No encuentro docker."

compose() { docker compose -f compose.yaml "$@"; }

# --- 1. Sin cambios a mano ---
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no >&2
  fallo "Hay cambios a mano en el repositorio. Guárdalos o descártalos antes de actualizar."
fi

ANTES="$(git rev-parse --short HEAD)"

# nginx, con su propio usuario, sirve del montaje la marca, las fotos y el
# mapa: un fichero subido sin lectura para los demás da 403. Se arregla aquí
# si son de este usuario; si no, se avisa (docs/despliegue.md, «Permisos»).
permisos_ok=1
chmod 755 instalacion 2>/dev/null || permisos_ok=0
for d in instalacion/marca instalacion/imagenes instalacion/mapas; do
  [[ -d "$d" ]] || continue
  find "$d" \( -type d -exec chmod 755 {} + \) -o \( -type f -exec chmod 644 {} + \) 2>/dev/null || permisos_ok=0
done
[[ "$permisos_ok" -eq 1 ]] || log "AVISO: no he podido dejar instalacion/ y sus marca/, imagenes/ y mapas/ en 755/644 (¿de otro usuario?). Lo que nginx no pueda leer dará 403."

# --- 2. La copia de seguridad ---
if [[ "$SIN_COPIA" -eq 1 ]]; then
  log "Sin copia de seguridad, como se ha pedido."
else
  CONF=/etc/desamparados/copia.env
  [[ -r "$CONF" ]] || fallo "No encuentro $CONF (la configuración de las copias, ver docs/despliegue.md). Si ya tienes una copia de hoy, repite con --sin-copia."
  log "Copia de seguridad antes de actualizar…"
  # El fichero es del servidor, no del repositorio: no hay nada que seguir.
  # shellcheck source=/dev/null
  ( set -a; . "$CONF"; set +a; PROYECTO_DIR="$PROYECTO_DIR" bash ./backend-desamparados/scripts/backup-vps.sh ) \
    || fallo "La copia de seguridad ha fallado: no se actualiza sin ella."
fi

# --- 3. El código ---
log "Trayendo el código…"
git fetch --quiet --tags origin
if [[ -n "$DESTINO" ]]; then
  git rev-parse --verify --quiet "$DESTINO^{commit}" >/dev/null || fallo "No existe la versión «$DESTINO»."
  # Una etiqueta o un commit concreto: se deja la copia en él, sin rama.
  git -c advice.detachedHead=false checkout --quiet "$DESTINO"
else
  RAMA="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$RAMA" != "HEAD" ]] || fallo "La copia está fijada en una versión concreta; di a cuál ir (./docker/actualizar.sh <versión>) o vuelve a main con «git checkout main»."
  git merge --ff-only --quiet "origin/$RAMA" || fallo "La rama local se ha separado de origin/$RAMA: arréglalo a mano antes de actualizar."
fi
DESPUES="$(git rev-parse --short HEAD)"
if [[ "$ANTES" == "$DESPUES" ]]; then
  log "Ya estaba en la última versión ($DESPUES). Se reconstruye igualmente por si cambió la configuración."
else
  log "De $ANTES a $DESPUES:"
  git log --oneline "$ANTES..$DESPUES" | sed 's/^/    /'
  NUEVAS="$(git diff --name-only "$ANTES" "$DESPUES" -- backend-desamparados/prisma/migrations | grep -c 'migration.sql$' || true)"
  log "Migraciones nuevas: $NUEVAS."
fi

# --- 4 y 5. Imágenes y arranque ---
log "Construyendo las imágenes (la web sigue en marcha)…"
compose build --quiet
log "Cambiando los contenedores y aplicando las migraciones…"
if ! compose up -d --remove-orphans; then
  compose logs --no-color --tail 40 migraciones >&2 || true
  # MariaDB no deshace a medias los cambios de esquema: una migración que falla
  # puede dejar parte hecha. Por eso aquí se remite a la copia y no se promete nada.
  fallo "No se ha podido levantar (mira el registro de arriba). Si fallaron las migraciones, la API sigue parada y la base puede haber quedado a medias: restaura la copia recién hecha antes de volver a la versión $ANTES."
fi

# --- 6. Comprobación ---
log "Esperando a que la API esté sana…"
for _ in $(seq 1 60); do
  estado="$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null || echo desconocido)"
  if [[ "$estado" == "healthy" ]]; then
    break
  fi
  sleep 5
done

if [[ "$estado" == "healthy" ]]; then
  # La web escribe sus datos al arrancar (/instalacion.js, index.html…) y, con
  # un dato o una imagen de la marca que no sirven, sale y el compose la
  # reintenta en bucle sin que nada lo diga.
  log "Comprobando la web…"
  for _ in $(seq 1 15); do
    if compose exec -T web test -s /var/www/desamparados/dist/instalacion.js 2>/dev/null; then
      log "Hecho: $DESPUES en marcha."
      exit 0
    fi
    sleep 2
  done
  compose logs --no-color --tail 40 web >&2 || true
  fallo "La API está sana, pero la web no arranca (mira el registro de arriba: ¿un dato de instalacion/datos-entidad.json o una imagen de instalacion/marca/ mal puestos?). Corrígelo y «docker compose restart web»: la base no tiene nada que ver."
fi

compose ps >&2
compose logs --no-color --tail 60 api >&2 || true
cat >&2 <<EOF

La API no ha quedado sana en cinco minutos. Para volver a la versión anterior:
  1. docker compose stop api web
  2. Restaura la base de la copia recién hecha (docs/despliegue.md, «Restaurar»).
  3. git checkout $ANTES && docker compose up -d --build
Sin restaurar la base, el código anterior no conoce las migraciones nuevas.
EOF
exit 1
