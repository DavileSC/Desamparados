// prisma/seed.ts

import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import crypto from 'crypto';
import db from '../src/config/db';
import { sembrarContenido } from './seed-contenido';
import { sembrarDemostracion } from './seed-demo';
import { sembrarSalidas } from './seed-salidas';
import {
  DNI_ADMIN_DESARROLLO, DNI_HERMANO_DESARROLLO, HERMANO_EMAIL_DESARROLLO, PASSWORD_DEV_ADMIN, PASSWORD_DEV_USER,
  planDeCuentas, type PlanCuentas,
} from './seed-cuentas';
import { ModulosService } from '../src/services/modulos.service';

/**
 * Cuentas de la siembra (las reglas viven en seed-cuentas.ts):
 * - NODE_ENV tiene que ser development, test o production; con cualquier otro
 *   valor, o sin él, la siembra se cancela antes de tocar nada.
 * - En PRODUCCIÓN, el correo del administrador sale de SEED_ADMIN_EMAIL
 *   (obligatoria) y no se crea la cuenta de hermano de prueba.
 * - En desarrollo y test, `admin@cofradia.com` y `hermano@cofradia.com`, que
 *   son las que usan los traspasos y las pruebas manuales.
 *
 * Contraseñas:
 * - SEED_ADMIN_PASSWORD/SEED_USER_PASSWORD mandan siempre, también en desarrollo
 *   (en producción, SEED_ADMIN_PASSWORD tiene que cumplir la política).
 * - Sin ellas, en DESARROLLO se usan PASSWORD_DEV_ADMIN y PASSWORD_DEV_USER
 *   (seed-cuentas.ts), que cumplen la política real del proyecto: 12
 *   caracteres mínimo y ninguna palabra de la lista negra. Una prueba lo
 *   comprueba. Llevan "Local" en el nombre para que canten en un servidor real.
 * - Sin ellas, en PRODUCCIÓN se genera una aleatoria y se muestra UNA sola vez.
 * - Si la cuenta ya existe no se toca, y tampoco se genera ni se muestra
 *   ninguna contraseña (antes se mostraba una que no se llegaba a guardar).
 */


function resolveSeedPassword(plan: PlanCuentas, envVar: string, devDefault: string, label: string): string {
  // El entorno manda siempre. Antes se miraba isDev primero, así que estas
  // variables se ignoraban en desarrollo sin avisar de nada.
  if (process.env[envVar]) return process.env[envVar]!;
  if (plan.entorno !== 'production') return devDefault;
  const generated = crypto.randomBytes(12).toString('base64url');
  console.log(`⚠️  [Seed PRODUCCIÓN] ${label}: ${generated} (guárdala AHORA, no se volverá a mostrar)`);
  return generated;
}

async function yaExiste(email: string): Promise<boolean> {
  return (await db.user.findUnique({ where: { email }, select: { id: true } })) !== null;
}

async function main() {
  // Lo primero: si el entorno no está claro, no se escribe nada.
  const plan = planDeCuentas();
  console.log(`🌱 Iniciando la siembra de datos (NODE_ENV=${plan.entorno})...`);

  // 1. ADMINISTRADOR
  if (await yaExiste(plan.adminEmail)) {
    console.log(`   (el administrador ${plan.adminEmail} ya existe: no se toca, tampoco su contraseña)`);
  } else {
    const adminPassword = await hash(resolveSeedPassword(plan, 'SEED_ADMIN_PASSWORD', PASSWORD_DEV_ADMIN, 'Contraseña ADMIN'), 10);
    await db.user.create({
      data: {
        email: plan.adminEmail,
        password: adminPassword,
        role: Role.ADMIN, // ¡IMPORTANTE!
        dni: DNI_ADMIN_DESARROLLO,
        nombre: 'Super',
        apellidos: 'Administrador',
        telefono: '600000000',
        direccion: 'Casa parroquial, Calle Real 1',
        active: true,
        twoFactorEnabled: false // Empieza desactivado para que puedas entrar y probar el setup
      },
    });
    console.log(`✅ Creado usuario Admin: ${plan.adminEmail}`);
    if (plan.entorno === 'production') {
      console.log('   Entra en /cms/acceso, activa el doble factor y completa los datos reales de la ficha.');
    }
  }

  // 2. HERMANO RASO de prueba (usuario normal). Nunca en producción.
  if (!plan.crearHermanoDePrueba) {
    console.log('   (cuenta de hermano de prueba omitida en producción)');
  } else if (await yaExiste(HERMANO_EMAIL_DESARROLLO)) {
    console.log(`   (${HERMANO_EMAIL_DESARROLLO} ya existe: no se toca)`);
  } else {
    const userPassword = await hash(resolveSeedPassword(plan, 'SEED_USER_PASSWORD', PASSWORD_DEV_USER, 'Contraseña USER de prueba'), 10);
    await db.user.create({
      data: {
        email: HERMANO_EMAIL_DESARROLLO,
        password: userPassword,
        role: Role.USER,
        dni: DNI_HERMANO_DESARROLLO,
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
            dni: DNI_HERMANO_DESARROLLO,
            esTitular: true,
            activo: true,
            // Datos procesión vacíos por ahora
            tieneTunicaPropia: false
          }
        }
      },
    });
    console.log(`✅ Creado usuario Normal: ${HERMANO_EMAIL_DESARROLLO}`);
  }

  // 3. Contenido de ejemplo (noticias, agenda, publicaciones, páginas,
  //    albacería y categorías contables) para no ver la web vacía.
  await sembrarContenido({ soloTablasVacias: plan.entorno === 'production' });

  // 4. Las salidas procesionales: sin ellas no hay papeletas, ni repartos, ni
  //    mesa. Antes de la demostración, que cuelga sus papeletas de la Pasión.
  await sembrarSalidas({ soloSiNoHay: plan.entorno === 'production' });

  // 4b. Los módulos que esta instalación tiene encendidos (instalacion/datos-entidad.json).
  const modulosNuevos = await ModulosService.sembrar();
  console.log(`   ${modulosNuevos} módulos nuevos (los que ya existían no se tocan)`);

  // 5. Censo de demostración: 300 hermanos con cinco ejercicios de cuotas,
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
    // Las cancelaciones de seed-cuentas.ts se explican solas; lo demás, con su pila.
    console.error(e instanceof Error && e.message.startsWith('Siembra cancelada') ? e.message : e);
    await db.$disconnect();
    process.exit(1);
  });
