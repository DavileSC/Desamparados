import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { comprobarEntorno, hostDeEscucha, puertoDeEscucha, validarEntorno } from '../src/config/entorno.js';

/**
 * Validación del entorno al arrancar (src/config/entorno.ts).
 *
 * Sin NODE_ENV=production el backend fallaba abierto sin avisar: cookies sin
 * Secure, sin HSTS, JWT_SECRET de cualquier longitud, enlaces a localhost.
 */

const PRODUCCION_COMPLETA = {
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://www.ejemplo.org',
  API_URL: 'https://www.ejemplo.org',
  EMAIL_USER: 'secretaria@ejemplo.org',
  EMAIL_PASS: 'clave-de-aplicacion',
  NUM_PROXIES: '1',
  JWT_SECRET: 'x'.repeat(64),
  TOTP_ENC_KEY: 'ab'.repeat(32),
  CLAMAV_HOST: '127.0.0.1',
  CLAMAV_REQUIRED: 'true',
};

describe('validarEntorno', () => {
  test('sin NODE_ENV no arranca, y lo dice', () => {
    const { errores } = validarEntorno({});
    assert.equal(errores.length, 1);
    assert.match(errores[0], /NODE_ENV no está definida/);
  });

  test('un NODE_ENV desconocido («prod») no arranca: se trataría como desarrollo', () => {
    const { errores } = validarEntorno({ NODE_ENV: 'prod' });
    assert.match(errores[0], /no es un valor conocido/);
  });

  test('en desarrollo y en test basta con NODE_ENV', () => {
    assert.deepEqual(validarEntorno({ NODE_ENV: 'development' }).errores, []);
    assert.deepEqual(validarEntorno({ NODE_ENV: 'test' }).errores, []);
  });

  test('producción completa arranca sin errores ni avisos', () => {
    assert.deepEqual(validarEntorno(PRODUCCION_COMPLETA), { errores: [], avisos: [] });
  });

  test('producción sin nada enumera TODO lo que falta de una vez', () => {
    const { errores } = validarEntorno({ NODE_ENV: 'production' });
    for (const variable of ['FRONTEND_URL', 'API_URL', 'EMAIL_USER', 'EMAIL_PASS', 'NUM_PROXIES', 'JWT_SECRET', 'TOTP_ENC_KEY', 'CLAMAV_HOST', 'CLAMAV_REQUIRED']) {
      assert.ok(errores.some((e) => e.includes(variable)), `falta el error de ${variable}: ${errores.join(' / ')}`);
    }
  });

  test('una variable vacía cuenta como no definida', () => {
    const { errores } = validarEntorno({ ...PRODUCCION_COMPLETA, EMAIL_PASS: '  ' });
    assert.ok(errores.some((e) => e.includes('Falta EMAIL_PASS')));
  });

  test('en producción JWT_SECRET necesita 32 caracteres y TOTP_ENC_KEY 64 hexadecimales', () => {
    const corto = validarEntorno({ ...PRODUCCION_COMPLETA, JWT_SECRET: 'corto' }).errores;
    assert.ok(corto.some((e) => /JWT_SECRET es demasiado corto/.test(e)));
    const clave = validarEntorno({ ...PRODUCCION_COMPLETA, TOTP_ENC_KEY: 'zz'.repeat(32) }).errores;
    assert.ok(clave.some((e) => /TOTP_ENC_KEY debe tener exactamente 64/.test(e)));
  });

  test('en producción CLAMAV_REQUIRED=false no vale', () => {
    const { errores } = validarEntorno({ ...PRODUCCION_COMPLETA, CLAMAV_REQUIRED: 'false' });
    assert.ok(errores.some((e) => /CLAMAV_REQUIRED debe ser true/.test(e)));
  });

  test('en producción las URL tienen que ser https', () => {
    const { errores } = validarEntorno({ ...PRODUCCION_COMPLETA, FRONTEND_URL: 'http://localhost:5173' });
    assert.ok(errores.some((e) => /FRONTEND_URL=.*https/.test(e)));
  });

  test('valores mal escritos se detectan en cualquier entorno', () => {
    const { errores } = validarEntorno({ NODE_ENV: 'development', PORT: 'tres mil', CLAMAV_REQUIRED: 'si', AUDIT_RETENTION_DAYS: '7', NUM_PROXIES: 'uno' });
    assert.equal(errores.length, 4, errores.join(' / '));
  });

  test('avisa (sin impedir el arranque) si la API escucha fuera de la máquina', () => {
    const { errores, avisos } = validarEntorno({ ...PRODUCCION_COMPLETA, HOST: '0.0.0.0' });
    assert.deepEqual(errores, []);
    assert.ok(avisos.some((a) => a.includes('X-Forwarded-For')));
  });

  // Un pago simulado en producción daba recibos por pagados sin cobrar, y
  // solo lo decía un aviso en el registro que nadie lee.
  test('en producción, un pago de prueba corta el arranque salvo que se consienta por escrito', () => {
    for (const pago of [{ PAGO_EN_LINEA: 'simulado' }, { PAGO_EN_LINEA: 'redsys' }, { PAGO_EN_LINEA: 'redsys', REDSYS_ENTORNO: 'pruebas' }]) {
      const { errores } = validarEntorno({ ...PRODUCCION_COMPLETA, ...pago });
      assert.ok(errores.some((e) => /PAGO_DE_PRUEBA_EN_PRODUCCION=si/.test(e)), JSON.stringify(pago));
      const consentido = validarEntorno({ ...PRODUCCION_COMPLETA, ...pago, PAGO_DE_PRUEBA_EN_PRODUCCION: 'si' });
      assert.deepEqual(consentido.errores, [], JSON.stringify(pago));
      assert.ok(consentido.avisos.some((a) => /no se cobra de verdad/.test(a)));
    }
    // El banco de verdad y el pago apagado no necesitan nada.
    const real = { PAGO_EN_LINEA: 'redsys', REDSYS_ENTORNO: 'real', REDSYS_COMERCIO: '123456789', REDSYS_CLAVE: 'sq7HjrUOBfKmC576ILgskD5srU870gJ7' };
    assert.deepEqual(validarEntorno({ ...PRODUCCION_COMPLETA, ...real }).errores, []);
    assert.deepEqual(validarEntorno({ ...PRODUCCION_COMPLETA, PAGO_EN_LINEA: 'no' }).errores, []);
    // Fuera de producción el simulado es lo normal.
    assert.deepEqual(validarEntorno({ NODE_ENV: 'development', PAGO_EN_LINEA: 'simulado' }).errores, []);
  });

  test('comprobarEntorno lanza con la lista completa', () => {
    assert.throws(() => comprobarEntorno({ NODE_ENV: 'production' }), /El servidor no arranca: el entorno tiene 9 problema\(s\)/);
    assert.doesNotThrow(() => comprobarEntorno({ NODE_ENV: 'development' }));
  });
});

