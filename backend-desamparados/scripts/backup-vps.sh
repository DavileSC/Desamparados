#!/usr/bin/env bash
# Copia de seguridad del servidor (Linux): base de datos + archivos subidos,
# cifrada, rotada y, si hay destino configurado, enviada fuera del servidor.
#
# Qué hace, en orden:
#   1. Vuelca MariaDB con `mariadb-dump --single-transaction` (consistente y sin
#      bloquear la web) y comprueba que el volcado está entero.
#   2. Empaqueta el volcado junto con `storage/` (fotos y PDF del CMS, públicos
#      y privados): sin ellos, una base restaurada apunta a archivos que no hay.
#      Y con `instalacion/` (datos de la corporación, marca, fotos fijas, mapa):
#      vive fuera de git y de la imagen, y sin ella la web no arranca. El .env
#      se queda fuera: lleva TOTP_ENC_KEY y la copia no debe ir con su llave.
#   3. Lo cifra con `age` para la clave PÚBLICA indicada. La privada NO debe
#      estar en el servidor: quien se lleve el disco o las copias no puede
#      leerlas. El volcado sin cifrar solo existe unos segundos, en una carpeta
#      temporal con permisos 700 que se borra al terminar pase lo que pase.
#   4. Borra las copias locales más antiguas que BACKUP_RETENTION_DAYS (solo
#      después de haber hecho una nueva, así nunca se queda a cero).
#   5. Si BACKUP_RCLONE_REMOTE está definida, sube la copia con rclone. Una
#      copia que solo vive en el mismo servidor no sobrevive a que se pierda
#      el servidor.
#   6. Si BACKUP_RCLONE_DIAS está definida, borra allí las copias viejas
#      (para destinos sin reglas de ciclo de vida, como Google Drive).
#
# Configuración (variables de entorno; en el servidor, en el EnvironmentFile
# del servicio systemd, ver docs/despliegue.md):
#   BACKUP_AGE_RECIPIENTS  Fichero con una o varias claves públicas de age (age1...).
#   BACKUP_AGE_RECIPIENT   O bien una clave pública directamente. Una de las dos es obligatoria.
#   BACKUP_DIR             Dónde guardar las copias locales. Por defecto /var/backups/desamparados.
#   BACKUP_RETENTION_DAYS  Días que se conservan las copias locales. Por defecto 14.
#   BACKUP_RCLONE_REMOTE   Destino de rclone (p. ej. «copias:grupo-parroquial/desamparados»). Opcional.
#   BACKUP_RCLONE_DIAS     Días de copias diarias que se conservan en el destino. Sin ella, allí no se borra nada.
#   BACKUP_RCLONE_MESES    Además, la primera copia de cada mes durante estos meses. Por defecto 12.
#   BACKUP_GRUPO_LECTOR    Grupo que puede leer las copias locales (el usuario con el que las baja
#                          otro equipo, ver docs/servidor.md). Sin ella, solo las lee su dueño.
#   PROYECTO_DIR           Carpeta con compose.yaml. Por defecto, la raíz del repositorio.
#   APP_DIR                Carpeta de backend-desamparados. Por defecto, la de este script.
#   BACKUP_AVISO_URL       Dirección de un vigilante de tareas (healthchecks.io u otro igual) a la
#                          que se avisa al acabar: tal cual si salió bien, con /fail si no. El
#                          vigilante escribe por correo si llega un fallo o si un día no llega nada
#                          (el timer no corrió). Opcional, pero sin ella un fallo solo queda en
#                          journalctl (docs/servidor.md, «Avisos si algo falla»).
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

