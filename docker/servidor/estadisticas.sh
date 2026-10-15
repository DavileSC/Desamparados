#!/usr/bin/env bash
# El informe de visitas de la web pública, con GoAccess. Lo lanza cada hora el
# timer `desamparados-estadisticas`, y logrotate justo antes de rotar el
# registro para no perder la última hora (docs/servidor.md, «Estadísticas de
# visitas»). Lo enseña el CMS en Web → «Estadísticas de visitas».
#
# El registro lo escribe el nginx del contenedor (docker/nginx/comun.conf):
# solo las páginas vistas, con la IP ya recortada. GoAccess guarda lo leído en
# su base (--persist/--restore): el histórico sigue aunque el registro rote, y
# volver a leer el mismo registro no cuenta dos veces.
set -euo pipefail

RAIZ="${RAIZ:-/srv/desamparados}"
REGISTRO="$RAIZ/registros/visitas/visitas.log"
SALIDA="$RAIZ/estadisticas"
BASE="${BASE_ESTADISTICAS:-/var/lib/desamparados-estadisticas}"

if [ ! -s "$REGISTRO" ]; then
  echo "Todavía no hay visitas en $REGISTRO: ¿está encendido el módulo?"
  exit 0
fi
mkdir -p "$SALIDA" "$BASE"

# En castellano si el sistema tiene el idioma (sudo locale-gen es_ES.UTF-8).
if locale -a 2>/dev/null | grep -qi '^es_ES\.utf-\?8$'; then export LC_ALL=es_ES.UTF-8; fi

# Fuera los paneles que aquí no dicen nada o no deben salir: las direcciones
# (aunque recortadas, no hacen falta para nada), los códigos de respuesta
# (todo es 200), lo estático (no se apunta) y lo que nginx no escribe.
goaccess "$REGISTRO" \
  --log-format=COMBINED \
  --persist --restore --db-path="$BASE" --keep-last=730 \
  --ignore-crawlers \
  --anonymize-ip \
  --no-query-string \
  --ignore-panel=HOSTS --ignore-panel=STATUS_CODES --ignore-panel=REQUESTS_STATIC \
  --ignore-panel=NOT_FOUND --ignore-panel=VIRTUAL_HOSTS --ignore-panel=REMOTE_USER \
  --ignore-panel=CACHE_STATUS --ignore-panel=GEO_LOCATION --ignore-panel=ASN \
  --ignore-panel=KEYPHRASES --ignore-panel=MIME_TYPE --ignore-panel=TLS_TYPE \
  --html-report-title="Visitas de la web" \
  --no-progress \
  -o "$SALIDA/informe.nuevo.html"

# Se cambia de una vez: la API nunca lee un informe a medio escribir.
chmod 644 "$SALIDA/informe.nuevo.html"
mv -f "$SALIDA/informe.nuevo.html" "$SALIDA/informe.html"
