#!/usr/bin/env bash
# Despliega en el VPS una versión ya construida por GitHub Actions
# (.github/workflows/desplegar.yml). Es lo único que puede hacer la clave con
# que entra GitHub: el usuario `despliegue` solo tiene permiso para lanzar
# esto, como `desamparados` (ver docs/servidor.md, «Despliegue desde GitHub»).
#
#   desplegar <commit>        # el token del registro de GitHub llega por la entrada estándar
#
# No vive en el repositorio que despliega, sino copiado en
# /usr/local/sbin/desplegar-desamparados, de root: así un commit no puede
# cambiar lo que hace la clave, y el `git checkout` de abajo no reescribe este
# fichero mientras se ejecuta.
#
# Qué hace, en orden:
#   1. Comprueba que el commit es de main (no despliega ramas sueltas).
#   2. Si hay copias de seguridad configuradas, hace una antes de tocar nada:
#      las migraciones no tienen vuelta atrás.
#   3. Deja el repositorio en ese commit: de él salen el compose y la
#      configuración de nginx y del antivirus, que tienen que ir con sus imágenes.
#   4. Descarga las imágenes de ese commit con el token de un solo uso de
#      GitHub, que no se guarda en ninguna parte.
#   5. Levanta: las migraciones se aplican solas y, si fallan, la API no arranca.
#   6. Espera a que la API esté sana.
#   7. Borra las imágenes viejas, menos la anterior (para volver atrás).

set -Eeuo pipefail

PROYECTO_DIR=/srv/desamparados
CLAVE_GITHUB=/etc/desamparados/clave-github
REGISTRO=ghcr.io/davilesc/desamparados

log() { printf '%s [desplegar] %s\n' "$(date +%H:%M:%S)" "$*"; }
fallo() { log "ERROR: $*" >&2; exit 1; }

COMMIT="${1:-}"
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || fallo "Hace falta el commit entero (40 caracteres hexadecimales), y ha llegado «$COMMIT»."
[[ "$(id -un)" == desamparados ]] || fallo "Se ejecuta como desamparados (sudo -u desamparados)."

cd "$PROYECTO_DIR"
[[ -f .env ]] || fallo "Falta $PROYECTO_DIR/.env."
# La API y la web los leen del volumen al arrancar; sin ellos no arrancan.
[[ -f instalacion/datos-entidad.json ]] || fallo "Falta $PROYECTO_DIR/instalacion/datos-entidad.json, los datos de la corporación (docs/servidor.md)."

compose() { docker compose -f compose.yaml -f compose.servidor.yaml "$@"; }

# El token, lo primero: si algo falla después, que no se quede esperando en la entrada.
TOKEN="$(cat)"
[[ -n "$TOKEN" ]] || fallo "No ha llegado el token del registro por la entrada estándar."

# --- 1. El commit es de main ---
# El usuario no tiene casa: la clave y la huella de GitHub viven en /etc/desamparados.
export GIT_SSH_COMMAND="ssh -i $CLAVE_GITHUB -o IdentitiesOnly=yes -o UserKnownHostsFile=/etc/desamparados/github_known_hosts -o StrictHostKeyChecking=yes"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fallo "Hay cambios a mano en $PROYECTO_DIR; guárdalos o descártalos antes."
git fetch --quiet origin main
git merge-base --is-ancestor "$COMMIT" origin/main || fallo "El commit $COMMIT no está en main."
ANTES="$(git rev-parse HEAD)"

# --- 2. Copia de seguridad, si ya están configuradas ---
CONF=/etc/desamparados/copia.env
if [[ -r "$CONF" ]]; then
  log "Copia de seguridad antes de desplegar…"
  # shellcheck source=/dev/null
  ( set -a; . "$CONF"; set +a; PROYECTO_DIR="$PROYECTO_DIR" bash ./backend-desamparados/scripts/backup-vps.sh ) \
    || fallo "La copia de seguridad ha fallado: no se despliega sin ella."
else
  log "Sin copias de seguridad configuradas ($CONF): se despliega sin copia."
fi

# --- 3. El código de ese commit ---
git -c advice.detachedHead=false checkout --quiet "$COMMIT"
if [[ "$ANTES" != "$COMMIT" ]]; then
  log "De ${ANTES:0:7} a ${COMMIT:0:7}:"
  git log --oneline "$ANTES..$COMMIT" | sed 's/^/    /' | head -n 30
fi

# La versión que el compose del servidor descarga.
if grep -q '^VERSION=' .env; then sed -i "s/^VERSION=.*/VERSION=$COMMIT/" .env
else printf '\n# La pone docker/servidor/desplegar.sh: el commit desplegado.\nVERSION=%s\n' "$COMMIT" >> .env; fi

# --- 4. Las imágenes ---
# Un DOCKER_CONFIG de usar y tirar: el token no queda en ~/.docker/config.json.
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
printf '%s' "$TOKEN" | docker login ghcr.io --username despliegue --password-stdin >/dev/null
log "Descargando las imágenes de ${COMMIT:0:7}…"
compose pull --quiet
docker logout ghcr.io >/dev/null

# --- 5. Arranque ---
log "Cambiando los contenedores y aplicando las migraciones…"
if ! compose up -d --remove-orphans; then
  compose logs --no-color --tail 40 migraciones >&2 || true
  fallo "No se ha podido levantar (mira el registro de arriba). Si fallaron las migraciones, la API sigue parada y la base puede haber quedado a medias: docs/despliegue.md, «Si una migración falla a medias»."
fi

# --- 6. Comprobación ---
log "Esperando a que la API esté sana…"
SANA=0
for _ in $(seq 1 60); do
  if [[ "$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null)" == healthy ]]; then SANA=1; break; fi
  sleep 5
done
if [[ "$SANA" -ne 1 ]]; then
  compose ps >&2
  compose logs --no-color --tail 60 api >&2 || true
  fallo "La API no ha quedado sana en cinco minutos."
fi

# La web escribe al arrancar los datos de la corporación (/instalacion.js,
# index.html…) y, con un dato mal puesto en instalacion/datos-entidad.json, no
# arranca: el compose la reintenta en bucle sin que nada lo diga.
log "Comprobando la web…"
WEB=0
for _ in $(seq 1 15); do
  if curl -fsS -o /dev/null http://127.0.0.1:8080/instalacion.js; then WEB=1; break; fi
  sleep 2
done
if [[ "$WEB" -ne 1 ]]; then
  compose logs --no-color --tail 40 web >&2 || true
  fallo "La web no sirve /instalacion.js (mira el registro de arriba: ¿instalacion/datos-entidad.json mal puesto?)."
fi

# --- 7. Limpieza ---
# Cada versión son unos cientos de MB por imagen. Se queda la de ahora y la
# anterior, por si hay que volver.
for imagen in api web herramientas; do
  docker image ls --format '{{.Tag}}' "$REGISTRO-$imagen" \
    | grep -vxF -e "$COMMIT" -e "$ANTES" \
    | while read -r etiqueta; do docker image rm "$REGISTRO-$imagen:$etiqueta" >/dev/null || true; done     || true   # grep sin nada que borrar sale con 1, y con pipefail pararía aquí
done

log "Hecho: ${COMMIT:0:7} en marcha."
