import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // El comando completo, con tsx: esto es una línea de shell, no una ruta.
    // Sin él, Prisma intenta ejecutar el .ts como si fuera un binario, no pasa
    // nada y aun así informa de que la siembra terminó bien.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})