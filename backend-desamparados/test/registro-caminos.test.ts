// test/registro-caminos.test.ts
//
// Los tres caminos del alta: un adulto que se hace hermano, uno que además
// apunta a menores a su cargo, y uno que solo los apunta a ellos sin entrar él
// en el censo. Con las reglas que los acompañan: quién puede ser menor, quién
// tiene que ser adulto, cuántos caben en un alta y qué pasa con los DNI.
//
// El esquema se prueba sin base de datos; el alta, contra MariaDB.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { AuthService } from '../src/services/auth.service.js';
import { MAXIMO_MENORES_POR_ALTA, registerSchema } from '../src/schemas/auth.schema.js';
import { HttpError } from '../src/utils/error.handle.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const PASSWORD = 'Trono-Alameda-84-Verde';

/** DNI con la letra que le toca, para que pase la validación del esquema. */
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniValido = (n: number) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`;

const adulto = (email: string, dni: string) => ({
  email, dni, password: PASSWORD, nombre: 'Javier', apellidos: 'Ruiz Montes',
  telefono: '661223344', direccion: 'Calle Alameda 84', poblacion: 'Málaga', codigoPostal: '29013',
});

const valida = (body: unknown) =>
  !(registerSchema.onDeepUndeclaredKey('delete')({ body, query: {}, params: {} }) as { summary?: string }).summary;

describe('lo que acepta el esquema del alta', () => {
  const usuario = adulto('quien@ejemplo.test', dniValido(12345678));

  test('los tres caminos son válidos', () => {
    assert.ok(valida({ usuario, titular: { fechaNacimiento: '1986-11-03' } }));
    assert.ok(valida({ usuario, titular: { fechaNacimiento: '1986-11-03' }, menores: [{ nombre: 'Lucía', fechaNacimiento: '2017-04-12' }] }));
    assert.ok(valida({ usuario, menores: [{ nombre: 'Lucía', fechaNacimiento: '2017-04-12' }] }));
  });

  test('el menor puede traer DNI, correo y parentesco, o no traer ninguno', () => {
    const conTodo = { nombre: 'Marta', apellidos: 'Cano Ruiz', dni: dniValido(51234567), email: 'marta@ejemplo.test', parentesco: 'SOBRINO', fechaNacimiento: '2010-05-01' };
    assert.ok(valida({ usuario, menores: [conTodo] }));
    assert.ok(valida({ usuario, menores: [{ nombre: 'Martín', fechaNacimiento: '2019-06-30' }] }));
  });

  test('un parentesco inventado no cuela', () => {
    assert.ok(!valida({ usuario, menores: [{ nombre: 'Martín', parentesco: 'VECINO', fechaNacimiento: '2019-06-30' }] }));
  });

  test('la lista de menores ni va vacía ni pasa del tope', () => {
    assert.ok(!valida({ usuario, menores: [] }));
    const muchos = Array.from({ length: MAXIMO_MENORES_POR_ALTA + 1 }, (_, i) => ({ nombre: `Menor ${i}`, fechaNacimiento: '2018-01-01' }));
    assert.ok(!valida({ usuario, menores: muchos }));
  });
});

// =================================================================
//  Con base de datos
// =================================================================

describe('el alta contra la base de datos', () => {
  let dbDisponible = false;
  const sufijo = `${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  const correos: string[] = [];
  // Números altos y propios de la prueba: no chocan con los del censo sembrado.
  let siguienteDni = 70_000_000 + randomInt(0, 900_000);

  const nuevoDni = () => dniValido(siguienteDni++);
  const nuevoCorreo = (quien: string) => {
    const email = `${quien}-${sufijo}@ejemplo.test`;
    correos.push(email);
    return email;
  };

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  });

  after(async () => {
    if (dbDisponible) {
      const usuarios = await db.user.findMany({ where: { email: { in: correos } }, select: { id: true } });
      await db.hermano.deleteMany({ where: { userId: { in: usuarios.map((u) => u.id) } } });
      await db.user.deleteMany({ where: { id: { in: usuarios.map((u) => u.id) } } });
    }
    await db.$disconnect();
  });

  const fichasDe = async (email: string) => {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, active: true } });
    const fichas = await db.hermano.findMany({ where: { userId: user!.id }, orderBy: { id: 'asc' } });
    return { user, fichas };
  };

  test('camino 1: un adulto que se hace hermano tiene una ficha, la suya', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('solo-yo');
    await AuthService.registerUser({ usuario: adulto(email, nuevoDni()), titular: { fechaNacimiento: '1986-11-03' } });

    const { user, fichas } = await fichasDe(email);
    assert.equal(user!.active, false, 'la cuenta nace bloqueada');
    assert.equal(fichas.length, 1);
    assert.equal(fichas[0].esTitular, true);
    assert.equal(fichas[0].activo, false, 'la ficha nace pendiente');
    assert.equal(fichas[0].parentesco, null, 'la suya no es hija de nadie');
  });

  test('camino 2: con dos menores salen tres fichas, y solo una es la del titular', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('yo-y-los-mios');
    await AuthService.registerUser({
      usuario: adulto(email, nuevoDni()),
      titular: { fechaNacimiento: '1986-11-03' },
      menores: [
        { nombre: 'Lucía', parentesco: 'HIJO', fechaNacimiento: '2017-04-12' },
        { nombre: 'Martín', parentesco: 'HIJO', fechaNacimiento: '2019-06-30' },
      ],
    });

    const { fichas } = await fichasDe(email);
    assert.equal(fichas.length, 3);
    assert.equal(fichas.filter((f) => f.esTitular).length, 1);
    assert.deepEqual(fichas.map((f) => f.nombre), ['Javier', 'Lucía', 'Martín']);
    // Los menores heredan el contacto del adulto: por ahí se les localiza.
    assert.equal(fichas[1].telefono, '661223344');
    assert.equal(fichas[1].email, email);
    assert.equal(fichas[1].dni, null);
  });

  test('camino 3: quien solo apunta a un menor no entra en el censo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('solo-mi-hija');
    await AuthService.registerUser({
      usuario: adulto(email, nuevoDni()),
      menores: [{ nombre: 'Lucía', parentesco: 'HIJO', fechaNacimiento: '2017-04-12' }],
    });

    const { user, fichas } = await fichasDe(email);
    assert.equal(fichas.length, 1);
    assert.equal(fichas[0].esTitular, false, 'la cuenta es suya, la ficha es de la niña');
    assert.equal(fichas[0].nombre, 'Lucía');
    assert.ok(user);
  });

  test('un sobrino conserva sus apellidos; un hijo hereda los del adulto', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('con-sobrino');
    await AuthService.registerUser({
      usuario: adulto(email, nuevoDni()),
      menores: [
        { nombre: 'Hugo', apellidos: 'Cano Vega', parentesco: 'SOBRINO', fechaNacimiento: '2015-02-20' },
        { nombre: 'Martín', parentesco: 'HIJO', fechaNacimiento: '2019-06-30' },
      ],
    });

    const { fichas } = await fichasDe(email);
    const hugo = fichas.find((f) => f.nombre === 'Hugo')!;
    const martin = fichas.find((f) => f.nombre === 'Martín')!;
    assert.equal(hugo.apellidos, 'Cano Vega', 'los del tío no valen para el sobrino');
    assert.equal(hugo.parentesco, 'SOBRINO');
    assert.equal(martin.apellidos, 'Ruiz Montes', 'sin apellidos se heredan los del adulto');
    assert.equal(martin.parentesco, 'HIJO');
  });

  test('un menor de 14 a 17 puede traer su propio DNI y su correo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('con-adolescente');
    const suDni = nuevoDni();
    await AuthService.registerUser({
      usuario: adulto(email, nuevoDni()),
      menores: [{ nombre: 'Marta', dni: suDni, email: 'marta.prueba@ejemplo.test', parentesco: 'HIJO', fechaNacimiento: '2010-05-01' }],
    });

    const { fichas } = await fichasDe(email);
    assert.equal(fichas[0].dni, suDni);
    assert.equal(fichas[0].email, 'marta.prueba@ejemplo.test', 'el suyo, no el del padre');
  });

  test('sin titular ni menores no hay a quién dar de alta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(
      () => AuthService.registerUser({ usuario: adulto(nuevoCorreo('vacio'), nuevoDni()) }),
      (e: HttpError) => e instanceof HttpError && /No hay a quién dar de alta/.test(e.message),
    );
  });

  test('a quien tiene 18 cumplidos no se le apunta como menor', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(
      () => AuthService.registerUser({
        usuario: adulto(nuevoCorreo('mayor-como-menor'), nuevoDni()),
        menores: [{ nombre: 'Andrés', fechaNacimiento: '1995-01-01' }],
      }),
      (e: HttpError) => e instanceof HttpError && /con su DNI/.test(e.message),
    );
  });

  test('y un menor no abre cuenta propia haciéndose pasar por titular', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(
      () => AuthService.registerUser({
        usuario: adulto(nuevoCorreo('nino-solo'), nuevoDni()),
        titular: { fechaNacimiento: '2015-03-01' },
      }),
      (e: HttpError) => e instanceof HttpError && /tiene que apuntarte un adulto/.test(e.message),
    );
  });

  test('el mismo DNI dos veces en el mismo envío se para antes de escribir nada', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('dni-repetido');
    const repetido = nuevoDni();
    await assert.rejects(
      () => AuthService.registerUser({
        usuario: adulto(email, nuevoDni()),
        menores: [
          { nombre: 'Marta', dni: repetido, fechaNacimiento: '2010-05-01' },
          { nombre: 'Hugo', dni: repetido, fechaNacimiento: '2011-07-02' },
        ],
      }),
      (e: HttpError) => e instanceof HttpError && /mismo DNI en dos/.test(e.message),
    );
    assert.equal(await db.user.count({ where: { email } }), 0, 'no queda una cuenta a medias');
  });

  test('ni el suyo propio colado como el de un menor', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const suyo = nuevoDni();
    await assert.rejects(
      () => AuthService.registerUser({
        usuario: adulto(nuevoCorreo('mi-dni-de-hijo'), suyo),
        menores: [{ nombre: 'Marta', dni: suyo, fechaNacimiento: '2010-05-01' }],
      }),
      (e: HttpError) => e instanceof HttpError && /tu propio DNI/.test(e.message),
    );
  });

  test('un DNI que ya está en el censo se rechaza con 409', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('con-dni-ocupado');
    const ocupado = nuevoDni();
    await AuthService.registerUser({
      usuario: adulto(nuevoCorreo('primero'), nuevoDni()),
      menores: [{ nombre: 'Marta', dni: ocupado, fechaNacimiento: '2010-05-01' }],
    });

    await assert.rejects(
      () => AuthService.registerUser({
        usuario: adulto(email, nuevoDni()),
        menores: [{ nombre: 'Otra', dni: ocupado, fechaNacimiento: '2011-01-01' }],
      }),
      (e: HttpError) => e instanceof HttpError && e.status === 409,
    );
  });
});
