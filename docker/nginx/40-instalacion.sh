#!/bin/sh
# Los datos de la corporación, al arrancar el contenedor de la web y no al
# construir la imagen: así una misma imagen sirve a cualquier corporación. Los
# lee de /app/instalacion/datos-entidad.json, el mismo montaje que la API
# (./instalacion:/app/instalacion:ro en compose.yaml).
#
# Lo lanza el docker-entrypoint.sh de la imagen oficial de nginx antes de
# arrancarlo, como todo lo de /docker-entrypoint.d/ (solo si el CMD empieza por
# `nginx`: ver web.Dockerfile). Si falla, el entrypoint corta y el contenedor
# sale con el error a la vista en `docker compose logs web`: mejor caído que
# sirviendo una web sin datos o con los de otro.
set -eu

# 1. La web: index.html relleno (y su .gz, que es el que sirve gzip_static),
#    manifest.json, robots.txt e instalacion.js. La plantilla es el index.html
#    de `vite build`, guardado fuera de la carpeta servida: este paso se repite
#    en cada arranque y tiene que partir siempre de las marcas sin rellenar.
#    Y la marca: el escudo y los iconos de /app/instalacion/marca (los que
#    falten, los genéricos de shared/marca-de-partida) copiados a marca/. Un
#    fichero de la marca que no sirve (otro formato, roto, ilegible) también
#    para aquí; uno que falta solo se avisa en el registro.
node /app/desamparados-web/scripts/instalacion-web.mjs \
  --plantilla /app/desamparados-web/index.plantilla.html \
  --destino /var/www/desamparados/dist \
  --comprimir

# 2. El sitio de producción, con el dominio de la corporación. Si el compose
#    monta otro encima (el de detrás del nginx del sistema, o el local), manda
#    ese y aquí no se escribe nada: el montaje es de solo lectura.
SITIO=/etc/nginx/conf.d/desamparados.conf
if grep -q " $SITIO " /proc/self/mountinfo; then
  echo "[instalacion] $SITIO viene montado: se usa tal cual."
else
  node /app/docker/nginx/generar-sitio.mjs /app/instalacion/datos-entidad.json /app/docker/nginx/sitio.conf "$SITIO"
  echo "[instalacion] $SITIO escrito con el dominio de la corporación."
fi
