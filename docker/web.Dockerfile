# syntax=docker/dockerfile:1

# Imagen de la web: construye la SPA con Vite y la sirve con nginx, que además
# hace de proxy de la API y sirve los archivos subidos desde el CMS.
#
# El contexto de construcción es la raíz del repositorio (igual que la API),
# porque aquí se copian tanto `desamparados-web/` como `docker/nginx/`.

# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS construccion

WORKDIR /app/desamparados-web

COPY desamparados-web/package.json desamparados-web/package-lock.json ./
# Sin --omit=dev: Vite, TypeScript y los plugins son devDependencies.
RUN npm ci

COPY desamparados-web/ ./

# La web no se compila sola. Dos carpetas de fuera le hacen falta, y no solo
# en los tests:
#   - `shared/`, del que salen los textos por defecto de la portada y del
#     recorrido (useContenidoPortada.ts, RecorridoPage.tsx).
#   - `backend-desamparados/src/domain/`, de donde `lib/passwordPolicy.ts`
#     importa `password-debil`: la lista de contraseñas prohibidas es la misma
#     a los dos lados, y por eso hay un solo fichero.
# Se copia `src` entero y no ese único módulo porque el día que importe algo
# de al lado, `tsc` lo encontrará en vez de romper la construcción. Nada de
# esto llega a la imagen final: de esta etapa solo sale `dist/`.
COPY shared /app/shared
COPY backend-desamparados/src /app/backend-desamparados/src

# `npm run build` regenera antes la identidad y la lista de rutas públicas
# (script `prebuild`; esta última va a shared/ y aquí no sale de la etapa: el
# sitemap lo sirve la API con la versionada), y después hace
# `tsc -b && vite build`.
#
# VITE_API_URL se queda sin definir a propósito: el cliente cae entonces en
# `/api` (src/lib/api/client.ts), que es una ruta del mismo dominio. Apuntar a
# otro origen dejaría fuera la cookie de sesión, que es SameSite=Strict.
RUN npm run build

# Cada fichero de texto, comprimido una vez aquí: nginx sirve el .gz ya hecho
# (gzip_static, en comun.conf) y el VPS no gasta CPU en cada visita. Sin esto
# el móvil se bajaba ~1,1 MB de JS en vez de ~300 KB.
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \
      -o -name '*.json' -o -name '*.xml' -o -name '*.txt' -o -name '*.webmanifest' \) \
      -size +1k -exec gzip -k -9 {} +

# El sitio de nginx con el dominio de la corporación, del mismo fichero que la
# web: aquí hay Node y en la imagen de nginx no.
COPY docker/nginx/sitio.conf docker/nginx/generar-sitio.mjs /app/nginx/
RUN node /app/nginx/generar-sitio.mjs /app/shared/datos-entidad.json /app/nginx/sitio.conf /app/nginx/sitio-generado.conf

# ---------------------------------------------------------------------------
# La rama estable fijada, no `latest`: un `up --build` cualquiera no debe
# cambiar de versión mayor de nginx por su cuenta. La 1.30 recibe los parches
# de seguridad; al pasar a la siguiente estable se cambia aquí a mano.
FROM nginx:1.30-alpine AS servidor

# La imagen oficial trae un sitio de ejemplo en conf.d que atendería el puerto
# 80 antes que el nuestro.
RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/snippets

# Directivas del contexto `http` (conf.d se incluye ahí dentro): el formato de
# registro sin la consulta de la URL, y server_tokens.
COPY docker/nginx/comun.conf /etc/nginx/conf.d/00-comun.conf

# Las cabeceras de seguridad, en fragmentos que cada `location` incluye.
COPY docker/nginx/seguridad.conf /etc/nginx/snippets/desamparados-seguridad.conf
COPY docker/nginx/seguridad-sin-hsts.conf /etc/nginx/snippets/desamparados-seguridad-sin-hsts.conf
# Las rutas del sitio, comunes al de producción y al de detrás de otro nginx.
COPY docker/nginx/ubicaciones.conf /etc/nginx/snippets/desamparados-ubicaciones.conf

# El sitio de producción. En local, compose.local.yaml monta encima de esta
# misma ruta el de docker/nginx/sitio-local.conf.
COPY --from=construccion /app/nginx/sitio-generado.conf /etc/nginx/conf.d/desamparados.conf

COPY --from=construccion /app/desamparados-web/dist /var/www/desamparados/dist

# Punto de montaje de los archivos subidos (llega en solo lectura desde el
# disco del servidor) y carpeta del desafío de Let's Encrypt.
RUN mkdir -p /srv/storage/public /var/www/certbot

# nginx recarga cada seis horas para tomar el certificado que haya renovado
# certbot; sin esto seguiría sirviendo el viejo hasta el siguiente reinicio.
CMD ["sh", "-c", "while :; do sleep 6h & wait $!; nginx -s reload; done & exec nginx -g 'daemon off;'"]
