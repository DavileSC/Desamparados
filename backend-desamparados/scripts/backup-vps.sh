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
#   PROYECTO_DIR           Carpeta con compose.yaml. Por defecto, la raíz del repositorio.
#   APP_DIR                Carpeta de backend-desamparados. Por defecto, la de este script.
#
# El volcado lo hace el contenedor de MariaDB con las credenciales que ya
# tiene en su entorno: aquí no se leen ni se pasan por la línea de órdenes,
# donde cualquier usuario del servidor las vería con `ps`. `storage/` sí se lee
# del disco, porque el compose lo monta desde una carpeta normal y no desde un
# volumen de Docker.
#
# Sale con código distinto de 0 si algo falla, para que systemd lo marque como
# fallido.

set -Eeuo pipefail
umask 077

log() { printf '%s [copia] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fallo() { log "ERROR: $*" >&2; exit 1; }

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PROYECTO_DIR="${PROYECTO_DIR:-$(cd "$APP_DIR/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/desamparados}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

[[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || fallo "BACKUP_RETENTION_DAYS debe ser un número de días."
[[ -f "$PROYECTO_DIR/compose.yaml" ]] || fallo "No se encuentra $PROYECTO_DIR/compose.yaml."
[[ -d "$APP_DIR/storage" ]] || fallo "No se encuentra $APP_DIR/storage."

# --- La orden del compose, una sola vez ---
compose() { docker compose -f "$PROYECTO_DIR/compose.yaml" "$@"; }

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
# mariadb-dump no hace falta en el servidor: lo trae la imagen de MariaDB.
for herramienta in docker age tar gzip; do
  command -v "$herramienta" >/dev/null || fallo "No se encuentra $herramienta."
done
compose ps --status running --services 2>/dev/null | grep -qx db \
  || fallo "El servicio db no está en marcha: sin él no hay de dónde volcar."

mkdir -p "$BACKUP_DIR"

# Dos ejecuciones a la vez (un timer y una manual) se pisarían el temporal.
if command -v flock >/dev/null; then
  exec 9>"$BACKUP_DIR/.bloqueo"
  flock -n 9 || fallo "Ya hay otra copia en curso."
fi

TMP="$(mktemp -d "$BACKUP_DIR/.tmp.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# --- 1. Volcado ---
# Se vuelca DENTRO del contenedor de la base de datos. Las credenciales salen
# de su propio entorno (MARIADB_USER y compañía, que puso el compose) y nunca
# pasan por la línea de órdenes, donde cualquier usuario del servidor las
# vería con `ps`. Las comillas SIMPLES de la orden son las que impiden que las
# expanda este script en lugar del contenedor.
#
# --single-transaction lo deja consistente sin bloquear la web;
# --no-tablespaces evita necesitar el privilegio PROCESS, que el usuario de la
# aplicación no tiene.
log "Volcando la base de datos..."
compose exec -T db sh -c '
  MYSQL_PWD="$MARIADB_PASSWORD" mariadb-dump \
    --user="$MARIADB_USER" \
    --single-transaction --quick --no-tablespaces --hex-blob \
    --default-character-set=utf8mb4 \
    "$MARIADB_DATABASE"' > "$TMP/db.sql"

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
