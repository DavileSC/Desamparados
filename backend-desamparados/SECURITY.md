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
      aleatorias (o define `SEED_ADMIN_PASSWORD`). Cambia `admin123`
      inmediatamente si sembraste en desarrollo.
- [ ] **Usuario de BD dedicado** (no root) con privilegios solo sobre
      `desamparados_db`.

## Copias de seguridad

- Windows/local: `.\scripts\backup-db.ps1` (programable con Task Scheduler).
- **Prueba la restauración** al menos una vez antes de confiar en los backups:
  `gunzip < backup.sql.gz | mysql -u root -p desamparados_db`
- Copia un backup fuera del servidor (nube/disco externo).

## Antivirus en subidas (opcional)

Si sirves PDFs al público, instala ClamAV como servicio separado y define
`CLAMAV_HOST` y `CLAMAV_PORT`. Los uploads se escanearán vía clamd antes de
aceptarse. Sin la variable, el escaneo se omite.

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
| Subidas | Whitelist MIME+extensión, magic numbers, coincidencia ext↔contenido, tamaño 5MB, ClamAV opcional |
| Cabeceras | Helmet (CSP, HSTS, frameguard, referrer-policy), CORS cerrado por defecto en producción |
| Datos | Soft-delete + anonimización RGPD (art. 15/17), exportación de datos propios |
| Forense | AuditLog de acciones sensibles con IP y user-agent |
