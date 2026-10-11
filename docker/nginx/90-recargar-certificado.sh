#!/bin/sh
# nginx recarga cada seis horas para tomar el certificado que haya renovado
# certbot; sin esto seguiría sirviendo el viejo hasta el siguiente reinicio.
#
# Antes iba en el CMD de web.Dockerfile, pero con un CMD que no empieza por
# `nginx` el entrypoint oficial no lanza /docker-entrypoint.d/ (ni el paso de
# los datos de la corporación). El bucle va en segundo plano y suelto de la
# entrada: el entrypoint espera a este guion antes de arrancar nginx.
set -eu

(
  while :; do
    sleep 6h
    nginx -s reload
  done
) </dev/null >/dev/null 2>&1 &
