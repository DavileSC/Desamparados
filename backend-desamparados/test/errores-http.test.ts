import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, test } from 'node:test';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { handleHttp, HttpError, traducirErrorPrisma } from '../src/utils/error.handle.js';
import { globalErrorHandler } from '../src/middleware/error.middleware.js';

/**
 * Traducción de errores a respuestas HTTP.
 *
 * Los controladores capturan el error y llaman a `handleHttp`, que solo
 * reconocía `HttpError`: un DNI repetido (P2002), un registro que ya no existe
 * (P2025) o un borrado de algo en uso (P2003) salían como 500 en toda la API.
 * Los `meta` de estos errores son los que da de verdad Prisma 7 con el
 * adaptador de MariaDB (copiados de la base de datos local).
 */

const clientVersion = '7.0.0';

function errorPrisma(code: string, meta: Record<string, unknown>, message = 'fallo'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion, meta });
}

const P2002_EMAIL = errorPrisma('P2002', {
  modelName: 'User',
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '1062',
      originalMessage: "Duplicate entry 'ana@ejemplo.org' for key 'User_email_key'",
      kind: 'UniqueConstraintViolation',
      constraint: { index: 'User_email_key' },
    },
  },
}, 'Invalid `db.user.create()` invocation in\n/srv/app.ts:3:21\n\n  data: { email: "ana@ejemplo.org" }\n\nUnique constraint failed on the constraint: `User_email_key`');

const P2003_CATEGORIA = errorPrisma('P2003', {
  modelName: 'CategoriaTransaccion',
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: { originalCode: '1451', kind: 'ForeignKeyConstraintViolation', constraint: { fields: ['categoriaId'] } },
  },
});

/** Respuesta falsa que recuerda el estado y el cuerpo. */
function respuestaFalsa(method = 'POST', originalUrl = '/api/hermanos?q=12345678Z') {
  const r = {
    statusCode: 0,
    cuerpo: undefined as unknown,
    req: { method, originalUrl } as Request,
    status(codigo: number) { r.statusCode = codigo; return r; },
    json(cuerpo: unknown) { r.cuerpo = cuerpo; return r; },
  };
  return r;
}
const comoRes = (r: ReturnType<typeof respuestaFalsa>) => r as unknown as Response;

// Silencia y recoge lo que se escribe en consola durante cada test.
let registro: string[] = [];
const originales = { error: console.error, warn: console.warn };
beforeEach(() => {
  registro = [];
  console.error = (...args: unknown[]) => { registro.push(args.map(String).join(' ')); };
  console.warn = (...args: unknown[]) => { registro.push(args.map(String).join(' ')); };
});
afterEach(() => {
  console.error = originales.error;
  console.warn = originales.warn;
});

