// La cuenta de custodia del censo importado no es de nadie: su teléfono
// («000000000»), su correo (@cuentas.invalido), su DNI y su nombre son relleno.
// Ninguna pantalla los enseña como datos de una ficha que cuelga de ella, y las
// demás fichas de la custodia no son su familia: ni en la ficha del censo, ni
// en el buscador o el listado, ni en el ropero, ni en la mesa (la ficha y el
// alta de un menor), ni como a quién dar el pésame.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MotivoBaja, Prisma, TipoRecibo } from '@prisma/client';
import db from '../src/config/db.js';
import { CUENTA_CENSO_IMPORTADO, cuentaDeCustodia } from '../src/services/censo-hoja.service.js';
import { CensoService } from '../src/services/censo.service.js';
import { RoperoService } from '../src/services/ropero.service.js';
import { MesaService } from '../src/services/procesion/mesa.service.js';
import { DifuntosService } from '../src/services/difuntos.service.js';
import { anioDeLaMesa } from '../src/services/procesion/zonas.service.js';
import { salida } from './fixtures/salidas.js';
import { SIN_DB } from './fixtures/sin-db.js';
import { enviarCorreo, ponerTransporte } from '../src/services/correos/envio.js';
import { esDireccionDeNadie } from '../src/domain/cuenta-de-custodia.js';

let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await db.$disconnect();
});

/** Nada de la cuenta de custodia en lo que sale hacia la pantalla. */
function sinRelleno(respuesta: unknown, donde: string) {
  const texto = JSON.stringify(respuesta);
  for (const relleno of [CUENTA_CENSO_IMPORTADO.telefono, CUENTA_CENSO_IMPORTADO.email, CUENTA_CENSO_IMPORTADO.dni]) {
    assert.ok(!texto.includes(relleno), `${donde} enseña «${relleno}», que es de la cuenta de custodia`);
  }
}

