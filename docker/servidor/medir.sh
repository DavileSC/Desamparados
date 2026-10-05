#!/usr/bin/env bash
# Una medida de lo que gasta el servidor, en una línea por contenedor y otra
# para la máquina entera. La lanza cada minuto un timer de systemd
# (docs/servidor.md, «Medir el consumo») y la deja en un CSV:
#
#   /var/log/desamparados/recursos.csv
#   momento,quien,cpu_pct,memoria_mib,limite_mib
#
# «quien» es el nombre del contenedor, o «servidor» para la máquina: memoria
# usada de verdad (sin la caché del disco, que el sistema suelta cuando hace
# falta), swap usada y carga media del último minuto en la columna de la CPU.
#
# Es lo más ligero que hay: un `docker stats` sin quedarse escuchando y la
# lectura de /proc. Una herramienta de monitorización de verdad gastaría
# justo la memoria que se quiere medir.

set -Eeuo pipefail

DESTINO="${1:-/var/log/desamparados/recursos.csv}"
mkdir -p "$(dirname "$DESTINO")"
[[ -s "$DESTINO" ]] || echo "momento,quien,cpu_pct,memoria_mib,limite_mib" > "$DESTINO"

AHORA="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# A MiB, venga como venga («512.3MiB», «1.2GiB», «800kB»).
a_mib() {
  awk -v v="$1" 'BEGIN {
    n = v + 0; u = v; sub(/^[0-9.]+/, "", u)
    if (u ~ /^G/) n *= 1024; else if (u ~ /^[kK]/) n /= 1024; else if (u ~ /^B/) n /= 1048576
    printf "%.0f", n
  }'
}

docker stats --no-stream --format '{{.Name}};{{.CPUPerc}};{{.MemUsage}}' | while IFS=';' read -r nombre cpu memoria; do
  usada="${memoria%% / *}"
  limite="${memoria##* / }"
  echo "$AHORA,$nombre,${cpu%\%},$(a_mib "$usada"),$(a_mib "$limite")"
done >> "$DESTINO"

# La máquina: memoria usada (total menos disponible) y swap, en MiB; la carga
# del último minuto va en la columna de la CPU.
read -r total disponible swap_total swap_libre < <(awk '
  /^MemTotal:/ {t=$2} /^MemAvailable:/ {d=$2} /^SwapTotal:/ {st=$2} /^SwapFree:/ {sl=$2}
  END {print t, d, st, sl}' /proc/meminfo)
carga="$(cut -d' ' -f1 /proc/loadavg)"
echo "$AHORA,servidor,$carga,$(( (total - disponible) / 1024 )),$(( total / 1024 ))" >> "$DESTINO"
echo "$AHORA,swap,0,$(( (swap_total - swap_libre) / 1024 )),$(( swap_total / 1024 ))" >> "$DESTINO"
