// test/altas-retenidas-db.test.ts
//
// Un alta con un DNI ya registrado no se pierde: espera en Solicitudes
// (AltaRetenida) con el aviso de con quién choca, y Secretaría la tramita con
// el DNI corregido —pasa a ser una solicitud normal— o la descarta. Antes se
// quedaba solo en la auditoría y nadie la veía.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomInt } from 'node:crypto';
import db from '../src/config/db.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { RegistroService } from '../src/services/registro.service.js';
import { AltasRetenidasService, DIAS_DE_RETENCION } from '../src/services/altas-retenidas.service.js';
import { SolicitudesService } from '../src/services/solicitudes.service.js';
import { documentosPrivadosReferenciados } from '../src/utils/documentos-privados.js';
import type { RegisterDto } from '../src/dtos/auth.dto.js';
import { SIN_DB } from './fixtures/sin-db.js';

const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dniValido = (n: number) => `${String(n).padStart(8, '0')}${LETRAS[n % 23]}`;
const sufijo = `${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`;
let siguienteDni = 70_000_000 + randomInt(0, 900_000);
const nuevoDni = () => dniValido(siguienteDni++);
const correos: string[] = [];
const nuevoCorreo = (quien: string) => {
  const email = `${quien}-${sufijo}@ejemplo.test`;
  correos.push(email);
  return email;
};

const titular = { fechaNacimiento: '1986-11-03', sexo: 'HOMBRE', estadoCivil: 'SOLTERO', fechaBautismo: '1986-12-28' } as RegisterDto['titular'];
const alta = (email: string, dni: string, menores: RegisterDto['menores'] = []): RegisterDto => ({
  usuario: {
    email, dni, password: 'Trono-Alameda-84-Verde', nombre: 'Javier', apellidos: 'Ruiz Montes',
    telefono: '661223344', direccion: 'Calle Alameda 84', poblacion: 'Málaga', codigoPostal: '29013',
  },
  titular,
  menores,
});

let dbDisponible = false;

before(async () => {
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000).unref());
  dbDisponible = (await Promise.race([db.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const), timeout])) === 'ok';
  ponerTransporte({ sendMail: async () => {} });
});