test('los datos de relleno de la cuenta de custodia no salen como datos de sus fichas', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const custodiaAntes = await db.user.findUnique({ where: { email: CUENTA_CENSO_IMPORTADO.email }, select: { id: true } });
  const custodia = await db.$transaction((tx) => cuentaDeCustodia(tx));
  const marca = `Custodia${Date.now()}`;
  const creadas: number[] = [];
  const ficha = async (datos: Partial<Prisma.HermanoUncheckedCreateInput>) => {
    const h = await db.hermano.create({
      data: { userId: custodia, nombre: 'Rosa', apellidos: `${marca} Prueba`, fechaNacimiento: new Date(Date.UTC(1970, 0, 1)), esTitular: false, activo: true, ...datos },
    });
    creadas.push(h.id);
    return h;
  };
  try {
    // La que nos ocupa: sin teléfono ni correo propios, como la trajo el CSV.
    const sola = await ficha({});
    // Otra ficha cualquiera de la custodia, con su correo y una cuota sin
    // pagar: no es de su familia.
    const extrana = await ficha({ nombre: 'Extraña', email: `extrana-${marca}@ejemplo.test` });
    const pasion = await salida();
    await db.recibo.create({
      data: { hermanoId: extrana.id, year: anioDeLaMesa(pasion), concepto: 'Cuota', importe: new Prisma.Decimal(20), tipo: TipoRecibo.CUOTA_HERMANO },
    });

    // La ficha del censo en el CMS.
    const delCenso = await CensoService.getHermanoById(sola.id);
    sinRelleno(delCenso, 'La ficha del censo');
    assert.equal(delCenso?.user, null, 'la cuenta de custodia no es la cuenta de la ficha');
    assert.equal(delCenso?.enCensoImportado, true);

    // El buscador y el listado del censo.
    const buscada = await CensoService.searchHermanos({ q: marca });
    sinRelleno(buscada.data, 'El buscador del censo');
    assert.deepEqual(buscada.data.map((h) => h.id).sort(), [sola.id, extrana.id].sort());
    let pagina = 1;
    let vista = false;
    for (;;) {
      const listado = await CensoService.getAllHermanos({ page: pagina, limit: 100 });
      const nuestra = listado.data.filter((h) => creadas.includes(h.id));
      sinRelleno(nuestra, 'El listado del censo');
      vista ||= nuestra.length > 0;
      if (pagina >= listado.meta.totalPages) break;
      pagina++;
    }
    assert.ok(vista, 'el listado tiene que llegar a las fichas de la prueba');

    // El ropero: «su cuenta la lleva Censo importado» no es nadie.
    const enElRopero = await RoperoService.buscarHermanos(`Rosa ${marca}`);
    assert.deepEqual(enElRopero.map((h) => [h.id, h.gestor]), [[sola.id, null]]);

    // La mesa: la otra ficha de la custodia no es familia que pague junta.
    const enLaMesa = await MesaService.ficha(sola.id, pasion, { censo: true });
    sinRelleno(enLaMesa, 'La ficha de la mesa');
    assert.deepEqual(enLaMesa.familia, []);

    // Un menor dado de alta en la mesa con ella de tutora no hereda el relleno.
    const menor = await MesaService.darDeAlta({
      nombre: 'Nieto', primerApellido: marca, fechaNacimiento: '2020-05-05', tutor: { hermanoId: sola.id }, parentesco: 'OTRO',
    });
    creadas.push(menor.id);
    const contacto = await db.hermano.findUniqueOrThrow({ where: { id: menor.id }, select: { telefono: true, email: true } });
    assert.deepEqual(contacto, { telefono: null, email: null });

    // El pésame: la otra ficha de la custodia no es su familia.
    await db.hermano.update({ where: { id: sola.id }, data: { activo: false, fechaBaja: new Date(), motivoBaja: MotivoBaja.FALLECIMIENTO } });
    const difunta = await DifuntosService.ficha(sola.id);
    assert.equal(difunta.familia, null);
  } finally {
    await db.recibo.deleteMany({ where: { hermanoId: { in: creadas } } });
    await db.auditLog.deleteMany({ where: { entityType: 'hermano', entityId: { in: creadas.map(String) } } });
    await db.hermano.deleteMany({ where: { id: { in: creadas } } });
    // La custodia solo se va si la creó esta prueba y se ha quedado vacía.
    if (!custodiaAntes && (await db.hermano.count({ where: { userId: custodia } })) === 0) await db.user.delete({ where: { id: custodia } });
  }
});

// Los correos que no traen dirección propia caen en la de la cuenta (el aviso
// de baja, la papeleta, el recibo…): con una ficha de la custodia salían a
// censo-importado@cuentas.invalido, que rebota en el buzón de Secretaría. Se
// corta en el único sitio por donde salen todos, como si no hubiera correo.
test('ningún correo sale a una dirección .invalido, la de la custodia incluida', async () => {
  const enviados: unknown[] = [];
  ponerTransporte({ sendMail: async (correo) => { enviados.push(correo); } });
  try {
    assert.equal(await enviarCorreo(CUENTA_CENSO_IMPORTADO.email, 'Aviso', '<p>Hola</p>', { uso: 'prueba' }), false);
    assert.equal(await enviarCorreo('  Alguien@Demo.INVALIDO ', 'Aviso', '<p>Hola</p>', { uso: 'prueba' }), false);
    assert.deepEqual(enviados, []);
    assert.equal(await enviarCorreo('hermano@ejemplo.test', 'Aviso', '<p>Hola</p>', { uso: 'prueba' }), true);
    assert.equal(enviados.length, 1);
  } finally {
    ponerTransporte(undefined);
  }
  assert.ok(esDireccionDeNadie(CUENTA_CENSO_IMPORTADO.email));
  assert.ok(!esDireccionDeNadie('alguien@invalido.es'), 'solo el dominio de nivel superior .invalido');
});
