FROM node:22-alpine
WORKDIR /app

# Solo package*.json primero para aprovechar la caché de capas
COPY package*.json ./
# npm ci: instala EXACTAMENTE lo del package-lock (reproducible y auditable)
RUN npm ci

# Código con permisos del usuario 'node' (no root)
COPY --chown=node:node . .

# Nunca ejecutar el servidor como root
USER node

EXPOSE 3001

# Entorno de desarrollo (compose). Para producción: crear una imagen con
# NODE_ENV=production, sin nodemon, idealmente multi-stage con --omit=dev.
CMD ["npm", "run", "docker:dev"]
