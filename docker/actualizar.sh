#!/usr/bin/env bash
# Actualiza una instalación a la última versión: copia de seguridad, código
# nuevo, imágenes nuevas, migraciones y comprobación de que la web responde.
#
#   sudo -u desamparados ./docker/actualizar.sh            # a lo último de main
#   sudo -u desamparados ./docker/actualizar.sh v1.4.0     # a una etiqueta o commit
#   ./docker/actualizar.sh --sin-copia                     # solo si la copia ya está hecha
#
# Qué hace, en orden, y por qué en ese orden:
#   1. Comprueba que el repositorio no tiene cambios a mano ni ficheros sueltos
#      (todo lo de la carpeta entra en las imágenes) y que todo es de este
#      usuario: un `git pull` encima los mezclaría o se pararía a medias. Los
#      datos de la corporación (instalacion/), el .env y storage/ no cuentan:
#      git los ignora.
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
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
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
# docker guarda su configuración en ~/.docker al construir: sin carpeta
# personal, fallaría tras la copia y con el código ya cambiado.
[[ -n "${HOME:-}" && -d "$HOME" && -w "$HOME" ]] || fallo "$(id -un) no tiene carpeta personal donde escribir (${HOME:-sin HOME}) y docker la necesita para construir: sudo install -d -o $(id -un) -g $(id -gn) -m 700 ${HOME:-/home/$(id -un)}"

compose() { docker compose -f compose.yaml "$@"; }

# --- 1. Sin cambios a mano ---
# Los sueltos también: lo que hay en la carpeta entra en las imágenes, y una
# migración que ya no está en git se aplicaría igual.
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short >&2
  fallo "Hay cambios a mano o ficheros que no son de git en el repositorio. Guárdalos, descártalos o bórralos antes de actualizar."
fi

# Un git lanzado como root (un checkout a mano) deja ficheros que este usuario
# no puede cambiar: el avance rápido los salta sin fallar y la imagen sale con
# el código mezclado, incluso con una migración que ya no está en git.
AJENO="$(find . \( -path ./backend-desamparados/storage -o -path ./instalacion \) -prune -o ! -user "$(id -u)" -print -quit)"
[[ -z "$AJENO" ]] || fallo "Hay ficheros del repositorio que no son de $(id -un) (por ejemplo $AJENO): alguien ha usado git como root y la versión nueva saldría mezclada. Arréglalo con «sudo chown -R $(id -un):$(id -gn) $PROYECTO_DIR» y mira «sudo -u $(id -un) git status» (como root, git lo volvería a dejar así) antes de actualizar."

ANTES="$(git rev-parse --short HEAD)"
NUEVAS=0
if [[ "$SIN_COPIA" -eq 1 ]]; then COPIA="tu última copia"; else COPIA="la copia recién hecha"; fi

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
git fetch --quiet --tags origin || fallo "No he podido traer el código de origin (mira el error de git de arriba: ¿red, o la clave de acceso al repositorio?). No se ha tocado nada."
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
  NUEVAS="$(git diff --name-only --diff-filter=A "$ANTES" "$DESPUES" -- backend-desamparados/prisma/migrations | grep -c 'migration.sql$' || true)"
  log "Migraciones nuevas: $NUEVAS."
fi

# --- 4 y 5. Imágenes y arranque ---
log "Construyendo las imágenes (la web sigue en marcha)…"
compose build --quiet
log "Cambiando los contenedores y aplicando las migraciones…"
estado=""
if ! compose up -d --remove-orphans; then
  # `up` falla igual si las migraciones salen mal que si la API no arranca (la
  # web la espera sana). Lo segundo suele ser un dato de instalacion/ o del
  # .env, con la base intacta: mandar a restaurar la copia sería un destrozo.
  salida_migraciones="$(docker inspect -f '{{.State.ExitCode}}' "$(compose ps -aq migraciones)" 2>/dev/null || true)"
  if [[ "$salida_migraciones" != "0" ]]; then
    compose logs --no-color --tail 40 migraciones >&2 || true
    # MariaDB no deshace a medias los cambios de esquema: una migración que falla
    # puede dejar parte hecha. Por eso aquí se remite a la copia y no se promete nada.
    fallo "Han fallado las migraciones, o no han llegado a correr (mira el registro de arriba). La API sigue parada y la base puede haber quedado a medias: restaura $COPIA antes de volver a la versión $ANTES."
  fi
  estado="no arranca"
fi

# --- 6. Comprobación ---
if [[ -z "$estado" ]]; then
  log "Esperando a que la API esté sana…"
  for _ in $(seq 1 60); do
    estado="$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null || echo desconocido)"
    if [[ "$estado" == "healthy" ]]; then
      break
    fi
    sleep 5
  done
fi

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
if [[ "$NUEVAS" -gt 0 ]]; then
  RESTAURAR="Restaura la base de $COPIA (docs/despliegue.md, «Restaurar»): el código anterior no conoce las $NUEVAS migraciones nuevas."
else
  RESTAURAR="No hay que restaurar la base: esta versión no traía migraciones."
fi
cat >&2 <<EOF

La API no arranca, aunque las migraciones se han aplicado bien (registro de arriba).
  - Si es un dato de instalacion/ o del .env, corrígelo y «docker compose up -d».
EOF
[[ "$ANTES" == "$DESPUES" ]] || cat >&2 <<EOF
  - Si es la versión nueva, para volver a la $ANTES:
      1. docker compose stop api web
      2. $RESTAURAR
      3. sudo -u $(id -un) git checkout $ANTES && sudo -u $(id -un) docker compose up -d --build
EOF
exit 1
