# syntax=docker/dockerfile:1

# Imagen de la API (Express + Prisma).
#
# El contexto de construcción es la RAÍZ del repositorio, no
# `backend-desamparados/`: el código importa `../../../shared/*.json`, o sea
# que dentro de la imagen tiene que haber `/app/shared` al lado de
# `/app/backend-desamparados`. Con el contexto puesto en la carpeta del
# backend, esa ruta se sale del contexto y la construcción falla.
#
# Dos imágenes salen de aquí:
#   - `ejecucion`   la que corre en producción, sin devDependencies.
#   - `herramientas` la misma más el CLI de Prisma y lo necesario para las
#                    migraciones, la siembra y los scripts de mantenimiento.
#
# Node 22 porque es la del CI (.github/workflows/verificacion.yml) y la que
# pide docs/despliegue.md. Debian y no Alpine: sharp y el cliente de Prisma
# traen binarios compilados para glibc.

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV NODE_ENV=production
WORKDIR /app/backend-desamparados

# tini: como PID 1, Node recibe el SIGTERM de `docker compose stop` y cierra
#   ordenadamente (el servidor espera a las peticiones en curso). Sin él, el
#   proceso 1 no reenvía las señales y el contenedor muere de un tirón a los
#   diez segundos.
# openssl: la imagen slim no lo trae y Prisma, al no poder averiguar la
#   versión de libssl, avisa en cada orden y tira de un binario para
#   OpenSSL 1.1 que no es el de esta imagen (Debian 12 lleva la 3).
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini openssl \
 && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Dependencias completas + cliente de Prisma. Esta etapa no llega a producción.
FROM base AS dependencias

COPY backend-desamparados/package.json backend-desamparados/package-lock.json ./
# --include=dev: con NODE_ENV=production, `npm ci` las omitiría, y `prisma`
# (el CLI que genera el cliente y aplica las migraciones) es devDependency.
RUN npm ci --include=dev

COPY backend-desamparados/prisma ./prisma
COPY backend-desamparados/prisma.config.ts backend-desamparados/tsconfig.json ./

# `prisma.config.ts` exige DATABASE_URL para resolver la datasource. Generar el
# cliente no abre ninguna conexión, así que aquí vale cualquier cosa con forma
# de URL; la de verdad la pone el compose al arrancar. No queda en la imagen
# final: esta etapa solo aporta node_modules.
ENV DATABASE_URL="mysql://construccion:construccion@127.0.0.1:3306/construccion"
RUN npx prisma generate

# ---------------------------------------------------------------------------
# Lo que corre en producción.
FROM base AS ejecucion

COPY backend-desamparados/package.json backend-desamparados/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# El cliente generado. `@prisma/client` ya viene de las dependencias normales;
# lo que falta es lo que `prisma generate` escribe en `.prisma/`.
COPY --from=dependencias /app/backend-desamparados/node_modules/.prisma ./node_modules/.prisma

# `shared/` es dependencia de ejecución, no un extra: sin ella la API no
# arranca.
COPY shared /app/shared

COPY backend-desamparados/src ./src
COPY backend-desamparados/prisma ./prisma
COPY backend-desamparados/tsconfig.json backend-desamparados/prisma.config.ts ./

# Las subidas del CMS se montan aquí desde el disco del servidor (ver
# compose.yaml). Se crean ahora para que el punto de montaje exista con el
# dueño correcto aunque el servidor arranque con la carpeta vacía.
RUN mkdir -p storage/public storage/private && chown -R node:node storage

USER node
EXPOSE 3001

# La imagen no trae curl; Node 22 tiene fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
# Sin compilar a JavaScript, igual que fuera de Docker: el código usa imports
# sin extensión (`moduleResolution: bundler`) que Node no resuelve solo. El
# porqué, en docs/despliegue.md.
CMD ["node", "--import", "tsx", "src/index.ts"]

# ---------------------------------------------------------------------------
# Migraciones, siembra y mantenimiento. Misma imagen más las devDependencies.
FROM ejecucion AS herramientas

USER root
# Reemplaza node_modules por el completo (incluye el CLI de Prisma y el cliente
# ya generado de la etapa `dependencias`).
COPY --from=dependencias /app/backend-desamparados/node_modules ./node_modules
COPY backend-desamparados/scripts ./scripts
USER node

HEALTHCHECK NONE
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npx", "prisma", "migrate", "deploy"]