after(async () => {
  ponerTransporte(undefined);
  if (dbDisponible) {
    const usuarios = await db.user.findMany({ where: { email: { in: correos } }, select: { id: true } });
    const ids = usuarios.map((u) => u.id);
    await db.hermano.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    for (const r of await retenidasDe(correos)) await db.altaRetenida.delete({ where: { id: r.id } });
    await db.auditLog.deleteMany({ where: { action: { startsWith: 'ALTA_RETENIDA' }, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  }
  await db.$disconnect();
});

async function retenidasDe(emails: string[]) {
  const todas = await db.altaRetenida.findMany({ select: { id: true, datos: true, creadaEl: true } });
  return todas.filter((r) => emails.includes((r.datos as { usuario: { email: string } }).usuario.email));
}

describe('altas retenidas por un DNI ya registrado', () => {
  test('espera en Solicitudes con su choque, y se tramita con el DNI corregido', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const dniOcupado = nuevoDni();
    const dniMenorOcupado = nuevoDni();
    await RegistroService.registerUser(alta(nuevoCorreo('primero'), dniOcupado, [{ nombre: 'Marta', dni: dniMenorOcupado, fechaNacimiento: '2012-05-01' }]));

    const email = nuevoCorreo('segundo');
    const r = await RegistroService.registerUser({
      ...alta(email, dniOcupado, [{ nombre: 'Luis', dni: dniMenorOcupado, fechaNacimiento: '2013-01-01' }]),
      pago: { forma: 'DOMICILIACION', iban: 'ES9121000418450200051332', titularidad: 'PROPIA' },
    });
    assert.equal(r.creada, false);
    assert.equal(r.retenida, true);
    assert.equal(await db.user.count({ where: { email } }), 0, 'la cuenta no se crea todavía');

    // Secretaría la ve, con los dos DNI que chocan y con quién.
    const { retenidas } = await SolicitudesService.getSolicitudesPendientes();
    const vista = retenidas.find((v) => v.email === email);
    assert.ok(vista, 'sale en Solicitudes');
    assert.deepEqual(vista.choques.map((c) => [c.quien, c.motivo]).sort(), [[0, 'dni_de_menor_en_el_censo'], ['adulto', 'dni_de_cuenta']].sort());
    const delAdulto = vista.choques.find((c) => c.quien === 'adulto')!;
    assert.equal(delAdulto.con.tipo, 'cuenta');
    assert.deepEqual(vista.personas.map((p) => p.nombre), ['Javier', 'Luis']);

    // Con un DNI que sigue ocupado, no se tramita y se dice cuál.
    await assert.rejects(
      AltasRetenidasService.tramitar(vista.id, { adulto: nuevoDni() }),
      (e: Error & { status?: number }) => /Sigue registrado/.test(e.message) && e.message.includes(dniMenorOcupado),
    );

    // Secretaría la tramita días después de recibirla: el mandato SEPA se
    // firmó al dar la cuenta en el formulario, no al tramitar.
    const enviadaEl = new Date(Date.now() - 12 * 86_400_000);
    await db.altaRetenida.update({ where: { id: vista.id }, data: { creadaEl: enviadaEl } });

    // Con los dos corregidos, pasa a ser una solicitud normal.
    const dniBueno = nuevoDni();
    await AltasRetenidasService.tramitar(vista.id, { adulto: dniBueno, menores: [{ indice: 0, dni: nuevoDni() }] });
    assert.equal((await retenidasDe([email])).length, 0, 'deja de estar retenida');
    const cuenta = await db.user.findUnique({ where: { email }, select: { dni: true, active: true, hermanos: { select: { activo: true, fechaMandato: true } } } });
    assert.ok(cuenta);
    assert.equal(cuenta.dni, dniBueno);
    assert.equal(cuenta.active, false, 'la cuenta nace bloqueada, como cualquier alta');
    assert.deepEqual(cuenta.hermanos.map((h) => h.activo), [false, false]);
    assert.deepEqual(cuenta.hermanos.map((h) => h.fechaMandato?.getTime()), [enviadaEl.getTime(), enviadaEl.getTime()]);
    const { data } = await SolicitudesService.getSolicitudesPendientes({ limit: '100' });
    assert.ok(data.some((s) => s.email === email), 'y está entre las solicitudes por aprobar');

    // Dos clics: la segunda vez ya no está.
    await assert.rejects(AltasRetenidasService.tramitar(vista.id, {}), /ya no está/);
  });

  test('se descarta con sus documentos, y las que nadie atiende caducan', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const dniOcupado = nuevoDni();
    await RegistroService.registerUser(alta(nuevoCorreo('tercero'), dniOcupado));

    const foto = `${'a'.repeat(28)}${sufijo.slice(0, 4).padEnd(4, '0').replace(/[^a-f0-9]/g, '0')}.webp`;
    const email = nuevoCorreo('cuarto');
    await RegistroService.registerUser({ ...alta(email, dniOcupado), documentos: { foto } });
    const [retenida] = await retenidasDe([email]);
    assert.ok(retenida);
    assert.ok((await documentosPrivadosReferenciados()).has(foto), 'la limpieza de huérfanos no se lleva su foto');

    await AltasRetenidasService.descartar(retenida.id);
    assert.equal((await retenidasDe([email])).length, 0);
    assert.ok(!(await documentosPrivadosReferenciados()).has(foto));
    await assert.rejects(AltasRetenidasService.descartar(retenida.id), /ya no está/);

    // Una sin atender desde hace más de DIAS_DE_RETENCION días se borra sola.
    const vieja = nuevoCorreo('quinto');
    await RegistroService.registerUser(alta(vieja, dniOcupado));
    const [fila] = await retenidasDe([vieja]);
    await db.altaRetenida.update({ where: { id: fila.id }, data: { creadaEl: new Date(Date.now() - (DIAS_DE_RETENCION + 1) * 86_400_000) } });
    assert.ok(await AltasRetenidasService.borrarCaducadas() >= 1);
    assert.equal((await retenidasDe([vieja])).length, 0);
  });
});