describe('dónde escucha el servidor', () => {
  test('en producción, solo en 127.0.0.1 salvo que HOST diga otra cosa', () => {
    assert.equal(hostDeEscucha({ NODE_ENV: 'production' }), '127.0.0.1');
    assert.equal(hostDeEscucha({ NODE_ENV: 'production', HOST: '::1' }), '::1');
  });

  test('en desarrollo no se restringe: localhost puede ser ::1 en Windows', () => {
    assert.equal(hostDeEscucha({ NODE_ENV: 'development' }), undefined);
    assert.equal(hostDeEscucha({ NODE_ENV: 'development', HOST: '' }), undefined);
  });

  test('el puerto por defecto es 3001, el mismo al que apuntan Vite y nginx', () => {
    assert.equal(puertoDeEscucha({}), 3001);
    assert.equal(puertoDeEscucha({ PORT: '3002' }), 3002);
  });
});

describe('arranque real (src/index.ts)', () => {
  test('con NODE_ENV=production y sin variables, el proceso sale con 1 y la lista', () => {
    const raiz = path.resolve(import.meta.dirname, '..');
    // Se ejecuta con `node --import tsx`, el mismo comando que `npm start`.
    // DOTENV_CONFIG_PATH apunta a un fichero que no existe para que el .env
    // local no rellene nada.
    const resultado = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: raiz,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        NODE_ENV: 'production',
        DOTENV_CONFIG_PATH: path.join(raiz, 'no-existe.env'),
        DOTENV_CONFIG_QUIET: 'true',
        // Los datos de la corporación no son lo que se prueba aquí, y con el
        // entorno vaciado el hijo no sabe que es una prueba: sin esto buscaría
        // instalacion/, que en el CI no existe, y pararía antes de la lista.
        DATOS_ENTIDAD: 'shared/datos-entidad.ejemplo.json',
      },
    });
    assert.equal(resultado.status, 1, `salida: ${resultado.stdout}\n${resultado.stderr}`);
    assert.match(resultado.stderr, /El servidor no arranca/);
    assert.match(resultado.stderr, /Falta FRONTEND_URL/);
    // Nunca llegó a importar app: el error de db.ts sería otro.
    assert.doesNotMatch(resultado.stderr, /DATABASE_HOST/);
  });
});
