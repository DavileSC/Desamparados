// Cambiar desde el área de hermanos la cuenta en la que se cargan los
// recibos avisa por correo a la cuenta, con la nueva tapada: si no fue su
// dueño, es como se entera. Cambiar otra cosa de la ficha no avisa.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { MisFichasService } from '../src/services/mis-fichas.service.js';
import { ponerTransporte, type TransporteDeCorreo } from '../src/services/correos/envio.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';

const IBAN_VIEJO = 'ES9121000418450200051332';
const IBAN_NUEVO = 'ES7921000813610123456789';

let dbDisponible = false;
const enviados: Parameters<TransporteDeCorreo['sendMail']>[0][] = [];

before(async () => {
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  ponerTransporte({ sendMail: async (c) => { enviados.push(c); return {}; } });
});

after(async () => {
  ponerTransporte(undefined);
  await db.$disconnect();
});

/** Los avisos a esa dirección, esperando un poco: salen sin que nadie los espere. */
async function avisosA(para: string, cuantos: number) {
  const de = () => enviados.filter((c) => c.to === para && /cuenta bancaria/.test(c.subject));
  for (let i = 0; i < 50 && de().length < cuantos; i++) await new Promise((r) => setTimeout(r, 20));
  return de();
}

test('cambiar el IBAN avisa a la cuenta, con la nueva tapada; cambiar el teléfono, no', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const usuario = await crearUsuarioPrueba();
  const ficha = await db.hermano.create({
    data: { userId: usuario.id, nombre: 'Rocío', apellidos: `Cuenta${Date.now()} Prueba`, fechaNacimiento: new Date(Date.UTC(1985, 4, 2)), activo: true, esTitular: true, iban: IBAN_VIEJO },
  });
  try {
    await MisFichasService.updateProfileIfOwned(ficha.id, usuario.id, { telefono: '600000000' });
    // El mismo IBAN escrito con espacios tampoco es un cambio.
    await MisFichasService.updateProfileIfOwned(ficha.id, usuario.id, { iban: 'ES91 2100 0418 4502 0005 1332' });
    await MisFichasService.updateProfileIfOwned(ficha.id, usuario.id, { iban: IBAN_NUEVO });

    const avisos = await avisosA(usuario.email, 1);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(enviados.filter((c) => c.to === usuario.email).length, 1, 'un solo aviso: el del cambio de verdad');
    const [aviso] = avisos;
    assert.equal(aviso.subject, `Se ha cambiado la cuenta bancaria de Rocío ${ficha.apellidos}`);
    assert.ok(!aviso.html.includes(IBAN_NUEVO), 'la cuenta va tapada');
    assert.ok(aviso.html.includes('6789'), 'con sus cuatro últimas cifras');
    assert.match(aviso.html, /Si no ha sido usted/);
  } finally {
    await db.auditLog.deleteMany({ where: { entityType: 'hermano', entityId: String(ficha.id) } });
    await db.hermano.delete({ where: { id: ficha.id } });
    await borrarUsuarioPrueba(usuario.id);
  }
});
