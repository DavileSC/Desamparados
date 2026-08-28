// prisma/seed.ts

import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import crypto from 'crypto';
import db from '../src/config/db';
import { sembrarContenido } from './seed-contenido';

/**
 * Contraseñas del seed:
 * - En DESARROLLO usa las clásicas (admin123/user123) para no romper el workflow local.
 * - En PRODUCCIÓN lee SEED_ADMIN_PASSWORD/SEED_USER_PASSWORD del entorno y,
 *   si no están definidas, genera aleatorias y las muestra UNA sola vez.
 */
const isDev = process.env.NODE_ENV !== 'production';

function resolveSeedPassword(envVar: string, devDefault: string, label: string): string {
  if (isDev) return devDefault;
  if (process.env[envVar]) return process.env[envVar]!;
  const generated = crypto.randomBytes(12).toString('base64url');
  console.log(`⚠️  [Seed PRODUCCIÓN] ${label}: ${generated} (guárdala AHORA, no se volverá a mostrar)`);
  return generated;
}

async function main() {
  console.log('🌱 Iniciando la siembra de datos (Seeding)...');

  const adminPassword = await hash(resolveSeedPassword('SEED_ADMIN_PASSWORD', 'admin123', 'Contraseña ADMIN'), 10);

  const admin = await db.user.upsert({
    where: { email: 'admin@cofradia.com' },
    update: {}, // Si ya existe, no hace nada
    create: {
      email: 'admin@cofradia.com',
      password: adminPassword,
      role: Role.ADMIN, // ¡IMPORTANTE!
      dni: '00000000A',
      nombre: 'Super',
      apellidos: 'Administrador',
      telefono: '600000000',
      direccion: 'Casa parroquial, Calle Real 1',
      active: true,
      twoFactorEnabled: false // Empieza desactivado para que puedas entrar y probar el setup
    },
  });

  console.log(`✅ Creado usuario Admin: ${admin.email}`);

  // 2. Crear un HERMANO RASO (Usuario normal)
  const userPassword = await hash(resolveSeedPassword('SEED_USER_PASSWORD', 'user123', 'Contraseña USER de prueba'), 10);
  
  const user = await db.user.upsert({
    where: { email: 'hermano@cofradia.com' },
    update: {},
    create: {
      email: 'hermano@cofradia.com',
      password: userPassword,
      role: Role.USER,
      dni: '11111111B',
      nombre: 'Juan',
      apellidos: 'El Cofrade',
      telefono: '611111111',
      active: true,
      
      // Creamos su perfil de hermano vinculado
      hermanos: {
        create: {
            nombre: 'Juan',
            apellidos: 'El Cofrade',
            fechaNacimiento: new Date('1990-05-15'),
            dni: '11111111B',
            esTitular: true,
            activo: true,
            // Datos procesión vacíos por ahora
            tieneTunicaPropia: false 
        }
      }
    },
  });

  console.log(`✅ Creado usuario Normal: ${user.email}`);

  // 3. Contenido de ejemplo (noticias, agenda, publicaciones, páginas,
  //    albacería y categorías contables) para no ver la web vacía.
  await sembrarContenido();

  console.log('✅ Siembra completada.');
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });