# Despliegue

> **El despliegue no debe ejecutarse todavía.** Este documento describe lo que
> hará falta el día que se autorice; escribirlo antes evita improvisar durante
> la puesta en producción.

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
server {
    listen 443 ssl http2;
    server_name www.desamparadosmalaga.com;

    root /var/www/desamparados/dist;
    index index.html;

    # Los assets llevan hash en el nombre: se pueden cachear indefinidamente.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html NUNCA se cachea: es quien apunta a los assets nuevos tras cada
    # despliegue. Si se cachea, los visitantes siguen viendo la versión vieja.
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # El reenvío de la SPA. Sin esto, las rutas internas dan 404.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # La API, detrás del mismo dominio.
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

En Apache, el equivalente en `.htaccess` es
`RewriteCond %{REQUEST_FILENAME} !-f` seguido de `RewriteRule . /index.html [L]`.

## Decisión pendiente: ¿mismo dominio para web y API?

La configuración de arriba las pone **bajo el mismo dominio** (`/api/` como
ruta), y conviene que siga así por dos motivos:

1. `NUM_PROXIES` y el rate limiting funcionan con la IP real que pasa el proxy.
2. Permite mover el token de sesión a una cookie `httpOnly` con
   `SameSite=Strict`, que es la única forma de que un fallo de XSS no se lleve
   la sesión por delante. Con la API en otro dominio haría falta
   `SameSite=None; Secure` y, con ello, protección CSRF explícita.

Hoy el token vive en `localStorage` precisamente porque esta decisión estaba
abierta. **Confirmar el dominio único desbloquea ese cambio.**

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
- [ ] Cambiar las contraseñas del seed (`admin123` / `user123`) o crear las
      cuentas reales y borrar las de prueba.
- [ ] Comprobar que `https://…/actualidad/noticias` carga al entrar directamente.
- [ ] Comprobar que el certificado cubre `www` y el dominio sin `www`.
- [ ] Programar la copia de seguridad y **restaurarla una vez** para verificar
      que sirve (ver `scripts/backup-db.ps1`).
- [ ] Rellenar los datos legales en `desamparados-web/src/config/site.ts`: hasta
      entonces, el aviso legal muestra «pendiente de confirmar».
