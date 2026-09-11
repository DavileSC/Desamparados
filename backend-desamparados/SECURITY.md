# Guía de Seguridad y Despliegue

Este documento recoge las medidas implementadas en el código y los requisitos
que **debes** cumplir al desplegar en producción.

## Checklist de despliegue (obligatorio)

- [ ] **HTTPS/TLS**: sirve la API detrás de un proxy con TLS (Nginx, Caddy,
      Traefik o la terminación TLS de tu plataforma). Sin HTTPS, tokens,
      contraseñas y datos personales viajan en claro. El backend ya envía
      cabeceras HSTS cuando `NODE_ENV=production`.
- [ ] **`NODE_ENV=production`** definido en el entorno (activa HSTS, la cookie
      `Secure`, endurece CORS y exige un `JWT_SECRET` robusto). El servidor no
      arranca sin `NODE_ENV` ni con un valor distinto de `development`, `test`
      o `production`, y en producción comprueba al arrancar todas las variables
      obligatorias (`src/config/entorno.ts`; lista en `docs/despliegue.md`).
- [ ] **`JWT_SECRET` nuevo** de al menos 32 caracteres (64 recomendado):
      `npm run gen:secret`. No reutilices el de desarrollo.
- [ ] **`TOTP_ENC_KEY`** propia (`npm run gen:clave-totp`), guardada también
      fuera del servidor, y `npm run 2fa:cifrar-secretos` una vez.
- [ ] **`FRONTEND_URL`** y **`API_URL`** con `https://` (obligatorias en
      producción: sin ellas el CORS queda cerrado y los enlaces apuntan a localhost).
- [ ] **`NUM_PROXIES`** correcto y explícito: `1` tras un Nginx/proxy, `2` tras
      Cloudflare+Nginx. Un valor incorrecto permite falsear la IP y saltarse
      los rate limiters. Además, la API solo escucha en `127.0.0.1` en
      producción (`HOST`): nadie debe llegar a su puerto sin pasar por nginx.
- [ ] **Siembra**: en producción exige `SEED_ADMIN_EMAIL` (un correo real del
      Grupo Parroquial), no crea la cuenta de hermano de prueba y genera una
      contraseña aleatoria que muestra una sola vez (o usa
      `SEED_ADMIN_PASSWORD`, que debe cumplir la política). Con un `NODE_ENV`
      desconocido o sin definir, se cancela. Las contraseñas de desarrollo
      llevan `Local` en el nombre y **están en el repositorio**: si aparecen
      `admin@cofradia.com` o `hermano@cofradia.com` en un servidor real,
      bórralas de inmediato (el dominio es ajeno y tiene correo activo).
- [ ] **Usuario de BD dedicado** (no root) con privilegios solo sobre
      `desamparados_db`.

## Almacenamiento

- `/storage/public` contiene únicamente archivos destinados a la web pública.
- Los documentos privados se guardan en `/storage/private`, que no se sirve como
  contenido estático. Se descargan mediante `/api/upload/private/:filename` y
  requieren autenticación.
- Las subidas públicas y privadas usan directorios y permisos CMS separados.
- Las URLs privadas no deben copiarse a campos de contenido público ni exponerse
  en respuestas destinadas a visitantes anónimos.

## Copias de seguridad

- Servidor (Linux): `scripts/backup-vps.sh` vuelca la base de datos, la
  empaqueta con `storage/`, la cifra con `age` para una clave pública (la
  privada no vive en el servidor), rota las copias locales y las sube fuera
  con `rclone`. Programación, preparación y restauración en
  `docs/despliegue.md`.
- Windows/local: `.\scripts\backup-db.ps1` (solo la base de datos y sin
  cifrar: vale para el equipo de desarrollo, no para el servidor).
- **Prueba la restauración** al menos una vez antes de confiar en las copias,
  y después cada pocos meses, sobre una base de datos de prueba.
- `backups/`, `*.sql` y `*.age` están en `.gitignore`: una copia lleva el censo
  entero y nunca debe acabar en el repositorio.

## Antivirus en subidas

Instala ClamAV como servicio separado y define `CLAMAV_HOST` y `CLAMAV_PORT`:
las subidas se analizan vía clamd antes de aceptarse. En producción es
obligatorio (`CLAMAV_HOST` y `CLAMAV_REQUIRED=true`; sin ellos el servidor no
arranca). El comportamiento real:

- Sin `CLAMAV_HOST`, no se analiza nada (salvo que `CLAMAV_REQUIRED=true`, que
  entonces rechaza todas las subidas).
