#!/usr/bin/env bash
# Pone en marcha una instalación nueva en un servidor limpio: la de una
# corporación, con su dominio, su base y sus secretos.
#
#   sudo ./docker/instalar.sh secretaria@corporacion.es
#   sudo ./docker/instalar.sh secretaria@corporacion.es --sin-certificado   # pruebas, sin dominio aún
#
# Antes de ejecutarlo:
#   - Docker con el plugin compose, y el repositorio clonado donde vaya a vivir
#     (por ejemplo /srv/desamparados). Se ejecuta desde ahí, como root.
#   - instalacion/datos-entidad.json con los datos de la corporación: el nombre,
#     la advocación, la localidad y el dominio (www.…). De ahí salen la web, los
#     correos, los PDF y nginx. Si no existe, este guion lo crea copiando
#     shared/datos-entidad.ejemplo.json y para hasta que se rellene.
#   - Si los tiene, lo demás de la corporación, también en instalacion/: la
#     marca (marca/), las fotos fijas (imagenes/), el mapa del barrio
#     (mapas/barrio.json) y su contenido de partida (contenido-inicial.json).
#     Nada es obligatorio, pero el contenido solo cuenta en el primer arranque:
#     el guion dice qué encuentra antes de arrancar.
#   - El dominio apuntando ya a este servidor, con los puertos 80 y 443 libres:
#     Let's Encrypt lo comprueba al pedir el certificado.
#
# Lo que hace, sin repetir nada si se vuelve a lanzar a medias:
#   1. El usuario del sistema dueño de los archivos (desamparados).
#   2. El .env a partir de docker/.env.example, con los secretos generados aquí.
#      Si ya existe, no lo toca: tendría las contraseñas con que se creó la base.
#   3. Las carpetas de las subidas con sus permisos.
#   4. El certificado, antes del primer arranque (nginx no arranca sin él).
#   5. Levanta todo: base, migraciones, API, web y antivirus, y comprueba que
#      la web ha escrito sus datos al arrancar.
#   6. La siembra (el administrador, cuya contraseña sale UNA vez por pantalla)
#      y el cifrado de los secretos del doble factor.
#
# La guía con el porqué de cada paso es docs/despliegue.md.

set -Eeuo pipefail

log() { printf '\n==> %s\n' "$*"; }
fallo() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

PROYECTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROYECTO_DIR"

CORREO=""
CERTIFICADO=1
for arg in "$@"; do
  case "$arg" in
    --sin-certificado) CERTIFICADO=0 ;;
    -h|--help) sed -n '2,34p' "$0"; exit 0 ;;
    -*) fallo "Opción desconocida: $arg" ;;
    *) CORREO="$arg" ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || fallo "Hay que ejecutarlo como root (sudo): crea un usuario y cambia permisos."