describe('traducirErrorPrisma', () => {
  test('P2002 → 409 nombrando el campo sin repetir el valor', () => {
    const t = traducirErrorPrisma(P2002_EMAIL);
    assert.deepEqual(t, { status: 409, message: 'Ya existe un registro con ese correo electrónico.' });
  });

  test('P2002 reconoce el campo por el índice, por `fields` o por `target`', () => {
    const porIndice = errorPrisma('P2002', { modelName: 'Hermano', driverAdapterError: { cause: { constraint: { index: 'Hermano_numeroHermano_key' } } } });
    assert.equal(traducirErrorPrisma(porIndice)?.message, 'Ya existe un registro con ese número de hermano.');
    const porCampos = errorPrisma('P2002', { driverAdapterError: { cause: { constraint: { fields: ['slug'] } } } });
    assert.equal(traducirErrorPrisma(porCampos)?.message, 'Ya existe un registro con esa dirección (slug).');
    const porTarget = errorPrisma('P2002', { target: ['dni'] });
    assert.equal(traducirErrorPrisma(porTarget)?.message, 'Ya existe un registro con ese DNI.');
  });

  test('P2002 sobre una clave compuesta o desconocida da el mensaje genérico', () => {
    const compuesta = errorPrisma('P2002', { modelName: 'Recibo', driverAdapterError: { cause: { constraint: { index: 'Recibo_hermanoId_year_concepto_key' } } } });
    assert.deepEqual(traducirErrorPrisma(compuesta), { status: 409, message: 'Ya existe un registro con ese valor.' });
    assert.equal(traducirErrorPrisma(errorPrisma('P2002', {}))?.message, 'Ya existe un registro con ese valor.');
  });

  test('P2025 → 404 y P2003 → 409', () => {
    assert.equal(traducirErrorPrisma(errorPrisma('P2025', { modelName: 'Noticia', operation: 'an update' }))?.status, 404);
    const t = traducirErrorPrisma(P2003_CATEGORIA);
    assert.equal(t?.status, 409);
    assert.match(t!.message, /en uso por otros registros/);
  });

  test('las escrituras concurrentes (P2034, MariaDB 1020 y 1213) → 409 «vuelve a intentarlo»', () => {
    const esperado = { status: 409, message: 'Otra persona ha cambiado estos datos a la vez; vuelve a intentarlo.' };
    // Así llega el 1020 de innodb_snapshot_isolation: el adaptador no lo traduce.
    const e1020 = Object.assign(new Error('Record has changed since last read in table \'Recibo\''), {
      name: 'DriverAdapterError',
      cause: { kind: 'mysql', code: 1020, message: 'Record has changed since last read in table \'Recibo\'', state: 'HY000' },
    });
    const e1213 = Object.assign(new Error('Deadlock found'), { name: 'DriverAdapterError', cause: { kind: 'mysql', code: 1213 } });
    const conflicto = Object.assign(new Error('TransactionWriteConflict'), { name: 'DriverAdapterError', cause: { kind: 'TransactionWriteConflict' } });
    assert.deepEqual(traducirErrorPrisma(e1020), esperado);
    assert.deepEqual(traducirErrorPrisma(e1213), esperado);
    assert.deepEqual(traducirErrorPrisma(conflicto), esperado);
    assert.deepEqual(traducirErrorPrisma(errorPrisma('P2034', {})), esperado);
    // Envuelto en un error de Prisma, con el código original en el meta:
    assert.deepEqual(traducirErrorPrisma(errorPrisma('P2010', { driverAdapterError: { cause: { kind: 'mysql', originalCode: '1020' } } })), esperado);
    // Otro error de MariaDB sin traducción sigue siendo interno:
    const otro = Object.assign(new Error('Table doesn\'t exist'), { name: 'DriverAdapterError', cause: { kind: 'mysql', code: 1146 } });
    assert.equal(traducirErrorPrisma(otro), null);
  });

  test('P2000 (texto más largo que la columna) → 400, también suelto del adaptador', () => {
    const esperado = { status: 400, message: 'Uno de los textos es demasiado largo: acórtalo y vuelve a intentarlo.' };
    assert.deepEqual(traducirErrorPrisma(errorPrisma('P2000', { modelName: 'Evento' })), esperado);
    const suelto = Object.assign(new Error('Data too long'), { name: 'DriverAdapterError', cause: { kind: 'LengthMismatch', column: 'title' } });
    assert.deepEqual(traducirErrorPrisma(suelto), esperado);
  });

  test('el resto no se traduce', () => {
    assert.equal(traducirErrorPrisma(errorPrisma('P2011', {})), null);
    assert.equal(traducirErrorPrisma(new Error('otra cosa')), null);
    assert.equal(traducirErrorPrisma(null), null);
  });
});

