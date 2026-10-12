// La semilla del contenido (instalacion/contenido-inicial.json): con ella nace
// la web de una instalación. Se valida al arrancar la API y solo crea las
// páginas que no existan; lo que ya está en la base no lo toca nunca.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import { porDefecto } from '../src/domain/contenido.js';
import {
  leerContenidoInicial,
  rutaDeContenidoInicial,
  sembrarPaginasQueFalten,
  validarContenidoInicial,
} from '../src/domain/contenido-inicial.js';
import { SIN_DB } from './fixtures/sin-db.js';

const PARCIAL = 'shared/__fixtures__/contenido-inicial/parcial.json';
const ROTO = 'shared/__fixtures__/contenido-inicial/roto.json';
/** Un entorno de pruebas como el del ejecutor, sin depender del de este proceso. */
const enPruebas = (extra: Record<string, string> = {}) => ({ NODE_TEST_CONTEXT: 'child', ...extra }) as NodeJS.ProcessEnv;

describe('dónde está la semilla', () => {
  test('en las pruebas no se lee la de esta máquina', () => {
    // Con la de Desamparados en el PC, las pruebas verían su contenido y no el neutro.
    assert.equal(rutaDeContenidoInicial(enPruebas()), null);
    assert.equal(leerContenidoInicial(enPruebas()).size, 0);
  });

  test('una prueba la pide con CONTENIDO_INICIAL_DE_PRUEBA, y si no existe lanza', () => {
    assert.match(rutaDeContenidoInicial(enPruebas({ CONTENIDO_INICIAL_DE_PRUEBA: PARCIAL }))!, /parcial\.json$/);
    assert.throws(() => rutaDeContenidoInicial(enPruebas({ CONTENIDO_INICIAL_DE_PRUEBA: 'no/existe.json' })), /no existe/);
  });

  test('fuera de las pruebas, la variable de pruebas no cuenta', () => {
    const ruta = rutaDeContenidoInicial({ CONTENIDO_INICIAL_DE_PRUEBA: PARCIAL } as NodeJS.ProcessEnv);
    assert.ok(ruta === null || /instalacion[\\/]contenido-inicial\.json$/.test(ruta));
  });

  test('un JSON roto no deja arrancar, y lo dice', () => {
    assert.throws(() => leerContenidoInicial(enPruebas({ CONTENIDO_INICIAL_DE_PRUEBA: ROTO })), /no es un JSON válido/);
  });
});

