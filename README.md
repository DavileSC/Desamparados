# Desamparados

Aplicacion web de la Hermandad de Nuestra Senora de los Desamparados.

## Estructura

- `desamparados-web/`: frontend React, TypeScript y Vite.
- `backend-desamparados/`: API Node.js, Express y Prisma.

## Desarrollo

El frontend y el backend se ejecutan por separado. Es necesario tener una
instancia local de MariaDB activa y configurar las variables del backend en
`backend-desamparados/.env`.

Backend:

```text
cd backend-desamparados
npm install
npx prisma migrate deploy
npm run dev
```

Frontend:

```text
cd desamparados-web
npm install
npm run dev
```

En desarrollo, Vite utiliza `http://localhost:3001` como destino del backend.

Los secretos locales deben mantenerse en archivos `.env` y nunca subirse al
repositorio.
