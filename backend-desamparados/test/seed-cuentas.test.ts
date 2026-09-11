import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { planDeCuentas } from '../prisma/seed-cuentas.js';

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