[[ "$CORREO" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || fallo "Falta el correo del administrador: sudo ./docker/instalar.sh secretaria@corporacion.es"
docker compose version >/dev/null 2>&1 || fallo "No encuentro «docker compose». Instala Docker Engine con su plugin compose."
command -v openssl >/dev/null || fallo "No encuentro openssl, que genera los secretos."

# Los datos de la corporación: fuera de git, para que actualizar no choque con
# ellos. La primera vez se parte del ejemplo y se para: arrancar con la
# corporación inventada mandaría correos y PDF con su nombre.
DATOS=instalacion/datos-entidad.json
EJEMPLO=shared/datos-entidad.ejemplo.json
if [[ ! -f "$DATOS" ]]; then
  install -d instalacion
  cp "$EJEMPLO" "$DATOS"
  fallo "He creado $PROYECTO_DIR/$DATOS a partir del ejemplo. Rellénalo con los datos de la corporación y vuelve a lanzar este guion."
fi
dominio_de() { sed -n 's/^[[:space:]]*"dominio":[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -n 1; }
# El dominio sale del mismo fichero que la web y nginx: un solo sitio donde cambiarlo.
DOMINIO="$(dominio_de "$DATOS")"
[[ "$DOMINIO" != "$(dominio_de "$EJEMPLO")" ]] || fallo "$DATOS sigue con los datos del ejemplo ($DOMINIO): rellénalo con los de la corporación."
[[ "$DOMINIO" =~ ^www\.[a-z0-9-]+(\.[a-z0-9-]+)+$ ]] || fallo "El dominio de $DATOS («$DOMINIO») tiene que ser del tipo www.ejemplo.com."
log "Instalación para $DOMINIO en $PROYECTO_DIR"

compose() { docker compose -f compose.yaml "$@"; }

# --- 1. El usuario ---
USUARIO=desamparados
if ! id "$USUARIO" >/dev/null 2>&1; then
  # El uid 1000 es el del contenedor; si ya lo tiene otro usuario, se usa el
  # siguiente libre y se apunta en el .env (APP_UID/APP_GID).
  if getent passwd 1000 >/dev/null; then useradd --system --shell /usr/sbin/nologin "$USUARIO"
  else useradd --system --shell /usr/sbin/nologin --uid 1000 --user-group "$USUARIO"; fi
  log "Usuario $USUARIO creado."
fi
APP_UID="$(id -u "$USUARIO")"
APP_GID="$(id -g "$USUARIO")"
# Para actualizar y hacer copias sin root (docker/actualizar.sh). Equivale a
# dar root en la máquina: este usuario no tiene shell ni contraseña.
getent group docker >/dev/null && usermod -aG docker "$USUARIO"

# --- 2. El .env ---
if [[ -f .env ]]; then
  log "Ya hay un .env: se deja como está."
else
  log "Generando el .env con secretos nuevos…"
  # Solo letras y números: la contraseña de la base va dentro de una URL.
  clave() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32; }
  URL="https://$DOMINIO"
  sed \
    -e "s|^APP_UID=.*|APP_UID=$APP_UID|" \
    -e "s|^APP_GID=.*|APP_GID=$APP_GID|" \
    -e "s|^DATABASE_PASSWORD=.*|DATABASE_PASSWORD=$(clave)|" \
    -e "s|^DATABASE_ROOT_PASSWORD=.*|DATABASE_ROOT_PASSWORD=$(clave)|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 64)|" \
    -e "s|^TOTP_ENC_KEY=.*|TOTP_ENC_KEY=$(openssl rand -hex 32)|" \
    -e "s|^FRONTEND_URL=.*|FRONTEND_URL=$URL|" \
    -e "s|^API_URL=.*|API_URL=$URL|" \
    -e "s|^SEED_ADMIN_EMAIL=.*|SEED_ADMIN_EMAIL=$CORREO|" \
    docker/.env.example > .env
  [[ "$CERTIFICADO" -eq 1 ]] || sed -i 's|^COMPOSE_PROFILES=.*|COMPOSE_PROFILES=antivirus|' .env
fi
chown "$USUARIO:$USUARIO" .env
chmod 600 .env

# --- 3. Las carpetas ---
chown -R "$USUARIO:$USUARIO" "$PROYECTO_DIR"
B="$PROYECTO_DIR/backend-desamparados"
install -d -o "$USUARIO" -g "$USUARIO" -m 750 "$B/storage/private"
# La pública la lee el nginx del contenedor, que corre con su propio usuario:
# con 750 no podría y cada foto subida daría 403. Lo que hay ahí es público.
install -d -o "$USUARIO" -g "$USUARIO" -m 755 "$B/storage" "$B/storage/public"
# nginx, con su propio usuario, sirve del montaje la marca, las fotos y el
# mapa: sin lectura para los demás, cada uno da 403. El resto de instalacion/
# lo lee la API con el uid del dueño, y el arranque de la web, como root.
chmod 755 instalacion
for d in instalacion/marca instalacion/imagenes instalacion/mapas; do
  [[ -d "$d" ]] || continue
  find "$d" \( -type d -exec chmod 755 {} + \) -o \( -type f -exec chmod 644 {} + \)
done
# Git se niega a trabajar en un repositorio de otro usuario sin esto.
git config --system --get-all safe.directory 2>/dev/null | grep -qxF "$PROYECTO_DIR" \
  || git config --system --add safe.directory "$PROYECTO_DIR"

# --- 4. El certificado ---
if [[ "$CERTIFICADO" -eq 1 ]]; then
  if compose run --rm --entrypoint sh certbot -c "test -e /etc/letsencrypt/live/$DOMINIO/fullchain.pem" 2>/dev/null; then
    log "El certificado de $DOMINIO ya existe."
  else
    log "Pidiendo el certificado de $DOMINIO y ${DOMINIO#www.}…"
    compose run --rm -p 80:80 --entrypoint certbot certbot certonly --standalone \
      -d "$DOMINIO" -d "${DOMINIO#www.}" --agree-tos -m "$CORREO" --no-eff-email \
      || fallo "No se ha podido sacar el certificado. ¿Apunta ya el dominio a este servidor y está libre el puerto 80?"
  fi
else
  log "Sin certificado, como se ha pedido: nginx no arrancará con el sitio de producción hasta que lo haya."
fi

# --- 5. Arranque ---
# Lo opcional, dicho antes del primer arranque: la semilla del contenido solo
# crea las páginas que aún no existen, y después de este arranque existen todas.
hay() { [[ -e "instalacion/$1" ]] && echo "sí" || echo "no: $2"; }
log "Lo propio de la corporación en instalacion/:"
echo "    marca/                  $(hay marca 'escudo e iconos genéricos de partida')"
echo "    imagenes/               $(hay imagenes 'la web pinta su fondo donde irían las fotos')"
echo "    mapas/barrio.json       $(hay mapas/barrio.json 'el recorrido, en lista, sin mapa')"
echo "    contenido-inicial.json  $(hay contenido-inicial.json 'las páginas nacen con el texto neutro')"
echo "    Para añadir contenido-inicial.json, ahora (Ctrl+C y volver a lanzar): luego ya no cuenta."
echo "    Lo demás se puede añadir cuando se quiera (docs/despliegue.md, «Una instalación por corporación»)."

log "Construyendo y levantando (la primera vez tarda: imágenes y firmas del antivirus)…"
compose up -d --build

# --- 6. Siembra y doble factor ---
# La siembra es idempotente: relanzar el guion no duplica nada ni cambia la
# contraseña de un administrador que ya exista.
log "Sembrando la base (el administrador y el contenido de ejemplo)…"
echo "    COPIA LA CONTRASEÑA DEL ADMINISTRADOR QUE SALE AHORA: no se vuelve a mostrar."
compose run --rm herramientas npm run seed
compose run --rm herramientas npm run 2fa:cifrar-secretos

log "Esperando a que la API esté sana…"
for _ in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null)" == "healthy" ]] && break
  sleep 5
done
compose ps

# La web escribe sus datos al arrancar (/instalacion.js, index.html…) y, con un
# dato o una imagen de la marca que no sirven, sale y el compose la reintenta
# en bucle sin que nada lo diga. Sin certificado, nginx no arranca: no se mira.
if [[ "$CERTIFICADO" -eq 1 ]]; then
  WEB=0
  for _ in $(seq 1 15); do
    if compose exec -T web test -s /var/www/desamparados/dist/instalacion.js 2>/dev/null; then WEB=1; break; fi
    sleep 2
  done
  if [[ "$WEB" -ne 1 ]]; then
    compose logs --no-color --tail 40 web >&2 || true
    fallo "La web no ha arrancado (mira el registro de arriba: ¿un dato de $DATOS o una imagen de instalacion/marca/ mal puestos?). Corrígelo y vuelve a lanzar el guion."
  fi
fi

cat <<EOF

Hecho. Lo que queda, a mano (docs/despliegue.md):
  - Correo saliente: EMAIL_USER y EMAIL_PASS en .env, y «docker compose up -d».
  - Copias de seguridad: /etc/desamparados/copia.env y el timer de systemd.
  - Si va a cobrar en línea o por domiciliación: REDSYS_* y SEPA_ACREEDOR_*.
  - Guarda fuera del servidor TOTP_ENC_KEY (está en .env): sin ella, todos los
    cargos tienen que volver a activar el doble factor.
  - Entra en https://$DOMINIO/cms con $CORREO y la contraseña de arriba.
EOF
