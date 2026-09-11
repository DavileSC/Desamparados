#!/usr/bin/env bash
# Copia de seguridad del servidor (Linux): base de datos + archivos subidos,
# cifrada, rotada y, si hay destino configurado, enviada fuera del servidor.
#
# Qué hace, en orden:
#   1. Vuelca MariaDB con `mariadb-dump --single-transaction` (consistente y sin
#      bloquear la web) y comprueba que el volcado está entero.
#   2. Empaqueta el volcado junto con `storage/` (fotos y PDF del CMS, públicos
#      y privados): sin ellos, una base restaurada apunta a archivos que no hay.
#   3. Lo cifra con `age` para la clave PÚBLICA indicada. La privada NO debe
#      estar en el servidor: quien se lleve el disco o las copias no puede
#      leerlas. El volcado sin cifrar solo existe unos segundos, en una carpeta
#      temporal con permisos 700 que se borra al terminar pase lo que pase.
#   4. Borra las copias locales más antiguas que BACKUP_RETENTION_DAYS (solo
#      después de haber hecho una nueva, así nunca se queda a cero).
#   5. Si BACKUP_RCLONE_REMOTE está definida, sube la copia con rclone. Una
#      copia que solo vive en el mismo servidor no sobrevive a que se pierda
#      el servidor.
#
# Configuración (variables de entorno; en el servidor, en el EnvironmentFile
# del servicio systemd, ver docs/despliegue.md):
#   BACKUP_AGE_RECIPIENTS  Fichero con una o varias claves públicas de age (age1...).
#   BACKUP_AGE_RECIPIENT   O bien una clave pública directamente. Una de las dos es obligatoria.
#   BACKUP_DIR             Dónde guardar las copias locales. Por defecto /var/backups/desamparados.
#   BACKUP_RETENTION_DAYS  Días que se conservan las copias locales. Por defecto 14.
#   BACKUP_RCLONE_REMOTE   Destino de rclone (p. ej. «copias:grupo-parroquial/desamparados»). Opcional.
#   BACKUP_DB_USER/BACKUP_DB_PASSWORD  Usuario de MariaDB solo de lectura para la copia. Opcional:
#                          sin ellos se usan DATABASE_USER/DATABASE_PASSWORD del .env.
#   APP_DIR                Carpeta de backend-desamparados. Por defecto, la de este script.
#
# Los datos de conexión (DATABASE_HOST, DATABASE_NAME...) se leen del .env del
# backend. Sale con código distinto de 0 si algo falla, para que systemd lo
# marque como fallido.

set -Eeuo pipefail
umask 077

log() { printf '%s [copia] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fallo() { log "ERROR: $*" >&2; exit 1; }

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/desamparados}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
ENV_FILE="$APP_DIR/.env"