describe('handleHttp', () => {
  test('un 1020 de MariaDB capturado por un controlador sale como 409', () => {
    const r = respuestaFalsa();
    const e1020 = Object.assign(new Error('Record has changed since last read'), { name: 'DriverAdapterError', cause: { kind: 'mysql', code: 1020 } });
    handleHttp(comoRes(r), e1020, 'Error al cobrar el recibo');
    assert.equal(r.statusCode, 409);
    assert.match((r.cuerpo as { error: string }).error, /vuelve a intentarlo/);
  });

  test('un P2002 capturado por un controlador sale como 409, no como 500', () => {
    const r = respuestaFalsa();
    handleHttp(comoRes(r), P2002_EMAIL, 'Error al crear el hermano');
    assert.equal(r.statusCode, 409);
    assert.deepEqual(r.cuerpo, { error: 'Ya existe un registro con ese correo electrónico.' });
  });

  test('si el controlador fuerza un estado, manda el suyo', () => {
    const r = respuestaFalsa();
    handleHttp(comoRes(r), P2002_EMAIL, 'Ese slug ya está cogido', 400);
    assert.equal(r.statusCode, 400);
    assert.deepEqual(r.cuerpo, { error: 'Ese slug ya está cogido' });
  });

  test('HttpError conserva su estado y su mensaje', () => {
    const r = respuestaFalsa();
    handleHttp(comoRes(r), new HttpError('Ya tienes tu papeleta', 409), 'Error genérico');
    assert.equal(r.statusCode, 409);
    assert.deepEqual(r.cuerpo, { error: 'Ya tienes tu papeleta' });
  });

  test('un error cualquiera sigue siendo 500 con el mensaje público', () => {
    const r = respuestaFalsa();
    handleHttp(comoRes(r), new TypeError('x is undefined'), 'Error al listar');
    assert.equal(r.statusCode, 500);
    assert.deepEqual(r.cuerpo, { error: 'Error al listar' });
  });

  test('el registro de un 500 no copia los argumentos de la consulta ni la consulta de la URL', () => {
    const validacion = new Prisma.PrismaClientValidationError(
      'Invalid `db.user.create()` invocation in\n/srv/app.ts:2:21\n\n  data: {\n    email: "ana@ejemplo.org",\n    dni: "12345678Z",\n+   password: String\n  }\n\nArgument `password` is missing.',
      { clientVersion }
    );
    const r = respuestaFalsa('GET', '/api/hermanos?q=12345678Z');
    handleHttp(comoRes(r), validacion, 'Error al listar');
    const escrito = registro.join('\n');
    assert.equal(r.statusCode, 500);
    assert.ok(!escrito.includes('ana@ejemplo.org'), escrito);
    assert.ok(!escrito.includes('12345678Z'), escrito);
    // Lo que sí debe estar para diagnosticar:
    assert.match(escrito, /GET \/api\/hermanos /);
    assert.match(escrito, /PrismaClientValidationError/);
    assert.match(escrito, /Argument `password` is missing\./);
    assert.match(escrito, /Invalid `db\.user\.create\(\)` invocation/);
  });

  test('el aviso de un 409 lleva el código de Prisma pero no el valor duplicado', () => {
    handleHttp(comoRes(respuestaFalsa()), P2002_EMAIL);
    const escrito = registro.join('\n');
    assert.match(escrito, /\(P2002\)/);
    assert.ok(!escrito.includes('ana@ejemplo.org'), escrito);
  });
});

describe('globalErrorHandler', () => {
  const siguiente: NextFunction = () => {};
  const manejar = (err: unknown) => {
    const r = respuestaFalsa();
    globalErrorHandler(err, r.req, comoRes(r), siguiente);
    return r;
  };

  test('un archivo demasiado grande da 413 con mensaje claro', () => {
    const r = manejar(new multer.MulterError('LIMIT_FILE_SIZE', 'file'));
    assert.equal(r.statusCode, 413);
    assert.match((r.cuerpo as { error: string }).error, /supera el tamaño máximo/);
  });

  test('los demás errores de multer son 400', () => {
    const r = manejar(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'otro'));
    assert.equal(r.statusCode, 400);
    assert.match((r.cuerpo as { error: string }).error, /campo «file»/);
  });

  test('traduce también los errores de Prisma que llegan sin capturar', () => {
    assert.equal(manejar(P2002_EMAIL).statusCode, 409);
    assert.equal(manejar(errorPrisma('P2025', {})).statusCode, 404);
    assert.equal(manejar(P2003_CATEGORIA).statusCode, 409);
  });

  test('una escritura concurrente sin capturar sale como 409 y no como 500', () => {
    const e1020 = Object.assign(new Error('Record has changed since last read'), { name: 'DriverAdapterError', cause: { kind: 'mysql', code: 1020 } });
    const r = manejar(e1020);
    assert.equal(r.statusCode, 409);
    assert.deepEqual(r.cuerpo, { error: 'Otra persona ha cambiado estos datos a la vez; vuelve a intentarlo.' });
    assert.match(registro.join('\n'), /\(mysql 1020\)/);
  });

  test('el cuerpo demasiado grande de body-parser sale en español', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413, expose: true, type: 'entity.too.large' });
    const r = manejar(err);
    assert.equal(r.statusCode, 413);
    assert.deepEqual(r.cuerpo, { error: 'El contenido enviado es demasiado grande.' });
  });

  test('un error desconocido sigue siendo 500 sin filtrar su mensaje', () => {
    const r = manejar(new Error('detalle interno'));
    assert.equal(r.statusCode, 500);
    assert.ok(!JSON.stringify(r.cuerpo).includes('detalle interno'));
  });
});

