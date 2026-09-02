# Desamparados

Aplicación web del Grupo Parroquial de Nuestra Señora de los Desamparados.

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
Se puede apuntar a otro con `VITE_DEV_BACKEND_URL`.

Los secretos locales deben mantenerse en archivos `.env` y nunca subirse al
repositorio.

## Antes de tocar nada

`docs/notas-del-proyecto.md` recoge las reglas y las trampas del proyecto que no
se deducen leyendo el código: cómo se llama la corporación en los textos, qué
variables exige el backend solo para arrancar, cómo comprobar de verdad que una
ruta está protegida, y un par de trampas de los tests que ya han dado falsos
verdes. El estado del trabajo, en cambio, está en los `docs/traspaso-*.md`, del
más reciente hacia atrás.