# Cómo acabó, al vigilante (BACKUP_AVISO_URL). Va en la salida del script, así
# que cubre cualquier fallo, también los que corta `set -e` sin pasar por
# `fallo`. Un vigilante que no responde no tumba una copia que salió bien.
avisar_fin() {
  local codigo="$1"
  [[ -n "${BACKUP_AVISO_URL:-}" ]] || return 0
  local url="${BACKUP_AVISO_URL%/}"
  (( codigo == 0 )) || url+="/fail"
  curl -fsS -m 10 --retry 3 -o /dev/null "$url" || log "AVISO: no se ha podido avisar al vigilante de BACKUP_AVISO_URL."
}
trap 'avisar_fin $?' EXIT
[[ -z "${BACKUP_AVISO_URL:-}" || "$BACKUP_AVISO_URL" =~ ^https://[^[:space:]]+$ ]] || fallo "BACKUP_AVISO_URL tiene que ser una dirección https://."

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PROYECTO_DIR="${PROYECTO_DIR:-$(cd "$APP_DIR/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/desamparados}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_RCLONE_MESES="${BACKUP_RCLONE_MESES:-12}"

[[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || fallo "BACKUP_RETENTION_DAYS debe ser un número de días."
[[ -z "${BACKUP_RCLONE_DIAS:-}" || "$BACKUP_RCLONE_DIAS" =~ ^[1-9][0-9]*$ ]] || fallo "BACKUP_RCLONE_DIAS debe ser un número de días mayor que cero."
[[ "$BACKUP_RCLONE_MESES" =~ ^[0-9]+$ ]] || fallo "BACKUP_RCLONE_MESES debe ser un número de meses."
[[ -f "$PROYECTO_DIR/compose.yaml" ]] || fallo "No se encuentra $PROYECTO_DIR/compose.yaml."
[[ -d "$APP_DIR/storage" ]] || fallo "No se encuentra $APP_DIR/storage."
[[ -f "$PROYECTO_DIR/instalacion/datos-entidad.json" ]] || fallo "No se encuentra $PROYECTO_DIR/instalacion/datos-entidad.json: sin instalacion/ la copia no serviría para levantar la web."

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
trap 'codigo=$?; rm -rf "$TMP"; avisar_fin "$codigo"' EXIT

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
tar -C "$TMP" -cf - db.sql -C "$APP_DIR" storage -C "$PROYECTO_DIR" instalacion | gzip -c | age "${AGE_ARGS[@]}" -o "$TMP/$NOMBRE"
[[ -s "$TMP/$NOMBRE" ]] || fallo "La copia cifrada ha salido vacía."
mv "$TMP/$NOMBRE" "$DESTINO"
# El umask 077 la deja solo para su dueño. Con un grupo lector, la puede bajar
# también el usuario de solo lectura del otro equipo, y nadie más.
if [[ -n "${BACKUP_GRUPO_LECTOR:-}" ]]; then
  chgrp "$BACKUP_GRUPO_LECTOR" "$DESTINO" && chmod 640 "$DESTINO" \
    || fallo "No se pudo dar lectura al grupo $BACKUP_GRUPO_LECTOR (¿está el usuario de la copia en ese grupo?)."
fi
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

# --- 6. Rotación fuera del servidor ---
# Solo para destinos que no saben borrar solos, como Google Drive: allí el
# permiso de subir ya permite borrar, así que no se pierde nada haciéndolo
# desde aquí. Lo que no se puede borrar desde este servidor es la copia que se
# baja otro equipo (docs/servidor.md, «Copias de seguridad»).
#
# Se conservan las de los últimos BACKUP_RCLONE_DIAS días y, además, la primera
# de cada mes de los últimos BACKUP_RCLONE_MESES meses: un fallo que se descubre
# tarde (una noticia borrada hace dos meses) todavía tiene arreglo.
if [[ -n "${BACKUP_RCLONE_REMOTE:-}" && -n "${BACKUP_RCLONE_DIAS:-}" ]]; then
  REMOTO="${BACKUP_RCLONE_REMOTE%/}"
  # Un listado que falla no puede leerse como «no hay ninguna»: se para.
  LISTA="$(rclone lsf --files-only "$REMOTO")" || fallo "No se pudo listar $REMOTO para rotar. La copia sí se ha subido."
  LIMITE_DIA="$(date -u -d "-$BACKUP_RCLONE_DIAS days" +%Y%m%d)"
  LIMITE_MES="$(date -u -d "$(date -u +%Y-%m-01) -$BACKUP_RCLONE_MESES months" +%Y%m)"
  MESES_VISTOS=" "
  BORRADAS_FUERA=0
  # Los nombres llevan la fecha, así que en orden alfabético van de la más
  # antigua a la más nueva: la primera que aparece de cada mes es la que queda.
  while IFS= read -r copia; do
    [[ "$copia" =~ ^desamparados_([0-9]{8})T[0-9]{6}Z\.tar\.gz\.age$ ]] || continue
    dia="${BASH_REMATCH[1]}"
    mes="${dia:0:6}"
    primera_del_mes=0
    if [[ "$MESES_VISTOS" != *" $mes "* ]]; then primera_del_mes=1; MESES_VISTOS+="$mes "; fi
    (( dia >= LIMITE_DIA )) && continue
    (( primera_del_mes == 1 && mes > LIMITE_MES )) && continue
    rclone deletefile "$REMOTO/$copia" || fallo "No se pudo borrar $copia de $REMOTO."
    BORRADAS_FUERA=$((BORRADAS_FUERA + 1))
  done < <(printf '%s\n' "$LISTA" | sort)
  log "Rotación fuera: $BORRADAS_FUERA copia(s) borrada(s) (se quedan $BACKUP_RCLONE_DIAS días y la primera de cada mes durante $BACKUP_RCLONE_MESES meses)."
fi
