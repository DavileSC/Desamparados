// test/alta-completa.test.ts
//
// Lo que el alta pide desde que se completó el formulario: sexo, estado civil
// y bautismo de quien se hace hermano; provincia, comunidad y país; la cuota
// (domiciliada o en Secretaría) con quién es el titular de la cuenta; el
// boletín; y la foto y el certificado de bautismo, que llegan en multipart.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import sharp from 'sharp';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { registerSchema } from '../src/schemas/auth.schema.js';
import { RegistroService } from '../src/services/registro.service.js';
import { HttpError } from '../src/utils/error.handle.js';
import { privateStorageDir } from '../src/middleware/upload.middleware.js';
import { SIN_DB } from './fixtures/sin-db.js';

const PASSWORD = 'Trono-Alameda-84-Verde';
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniValido = (n: number) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`;
const IBAN = 'ES9121000418450200051332';

const adulto = (email: string, dni: string) => ({
  email, dni, password: PASSWORD, nombre: 'Rocío', apellidos: 'Vega Luna',
  telefono: '661223344', direccion: 'Calle Alameda 84', poblacion: 'Málaga', codigoPostal: '29013',
  provincia: 'Málaga', comunidadAutonoma: 'Andalucía', pais: 'España',
});
const titular = {
  fechaNacimiento: '1985-02-10', sexo: 'MUJER', estadoCivil: 'CASADO', fechaBautismo: '1985-05-19',
  lugarBautismo: 'Málaga', parroquiaBautismo: 'Santo Domingo',
} as const;

const valida = (body: unknown) =>
  !(registerSchema.onDeepUndeclaredKey('delete')({ body, query: {}, params: {} }) as { summary?: string }).summary;

describe('lo que acepta el esquema del alta completa', () => {
  const usuario = adulto('quien@ejemplo.test', dniValido(12345678));

  test('quien se hace hermano da sexo, estado civil y fecha de bautismo', () => {
    assert.ok(valida({ usuario, titular }));
    const { sexo: _s, ...sinSexo } = titular;
    assert.ok(!valida({ usuario, titular: sinSexo }));
    const { fechaBautismo: _f, ...sinBautismo } = titular;
    assert.ok(!valida({ usuario, titular: sinBautismo }));
  });

  test('el IBAN se comprueba y se guarda limpio', () => {
    assert.ok(valida({ usuario, titular, pago: { forma: 'DOMICILIACION', iban: 'ES91 2100 0418 4502 0005 1332', titularidad: 'PROPIA' } }));
    assert.ok(!valida({ usuario, titular, pago: { forma: 'DOMICILIACION', iban: 'ES9121000418450200051333', titularidad: 'PROPIA' } }));
  });

  test('los nombres de los documentos no se pueden mandar en el cuerpo', () => {
    const salida = registerSchema.onDeepUndeclaredKey('delete')({
      body: { usuario, titular, documentos: { foto: 'ajeno.jpg' } }, query: {}, params: {},
    }) as { body: Record<string, unknown> };
    assert.equal(salida.body.documentos, undefined);
  });
});

describe('el alta completa contra la base de datos', () => {
  let dbDisponible = false;
  let server: Server;
  let baseUrl: string;
  const sufijo = `${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
  const correos: string[] = [];
  let siguienteDni = 71_000_000 + randomInt(0, 900_000);
  const nuevoDni = () => dniValido(siguienteDni++);
  const nuevoCorreo = (quien: string) => {
    const email = `${quien}-${sufijo}@ejemplo.test`;
    correos.push(email);
    return email;
  };

  before(async () => {
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
    dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (dbDisponible) {
      const usuarios = await db.user.findMany({ where: { email: { in: correos } }, select: { id: true } });
      const fichas = await db.hermano.findMany({ where: { userId: { in: usuarios.map((u) => u.id) } }, select: { foto: true, certificadoBautismo: true } });
      for (const nombre of fichas.flatMap((f) => [f.foto, f.certificadoBautismo])) {
        if (nombre) fs.rmSync(path.join(privateStorageDir, nombre), { force: true });
      }
      await db.hermano.deleteMany({ where: { userId: { in: usuarios.map((u) => u.id) } } });
      await db.user.deleteMany({ where: { id: { in: usuarios.map((u) => u.id) } } });
    }
    server.close();
    await db.$disconnect();
  });

  const fichasDe = async (email: string) => {
    const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return db.hermano.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  };

  test('guarda la ficha completa, y la cuenta domiciliada vista desde cada ficha', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('completa');
    await RegistroService.registerUser({
      usuario: { ...adulto(email, nuevoDni()), boletin: true },
      titular: { ...titular },
      pago: { forma: 'DOMICILIACION', iban: IBAN, titularidad: 'PROPIA' },
      menores: [{ nombre: 'Lola', apellidos: 'Vega Luna', parentesco: 'HIJO', fechaNacimiento: '2016-09-01' }],
    });

    const [suya, menor] = await fichasDe(email);
    assert.equal(suya.sexo, 'MUJER');
    assert.equal(suya.estadoCivil, 'CASADO');
    assert.equal(suya.lugarBautismo, 'Málaga');
    assert.equal(suya.parroquiaBautismo, 'Santo Domingo');
    assert.ok(suya.fechaBautismo, 'la fecha de bautismo se guarda');
    assert.equal(suya.comunidadAutonoma, 'Andalucía');
    assert.equal(suya.boletin, true);
    assert.equal(suya.formaPagoPref, 'DOMICILIACION');
    assert.equal(suya.iban, IBAN);
    assert.equal(suya.titularidadCuenta, 'PROPIA');
    assert.equal(suya.titularCuenta, null, 'vacío es «el propio hermano», como en su perfil');

    // La cuenta del adulto, para la ficha de la niña, es la de un familiar hermano.
    assert.equal(menor.titularidadCuenta, 'FAMILIAR_HERMANO');
    assert.equal(menor.titularCuenta, 'Rocío Vega Luna');
    assert.equal(menor.iban, IBAN);
    assert.equal(menor.boletin, false, 'el boletín va a la ficha del adulto: un correo por familia');
    assert.equal(menor.comunidadAutonoma, 'Andalucía');
  });

  test('sin forma de pago (una web de antes), la cuota queda para Secretaría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('sin-pago');
    await RegistroService.registerUser({ usuario: adulto(email, nuevoDni()), titular: { ...titular } });
    const [suya] = await fichasDe(email);
    assert.equal(suya.formaPagoPref, 'EFECTIVO');
    assert.equal(suya.iban, null);
  });

  test('domiciliar sin IBAN, o con la cuenta de otro sin su nombre, no pasa', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(
      () => RegistroService.registerUser({ usuario: adulto(nuevoCorreo('sin-iban'), nuevoDni()), titular: { ...titular }, pago: { forma: 'DOMICILIACION', titularidad: 'PROPIA' } }),
      (e: HttpError) => e instanceof HttpError && /IBAN/.test(e.message),
    );
    await assert.rejects(
      () => RegistroService.registerUser({ usuario: adulto(nuevoCorreo('sin-titular'), nuevoDni()), titular: { ...titular }, pago: { forma: 'DOMICILIACION', iban: IBAN, titularidad: 'OTRA_PERSONA' } }),
      (e: HttpError) => e instanceof HttpError && /nombre del titular/.test(e.message),
    );
  });

  test('el bautismo no puede ser anterior al nacimiento', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(
      () => RegistroService.registerUser({ usuario: adulto(nuevoCorreo('bautismo'), nuevoDni()), titular: { ...titular, fechaBautismo: '1984-01-01' } }),
      (e: HttpError) => e instanceof HttpError && /fecha de bautismo/.test(e.message),
    );
  });

  // --- Por HTTP, con los documentos ---

  const multipart = (datos: unknown, documentos: Record<string, [Buffer, string]>) => {
    const formulario = new FormData();
    formulario.append('datos', JSON.stringify(datos));
    for (const [campo, [contenido, nombre]] of Object.entries(documentos)) {
      formulario.append(campo, new Blob([new Uint8Array(contenido)]), nombre);
    }
    return fetch(`${baseUrl}/api/auth/register`, { method: 'POST', body: formulario });
  };
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const ficherosPrivados = () => new Set(fs.readdirSync(privateStorageDir));

  test('la foto y el certificado llegan en multipart y quedan en la ficha, la foto en WebP y sin metadatos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const email = nuevoCorreo('documentos');
    const foto = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#a03d44' } })
      .withMetadata({ exif: { IFD0: { Copyright: 'rastro' } } }).jpeg().toBuffer();

    const res = await multipart(
      { usuario: adulto(email, nuevoDni()), titular, pago: { forma: 'EFECTIVO' }, comentarioAdicional: '' },
      { foto: [foto, 'yo.JPG'], certificadoBautismo: [PDF, 'partida.pdf'] },
    );
    assert.equal(res.status, 201, await res.clone().text());

    const [suya] = await fichasDe(email);
    assert.match(suya.foto ?? '', /^[a-f0-9]{32}\.webp$/, 'la foto se guarda en WebP');
    assert.ok(!fs.existsSync(path.join(privateStorageDir, suya.foto!.replace(/\.webp$/, '.jpg'))), 'el JPG que se subió no se queda');
    assert.match(suya.certificadoBautismo ?? '', /^[a-f0-9]{32}\.pdf$/);
    const guardada = fs.readFileSync(path.join(privateStorageDir, suya.foto!));
    const datos = await sharp(guardada).metadata();
    assert.equal(datos.format, 'webp');
    assert.equal(datos.exif, undefined, 'sin EXIF');
    assert.ok(fs.existsSync(path.join(privateStorageDir, suya.certificadoBautismo!)));
  });

  test('un documento que no es lo que dice se rechaza en su campo y no deja nada en disco', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = ficherosPrivados();
    const res = await multipart(
      { usuario: adulto(nuevoCorreo('falso'), nuevoDni()), titular, comentarioAdicional: '' },
      { certificadoBautismo: [Buffer.from('<html>no soy un pdf</html>'), 'partida.pdf'] },
    );
    assert.equal(res.status, 400);
    const cuerpo = await res.json() as { errors: { field: string }[] };
    assert.equal(cuerpo.errors[0].field, 'certificadoBautismo');
    assert.deepEqual(ficherosPrivados(), antes, 'el fichero rechazado se borra');
  });

  test('el certificado no admite Word (un .doc puede llevar macros); fotografiado, se guarda en WebP y sin metadatos', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = ficherosPrivados();
    // La cabecera de un contenedor OLE, que es lo que es un .doc.
    const doc = Buffer.concat([Buffer.from('D0CF11E0A1B11AE1', 'hex'), Buffer.alloc(504)]);
    const conWord = await multipart(
      { usuario: adulto(nuevoCorreo('word'), nuevoDni()), titular, comentarioAdicional: '' },
      { certificadoBautismo: [doc, 'partida.doc'] },
    );
    assert.equal(conWord.status, 400);
    assert.match((await conWord.json() as { message: string }).message, /PDF o una foto/);
    assert.deepEqual(ficherosPrivados(), antes);

    const email = nuevoCorreo('certfoto');
    const foto = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#eeeeee' } })
      .withMetadata({ exif: { IFD0: { Copyright: 'rastro' } } }).jpeg().toBuffer();
    const res = await multipart(
      { usuario: adulto(email, nuevoDni()), titular, pago: { forma: 'EFECTIVO' }, comentarioAdicional: '' },
      { certificadoBautismo: [foto, 'partida.jpg'] },
    );
    assert.equal(res.status, 201, await res.clone().text());
    const [suya] = await fichasDe(email);
    assert.match(suya.certificadoBautismo ?? '', /^[a-f0-9]{32}\.webp$/);
    assert.equal((await sharp(fs.readFileSync(path.join(privateStorageDir, suya.certificadoBautismo!))).metadata()).exif, undefined);
  });

  test('si el alta no sale (datos que no validan), los documentos se borran', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const antes = ficherosPrivados();
    const { sexo: _s, ...sinSexo } = titular;
    const res = await multipart(
      { usuario: adulto(nuevoCorreo('invalida'), nuevoDni()), titular: sinSexo, comentarioAdicional: '' },
      { certificadoBautismo: [PDF, 'partida.pdf'] },
    );
    assert.equal(res.status, 400);
    // La respuesta sale antes de que termine el borrado: se le da un momento.
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual(ficherosPrivados(), antes);
  });
});