describe('qué semilla vale', () => {
  test('una parcial vale: solo trae sus páginas, mezcladas sobre el neutro', () => {
    const semilla = leerContenidoInicial(enPruebas({ CONTENIDO_INICIAL_DE_PRUEBA: PARCIAL }));
    assert.deepEqual([...semilla.keys()].sort(), ['boletines', 'portada']);
    const portada = semilla.get('portada') as any;
    assert.equal(portada.hero.titulo, 'La corporación de las pruebas');
    // Lo que no trae sale del neutro.
    assert.equal(portada.hero.ceja, (porDefecto('portada') as any).hero.ceja);
    assert.equal(portada.accesos.teselas.length, 6);
    assert.equal((semilla.get('boletines') as any).bloques[0].titulo, 'Todas las hojas');
  });

  test('el neutro entero vale como semilla', () => {
    const todo = Object.fromEntries(['portada', 'historia', 'recorrido', 'contacto'].map((s) => [s, porDefecto(s as never)]));
    assert.equal(validarContenidoInicial(todo).size, 4);
  });

  test('una página que no existe no deja arrancar, y dice cuáles hay', () => {
    assert.throws(() => validarContenidoInicial({ portadita: {} }), /«portadita» no es ninguna página\. Las que hay: portada,/);
  });

  test('un documento que no pasa su esquema no deja arrancar, y dice dónde', () => {
    const malo = { historia: { cabecera: { titulo: '   ', subtitulo: '', foto: '', fotoAlt: '' }, bloques: [] } };
    assert.throws(() => validarContenidoInicial(malo), /historia: .*titulo/);
    const bloqueRaro = { cultos: { bloques: [{ tipo: 'inventado', titulo: '' }] } };
    assert.throws(() => validarContenidoInicial(bloqueRaro), /inventado/);
    const fotoAjena = { trono: { cabecera: { titulo: 'Trono', subtitulo: '', foto: 'https://otro.example/a.jpg', fotoAlt: '' } } };
    assert.throws(() => validarContenidoInicial(fotoAjena), /trono/);
  });

  test('lo que la mezcla tiraría en silencio tampoco deja arrancar', () => {
    // Una errata en una clave: sin esto, la página nacería con el texto neutro sin decir por qué.
    assert.throws(() => validarContenidoInicial({ portada: { hero: { titular: 'x' } } }), /portada\.hero\.titular: no existe/);
    assert.throws(() => validarContenidoInicial({ portada: { hero: { titulo: 3 } } }), /portada\.hero\.titulo: tiene que ser un texto/);
    assert.throws(
      () => validarContenidoInicial({ portada: { accesos: { teselas: [{ clave: 'inventada', titulo: 'x', descripcion: '' }] } } }),
      /no es ninguna tesela/,
    );
  });

  test('todos los problemas a la vez, para corregirlos de una pasada', () => {
    assert.throws(() => validarContenidoInicial({ uno: {}, dos: {} }), /2 problemas/);
  });

  test('el HTML se guarda saneado, como un guardado del CMS', () => {
    const semilla = validarContenidoInicial({ trono: { bloques: [{ tipo: 'texto', titulo: '', html: '<p>Hola</p><script>alert(1)</script>' }] } });
    assert.ok(!(semilla.get('trono') as any).bloques[0].html.includes('<script'));
  });
});

describe('la siembra', () => {
  let dbDisponible = false;
  before(async () => {
    const espera = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
    dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), espera]);
  });
  after(async () => { await db.$disconnect(); });

  test('crea las que faltan con la semilla (o con el neutro) y no pisa ninguna que exista', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const semilla = leerContenidoInicial(enPruebas({ CONTENIDO_INICIAL_DE_PRUEBA: PARCIAL }));
    const tocadas = ['portada', 'boletines', 'dossier-prensa'] as const;
    const antes = await db.contenidoPagina.findMany({ where: { slug: { in: [...tocadas] } } });
    try {
      // La portada existe (editada): se queda como está. Boletines (en la
      // semilla) y el dossier (no) faltan: nacen con la semilla y con el neutro.
      await sembrarPaginasQueFalten(new Map());
      await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: { hero: { titulo: 'Editada a mano' } } } });
      await db.contenidoPagina.deleteMany({ where: { slug: { in: ['boletines', 'dossier-prensa'] } } });

      const creadas = await sembrarPaginasQueFalten(semilla);
      assert.deepEqual(creadas, { conSemilla: ['boletines'], neutras: ['dossier-prensa'] });

      const fila = async (slug: string) => (await db.contenidoPagina.findUnique({ where: { slug } }))!.datos as any;
      assert.equal((await fila('portada')).hero.titulo, 'Editada a mano', 'una fila que existe no se pisa nunca');
      assert.equal((await fila('boletines')).cabecera.titulo, 'Hojas informativas');
      assert.deepEqual(await fila('dossier-prensa'), porDefecto('dossier-prensa'));

      // Otra vez: no crea nada.
      assert.deepEqual(await sembrarPaginasQueFalten(semilla), { conSemilla: [], neutras: [] });
    } finally {
      // La base es compartida y las pruebas van en serie: se deja como estaba.
      await db.contenidoPagina.deleteMany({ where: { slug: { in: [...tocadas] } } });
      if (antes.length) await db.contenidoPagina.createMany({ data: antes.map((f) => ({ slug: f.slug, datos: f.datos as object })) });
      await sembrarPaginasQueFalten(new Map());
    }
  });
});
