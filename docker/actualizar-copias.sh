#!/usr/bin/env bash
# Actualiza varias instalaciones, una detrás de otra, desde tu equipo.
#
#   ./docker/actualizar-copias.sh docker/copias.txt            # a lo último de main
#   ./docker/actualizar-copias.sh docker/copias.txt v1.4.0     # a una versión concreta
#   ./docker/actualizar-copias.sh docker/copias.txt --seguir   # no parar si una falla
#
# Cada línea del fichero es una instalación: un nombre para reconocerla, el
# destino de ssh y, si no es la de siempre, su carpeta. Las líneas vacías y
# las que empiezan por # no cuentan.
#
#   # nombre          ssh                          carpeta
#   desamparados      despliegue@web-desamparados  /srv/desamparados
#   otra-corporacion  despliegue@203.0.113.7
#
# Por defecto se para en la primera que falle: si una versión sale mal, mejor
# que se quede en una corporación que en todas. Las que ya se actualizaron no
# se tocan. El usuario de ssh tiene que poder ejecutar como el de la aplicación
# (`sudo -u desamparados`) sin contraseña, solo esa orden.

set -Euo pipefail

fallo() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

FICHERO=""
VERSION=""
SEGUIR=0
for arg in "$@"; do
  case "$arg" in
    --seguir) SEGUIR=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    -*) fallo "Opción desconocida: $arg" ;;
    *) if [[ -z "$FICHERO" ]]; then FICHERO="$arg"; else VERSION="$arg"; fi ;;
  esac
done
[[ -n "$FICHERO" ]] || fallo "Falta el fichero con las instalaciones (./docker/actualizar-copias.sh copias.txt)."
[[ -r "$FICHERO" ]] || fallo "No puedo leer $FICHERO."
# La versión pasa por ssh a otro shell: solo lo que puede ser una etiqueta o un commit.
[[ -z "$VERSION" || "$VERSION" =~ ^[A-Za-z0-9._/-]+$ ]] || fallo "Versión no válida: $VERSION"

hechas=()
fallidas=()
pendientes=()
parar=0

while read -r nombre destino carpeta _; do
  [[ -z "${nombre:-}" || "$nombre" == \#* ]] && continue
  [[ -n "${destino:-}" ]] || fallo "A la línea de «$nombre» le falta el destino de ssh."
  carpeta="${carpeta:-/srv/desamparados}"
  if [[ "$parar" -eq 1 ]]; then pendientes+=("$nombre"); continue; fi

  printf '\n=== %s (%s:%s) ===\n' "$nombre" "$destino" "$carpeta"
  # -n: que ssh no se coma el resto del fichero, que llega por la entrada estándar.
  if ssh -n -o BatchMode=yes "$destino" "cd '$carpeta' && sudo -u desamparados ./docker/actualizar.sh $VERSION"; then
    hechas+=("$nombre")
  else
    fallidas+=("$nombre")
    [[ "$SEGUIR" -eq 1 ]] || parar=1
  fi
done < "$FICHERO"

printf '\n--- Resumen ---\n'
printf 'Actualizadas: %s\n' "${hechas[*]:-ninguna}"
printf 'Con fallo:    %s\n' "${fallidas[*]:-ninguna}"
[[ ${#pendientes[@]} -eq 0 ]] || printf 'Sin tocar (se paró en el primer fallo): %s\n' "${pendientes[*]}"
[[ ${#fallidas[@]} -eq 0 ]]
