import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import {
  DNI_ADMIN_DESARROLLO, DNI_HERMANO_DESARROLLO, PASSWORD_DEV_ADMIN, PASSWORD_DEV_USER, planDeCuentas,
} from '../prisma/seed-cuentas.js';
import { dni } from '../src/config/common.js';
import { motivoContrasenaDebil } from '../src/domain/password-debil.js';

/**
 * Qué cuentas siembra `npm run seed` según el entorno. Sin base de datos.
 *
 * Antes creaba `admin@cofradia.com` (dominio real, con correo activo) y
 * `hermano@cofradia.com` también en producción, y cualquier NODE_ENV que no
 * fuera exactamente "production" sembraba las contraseñas del repositorio.
 */

describe('planDeCuentas', () => {
  test('en desarrollo y test siguen las cuentas de siempre (las usan los traspasos)', () => {
    for (const NODE_ENV of ['development', 'test']) {
      assert.deepEqual(planDeCuentas({ NODE_ENV }), {
        entorno: NODE_ENV,
        adminEmail: 'admin@cofradia.com',
        crearHermanoDePrueba: true,
      });
    }
  });

  test('sin NODE_ENV o con un valor desconocido se cancela', () => {
    assert.throws(() => planDeCuentas({}), /Siembra cancelada: NODE_ENV=\(sin definir\)/);
    assert.throws(() => planDeCuentas({ NODE_ENV: 'prod' }), /Siembra cancelada: NODE_ENV="prod"/);
    assert.throws(() => planDeCuentas({ NODE_ENV: 'Production' }), /Siembra cancelada/);
  });

  test('en producción exige SEED_ADMIN_EMAIL y no crea el hermano de prueba', () => {
    assert.throws(() => planDeCuentas({ NODE_ENV: 'production' }), /SEED_ADMIN_EMAIL/);
    assert.deepEqual(planDeCuentas({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'secretaria@grupo-parroquial.es' }), {
      entorno: 'production',
      adminEmail: 'secretaria@grupo-parroquial.es',
      crearHermanoDePrueba: false,
    });
  });

  test('en producción rechaza cofradia.com y correos mal escritos', () => {
    assert.throws(() => planDeCuentas({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'admin@cofradia.com' }), /dominio ajeno/);
    assert.throws(() => planDeCuentas({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'no-es-un-correo' }), /no es un correo válido/);
  });

  test('en producción una SEED_ADMIN_PASSWORD débil cancela la siembra', () => {
    const base = { NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'secretaria@grupo-parroquial.es' };
    assert.throws(() => planDeCuentas({ ...base, SEED_ADMIN_PASSWORD: 'corta' }), /SEED_ADMIN_PASSWORD no vale/);
    assert.doesNotThrow(() => planDeCuentas({ ...base, SEED_ADMIN_PASSWORD: 'Tres-Palabras-Largas-Juntas' }));
  });
});

describe('los datos de las cuentas de desarrollo', () => {
  test('los DNI tienen la letra que les toca: el alta y la ficha los validan igual', () => {
    for (const valor of [DNI_ADMIN_DESARROLLO, DNI_HERMANO_DESARROLLO]) {
      assert.equal(dni(valor) instanceof ArkErrors, false, `${valor} no es un DNI válido`);
    }
  });

  test('las contraseñas cumplen la política real, no una más floja', () => {
    for (const valor of [PASSWORD_DEV_ADMIN, PASSWORD_DEV_USER]) {
      assert.equal(motivoContrasenaDebil(valor, 'el Grupo Parroquial'), null, valor);
    }
  });
});
