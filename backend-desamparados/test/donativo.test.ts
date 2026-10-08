// El donativo en línea desde la web pública (octubre de 2026).
//
// Lo que se admite lo dice el bloque «Donativo» de la página: el servidor lo
// vuelve a leer y no acepta un destino que no esté en él ni un importe fuera
// de los límites. Cobrado, entra una vez en la contabilidad aunque el banco
// repita el aviso, y el donante recibe las gracias si dejó su correo. La
// página se simula: las pruebas no tocan el contenido de la base.

import assert from 'node:assert/strict';
import { after, before, describe, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoPagoEnLinea, TipoPagoEnLinea } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { configuracionRedsys, firmar } from '../src/domain/redsys.js';
import { ContenidoService } from '../src/services/contenido.service.js';
import { DonativoService, bloqueDeDonativo, conceptoDelDonativo } from '../src/services/pagos/donativo.service.js';
import { TransaccionService } from '../src/services/transaccion.service.js';
import { ponerTransporte, type TransporteDeCorreo } from '../src/services/correos/envio.js';
import { SIN_DB } from './fixtures/sin-db.js';

const CLAVE = configuracionRedsys({}).clave;
const BLOQUE = { tipo: 'donativo', titulo: 'Colabora', texto: '', importes: [5, 10, 20], destinos: ['Caridad', 'Cultos'] };
const VARIABLES = ['PAGO_EN_LINEA', 'REDSYS_ENTORNO', 'REDSYS_COMERCIO', 'REDSYS_TERMINAL', 'REDSYS_CLAVE', 'REDSYS_BIZUM'] as const;
const previas = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));

let dbDisponible = false;
let server: Server;
let baseUrl: string;
let pagina: unknown = { bloques: [BLOQUE] };
const enviados: Parameters<TransporteDeCorreo['sendMail']>[0][] = [];
const marca = Date.now().toString(36);

