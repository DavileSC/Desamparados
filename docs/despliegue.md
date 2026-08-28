# Despliegue

> **El despliegue no debe ejecutarse todavía.** Este documento describe lo que
> hará falta el día que se autorice; escribirlo antes evita improvisar durante
> la puesta en producción.

## Qué hay que contratar

**Nada de esto está contratado todavía.** Los requisitos salen de decisiones ya
tomadas en el código, así que conviene comprobarlos *antes* de pagar nada.

### Requisitos que no se pueden negociar

| Requisito | Por qué |
|---|---|
| **Ejecutar un proceso Node** de larga vida (Node 22+) | La API es Express. Un alojamiento que solo sirva estáticos o PHP no vale |
| **MariaDB o MySQL** propia | Prisma con el adaptador de MariaDB |
| **Configurar el proxy inverso** (nginx o Apache) | La web y la API **tienen** que compartir dominio: la sesión va en una cookie `SameSite=Strict` y el navegador no la mandaría a otro origen. Sin esto, nadie puede iniciar sesión |
| **Añadir cabeceras HTTP propias** | El `Content-Security-Policy` y las demás cabeceras de seguridad de la web las pone nginx, no la aplicación |
| **Certificado TLS** | Con Let's Encrypt basta |
| **Disco para las subidas** | Los ficheros del CMS van al sistema de archivos, no a la base de datos |

En la práctica eso significa **un VPS con acceso de administrador**. Un
alojamiento compartido de los que llevan cPanel puede servir el front, pero
raramente deja tocar la configuración del proxy ni añadir cabeceras, y ahí se
cae todo el montaje.

### Tamaño

Para una web de este tamaño el consumo es bajo. Lo que decide es el antivirus:

| Con qué | Memoria recomendada | Nota |
|---|---|---|
| Sin ClamAV | 2 GB | Node + MariaDB + nginx van holgados |
| **Con ClamAV** | **4 GB** | `clamd` carga la base de firmas en memoria y se come él solo más de 1 GB |

Dos núcleos sobran. El disco depende de cuántas fotos y PDF suba el Grupo
Parroquial: 40 GB dan para mucho tiempo.

### El dominio

También está sin comprar. El `server_name` de la configuración de abajo es un
marcador de posición. Al elegirlo, recordar que **la API vivirá bajo ese mismo
dominio en la ruta `/api/`**, así que no hace falta un subdominio aparte para
ella — y de hecho no debe tenerlo.

## Piezas

| Pieza | Qué es | Cómo se sirve |
|---|---|---|
| `desamparados-web` | SPA de React construida con Vite | Ficheros estáticos de `dist/` |
| `backend-desamparados` | API de Express | Proceso Node escuchando en `PORT` |
| MariaDB | Base de datos | Servicio propio, solo accesible desde la API |
| ClamAV (`clamd`) | Antivirus para las subidas | Servicio propio en el puerto 3310 |

## Lo que más fácilmente se olvida: el reenvío de la SPA

El router vive en el navegador. Si alguien entra directamente a
`https://…/actualidad/noticias`, el servidor busca un fichero con ese nombre, no
lo encuentra y responde 404 sin llegar a cargar la aplicación. **Toda ruta que
no corresponda a un fichero real tiene que devolver `index.html`.**

En nginx:

```nginx
# Cabeceras de seguridad de la web. Van en un fichero aparte porque en nginx
# `add_header` NO se hereda en un `location` que tenga sus propios `add_header`:
# hay que repetirlas con include en cada uno, o se pierden en silencio.
# Guardar como /etc/nginx/snippets/desamparados-seguridad.conf
#
#   add_header X-Content-Type-Options "nosniff" always;
#   add_header Referrer-Policy "strict-origin-when-cross-origin" always;
#   add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
#   # frame-ancestors sustituye a X-Frame-Options: nadie puede incrustarnos.
#   add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data: blob: https:; frame-src https://www.google.com; upgrade-insecure-requests" always;

server {
    listen 443 ssl http2;
    server_name www.desamparadosmalaga.com;  # marcador: el dominio esta sin contratar

    root /var/www/desamparados/dist;
    index index.html;

    include snippets/desamparados-seguridad.conf;

    # Los assets llevan hash en el nombre: se pueden cachear indefinidamente.
    location /assets/ {
        include snippets/desamparados-seguridad.conf;  # sin esto se pierden
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html NUNCA se cachea: es quien apunta a los assets nuevos tras cada
    # despliegue. Si se cachea, los visitantes siguen viendo la versión vieja.
    location = /index.html {
        include snippets/desamparados-seguridad.conf;  # sin esto se pierden
        add_header Cache-Control "no-cache";
    }

    # El reenvío de la SPA. Sin esto, las rutas internas dan 404.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # La API, detrás del mismo dominio. Aquí NO se incluye el snippet: las
    # cabeceras las pone helmet en Express, y duplicarlas daría valores dobles.
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Archivos públicos subidos desde el CMS.
    location /storage/public/ {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### Por qué estas cabeceras y no las de helmet

Helmet las pone en Express, **que solo sirve `/api/`**. El HTML de la web lo
sirve nginx, así que sin este bloque la página que de verdad ejecuta JavaScript
se queda sin `Content-Security-Policy` y sin protección contra clickjacking. La
cookie `httpOnly` evita que un XSS se lleve la sesión; el CSP es la otra mitad,
la que dificulta el XSS en sí.

Dos diferencias deliberadas respecto al CSP de helmet, y **si se copia el de
helmet tal cual, la web se rompe**:

| Directiva | Por qué |
|---|---|
| `frame-src https://www.google.com` | El pie incrusta el mapa de Google Maps tras aceptar cookies. Sin esto el mapa no carga |
| `img-src … https:` | `imagenUrl` del CMS es texto libre: se pueden pegar imágenes alojadas fuera. Con `'self'` se verían rotas |

