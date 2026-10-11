#!/bin/sh
# nginx recarga cada seis horas para tomar el certificado que haya renovado
# certbot; sin esto seguiría sirviendo el viejo hasta el siguiente reinicio.
#
# Antes iba en el CMD de web.Dockerfile, pero con un CMD que no empieza por
# `nginx` el entrypoint oficial no lanza /docker-entrypoint.d/ (ni el paso de
# los datos de la corporación). El bucle va en segundo plano y suelto de la
# entrada: el entrypoint espera a este guion antes de arrancar nginx.
#
# RECARGA_CERTIFICADO_CADA cambia el periodo (lo que acepte `sleep`); está
# para probar el bucle sin esperar seis horas.
set -eu

PERIODO="${RECARGA_CERTIFICADO_CADA:-6h}"

# La salida va a la del proceso 1 (nginx, cuando el entrypoint le hace exec):
# así llega a `docker logs`. No se hereda la del guion porque el bucle se
# quedaría con la tubería del entrypoint abierta mientras viva.
(
  # La subshell hereda `set -e`: sin esto, el primer reload fallido (una
  # configuración a medio tocar, por ejemplo) mataba el bucle sin decir nada y
  # el certificado dejaba de renovarse hasta reiniciar.
  set +e
  while :; do
    # Un periodo mal escrito haría girar el bucle sin pausa: se para y se dice.
    if ! sleep "$PERIODO"; then
      echo "[recarga] RECARGA_CERTIFICADO_CADA=$PERIODO no vale para sleep: el certificado no se recargará solo." >&2
      exit 1
    fi
    nginx -s reload || echo "[recarga] nginx -s reload ha fallado; se reintenta dentro de $PERIODO." >&2
  done
) </dev/null >/proc/1/fd/1 2>/proc/1/fd/2 &