[[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || fallo "BACKUP_RETENTION_DAYS debe ser un número de días."
[[ -f "$ENV_FILE" ]] || fallo "No se encuentra $ENV_FILE."
[[ -d "$APP_DIR/storage" ]] || fallo "No se encuentra $APP_DIR/storage."

# --- Leer una variable del .env sin ejecutarlo (`source` ejecutaría cualquier cosa que haya dentro) ---
leer_env() {
  local linea valor
  linea="$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 || true)"
  valor="${linea#*=}"
  valor="${valor%$'\r'}"
  valor="$(printf '%s' "$valor" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  # Quita las comillas que envuelven el valor, si las hay.
  if [[ "$valor" =~ ^\"(.*)\"$ || "$valor" =~ ^\'(.*)\'$ ]]; then valor="${BASH_REMATCH[1]}"; fi
  printf '%s' "$valor"
}

DB_HOST="$(leer_env DATABASE_HOST)"; DB_HOST="${DB_HOST:-localhost}"
DB_NAME="$(leer_env DATABASE_NAME)"
DB_USER="${BACKUP_DB_USER:-$(leer_env DATABASE_USER)}"
DB_PASS="${BACKUP_DB_PASSWORD:-$(leer_env DATABASE_PASSWORD)}"
[[ -n "$DB_NAME" ]] || fallo "Falta DATABASE_NAME en $ENV_FILE."
[[ -n "$DB_USER" ]] || fallo "Falta DATABASE_USER en $ENV_FILE."

# --- Cifrado: sin clave pública no se hace copia (una copia en claro es peor que ninguna) ---
AGE_ARGS=()
if [[ -n "${BACKUP_AGE_RECIPIENTS:-}" ]]; then
  [[ -s "$BACKUP_AGE_RECIPIENTS" ]] || fallo "BACKUP_AGE_RECIPIENTS=$BACKUP_AGE_RECIPIENTS no existe o está vacío."
  AGE_ARGS=(-R "$BACKUP_AGE_RECIPIENTS")
elif [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  AGE_ARGS=(-r "$BACKUP_AGE_RECIPIENT")
else
  fallo "Define BACKUP_AGE_RECIPIENTS (fichero de claves públicas) o BACKUP_AGE_RECIPIENT: no se hacen copias sin cifrar."
fi

# --- Herramientas ---
DUMP="$(command -v mariadb-dump || command -v mysqldump || true)"
[[ -n "$DUMP" ]] || fallo "No se encuentra mariadb-dump (paquete mariadb-client)."
for herramienta in age tar gzip; do
  command -v "$herramienta" >/dev/null || fallo "No se encuentra $herramienta."
done

mkdir -p "$BACKUP_DIR"

# Dos ejecuciones a la vez (un timer y una manual) se pisarían el temporal.
if command -v flock >/dev/null; then
  exec 9>"$BACKUP_DIR/.bloqueo"
  flock -n 9 || fallo "Ya hay otra copia en curso."
fi

TMP="$(mktemp -d "$BACKUP_DIR/.tmp.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# --- 1. Volcado ---
# La contraseña va en MYSQL_PWD y no en la línea de órdenes, donde cualquier
# usuario del servidor la vería con `ps`; el entorno de un proceso solo lo
# leen su dueño y root. (Un fichero de opciones obligaría a escapar `#`, `\` y
# comillas, y una contraseña con `#` se cortaría sin avisar.)
log "Volcando la base de datos $DB_NAME..."
MYSQL_PWD="$DB_PASS" "$DUMP" --host="$DB_HOST" --user="$DB_USER" \
  --single-transaction --quick --no-tablespaces --hex-blob \
  --default-character-set=utf8mb4 \
  "$DB_NAME" > "$TMP/db.sql"

# Un volcado cortado a medias (disco lleno, conexión perdida) pesa más de cero
# y parece válido: el volcado completo termina siempre con «Dump completed».
tail -n 5 "$TMP/db.sql" | grep -q 'Dump completed' || fallo "El volcado está truncado (falta la marca «Dump completed»)."
TABLAS="$(grep -c '^CREATE TABLE' "$TMP/db.sql" || true)"
(( TABLAS >= 10 )) || fallo "El volcado solo contiene $TABLAS tablas y el esquema tiene bastantes más."

# --- 2 y 3. Empaquetar y cifrar ---
NOMBRE="desamparados_$(date -u +%Y%m%dT%H%M%SZ).tar.gz.age"
DESTINO="$BACKUP_DIR/$NOMBRE"
log "Empaquetando volcado + storage/ y cifrando en $NOMBRE..."
# Se escribe con otro nombre y se renombra al final: una copia a medias nunca
# lleva el nombre de una buena.
tar -C "$TMP" -cf - db.sql -C "$APP_DIR" storage | gzip -c | age "${AGE_ARGS[@]}" -o "$TMP/$NOMBRE"
[[ -s "$TMP/$NOMBRE" ]] || fallo "La copia cifrada ha salido vacía."
mv "$TMP/$NOMBRE" "$DESTINO"
log "Copia local correcta: $DESTINO ($(du -h "$DESTINO" | cut -f1), $TABLAS tablas)."

# --- 4. Rotación local ---
BORRADAS="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'desamparados_*.tar.gz.age' -mtime +"$BACKUP_RETENTION_DAYS" -print -delete | wc -l)"
log "Rotación: $BORRADAS copia(s) local(es) de más de $BACKUP_RETENTION_DAYS días borrada(s)."

# --- 5. Copia fuera del servidor ---
if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  command -v rclone >/dev/null || fallo "BACKUP_RCLONE_REMOTE está definida pero rclone no está instalado. La copia local sí se ha hecho."
  log "Subiendo a $BACKUP_RCLONE_REMOTE..."
  # Solo se sube: la rotación del destino la hacen sus reglas de ciclo de vida.
  # Si el servidor pudiera borrar allí, quien lo comprometa podría borrar
  # también las copias.
  rclone copyto "$DESTINO" "${BACKUP_RCLONE_REMOTE%/}/$NOMBRE" \
    || fallo "No se pudo subir la copia a $BACKUP_RCLONE_REMOTE. La copia local sí se ha hecho."
  log "Copia fuera del servidor correcta."
else
  log "AVISO: BACKUP_RCLONE_REMOTE sin definir: la copia solo está en este servidor."
fi