before(async () => {
  mock.method(ContenidoService, 'leer', async () => pagina);
  ponerTransporte({ sendMail: async (c) => { enviados.push(c); return {}; } });
  for (const v of VARIABLES) delete process.env[v];
  process.env.PAGO_EN_LINEA = 'redsys';
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  mock.restoreAll();
  ponerTransporte(undefined);
  for (const v of VARIABLES) {
    if (previas[v] === undefined) delete process.env[v];
    else process.env[v] = previas[v];
  }
  if (dbDisponible) {
    const pagos = await db.pagoEnLinea.findMany({ where: { tipo: TipoPagoEnLinea.DONATIVO, donativo: { path: '$.nombre', string_contains: marca } }, select: { id: true, pedido: true } });
    await db.operacionMesa.deleteMany({ where: { clave: { in: pagos.map((p) => `redsys-${p.pedido}`) } } });
    await db.transaccion.deleteMany({ where: { concepto: { contains: marca } } });
    await db.auditLog.deleteMany({ where: { entityType: 'PagoEnLinea', entityId: { in: pagos.map((p) => String(p.id)) } } });
    await db.pagoEnLinea.deleteMany({ where: { id: { in: pagos.map((p) => p.id) } } });
  }
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

/** Un aviso como los de Redsys. */
function aviso(datos: Record<string, string>) {
  const parametros = Buffer.from(JSON.stringify(datos)).toString('base64');
  return { Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: parametros, Ds_Signature: firmar(parametros, datos.Ds_Order, CLAVE) };
}
const avisar = (campos: Record<string, string>) => fetch(`${baseUrl}/api/pagos/redsys/notificacion`, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(campos).toString(),
});

describe('lo que dice el bloque', () => {
  test('encuentra el bloque esté donde esté en la página', () => {
    assert.deepEqual(bloqueDeDonativo({ bloques: [{ tipo: 'texto' }, { tipo: 'columnas', hijos: [BLOQUE] }] }), BLOQUE);
    assert.equal(bloqueDeDonativo({ bloques: [{ tipo: 'texto' }] }), null);
  });

  test('el concepto dice que es un donativo, a qué y de quién', () => {
    assert.equal(conceptoDelDonativo({ pagina: 'caridad', destino: 'Caridad', nombre: 'María', email: null }), 'Donativo en línea · Caridad · de María');
    assert.equal(conceptoDelDonativo({ pagina: 'caridad', destino: null, nombre: null, email: null }), 'Donativo en línea');
  });

  test('solo los destinos del bloque, dentro de los límites y con dos decimales como mucho', async () => {
    const base = { pagina: 'caridad', importe: 10, destino: 'Caridad', metodo: 'TARJETA' as const };
    assert.equal((await DonativoService.comprobar({ ...base, destino: 'caridad' })).datos.destino, 'Caridad', 'sin distinguir mayúsculas');
    assert.equal((await DonativoService.comprobar({ ...base, importe: 7.5 })).centimos, 750, '«otro» importe, con céntimos');
    await assert.rejects(DonativoService.comprobar({ ...base, destino: 'Mi bolsillo' }), /Elige a qué/);
    await assert.rejects(DonativoService.comprobar({ ...base, destino: undefined }), /Elige a qué/);
    await assert.rejects(DonativoService.comprobar({ ...base, importe: 0.5 }), /entre 1 y 5000/);
    await assert.rejects(DonativoService.comprobar({ ...base, importe: 5000.01 }), /entre 1 y 5000/);
    await assert.rejects(DonativoService.comprobar({ ...base, importe: 10.005 }), /dos decimales/);
    await assert.rejects(DonativoService.comprobar({ ...base, pagina: 'no-existe' }), /no existe/);

    // Con certificado: hace falta el correo, y se guardan el NIF, el nombre, los apellidos y el código postal.
    const fiscal = { nif: '12345678Z', nombre: 'Ana', apellidos: ' Ruiz Gil ', codigoPostal: '29006' };
    await assert.rejects(DonativoService.comprobar({ ...base, fiscal }), /tu correo/);
    const conCertificado = (await DonativoService.comprobar({ ...base, email: 'ana@ejemplo.test', fiscal })).datos;
    assert.deepEqual([conCertificado.nif, conCertificado.nombreFiscal, conCertificado.apellidosFiscales, conCertificado.codigoPostal], ['12345678Z', 'Ana', 'Ruiz Gil', '29006']);
    assert.equal((await DonativoService.comprobar(base)).datos.nif, null, 'sin certificado, sin NIF');

    pagina = { bloques: [{ ...BLOQUE, destinos: [] }] };
    try {
      assert.equal((await DonativoService.comprobar({ ...base, destino: undefined })).datos.destino, null);
      await assert.rejects(DonativoService.comprobar(base), /no lleva destino/);
      pagina = { bloques: [] };
      await assert.rejects(DonativoService.comprobar(base), /ya no recoge donativos/);
    } finally {
      pagina = { bloques: [BLOQUE] };
    }
  });
});

test('el banco avisa: el donativo entra una vez en la contabilidad y el donante recibe las gracias', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  // Por HTTP, sin sesión, como desde la web pública.
  const respuesta = await fetch(`${baseUrl}/api/pagos/donativo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagina: 'caridad', importe: 12.5, destino: 'Cultos', nombre: `Lucía ${marca}`, email: 'lucia@example.com', metodo: 'TARJETA' }),
  });
  assert.equal(respuesta.status, 200);
  const inicio = await respuesta.json() as { tipo: string; pedido: string; campos: { Ds_MerchantParameters: string } };
  assert.equal(inicio.tipo, 'banco');
  const datos = JSON.parse(Buffer.from(inicio.campos.Ds_MerchantParameters, 'base64').toString()) as Record<string, string>;
  assert.equal(datos.DS_MERCHANT_AMOUNT, '1250');
  assert.match(datos.DS_MERCHANT_URLOK, new RegExp(`/caridad\\?donativo=${inicio.pedido}$`), 'vuelve a la página desde la que donó');
  assert.match(datos.DS_MERCHANT_URLKO, new RegExp(`/caridad\\?donativo=${inicio.pedido}&resultado=no$`));

  const estado = async () => (await (await fetch(`${baseUrl}/api/pagos/donativo/${inicio.pedido}`)).json()) as { estado: string; importe: number };
  assert.deepEqual(await estado(), { estado: EstadoPagoEnLinea.PENDIENTE, importe: 12.5 }, 'solo estado e importe: nada de quién donó');

  const bueno = aviso({ Ds_Order: inicio.pedido, Ds_Amount: '1250', Ds_Response: '0000', Ds_AuthorisationCode: '112233' });
  assert.equal((await avisar(bueno)).status, 200);
  assert.equal((await avisar(bueno)).status, 200, 'el banco puede repetir el aviso');

  assert.equal((await estado()).estado, EstadoPagoEnLinea.PAGADO);
  const apuntes = await db.transaccion.findMany({ where: { concepto: { contains: marca } }, include: { categoria: true } });
  assert.equal(apuntes.length, 1, 'un solo apunte aunque avise dos veces');
  assert.equal(apuntes[0].tipo, 'INGRESO');
  assert.equal(String(apuntes[0].importe), '12.5');
  assert.equal(apuntes[0].metodoPago, 'TARJETA');
  assert.equal(apuntes[0].hermanoId, null);
  assert.match(apuntes[0].concepto, /^Donativo en línea · Cultos · de Lucía/);
  // El pago guarda su apunte, y la contabilidad no lo trata como manual.
  assert.equal((await db.pagoEnLinea.findUniqueOrThrow({ where: { pedido: inicio.pedido } })).transaccionId, apuntes[0].id);
  await assert.rejects(TransaccionService.remove(apuntes[0].id), (err: unknown) => err instanceof Error && 'status' in err && err.status === 409 && /donativo/.test(err.message));

  for (let i = 0; i < 50 && !enviados.some((c) => c.to === 'lucia@example.com'); i++) await new Promise((r) => setTimeout(r, 20));
  const gracias = enviados.find((c) => c.to === 'lucia@example.com');
  assert.ok(gracias, 'le llegan las gracias');
  assert.match(gracias.html, /12,50 €/);
  assert.match(gracias.html, /Cultos/);
});

test('por HTTP: lo que no es un donativo se rechaza antes de ir al banco', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const donar = (cuerpo: unknown) => fetch(`${baseUrl}/api/pagos/donativo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  assert.equal((await donar({ pagina: 'caridad', importe: 10, destino: 'Otra cosa', metodo: 'TARJETA' })).status, 400);
  assert.equal((await donar({ pagina: 'caridad', importe: -3, destino: 'Caridad', metodo: 'TARJETA' })).status, 400);
  assert.equal((await donar({ pagina: 'caridad', importe: 10, destino: 'Caridad', metodo: 'BIZUM' })).status, 409, 'sin Bizum contratado');
  // Un NIF con la letra mal o un código postal de fuera no llegan al servicio.
  assert.equal((await donar({ pagina: 'caridad', importe: 10, destino: 'Caridad', metodo: 'TARJETA', nombre: 'Ana', email: 'a@ejemplo.test', fiscal: { nif: '12345678A', nombre: 'Ana', apellidos: 'Ruiz', codigoPostal: '29006' } })).status, 400);
  assert.equal((await donar({ pagina: 'caridad', importe: 10, destino: 'Caridad', metodo: 'TARJETA', nombre: 'Ana', email: 'a@ejemplo.test', fiscal: { nif: '12345678Z', nombre: 'Ana', apellidos: 'Ruiz', codigoPostal: '75001' } })).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/pagos/donativo/00000000ZZZZ`)).status, 404);
  const metodos = await (await fetch(`${baseUrl}/api/pagos/metodos`)).json() as { pago: { metodos: string[] } | null };
  assert.deepEqual(metodos.pago?.metodos, ['TARJETA']);
});
