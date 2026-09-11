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
| **MariaDB** propia, a ser posible 11.8 | Prisma con el adaptador de MariaDB. 11.8 es la de desarrollo y la del CI: trae `innodb_snapshot_isolation=ON`, que decide qué pasa cuando dos personas guardan lo mismo a la vez. Con otra versión, probarlo antes (el repositorio oficial de MariaDB la ofrece para Debian y Ubuntu) |
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

En producción ClamAV es **obligatorio** (el backend no arranca sin
`CLAMAV_HOST`), así que la cifra que vale es la de 4 GB.

Dos núcleos sobran. El disco depende de cuántas fotos y PDF suba el Grupo
Parroquial: 40 GB dan para mucho tiempo, contando las copias de seguridad
locales.

### El dominio

También está sin comprar. El `server_name` de la configuración de abajo es un
marcador de posición. Al elegirlo, recordar que **la API vivirá bajo ese mismo
dominio en la ruta `/api/`**, así que no hace falta un subdominio aparte para
ella — y de hecho no debe tenerlo.

### Almacenamiento externo para las copias

Una copia que solo vive en el servidor no sobrevive a perder el servidor. Hace
falta un almacenamiento de objetos fuera (Backblaze B2, un bucket S3 de otro
proveedor, un Hetzner Storage Box...) al que `rclone` pueda subir. Mejor si
admite reglas de ciclo de vida o bloqueo de objetos: ver
[Copias de seguridad](#copias-de-seguridad).

## Piezas

| Pieza | Qué es | Cómo se sirve |
|---|---|---|
| `desamparados-web` | SPA de React construida con Vite | Ficheros estáticos de `dist/`, servidos por nginx |
| `backend-desamparados` | API de Express | Proceso Node en `127.0.0.1:3001`, gestionado por systemd |
| `storage/public` | Fotos y PDF públicos subidos desde el CMS | nginx directamente, con `alias` |
| MariaDB | Base de datos | Servicio propio, solo accesible desde la máquina |
| ClamAV (`clamd`) | Antivirus para las subidas | Servicio propio en `127.0.0.1:3310` |

La API **solo escucha en `127.0.0.1`** (variable `HOST`, que en producción vale
eso por defecto). Con `NUM_PROXIES=1` Express se fía de la última entrada de
`X-Forwarded-For`; si el puerto 3001 fuera alcanzable desde fuera sin pasar por
nginx, cualquiera podría inventarse esa cabecera y estrenar cupo en los
limitadores de intentos con cada petición. Aun así, conviene que el cortafuegos
solo deje abiertos el 22, el 80 y el 443.

## Lo que más fácilmente se olvida: el reenvío de la SPA

El router vive en el navegador. Si alguien entra directamente a
`https://…/actualidad/noticias`, el servidor busca un fichero con ese nombre, no
lo encuentra y responde 404 sin llegar a cargar la aplicación. **Toda ruta que
no corresponda a un fichero real tiene que devolver `index.html`.** Está en el
`location /` de la configuración de abajo.

## Configuración de nginx

Tres ficheros. Primero, lo que va en el contexto `http` (se carga solo desde
`conf.d/`):

```nginx
# /etc/nginx/conf.d/desamparados.conf

# No anunciar la versión de nginx en las cabeceras ni en las páginas de error.
server_tokens off;

# Registro de accesos SIN la consulta de la URL. Con el formato por defecto
# (`combined`) quedarían en disco:
#  - el token de recuperación de contraseña: el enlace del correo es
#    /reset-password?token=... (la API lo recibe en el cuerpo, nunca en la
#    ruta);
#  - las búsquedas del censo, que van en ?q= con nombres y DNI.
# Tampoco se registran el Referer (la página de recuperación lo manda con el
# token a cada recurso que carga) ni el agente de usuario, que no hacen falta.
map $request_uri $ruta_registro {
    ~^(?<ruta_sin_consulta>[^?]*)     $ruta_sin_consulta;
}
log_format desamparados '$time_iso8601 $remote_addr "$request_method $ruta_registro $server_protocol" '
                        '$status $body_bytes_sent $request_time';
```

Las cabeceras de seguridad de la web, en un fragmento aparte:

```nginx
# /etc/nginx/snippets/desamparados-seguridad.conf
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
# frame-ancestors sustituye a X-Frame-Options: nadie puede incrustarnos.
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data: blob: https:; frame-src https://www.google.com; upgrade-insecure-requests" always;
```

Y el sitio:

```nginx
# /etc/nginx/sites-available/desamparados  (enlazado desde sites-enabled/)

# Todo lo que llegue por http se manda a https. certbot --nginx sabe resolver
# la validación de Let's Encrypt con este bloque delante.
server {
    listen 80;
    listen [::]:80;
    server_name www.desamparadosmalaga.com desamparadosmalaga.com;  # marcador: el dominio está sin contratar
    return 301 https://www.desamparadosmalaga.com$request_uri;
}

# https sin www: también a www. Sin este bloque, el único servidor 443
# atendería `desamparadosmalaga.com` tal cual: sesiones distintas en cada
# nombre (la cookie es de un solo host) y el HSTS solo en www. El certificado
# tiene que cubrir los dos nombres (`certbot -d www… -d …`).
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name desamparadosmalaga.com;  # marcador

    ssl_certificate     /etc/letsencrypt/live/www.desamparadosmalaga.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.desamparadosmalaga.com/privkey.pem;

    return 301 https://www.desamparadosmalaga.com$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.desamparadosmalaga.com;  # marcador

    ssl_certificate     /etc/letsencrypt/live/www.desamparadosmalaga.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.desamparadosmalaga.com/privkey.pem;

    access_log /var/log/nginx/desamparados.access.log desamparados;
    error_log  /var/log/nginx/desamparados.error.log warn;

    root /var/www/desamparados/dist;
    index index.html;

    # Tope de cuerpo para todo lo que no diga otra cosa: la web estática no
    # recibe cuerpos. Las rutas de la API lo suben abajo.
    client_max_body_size 1m;

    # OJO con `add_header`: un `location` que tenga alguno propio NO hereda los
    # del `server`. Por eso aquí no hay ninguno a nivel de server y el fragmento
    # se incluye en cada `location` de la web. La API no lo incluye y, al no
    # haber nada que heredar, solo lleva las cabeceras de helmet (si lo
    # heredara, llevaría las dos versiones de cada cabecera, y con dos CSP el
    # navegador aplica ambas).

    # Los assets llevan hash en el nombre: se pueden cachear indefinidamente.
    location /assets/ {
        include snippets/desamparados-seguridad.conf;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html NUNCA se cachea: es quien apunta a los assets nuevos tras cada
    # despliegue. Si se cachea, los visitantes siguen viendo la versión vieja.
    location = /index.html {
        include snippets/desamparados-seguridad.conf;
        add_header Cache-Control "no-cache";
    }

    # El reenvío de la SPA. Sin esto, las rutas internas dan 404.
    location / {
        include snippets/desamparados-seguridad.conf;
        try_files $uri $uri/ /index.html;
    }

    # La API, detrás del mismo dominio. 3 MB: las noticias, páginas y
    # publicaciones del CMS admiten hasta 2 MB de JSON; el resto de la API
    # corta en 100 KB por su cuenta.
    location /api/ {
        client_max_body_size 3m;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # nginx NO añade X-Forwarded-For por su cuenta: sin esta línea
        # reenviaría intacta la que mande el cliente y Express (NUM_PROXIES=1)
        # se creería una IP inventada.
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Subidas del CMS: los PDF llegan a 20 MB y las fotos a 5 MB. Con el tope
    # general, nginx cortaría con un 413 antes de llegar a la API.
    location /api/upload/ {
        client_max_body_size 25m;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # El análisis de ClamAV de un PDF grande puede tardar unos segundos.
        proxy_read_timeout 120s;
    }

    # Archivos públicos subidos desde el CMS, directamente del disco: no gastan
    # proceso de Node ni cupo del limitador. Solo storage/public: la carpeta
    # privada no se sirve nunca por aquí (se descarga por la API, con sesión).
    location /storage/public/ {
        alias /srv/desamparados/backend-desamparados/storage/public/;
        autoindex off;
        # Sin el fragmento de la web: son fotos y PDF, no páginas, y el CSP de
        # la web puede impedir que el navegador abra un PDF con su visor.
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        # El nombre de cada archivo es aleatorio y nunca se reutiliza, pero una
        # foto borrada del CMS (p. ej. la de un menor, por RGPD) seguiría
        # sirviéndose desde la caché de cada navegador todo lo que diga aquí:
        # un día es un término medio entre rendimiento y poder retirarla.
        add_header Cache-Control "public, max-age=86400";
        location ~ /\. { deny all; }
    }
}
```

Para que nginx (usuario `www-data`) pueda leer `storage/public` sin poder leer
nada más del backend, ver los permisos en
[Usuario y servicio de la API](#usuario-y-servicio-de-la-api).

Si se prefiere no tocar permisos, `/storage/public/` también puede pasar por
Node (que lo sirve sin índices ni ficheros ocultos), pero entonces el `location`
necesita las mismas cuatro líneas `proxy_set_header` que `/api/`: sin ellas,
nginx reenvía el `X-Forwarded-For` del cliente tal cual.

### Por qué estas cabeceras y no las de helmet

Helmet las pone en Express, **que solo sirve `/api/`**. El HTML de la web lo
sirve nginx, así que sin el fragmento la página que de verdad ejecuta
JavaScript se queda sin `Content-Security-Policy` y sin protección contra
clickjacking. La cookie `httpOnly` evita que un XSS se lleve la sesión; el CSP
es la otra mitad, la que dificulta el XSS en sí.

Dos diferencias deliberadas respecto al CSP de helmet, y **si se copia el de
helmet tal cual, la web se rompe**:

| Directiva | Por qué |
|---|---|
| `frame-src https://www.google.com` | El pie incrusta el mapa de Google Maps tras aceptar cookies. Sin esto el mapa no carga |
| `img-src … https:` | `imagenUrl` del CMS es texto libre: se pueden pegar imágenes alojadas fuera. Con `'self'` se verían rotas |

`img-src https:` es permisivo a propósito. Se puede cerrar a `'self' data: blob:`
el día que el CMS obligue a subir las imágenes en vez de aceptar una URL.

En Apache, el equivalente del reenvío de la SPA en `.htaccess` es
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

La plantilla comentada es `backend-desamparados/.env.example`. **El backend
comprueba el entorno al arrancar** (`src/config/entorno.ts`) y, si falta algo
de lo obligatorio, no arranca y enumera todo lo que falta.

Obligatorias en producción (sin ellas no arranca):

| Variable | Para qué |
|---|---|
| `NODE_ENV=production` | Activa HSTS, la cookie `Secure`, el formato de registro de producción y la siembra segura. Solo valen `development`, `test` o `production`: cualquier otro valor, o ninguno, impide arrancar |
| `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_URL` | Conexión a MariaDB |
| `JWT_SECRET` | Firma de las sesiones, 32 caracteres como mínimo. Generar con `npm run gen:secret` |
| `TOTP_ENC_KEY` | Clave de cifrado del secreto del doble factor: exactamente 64 caracteres hexadecimales. Generar con `npm run gen:clave-totp`. **Si se pierde, todos los cargos tienen que volver a activar el doble factor**: guardarla también fuera del servidor. Para cambiarla, ver «Rotar `TOTP_ENC_KEY`» |
| `FRONTEND_URL` | Origen permitido por CORS y base de los enlaces de los correos. Con `https://` |
| `API_URL` | Base de las URL de los archivos subidos. Con `https://`; en este montaje, el mismo dominio que `FRONTEND_URL` |
| `EMAIL_USER`, `EMAIL_PASS` | Cuenta desde la que salen los correos |
| `NUM_PROXIES` | Cuántos proxies hay delante: `1` detrás de nginx, `2` si además hay Cloudflare. Se exige explícita porque un valor equivocado deja falsear la IP ante los limitadores |
| `CLAMAV_HOST` | Dirección de `clamd` (`127.0.0.1`) |
| `CLAMAV_REQUIRED=true` | Con `false` no arranca |

Opcionales:

| Variable | Efecto |
|---|---|
| `PORT` | Puerto de la API. Por defecto `3001`, que es al que apunta el nginx de arriba |
| `HOST` | Interfaz en la que escucha. Por defecto `127.0.0.1` en producción y todas en desarrollo. Cambiarlo en producción solo con el puerto cerrado en el cortafuegos (el arranque avisa) |
| `CLAMAV_PORT` | Por defecto `3310` |
| `EMAIL_FROM_NAME` | Nombre del remitente. Por defecto «Secretaría» |
| `CONTACT_EMAIL_TO` | Destinatario del formulario de contacto. Por defecto, `EMAIL_USER` |
| `TOTP_ENC_KEY_ANTERIOR` | Solo durante una rotación de `TOTP_ENC_KEY`: la clave de antes (64 hexadecimales). Ver «Rotar `TOTP_ENC_KEY`» |
| `CONTACT_EMAIL_USER`, `CONTACT_EMAIL_PASS` | Cuenta aparte para enviar el formulario de contacto. Sin ellas, la de `EMAIL_USER` |
| `AUDIT_RETENTION_DAYS` | Días que se conserva la auditoría. Por defecto `730`; mínimo `30` |
| `PROCESION_FECHA`, `PROCESION_HORA`, `PROCESION_ACCESO` | Solo de reserva: la fecha, la hora y la puerta que se imprimen en la papeleta se leen primero de la tabla `Configuracion` (claves `procesion_fecha`, `procesion_hora` y `procesion_acceso`, editables desde el CMS), y solo si esas claves no existen se usan estas variables |
| `NORMATIVA_URL` | Sin ella, el enlace a la normativa no aparece en los correos. Puede apuntar a un PDF subido desde el CMS (`/storage/public/<hex>.pdf`): ese fichero cuenta como «en uso» y no se borra al sustituirlo en una publicación ni con `limpiar:huerfanos --borrar` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Solo para `npm run seed`. En producción `SEED_ADMIN_EMAIL` es obligatoria |

### El antivirus, tal como funciona de verdad

`src/utils/clamd.ts` decide así (antes esta guía lo contaba al revés):

| Configuración | Qué pasa con una subida |
|---|---|
| Sin `CLAMAV_HOST` y `CLAMAV_REQUIRED` en `false` o sin definir | **No se analiza**: se acepta tal cual, y el registro lo avisa una vez (en la primera subida) |
| Sin `CLAMAV_HOST` y `CLAMAV_REQUIRED=true` | Se rechazan todas con **503**: el antivirus es obligatorio y no está configurado |
| Con `CLAMAV_HOST` y `clamd` respondiendo | Se analiza; si hay virus (`FOUND`), se rechaza con **400** |
| Con `CLAMAV_HOST` y `clamd` caído, lento (más de 60 s) o con una respuesta que no se entiende | **Se rechaza siempre** con **503** «El análisis antivirus no está disponible», también con `CLAMAV_REQUIRED=false`, y se anota en el registro |
| `CLAMAV_REQUIRED` con un valor que no sea `true` ni `false` | Se rechazan todas (el arranque ya lo detecta y no llega a pasar) |

Los PDF de las publicaciones admiten hasta **20 MB**: en `/etc/clamav/clamd.conf`,
`StreamMaxLength` tiene que ser `21M` o más (por defecto es 25M; si la
distribución trae menos, `clamd` cortaría el análisis y la subida daría 503).

O sea: `CLAMAV_REQUIRED` solo cambia algo cuando **no** hay `CLAMAV_HOST`. En
producción se exigen las dos (`CLAMAV_HOST` y `CLAMAV_REQUIRED=true`) para que
la intención quede escrita. Si `clamd` se cae, las subidas del CMS fallan hasta
que vuelva: es lo que se quiere.

## Usuario y servicio de la API

La API corre con un usuario propio, sin shell ni permisos de administración:

```bash
sudo useradd --system --home-dir /var/lib/desamparados --create-home \
  --shell /usr/sbin/nologin desamparados

# El repositorio, en /srv/desamparados. Todo del usuario de la API.
sudo chown -R desamparados:desamparados /srv/desamparados/backend-desamparados
sudo chmod 600 /srv/desamparados/backend-desamparados/.env

# nginx (www-data) tiene que llegar a storage/public y leerlo, y a nada más:
# puede atravesar las carpetas (x) pero no listarlas; public es de su grupo,
# con setgid para que lo que se suba después herede el grupo; private, solo
# del usuario de la API.
B=/srv/desamparados/backend-desamparados
sudo chmod 711 "$B" "$B/storage"
sudo chown -R desamparados:www-data "$B/storage/public"
sudo find "$B/storage/public" -type d -exec chmod 2750 {} +
sudo find "$B/storage/public" -type f -exec chmod 640 {} +
sudo chmod 700 "$B/storage/private"
```

La unidad de systemd:

```ini
# /etc/systemd/system/desamparados-api.service
[Unit]
Description=API del Grupo Parroquial (backend-desamparados)
After=network-online.target mariadb.service clamav-daemon.service
Wants=network-online.target

[Service]
Type=simple
User=desamparados
Group=desamparados
WorkingDirectory=/srv/desamparados/backend-desamparados
# El .env lo lee la propia aplicación. NODE_ENV se fija también aquí, que
# manda sobre el .env: si alguien lo borra de allí, el servicio sigue en
# producción en vez de arrancar en modo desarrollo.
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --import tsx src/index.ts
Restart=on-failure
RestartSec=5
# El cierre ordenado (SIGTERM) espera hasta 10 s a las peticiones en curso.
TimeoutStopSec=20
# Lo que se sube queda rw-r-----: legible por nginx a través del grupo.
UMask=0027
SyslogIdentifier=desamparados-api

# Endurecimiento: solo puede escribir en storage/ y en su /tmp privado.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/desamparados/backend-desamparados/storage
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now desamparados-api
journalctl -u desamparados-api -f       # su registro
```

Si el endurecimiento impide algo (se verá en `journalctl` como un error de
permisos), relajar la directiva concreta en vez de quitar el bloque entero.
Ajustar la ruta de `node` con `command -v node`, y quitar `mariadb.service` de
`After=` si la base de datos está en otra máquina.

### Por qué `node --import tsx` y no JavaScript compilado

El código usa imports sin extensión (`moduleResolution: bundler`), que Node no
resuelve por sí solo: compilar con `tsc` no basta, habría que reescribir todos
los imports o añadir un empaquetador. Para una API de este tamaño no compensa:
`tsx` (ahora en `dependencies`) transpila al arrancar en uno o dos segundos y el
proceso ya no depende de las `devDependencies`. `npm start` no ejecuta
`prisma generate` en cada arranque: eso va en el paso de construcción
(`npm run build`), junto con las migraciones.

## Orden de una puesta en producción

Todo como el usuario `desamparados` (`sudo -u desamparados -H …`) salvo lo de
systemd y nginx:

1. Backend: `npm ci` (con las `devDependencies`: `prisma` hace falta para los
   dos pasos siguientes).
2. Backend: `npm run build` (genera el cliente de Prisma).
3. Backend: `npx prisma migrate deploy` (nunca `migrate dev` en producción).
4. Backend, solo la primera vez: `npm run seed` con `NODE_ENV=production` y
   `SEED_ADMIN_EMAIL` apuntando a un correo real del Grupo Parroquial. Crea el
   administrador (con una contraseña aleatoria que se muestra **una sola vez**)
   y el contenido de ejemplo, que se sustituye después desde el CMS. No crea la
   cuenta de hermano de prueba, y se niega a sembrar sin `SEED_ADMIN_EMAIL` o
   con un `NODE_ENV` que no sea uno de los tres válidos.
5. Backend, una vez tras definir `TOTP_ENC_KEY`: `npm run 2fa:cifrar-secretos`.
   Cifra los secretos del doble factor que sigan en claro; se puede repetir sin
   miedo. **Para cambiar la clave después no basta con sustituirla**: sigue
   «Rotar `TOTP_ENC_KEY`», más abajo.
6. Frontend: `npm ci && npm run build` (regenera el sitemap y compila a `dist/`).
7. Copiar `dist/` a `/var/www/desamparados/dist`.
8. `sudo systemctl restart desamparados-api` y `sudo nginx -t && sudo systemctl reload nginx`.
9. Comprobar `curl -fsS https://www.desamparadosmalaga.com/api/health`, que
   debe responder `{"status":"ok",…}`. Desde la propia máquina también vale
   `curl -fsS http://127.0.0.1:3001/health`. (Por el dominio, `/health` sin
   `/api/` devolvería la web: nginx solo manda a Node lo que va bajo `/api/`.)

Para un despliegue posterior, lo mismo sin los pasos 4 y 5.

Si el administrador pierde el acceso: `npm run admin:nueva-contrasena -- correo@del.admin`
genera una contraseña nueva y cierra sus sesiones. Sin argumento, pregunta el correo.

Si alguien pierde el doble factor y no hay otro ADMIN que pueda rescatarlo desde
el CMS (el rescate de allí es solo de ADMIN y nunca sobre la propia cuenta):
`npm run 2fa:rescatar -- correo@de.la.cuenta`. Apaga su 2FA, borra sus códigos
de respaldo y cierra sus sesiones; queda en la auditoría como `2FA_RESET_ADMIN`
con `via: consola`. Esa persona entra después solo con contraseña y lo vuelve a
activar desde «Mi seguridad».

## Rotar `TOTP_ENC_KEY`

Los secretos del doble factor están cifrados con esta clave. Si se sustituye
sin más, ninguno se puede descifrar: cada login con 2FA falla y, si todos los
ADMIN lo tienen activo, nadie puede entrar al CMS. La rotación se hace en tres
pasos, sin cortar el servicio más que en los reinicios:

1. Generar la nueva (`npm run gen:clave-totp`). En el `.env` del servidor, pasar
   la actual a `TOTP_ENC_KEY_ANTERIOR` y poner la nueva en `TOTP_ENC_KEY`.
   Reiniciar (`sudo systemctl restart desamparados-api`): desde aquí se lee con
   las dos y se escribe con la nueva. El arranque avisa de que hay una rotación
   en curso.
2. `npm run 2fa:cifrar-secretos`. Reescribe con la nueva todo lo que estaba con
   la anterior. Si termina diciendo que hay secretos ilegibles, **no seguir**:
   esos estaban cifrados con una clave que no es ninguna de las dos.
3. Quitar `TOTP_ENC_KEY_ANTERIOR` del `.env` y reiniciar otra vez. Guardar la
   nueva clave fuera del servidor, igual que la anterior.

Si la clave se ha perdido (no hay anterior que poner), no hay forma de
recuperar los secretos: `npm run 2fa:rescatar -- correo` para cada cargo con
2FA, y que cada uno lo vuelva a activar.

## Registros

- **La API** escribe en el diario de systemd (`journalctl -u desamparados-api`).
  En producción cada petición es una línea con fecha, IP, método, ruta **sin la
  consulta**, estado, tamaño y tiempo; el token de recuperación de contraseña
  que va en la ruta se tapa. Los errores 500 dejan el mensaje, el código de
  Prisma y la pila, sin los argumentos de la consulta (que llevarían correos o
  DNI).
- **nginx**, en `/var/log/nginx/desamparados.*.log`, con el formato
  `desamparados` de arriba.

Los dos llevan IP, que es un dato personal: no se guardan para siempre.

```ini
# /etc/systemd/journald.conf.d/desamparados.conf
[Journal]
MaxRetentionSec=30day
SystemMaxUse=1G
```

(`sudo systemctl restart systemd-journald` para aplicarlo.) Para nginx,
Debian y Ubuntu ya rotan `/var/log/nginx/*.log` con `/etc/logrotate.d/nginx`:
comprobar que dice `daily` y `rotate 14` (catorce días). El registro de errores
de nginx puede incluir la línea de la petición completa cuando falla el
upstream; por eso también rota a los catorce días.

## Copias de seguridad

`backend-desamparados/scripts/backup-vps.sh` hace, en una pasada:

1. Volcado de MariaDB con `mariadb-dump --single-transaction` (consistente, sin
   bloquear la web), comprobando que termina en «Dump completed» y que trae
   todas las tablas.
2. Empaquetado del volcado junto con `storage/` (fotos y PDF, públicos y
   privados): una base restaurada sin sus archivos apunta a ficheros que no hay.
3. Cifrado con [`age`](https://age-encryption.org) para una clave **pública**.
   La clave privada no está en el servidor: quien se lleve el disco o las
   copias no puede leerlas.
4. Rotación local (14 días por defecto), siempre después de haber hecho una
   copia nueva.
5. Subida con `rclone` al almacenamiento externo, si está configurado.

Las copias quedan en `/var/backups/desamparados/desamparados_AAAAMMDDTHHMMSSZ.tar.gz.age`.

### Preparación (una vez)

En **tu equipo**, no en el servidor, generar el par de claves y guardar la
privada en dos sitios seguros (un gestor de contraseñas y un USB guardado en la
casa parroquial, por ejemplo). Sin ella las copias no se pueden abrir:

```bash
age-keygen -o clave-copias-desamparados.txt
# Public key: age1...   ← esta línea es la que va al servidor
```

En el servidor:

```bash
sudo apt install mariadb-client age rclone
sudo install -d -o desamparados -g desamparados -m 700 /var/backups/desamparados
sudo install -d -m 755 /etc/desamparados
echo 'age1...' | sudo tee /etc/desamparados/copias.pub       # la clave PÚBLICA
sudo -u desamparados -H rclone config                        # crear el remoto, p. ej. «copias»
```

```bash
# /etc/desamparados/copia.env
BACKUP_AGE_RECIPIENTS=/etc/desamparados/copias.pub
BACKUP_DIR=/var/backups/desamparados
BACKUP_RETENTION_DAYS=14
BACKUP_RCLONE_REMOTE=copias:grupo-parroquial/desamparados
```

Conviene un usuario de MariaDB solo de lectura para la copia (y ponerlo en
`BACKUP_DB_USER`/`BACKUP_DB_PASSWORD` del mismo fichero, que entonces debe ser
`chmod 600`); sin ellos se usa el de la aplicación:

```sql
CREATE USER 'copias'@'localhost' IDENTIFIED BY '...';
GRANT SELECT, LOCK TABLES, SHOW VIEW, TRIGGER ON desamparados_db.* TO 'copias'@'localhost';
```

**En el almacenamiento externo, la clave que usa `rclone` no debería poder
borrar** (Backblaze B2 permite claves sin `deleteFiles`; S3, bloqueo de objetos
o una política sin `DeleteObject`). Si quien comprometa el servidor puede borrar
también las copias de fuera, no hay copias. La rotación de allí la hacen las
reglas de ciclo de vida del propio almacenamiento (por ejemplo, conservar 90
días); el script solo sube.

### Programación diaria

```ini
# /etc/systemd/system/desamparados-copia.service
[Unit]
Description=Copia de seguridad cifrada (base de datos + storage)
After=mariadb.service

[Service]
Type=oneshot
User=desamparados
EnvironmentFile=/etc/desamparados/copia.env
ExecStart=/bin/bash /srv/desamparados/backend-desamparados/scripts/backup-vps.sh
Nice=10
IOSchedulingClass=idle
```

```ini
# /etc/systemd/system/desamparados-copia.timer
[Unit]
Description=Copia de seguridad diaria

[Timer]
OnCalendar=*-*-* 04:00:00
RandomizedDelaySec=15min
# Si el servidor estaba apagado a las 4, la hace al arrancar.
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now desamparados-copia.timer
sudo systemctl start desamparados-copia.service    # una primera copia ya
journalctl -u desamparados-copia                    # qué pasó
systemctl list-timers 'desamparados-*'              # cuándo toca la siguiente
```

Si se prefiere cron: `0 4 * * * desamparados BACKUP_AGE_RECIPIENTS=/etc/desamparados/copias.pub BACKUP_RCLONE_REMOTE=copias:grupo-parroquial/desamparados /bin/bash /srv/desamparados/backend-desamparados/scripts/backup-vps.sh`
en `/etc/cron.d/desamparados`. Con systemd, un fallo queda marcado en
`systemctl --failed`; con cron, solo en el correo local, que nadie lee.

### Restaurar

Una copia que nunca se ha restaurado es una suposición. **Restaurar una sobre
una base de datos de prueba antes de dar por buena la puesta en marcha, y
después cada pocos meses.** En una máquina que tenga la clave privada:

```bash
# 1. Traer la copia (del servidor o del almacenamiento externo) y descifrarla
rclone copy copias:grupo-parroquial/desamparados/desamparados_20260911T040000Z.tar.gz.age .
mkdir restauracion
age -d -i clave-copias-desamparados.txt desamparados_20260911T040000Z.tar.gz.age \
  | tar -xzf - -C restauracion
# restauracion/db.sql y restauracion/storage/

# 2. La base de datos, primero en una de prueba
mariadb -u root -p -e "CREATE DATABASE desamparados_prueba CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mariadb -u root -p desamparados_prueba < restauracion/db.sql
mariadb -u root -p -e "SELECT COUNT(*) FROM desamparados_prueba.User"

# 3. Solo para restaurar de verdad (con la API parada):
#    sudo systemctl stop desamparados-api
#    mariadb -u root -p desamparados_db < restauracion/db.sql
#    sudo rsync -a --delete restauracion/storage/ /srv/desamparados/backend-desamparados/storage/
#    (y volver a aplicar los permisos de storage/ de más arriba)
#    sudo systemctl start desamparados-api

# 4. Borrar lo descifrado al terminar: lleva el censo entero en claro
rm -rf restauracion
mariadb -u root -p -e "DROP DATABASE desamparados_prueba"
```

En Windows, para el equipo de desarrollo, siguen `scripts/backup-db.ps1` y
`scripts/restore-db.ps1` (solo la base de datos y sin cifrar: no son para el
servidor). La carpeta `backups/` y los `.sql` están en `.gitignore`.

## Purga de la auditoría

La tabla `AuditLog` guarda la IP y el navegador de cada acción sensible: son
datos personales y no pueden conservarse sin límite. `npm run auditoria:purgar`
borra los registros más antiguos que `AUDIT_RETENTION_DAYS` (730 días por
defecto, dos ejercicios contables). Una vez al día:

```ini
# /etc/systemd/system/desamparados-auditoria.service
[Unit]
Description=Purga de la auditoría más antigua que el plazo de retención
After=mariadb.service

[Service]
Type=oneshot
User=desamparados
WorkingDirectory=/srv/desamparados/backend-desamparados
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --import tsx scripts/purgar-auditoria.ts
```

```ini
# /etc/systemd/system/desamparados-auditoria.timer
[Unit]
Description=Purga diaria de la auditoría

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now desamparados-auditoria.timer
```

Con cron, el equivalente es
`30 3 * * * desamparados cd /srv/desamparados/backend-desamparados && NODE_ENV=production /usr/bin/node --import tsx scripts/purgar-auditoria.ts`
en `/etc/cron.d/desamparados`. Las copias de seguridad conservan lo purgado
hasta que rotan: con las de fuera en 90 días, un registro vive como mucho
`AUDIT_RETENTION_DAYS` más 90 días.

## Antes de dar por buena la puesta en marcha

- [ ] Rotar `JWT_SECRET` y las credenciales de correo que hayan podido circular
      durante el desarrollo.
- [ ] Guardar `TOTP_ENC_KEY` fuera del servidor y ejecutar
      `npm run 2fa:cifrar-secretos`.
- [ ] Sembrar con `NODE_ENV=production` y `SEED_ADMIN_EMAIL` real. Si alguna
      vez se sembró sin eso, buscar y borrar `admin@cofradia.com` y
      `hermano@cofradia.com`: sus contraseñas están en el repositorio y el
      dominio es ajeno.
- [ ] Comprobar que `https://…/actualidad/noticias` carga al entrar directamente.
- [ ] Comprobar que `http://…` redirige a `https://www.…` y que el certificado
      cubre `www` y el dominio sin `www`.
- [ ] Comprobar `https://…/api/health` y que `curl http://IP-del-servidor:3001/health`
      desde fuera **no** responde.
- [ ] Subir un PDF de más de 5 MB desde el CMS (comprueba el `client_max_body_size`
      de `/api/upload/` y que ClamAV responde).
- [ ] Hacer una copia con `desamparados-copia.service`, comprobar que llega al
      almacenamiento externo y **restaurarla una vez** sobre una base de prueba.
- [ ] Comprobar en `/var/log/nginx/desamparados.access.log` que las líneas no
      llevan `?` (ni, por tanto, el `token` del enlace de recuperación).
- [ ] Rellenar los datos legales en `desamparados-web/src/config/site.ts`: hasta
      entonces, el aviso legal muestra «pendiente de confirmar».
