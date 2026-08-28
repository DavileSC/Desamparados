# Guía de Seguridad y Despliegue

Este documento recoge las medidas implementadas en el código y los requisitos
que **debes** cumplir al desplegar en producción.

## Checklist de despliegue (obligatorio)

- [ ] **HTTPS/TLS**: sirve la API detrás de un proxy con TLS (Nginx, Caddy,
      Traefik o la terminación TLS de tu plataforma). Sin HTTPS, tokens,
      contraseñas y datos personales viajan en claro. El backend ya envía
      cabeceras HSTS cuando `NODE_ENV=production`.
- [ ] **`NODE_ENV=production`** definido en el entorno (activa HSTS, endurece
      CORS y exige un `JWT_SECRET` robusto).
- [ ] **`JWT_SECRET` nuevo** de al menos 32 caracteres (64 recomendado):
      `npm run gen:secret`. No reutilices el de desarrollo.
- [ ] **`FRONTEND_URL`** definido (si no, el CORS queda cerrado en producción
      y el frontend no podrá llamar a la API).
- [ ] **`NUM_PROXIES`** correcto: `1` tras un Nginx/proxy, `2` tras
      Cloudflare+Nginx, `0` si no hay proxy. Un valor incorrecto permite
      falsear la IP y saltarse los rate limiters.
- [ ] **Contraseñas del seed**: en producción el seed genera contraseñas
      aleatorias y las muestra una sola vez (o define `SEED_ADMIN_PASSWORD` y
      `SEED_USER_PASSWORD`, que mandan también en desarrollo). Las de desarrollo
      llevan `Local` en el nombre y **están en el repositorio**: si aparecen en
      un servidor real, es que se sembró sin `NODE_ENV=production`. Cámbialas
      de inmediato.
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

- Windows/local: `.\scripts\backup-db.ps1` (programable con Task Scheduler).
- **Prueba la restauración** al menos una vez antes de confiar en los backups:
  `gunzip < backup.sql.gz | mysql -u root -p desamparados_db`
- Copia un backup fuera del servidor (nube/disco externo).

## Antivirus en subidas

Si sirves PDFs al público, instala ClamAV como servicio separado y define
`CLAMAV_HOST` y `CLAMAV_PORT`. Los uploads se escanearán vía clamd antes de
aceptarse. Por defecto, si ClamAV no está configurado, el escaneo se omite;
define `CLAMAV_REQUIRED=true` para rechazar archivos cuando el antivirus no
esté disponible.

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

(solo rol ADMIN). Los registros de auditoría NO deben borrarse masivamente:
son la prueba forense ante cualquier disputa.

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
| Entrada | Validación ArkType en 100% de rutas de escritura, sanitización HTML (noticias/páginas), escape en emails |
| Subidas | Almacenamiento público/privado separado, whitelist MIME+extensión, magic numbers, coincidencia ext↔contenido, tamaño 5MB, ClamAV opcional |
| Cabeceras | Helmet (CSP, HSTS, frameguard, referrer-policy), CORS cerrado por defecto en producción |
| Datos | Soft-delete + anonimización RGPD (art. 15/17), exportación de datos propios |
| Forense | AuditLog de acciones sensibles con IP y user-agent |