`img-src https:` es permisivo a propósito. Se puede cerrar a `'self' data: blob:`
el día que el CMS obligue a subir las imágenes en vez de aceptar una URL.

En Apache, el equivalente en `.htaccess` es
`RewriteCond %{REQUEST_FILENAME} !-f` seguido de `RewriteRule . /index.html [L]`.

## Decidido: mismo dominio para web y API

La configuración de arriba es la definitiva: **la web y la API comparten
dominio**, con `/api/` como ruta. No es una preferencia, es un **requisito de
funcionamiento**, y por tanto un requisito para el alojamiento que se contrate:

1. `NUM_PROXIES` y el rate limiting funcionan con la IP real que pasa el proxy.
2. **La sesión viaja en una cookie `httpOnly` con `SameSite=Strict` y
   `Path=/api`.** Con la API en otro dominio el navegador no la mandaría y nadie
   podría iniciar sesión.

Por eso el bloque `location /api/` del proxy es obligatorio. Y por eso
`VITE_API_URL` no puede apuntar a otro origen: o se deja vacío, o se pone una
ruta del mismo dominio.

## Variables de entorno del backend

Obligatorias en producción:

| Variable | Para qué |
|---|---|
| `NODE_ENV=production` | Activa HSTS y cierra CORS si falta `FRONTEND_URL` |
| `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_URL` | Conexión a MariaDB |
| `JWT_SECRET` | Firma de los tokens. Generar con `npm run gen:secret` |
| `FRONTEND_URL` | Origen permitido por CORS. **Sin él, CORS queda cerrado a todo** |
| `API_URL` | Base para los enlaces de los correos |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM_NAME` | Envío de correo |
| `CONTACT_EMAIL_TO` | Destinatario del formulario de contacto |
| `NUM_PROXIES` | Cuántos proxies hay delante. Mal puesto, el rate limiting es burlable |

Recomendadas:

| Variable | Efecto si falta |
|---|---|
| `CLAMAV_REQUIRED=true` | Sin ella, si `clamd` no responde la subida se acepta sin analizar |
| `CLAMAV_HOST`, `CLAMAV_PORT` | Por defecto `127.0.0.1:3310` |
| `PROCESION_FECHA`, `PROCESION_HORA`, `PROCESION_ACCESO` | Se imprimen en las papeletas de sitio |
| `NORMATIVA_URL` | Sin ella, el enlace a la normativa no aparece en los correos |

## Orden de una puesta en producción

1. `npm ci` en los dos proyectos.
2. Backend: `npx prisma migrate deploy` (nunca `migrate dev` en producción).
3. Backend: `npm run seed` solo la primera vez, y **revisando antes** que el
   contenido de ejemplo se va a sustituir por el real desde el CMS.
4. Frontend: `npm run build` (regenera el sitemap y compila a `dist/`).
5. Copiar `dist/` a la raíz que sirve nginx.
6. Arrancar la API con un gestor de procesos que la reinicie sola (systemd o pm2).
7. Comprobar `GET /health`, que debe responder `{"status":"ok"}`.

## Antes de dar por buena la puesta en marcha

- [ ] Rotar `JWT_SECRET` y las credenciales de correo que hayan podido circular
      durante el desarrollo.
- [ ] Sembrar **con `NODE_ENV=production`**, o definir `SEED_ADMIN_PASSWORD` y
      `SEED_USER_PASSWORD`. Sin eso se usan las contraseñas de desarrollo, que
      están en el repositorio. Después, crear las cuentas reales y borrar las
      de prueba.
- [ ] Comprobar que `https://…/actualidad/noticias` carga al entrar directamente.
- [ ] Comprobar que el certificado cubre `www` y el dominio sin `www`.
- [ ] Programar la copia de seguridad y **restaurarla una vez** para verificar
      que sirve (ver `scripts/backup-db.ps1`).
- [ ] Rellenar los datos legales en `desamparados-web/src/config/site.ts`: hasta
      entonces, el aviso legal muestra «pendiente de confirmar».
