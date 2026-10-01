// El Modelo 182 contra MariaDB, en un ejercicio que nadie usa (2091): qué se
// declara (cuotas y donativos pagados, donativos y apadrinamientos con NIF),
// qué no (papeletas, sin DNI, anónimos), a quién van los recibos de un niño,
// el fichero, los certificados en PDF y que un hermano solo saque los suyos.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoPago, EstadoPagoEnLinea, EstadoPedido, MetodoPago, Role, TipoPagoEnLinea, TipoRecibo } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { Modelo182Service } from '../src/services/modelo-182.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { idDeSalida, ROSARIO } from './fixtures/salidas.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const EJERCICIO = 2091;
let dbDisponible = false;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

/** Un DNI con su letra que no choque con los de la base de desarrollo. */
function dniNuevo() {
  const n = 90_000_000 + Math.floor(Math.random() * 9_999_999);
  return `${n}${'TRWAGMYFPDXBNJZSQVHLCKE'[n % 23]}`;
}

test('el resumen, el fichero y los certificados del ejercicio', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const familia = await crearUsuarioPrueba(Role.USER);
  const otro = await crearUsuarioPrueba(Role.USER);
  const previa = await db.configuracion.findUnique({ where: { key: 'modelo_182' } });
  const hermanos: number[] = [];
  const pagos: number[] = [];
  let campanaId: number | null = null;
  try {
    const dniMadre = dniNuevo();
    const dniHija = dniNuevo();
    const ficha = async (d: { nombre: string; apellidos: string; dni: string | null; nacimiento: string; titular: boolean; userId?: number; cp?: string; email?: string }) => {
      const h = await db.hermano.create({
        data: {
          userId: d.userId ?? familia.id, esTitular: d.titular, nombre: d.nombre, apellidos: d.apellidos, dni: d.dni,
          fechaNacimiento: new Date(`${d.nacimiento}T00:00:00Z`), codigoPostal: d.cp ?? '29006', email: d.email ?? null,
        },
      });
      hermanos.push(h.id);
      return h;
    };
    const madre = await ficha({ nombre: 'Lucía', apellidos: 'Pérez Gómez', dni: dniMadre, nacimiento: '1980-02-02', titular: true, cp: '41001', email: 'lucia@ejemplo.test' });
    const hija = await ficha({ nombre: 'Marta', apellidos: 'Ruiz Pérez', dni: dniHija, nacimiento: '2080-05-05', titular: false });
    const bebe = await ficha({ nombre: 'Leo', apellidos: 'Ruiz Pérez', dni: null, nacimiento: '2089-01-01', titular: false });
    const sinDni = await ficha({ nombre: 'Pedro', apellidos: 'Sin Dni', dni: null, nacimiento: '1970-01-01', titular: true, userId: otro.id });

    const recibo = (hermanoId: number, tipo: TipoRecibo, euros: string, dia: string, concepto: string, estado: EstadoPago = EstadoPago.PAGADO) =>
      db.recibo.create({ data: { hermanoId, year: EJERCICIO, concepto, importe: euros, tipo, estado, fechaPago: new Date(`${dia}T10:00:00Z`), metodoPago: MetodoPago.EFECTIVO } });
    await recibo(madre.id, TipoRecibo.CUOTA_HERMANO, '30', `${EJERCICIO}-02-01`, 'Cuota 2091');
    await recibo(madre.id, TipoRecibo.DONATIVO, '250', `${EJERCICIO}-12-31`, 'Donativo flores');
    await recibo(madre.id, TipoRecibo.CUOTA_HERMANO, '20', `${EJERCICIO}-03-01`, 'Cuota pendiente', EstadoPago.PENDIENTE);
    await recibo(hija.id, TipoRecibo.CUOTA_HERMANO, '15', `${EJERCICIO}-02-01`, 'Cuota 2091');
    await recibo(bebe.id, TipoRecibo.CUOTA_HERMANO, '10', `${EJERCICIO}-02-01`, 'Cuota 2091');
    await recibo(sinDni.id, TipoRecibo.CUOTA_HERMANO, '30', `${EJERCICIO}-02-01`, 'Cuota 2091');
    // Lo de una salida no es donativo, aunque se llame así.
    const delRosario = await recibo(madre.id, TipoRecibo.DONATIVO, '5', `${EJERCICIO}-10-10`, 'Donativo Rosario vespertino 2091');
    await db.papeletaSitio.create({ data: { hermanoId: madre.id, year: EJERCICIO, salidaId: await idDeSalida(ROSARIO), puesto: 'Vela', reciboId: delRosario.id } });

    // Un donativo en línea con certificado, otro anónimo, y un apadrinamiento con NIF.
    const enLinea = (donativo: object, euros: string) => db.pagoEnLinea.create({
      data: {
        tipo: TipoPagoEnLinea.DONATIVO, estado: EstadoPagoEnLinea.PAGADO, metodo: MetodoPago.TARJETA, importe: euros, reciboIds: [], solicitudIds: [],
        donativo, createdAt: new Date(`${EJERCICIO}-06-06T10:00:00Z`),
      },
    });
    const dniDonante = dniNuevo();
    pagos.push((await enLinea({ pagina: 'caridad', destino: 'Caridad', nombre: 'Rosa', email: 'rosa@ejemplo.test', nif: dniDonante, nombreFiscal: 'Rosa', apellidosFiscales: 'Martín Sanz', codigoPostal: '28001' }, '100')).id);
    pagos.push((await enLinea({ pagina: 'caridad', destino: null, nombre: null, email: null }, '7')).id);
    const campana = await db.campanaApadrinamiento.create({ data: { titulo: 'Prueba 182', foto: 'x.webp', piezas: { create: { nombre: 'Vela 1', precio: '40', x: '10', y: '10' } } }, include: { piezas: true } });
    campanaId = campana.id;
    await db.apadrinamiento.create({
      data: {
        token: `p182${Date.now()}`.padEnd(32, '0').slice(0, 32), piezaId: campana.piezas[0].id, nombre: 'Rosa M.', nombreFiscal: 'Rosa', apellidosFiscales: 'Martín Sanz', email: 'rosa@ejemplo.test', telefono: '600000000',
        nif: dniDonante, codigoPostal: '28001', estado: EstadoPedido.PAGADO, importe: '40', pagadoEl: new Date(`${EJERCICIO}-07-07T10:00:00Z`),
      },
    });

    const meta = { userId: tesorero.id };
    await Modelo182Service.guardarConfiguracion({ nif: null, telefono: '', contacto: '', firmanteNombre: '', firmanteCargo: 'Secretario', cuotas: true }, meta);
    const r = await Modelo182Service.resumen(EJERCICIO);
    const de = (nif: string) => r.declarados.find((d) => d.nif === nif);

    // La madre: su cuota, su donativo y la cuota del bebé (sin DNI, la paga ella); ni la pendiente ni el Rosario.
    assert.equal(de(dniMadre)?.centimos, 290_00);
    assert.equal(de(dniMadre)?.provincia, '41');
    assert.equal(de(dniMadre)?.porcentaje, 40, 'pasa de 250 €');
    assert.equal(de(dniMadre)?.apellidosYNombre, 'PEREZ GOMEZ LUCIA');
    // La hija, menor de 14 con DNI: declarada con su madre como representante.
    assert.equal(de(dniHija)?.centimos, 15_00);
    assert.equal(de(dniHija)?.nifRepresentante, dniMadre);
    // Rosa: el donativo en línea y el apadrinamiento juntos.
    assert.equal(de(dniDonante)?.centimos, 140_00);
    assert.equal(de(dniDonante)?.provincia, '28');
    assert.ok(r.excluidos.some((e) => e.nombre === 'Pedro Sin Dni' && e.centimos === 30_00));
    assert.ok(r.anonimos.cuantos >= 1);
    assert.deepEqual(r.faltaParaElFichero, ['el NIF del Grupo', 'un teléfono de contacto de nueve cifras', 'la persona de contacto']);

    // Sin cuotas, solo los donativos.
    await Modelo182Service.guardarConfiguracion({ ...r.configuracion, cuotas: false }, meta);
    assert.equal((await Modelo182Service.resumen(EJERCICIO)).declarados.find((d) => d.nif === dniMadre)?.centimos, 250_00);

    // Con los datos del Grupo, el fichero y los certificados.
    await assert.rejects(Modelo182Service.guardarConfiguracion({ ...r.configuracion, nif: 'B12345670' }, meta), /no es válido/);
    await Modelo182Service.guardarConfiguracion({ nif: 'r-2900001-e', telefono: '644 90 01 67', contacto: 'Pérez López Juan', firmanteNombre: 'Juan Pérez', firmanteCargo: 'Secretario', cuotas: true }, meta);
    const cab = { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}` };
    const fichero = await fetch(`${baseUrl}/api/recibos/admin/modelo-182/fichero?ejercicio=${EJERCICIO}&justificante=1822091000001`, { headers: cab });
    assert.equal(fichero.status, 200);
    const texto = Buffer.from(await fichero.arrayBuffer()).toString('latin1');
    assert.ok(texto.startsWith('11822091R2900001E'));
    assert.ok(texto.split('\r\n').filter(Boolean).every((l) => l.length === 250));
    assert.ok(texto.includes(`2182${EJERCICIO}R2900001E${dniHija}${dniMadre}RUIZ PEREZ MARTA`));
    assert.equal(await db.auditLog.count({ where: { userId: tesorero.id, action: 'MODELO_182_FICHERO' } }), 1);

    const pdf = await fetch(`${baseUrl}/api/recibos/admin/modelo-182/certificados?ejercicio=${EJERCICIO}&nif=${dniMadre}`, { headers: cab });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');

    // Por correo, a quien lo dejó: en las pruebas no sale ninguno, pero se apunta cuándo se intentó.
    const envio = await Modelo182Service.enviarCertificados(EJERCICIO, meta);
    assert.equal(envio.enviados + envio.fallidos, 3, 'la madre, la hija (al correo de su madre) y Rosa');
    assert.equal(await db.auditLog.count({ where: { userId: tesorero.id, action: 'MODELO_182_ENVIAR' } }), 1);
    assert.ok((await Modelo182Service.resumen(EJERCICIO)).enviados);

    // El hermano saca los de su cuenta (el suyo y el de su hija), no el de otra persona.
    const hoy = new Date(`${EJERCICIO + 1}-02-01T10:00:00Z`);
    assert.ok((await Modelo182Service.miCertificado(familia.id, EJERCICIO, dniHija, hoy)).length > 1000);
    await assert.rejects(Modelo182Service.miCertificado(familia.id, EJERCICIO, dniDonante, hoy), /No hay donativos/);
    await assert.rejects(Modelo182Service.miCertificado(familia.id, EJERCICIO, dniMadre, new Date(`${EJERCICIO}-12-01T10:00:00Z`)), /acaba el año/);
    const suyo = await fetch(`${baseUrl}/api/recibos/mis-recibos/certificados`, { headers: { Cookie: `${COOKIE_HERMANO}=${generateToken(familia.id, Role.USER, false, 'hermanos')}` } });
    assert.equal(suyo.status, 200);
    assert.equal((await suyo.json()).disponibles, true);

    // Sin sesión de Tesorería, nada.
    assert.equal((await fetch(`${baseUrl}/api/recibos/admin/modelo-182?ejercicio=${EJERCICIO}`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/recibos/admin/modelo-182?ejercicio=${EJERCICIO}`, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(familia.id, Role.USER)}` } })).status, 403);
  } finally {
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await db.pagoEnLinea.deleteMany({ where: { id: { in: pagos } } });
    if (campanaId) await db.campanaApadrinamiento.delete({ where: { id: campanaId } });
    if (previa) await db.configuracion.update({ where: { key: previa.key }, data: { value: previa.value } });
    else await db.configuracion.deleteMany({ where: { key: 'modelo_182' } });
    await db.configuracion.deleteMany({ where: { key: `modelo_182_enviados_${EJERCICIO}` } });
    await db.auditLog.deleteMany({ where: { userId: tesorero.id } });
    await borrarUsuarioPrueba(familia.id);
    await borrarUsuarioPrueba(otro.id);
    await borrarUsuarioPrueba(tesorero.id);
  }
});