/**
 * Con la base de datos de verdad: si una actualización de Prisma o del
 * adaptador cambia la forma del `meta`, los tests de arriba (con el `meta`
 * copiado) seguirían pasando y el campo dejaría de nombrarse sin que nadie lo
 * notara. El skip va dentro del cuerpo (ver docs/notas-del-proyecto.md, §6).
 */
describe('con MariaDB', () => {
  const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

  async function sondearDb(db: { $queryRaw: (q: TemplateStringsArray) => Promise<unknown> }): Promise<boolean> {
    const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
    return Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  }

  test('un correo repetido de verdad se traduce a 409 nombrando el campo', async (t) => {
    const { default: db } = await import('../src/config/db.js');
    const { crearUsuarioPrueba, borrarUsuarioPrueba } = await import('./fixtures/usuarios.js');
    if (!(await sondearDb(db))) return t.skip(SIN_DB);

    const usuario = await crearUsuarioPrueba();
    try {
      const error = await db.user.create({
        data: { email: usuario.email, password: 'x', dni: `D${Date.now()}`, nombre: 'a', apellidos: 'b', telefono: '600000000' },
      }).then(() => null, (e: unknown) => e);
      assert.deepEqual(traducirErrorPrisma(error), { status: 409, message: 'Ya existe un registro con ese correo electrónico.' });

      const noExiste = await db.noticia.update({ where: { id: -1 }, data: { titulo: 'x' } }).then(() => null, (e: unknown) => e);
      assert.equal(traducirErrorPrisma(noExiste)?.status, 404);
    } finally {
      await borrarUsuarioPrueba(usuario.id);
    }
  });

  test('un texto más largo que su columna se traduce a 400', async (t) => {
    const { default: db } = await import('../src/config/db.js');
    if (!(await sondearDb(db))) return t.skip(SIN_DB);
    const error = await db.evento.create({ data: { title: 'x'.repeat(300), startDate: new Date() } }).then(
      async (creado) => { await db.evento.delete({ where: { id: creado.id } }); return null; },
      (e: unknown) => e,
    );
    assert.equal(traducirErrorPrisma(error)?.status, 400);
  });

  test('una fila cambiada por otra transacción a mitad (MariaDB 1020) se traduce a 409', async (t) => {
    const { default: db } = await import('../src/config/db.js');
    const { crearUsuarioPrueba, borrarUsuarioPrueba } = await import('./fixtures/usuarios.js');
    if (!(await sondearDb(db))) return t.skip(SIN_DB);

    const [{ aislamiento }] = await db.$queryRaw<{ aislamiento: bigint | number | null }[]>`SELECT @@innodb_snapshot_isolation AS aislamiento`
      .catch(() => [{ aislamiento: null }]);
    if (Number(aislamiento) !== 1) {
      return t.skip('esta MariaDB no tiene innodb_snapshot_isolation=ON (llegó en 11.6 y viene activado desde 11.8): no da el error 1020');
    }

    const usuario = await crearUsuarioPrueba();
    try {
      // La transacción lee (fija su instantánea), otra conexión cambia la fila
      // y confirma, y la primera intenta escribirla: MariaDB responde 1020.
      const error = await db.$transaction(async (tx) => {
        await tx.user.findUnique({ where: { id: usuario.id } });
        await db.user.update({ where: { id: usuario.id }, data: { nombre: 'Otra persona' } });
        await tx.user.update({ where: { id: usuario.id }, data: { nombre: 'Yo' } });
      }).then(() => null, (e: unknown) => e);

      assert.ok(error, 'la segunda escritura debía fallar con 1020');
      assert.deepEqual(traducirErrorPrisma(error), {
        status: 409,
        message: 'Otra persona ha cambiado estos datos a la vez; vuelve a intentarlo.',
      });
    } finally {
      await borrarUsuarioPrueba(usuario.id);
    }
  });

  after(async () => {
    const { default: db } = await import('../src/config/db.js');
    await db.$disconnect();
  });
});