- Con `CLAMAV_HOST` y clamd caído, la subida se rechaza **siempre**, también
  con `CLAMAV_REQUIRED=false`.

El backend no inicia ni administra el proceso de ClamAV: solo conecta con el
servicio `clamd` por TCP usando `INSTREAM`. En producción, configura por ejemplo
`CLAMAV_HOST=127.0.0.1`, `CLAMAV_PORT=3310` y `CLAMAV_REQUIRED=true`, y verifica
que `clamd` esté escuchando antes de publicar el servicio web.

### Prueba local con WSL2

En Windows, una instalación de Ubuntu bajo WSL2 puede ejecutar ClamAV como
servicio independiente para las pruebas locales:

```bash
sudo apt-get install clamav clamav-daemon
sudo freshclam
sudo systemctl enable --now clamav-daemon
```

El backend usa `CLAMAV_HOST=127.0.0.1`, `CLAMAV_PORT=3310` y
`CLAMAV_REQUIRED=true`. Las comprobaciones disponibles son:

```bash
npm run test:clamav
npm run test:upload-clamav
```

La primera prueba el protocolo con un archivo limpio y EICAR. La segunda
autentica un usuario CMS, sube un PDF limpio por HTTP y elimina el archivo de
prueba al finalizar.

## Auditoría

Toda acción sensible (cobros, aprobaciones, cambios de rol/config, RGPD) queda
registrada en la tabla `AuditLog` con usuario, IP y user-agent. Consúltala con:

```
GET /api/admin/audit-logs?page=1&limit=50&action=RECIBO_COBRAR&userId=3
```

(solo rol ADMIN). Los registros de auditoría no se borran a mano: son la
prueba forense ante cualquier disputa. Pero guardan IP y navegador, que son
datos personales, así que tienen plazo: `npm run auditoria:purgar` (diario en
el servidor, ver `docs/despliegue.md`) borra los más antiguos que
`AUDIT_RETENTION_DAYS` (730 días por defecto).

## Registros

En producción el registro de accesos lleva fecha, IP, método, ruta **sin la
consulta**, estado y tiempo (las búsquedas del censo van en `?q=` con nombres y
DNI, y el enlace de recuperación lleva el token en `?token=`). La API recibe ese
token en el cuerpo de `POST /api/auth/reset-password/confirmar`, nunca en la
ruta, así que no llega a ningún registro. Los errores 500
dejan mensaje, código de Prisma y pila, sin los argumentos de la consulta. La
retención (journald y logrotate) está en `docs/despliegue.md`.

## Escalado horizontal (varias instancias)

Los contadores de lockout de login/2FA viven en memoria de cada instancia.
Con una sola instancia (lo normal en una Hermandad) funciona tal cual. Si algún
día corres varias réplicas detrás de un balanceador, mueve esos contadores y
los rate limiters a un almacén compartido (Redis, `rate-limit-redis`).

## Protecciones implementadas (resumen)

| Área | Medida |
|---|---|
| Autenticación | bcrypt (10 rondas), JWT HS256 8h, invalidación por `tokenValidAfter` |
| Fuerza bruta | Rate limit por IP (login/registro/2FA/reset) + lockout por cuenta (login y 2FA) |
| 2FA | Solo staff del CMS, backup codes de un solo uso (hash SHA-256), rescate por ADMIN auditado |
| Autorización | `checkRole` en rutas, verificación de propiedad (anti-IDOR) en todas las operaciones familiares |
| Entrada | Validación ArkType en 100% de rutas de escritura, sanitización HTML (noticias/páginas), escape en emails, cuerpo JSON de 100 KB como mucho (2 MB solo en noticias, páginas y publicaciones), email de una sola dirección y 254 caracteres |
| Subidas | Almacenamiento público/privado separado, whitelist MIME+extensión, magic numbers, coincidencia ext↔contenido, 5 MB las fotos y 20 MB los PDF, ClamAV obligatorio en producción |
| Cabeceras | Helmet (CSP con `frame-ancestors 'none'`, HSTS, frameguard, referrer-policy, CORP `same-origin` salvo `/storage/public`), CORS cerrado por defecto en producción |
| Arranque | Validación del entorno (falla cerrado sin `NODE_ENV` o sin las variables de producción), API solo en `127.0.0.1` en producción, cierre ordenado con SIGTERM |
| Datos | Soft-delete + anonimización RGPD (art. 15/17), exportación de datos propios |
| Forense | AuditLog de acciones sensibles con IP y user-agent |
