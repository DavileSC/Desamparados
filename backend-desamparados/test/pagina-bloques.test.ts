import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { SLUGS_CONTENIDO, porDefecto } from '../src/domain/contenido.js';

const CABECERA = { titulo: 'Nuestros Fines', subtitulo: 'Caridad y formación.', foto: '', fotoAlt: '' };
const TEXTO = { tipo: 'texto', titulo: '', html: '<p>Hola</p>' };
const doc = (bloques: unknown[]) => ({ cabecera: CABECERA, bloques });
const valida = (valor: unknown) => esquemaDeSlug('nuestros-fines')(valor);
const falla = (valor: unknown) => valida(valor) instanceof ArkErrors;

describe('el documento de una página de bloques', () => {
  test('el slug está declarado y trae valores de partida', () => {
    assert.ok((SLUGS_CONTENIDO as readonly string[]).includes('nuestros-fines'));
    const defectos = porDefecto('nuestros-fines') as { cabecera?: unknown; bloques?: unknown[] };
    assert.ok(defectos.cabecera, 'faltan los valores de partida de la cabecera');
    assert.ok(Array.isArray(defectos.bloques));
  });

  test('acepta una página con bloques', () => {
    assert.ok(!falla(doc([TEXTO])));
  });

  test('acepta una página sin bloques: se ve la cabecera y nada más', () => {
    assert.ok(!falla(doc([])));
  });

  test('rechaza un tipo de bloque que no existe, y lo nombra', () => {
    const salida = valida(doc([{ tipo: 'carrusel3d', titulo: '' }]));
    assert.ok(salida instanceof ArkErrors);
    assert.match(String(salida), /carrusel3d/, 'el error debe decir qué tipo no reconoce');
  });

  test('rechaza un bloque cuyo contenido no cuadra con su tipo', () => {
    assert.ok(falla(doc([{ tipo: 'texto', titulo: '', html: '' }])));
    assert.ok(falla(doc([{ ...TEXTO, tipo: 'foto' }])));
  });

  test('rechaza una página sin cabecera o con el título por encima del tope', () => {
    assert.ok(falla({ bloques: [] }));
    assert.ok(falla({ cabecera: { ...CABECERA, titulo: 'x'.repeat(121) }, bloques: [] }));
  });

  test('una cabecera con foto no exige su descripción', () => {
    // La foto de la cabecera es el fondo velado de la página, decorativo y
    // fuera del árbol accesible: pedir una descripción que nadie va a oír solo
    // frenaba a quien edita.
    const conFoto = { ...CABECERA, foto: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp' };
    assert.ok(!falla({ cabecera: conFoto, bloques: [] }), 'foto sin descripción');
    assert.ok(!falla({ cabecera: { ...conFoto, fotoAlt: 'La Virgen en su trono' }, bloques: [] }));
  });

  test('la foto de la cabecera tiene que ser nuestra', () => {
    // El bloque de foto ya tenía su prueba; la cabecera no, y su regla se podía
    // borrar entera sin que nada se pusiera rojo. Una foto de fuera filtra la IP
    // de quien visita y el limpiador de huérfanos no la conoce.
    const con = (foto: string) => falla({ cabecera: { ...CABECERA, foto, fotoAlt: 'Da igual' }, bloques: [] });
    assert.ok(con('https://ejemplo.test/foto.jpg'), 'una dirección de fuera');
    assert.ok(con('//ejemplo.test/foto.jpg'), 'relativa al protocolo: parece interna y no lo es');
    assert.ok(con('javascript:alert(1)'), 'ni siquiera es una imagen');
    assert.ok(con('/storage/private/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp'), 'lo privado no se publica');
  });

  test('el encuadre de la foto es un porcentaje entero, y es opcional', () => {
    const con = (encuadre: unknown) => falla({ cabecera: { ...CABECERA, encuadre }, bloques: [] });
    assert.equal(falla({ cabecera: CABECERA, bloques: [] }), false, 'sin encuadre vale');
    assert.equal(con(0), false);
    assert.equal(con(100), false);
    assert.ok(con(-5), 'por encima de la foto');
    assert.ok(con(101), 'por debajo de la foto');
    assert.ok(con(40.5), 'con decimales');
    assert.ok(con('40'), 'como texto');
  });

  // El CMS ya avisa antes de guardar (PaginaAdminPage.tsx), pero esa
  // comprobación vive solo en el navegador: un PUT hecho a mano con el título
  // en blanco tiene que rechazarlo igual, o la página se queda sin título en
  // producción («Todo se valida en el servidor», restricciones del proyecto).
  test('rechaza una cabecera sin título, en blanco o solo con espacios', () => {
    assert.ok(falla({ cabecera: { ...CABECERA, titulo: '' }, bloques: [] }), 'título vacío');
    assert.ok(falla({ cabecera: { ...CABECERA, titulo: '   ' }, bloques: [] }), 'solo espacios: no es un título');
    assert.ok(!falla({ cabecera: { ...CABECERA, titulo: 'Corporación' }, bloques: [] }));
  });

  test('rechaza una página con más bloques de los que nadie va a poner', () => {
    assert.ok(falla(doc(Array.from({ length: 41 }, () => TEXTO))));
  });
});
