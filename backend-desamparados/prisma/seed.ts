// prisma/seed.ts

import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import crypto from 'crypto';
import db from '../src/config/db';
import { sembrarContenido } from './seed-contenido';
import { sembrarDemostracion } from './seed-demo';

/**
 * Contraseñas del seed:
 * - SEED_ADMIN_PASSWORD/SEED_USER_PASSWORD mandan siempre, también en desarrollo.
 * - Sin ellas, en DESARROLLO se usan las constantes de abajo, que cumplen la
 *   política real del proyecto: 12 caracteres mínimo y ninguna palabra de la
 *   lista negra. Las anteriores eran más cortas que ese mínimo, así que con las
 *   cuentas sembradas no se podía ni entrar por el formulario.
 * - Sin ellas, en PRODUCCIÓN se genera una aleatoria y se muestra UNA sola vez.
 *
 * OJO: isDev es "NODE_ENV distinto de production". Si se despliega olvidando
 * NODE_ENV=production se usarían estas contraseñas, que están en el repositorio:
 * por eso llevan "Local" en el nombre, para que cante en un servidor real.
 */
const isDev = process.env.NODE_ENV !== 'production';

const PASSWORD_DEV_ADMIN = 'Nazareno-Local-2026';
const PASSWORD_DEV_USER = 'Siembra-Local-Titular';

function resolveSeedPassword(envVar: string, devDefault: string, label: string): string {
  // El entorno manda siempre. Antes se miraba isDev primero, así que estas
  // variables se ignoraban en desarrollo sin avisar de nada.
  if (process.env[envVar]) return process.env[envVar]!;
  if (isDev) return devDefault;
  const generated = crypto.randomBytes(12).toString('base64url');
  console.log(`⚠️  [Seed PRODUCCIÓN] ${label}: ${generated} (guárdala AHORA, no se volverá a mostrar)`);
  return generated;
}

async function main() {
  console.log('🌱 Iniciando la siembra de datos (Seeding)...');

  const adminPassword = await hash(resolveSeedPassword('SEED_ADMIN_PASSWORD', PASSWORD_DEV_ADMIN, 'Contraseña ADMIN'), 10);

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
  const userPassword = await hash(resolveSeedPassword('SEED_USER_PASSWORD', PASSWORD_DEV_USER, 'Contraseña USER de prueba'), 10);
  
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

  // 4. Censo de demostración: 300 hermanos con cinco ejercicios de cuotas,
  //    papeletas, contabilidad, reparto y ropero, para ver el CMS con
  //    contenido de verdad. No se ejecuta en producción, y se puede apagar
  //    con SEED_DEMO=0.
  await sembrarDemostracion();

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