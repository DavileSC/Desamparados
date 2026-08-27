# Resumen de traspaso actualizado

## Proyecto Desamparados

**Fecha:** 27 de agosto de 2026  
**Repositorio:** `github.com/DavileSC/Desamparados`  
**Rama:** `main`  
**Stack:** React, TypeScript, Vite, MUI, Node.js, Express, Prisma y MariaDB/MySQL  
**Estrategia:** frontend, backend, MariaDB y ClamAV como servicios independientes. Docker no forma parte del proyecto.

## 1. Estado actual

El proyecto funciona en desarrollo. El frontend y el backend arrancan correctamente, Prisma genera el cliente y la base de datos está al día. Las rutas públicas y las principales rutas autenticadas fueron probadas con respuestas HTTP correctas.

## 2. Trabajo completado

### Seguridad y autenticación

- Protección contra mass assignment en perfiles, inventario y recibos.
- Listas blancas explícitas para actualizaciones.
- Validación de cuerpos y parámetros con ArkType.
- Hashes, secretos 2FA y tokens de recuperación ocultos.
- JWT, invalidación de sesiones, rate limiting, Helmet, CORS y HPP activos.
- Login, registro, 2FA y recuperación de contraseña conectados.
- Errores internos no expuestos al cliente.

### Zona de hermanos

- Perfil conectado a `GET /api/hermanos/mis-perfiles`.
- Edición conectada a `PUT /api/hermanos/mis-perfiles/:id`.
- Recibos conectados a `GET /api/recibos/mis-recibos`.
- Papeleta e histórico conectados a `GET /api/procesion/mis-papeletas`.
- Estados de carga, error y ausencia de datos añadidos.

### Web pública

- Agenda conectada a `GET /api/events`.
- Noticias conectadas a `/api/news/latest`, `/archive` y `/:slug`.
- Fechas, contenido HTML sanitizado, ubicaciones y estados adaptados.
- `robots.txt`, `sitemap.xml`, canonicales y Open Graph añadidos para `https://www.desamparadosmalaga.com`.

### CMS implementado

Disponible bajo `/cms`, protegido por roles:

- Noticias: crear, editar, publicar, ocultar y eliminar.
- Agenda: crear, editar y eliminar eventos.
- Hermanos: censo, búsqueda, edición, aprobación y rechazo de solicitudes.
- Tesorería: listado de recibos, generación de cuotas y cobro.
- Inventario: enseres, prendas, asignaciones y devoluciones.
- Contabilidad: balance, libro mayor, categorías y apuntes manuales.
- Auditoría: visor de registros exclusivo para `ADMIN`.

### Contabilidad y datos

- Cobros generan asientos de ingreso.
- Devolución de un recibo pagado genera un asiento de gasto compensatorio.
- Reversos idempotentes para evitar duplicados concurrentes.
- Migración `20260827000000_allow_receipt_reversals` aplicada correctamente.
- `Transaccion.reciboId` ya no es único.
- Transacciones manuales y categorías generan auditoría.

### ClamAV

- Cliente TCP `clamd` con protocolo `INSTREAM`.
- Rechazo fail-closed cuando `CLAMAV_REQUIRED=true` y ClamAV no responde.
- Valores inválidos de `CLAMAV_REQUIRED` rechazados.
- Configuración documentada en `SECURITY.md` y `.env.example`.

## 3. Verificaciones realizadas

- Frontend `npm run build`: correcto.
- Frontend `npm run lint`: correcto.
- Frontend `npm run test`: 13/13 tests correctos.
- Backend `npx tsc --noEmit`: correcto.
- `npx prisma generate`: correcto.
- `npx prisma validate`: correcto.
- `npx prisma migrate status`: base de datos al día.
- Backend de desarrollo: arranque correcto en `http://localhost:3001`.
- Frontend de desarrollo: arranque correcto en `http://localhost:5173`.
- Healthcheck `/health`: HTTP 200.
- Rutas públicas de noticias, agenda y páginas: HTTP 200.
- Rutas autenticadas de hermanos y CMS: HTTP 200.
- Subida sin archivo: rechazada con HTTP 400.
- Prueba aislada de reverso contable: un reverso de 12,34 euros y limpieza posterior correcta.
- Prueba de `CLAMAV_REQUIRED=true` sin clamd: rechazo correcto.

## 4. Pendientes prioritarios

1. Probar una subida real con un servicio `clamd` instalado y activo.
2. Completar tests de integración reales para el backend.
3. Corregir los mocks restantes de portada y publicaciones.
4. Crear backend y CMS para publicaciones.
5. Conectar el formulario de contacto con un backend real.
6. Completar auditoría de noticias, páginas, agenda e inventario.
7. Validar que las inscripciones manuales solo aceptan hermanos activos.
8. Añadir reintentos controlados para conflictos de serialización.
9. Completar la máquina de estados y todos los escenarios de reversos.
10. Separar almacenamiento público y documentos privados.
11. Tipar completamente `TransaccionService` y eliminar `any` innecesarios.
12. Revisar eliminaciones físicas de noticias, papeletas e inventario.

## 5. Pendientes frontend detectados

- `FeaturedNews` de la portada todavía usa mocks.
- `FeaturedPublications` usa mocks.
- Publicaciones, boletines y dossier usan mocks.
- No existe API ni modelo de publicaciones.
- El formulario de contacto mantiene lógica simulada.
- YouTube y el reproductor en directo conservan enlaces `href="#"`.
- Algunas plantillas de correo conservan enlaces `#`.
- La zona de hermanos aún no ofrece todas las operaciones familiares avanzadas en la interfaz.
- El CMS no tiene todavía un dashboard general ni todos los módulos administrativos.

## 6. Legal, privacidad y producción

- Los textos legales fueron ampliados, pero siguen necesitando revisión jurídica.
- Falta confirmar denominación legal, NIF, domicilio completo y responsable.
- Deben concretarse plazos de conservación y canales oficiales de derechos.
- Google Maps se carga tras consentimiento explícito.
- Google Fonts sigue cargándose desde `index.html` y debe revisarse su encaje legal.
- `/storage` se sirve actualmente como almacenamiento público único.
- No hay pipeline CI/CD completo.
- No hay estrategia automatizada de restauración y verificación de backups.
- Deben rotarse secretos que hayan podido exponerse históricamente.
- La SPA necesita configuración del servidor para resolver rutas desconocidas correctamente; visualmente muestra 404, pero el servidor puede responder HTTP 200.

## 7. Pendientes que se dejan expresamente para el final

### ClamAV real

Instalar ClamAV como servicio independiente, arrancar `clamd` en el puerto 3310 y probar una subida limpia y una detección controlada.

### Despliegue

No se debe realizar todavía. Queda como tarea pendiente final:

- Frontend estático.
- Backend Node/Express.
- MariaDB.
- ClamAV/clamd.
- HTTPS, reverse proxy, variables de entorno, backups y monitorización.

## 8. Orden recomendado para la próxima sesión

1. Corregir mocks de portada y decidir el modelo de publicaciones.
2. Conectar el formulario de contacto.
3. Completar auditoría de módulos CMS.
4. Añadir validación de hermanos activos y reintentos de serialización.
5. Crear tests de integración backend.
6. Revisar almacenamiento público/privado.
7. Revisar legal y consentimiento de terceros.
8. Instalar ClamAV.
9. Ejecutar validación final en desarrollo.
10. Dejar el despliegue como último paso, sin ejecutarlo hasta recibir autorización.

## 9. Comandos de desarrollo

### Backend

```bash
cd backend-desamparados
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Frontend

```bash
cd desamparados-web
npm install
npm run dev
```

### Verificaciones

```bash
cd desamparados-web
npm run build
npm run lint
npm run test

cd ../backend-desamparados
npx tsc --noEmit
```

## 10. Nota para la próxima sesión

Continuar desde este documento. No asumir que el proyecto está listo para producción. Antes de usar datos reales hay que cerrar ClamAV, almacenamiento privado, backups, tests de integración, revisión legal y secretos.
