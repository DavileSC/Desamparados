// test/constructor-bloques.test.ts
//
// El constructor de páginas ampliado: la presentación de los bloques, los nueve
// bloques nuevos y las anclas. Todo se prueba por el mismo camino que la ruta:
// primero `sanearBloques`, después el esquema de la página.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import catalogoTipos from '../../shared/tipos-de-bloque.json' with { type: 'json' };
import presentacion from '../../shared/presentacion-de-bloques.json' with { type: 'json' };
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { esquemaDeBloque, problemaDeBloque } from '../src/schemas/bloques.schema.js';
import { problemaDePresentacion } from '../src/domain/presentacion.js';
import { esDestinoValido } from '../src/domain/destinos.js';
import { sanearBloques } from '../src/utils/sanear-html.js';

const CABECERA = { titulo: 'Cultos', subtitulo: '', foto: '', fotoAlt: '' };
const FOTO = '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp';
const PDF = '/storage/public/b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.pdf';
const TEXTO = { tipo: 'texto', titulo: '', html: '<p>Hola</p>' };

/** El camino de la ruta: se prepara el documento y se valida. */
function guardar(bloques: unknown[]) {
  const preparado = sanearBloques({ cabecera: CABECERA, bloques }) as { bloques: Record<string, unknown>[] };
  const salida = esquemaDeSlug('cultos')(preparado);
  return { error: salida instanceof ArkErrors ? salida.summary : null, bloques: preparado.bloques };
}

const vale = (bloques: unknown[]) => assert.equal(guardar(bloques).error, null);
const falla = (bloques: unknown[], motivo?: RegExp) => {
  const { error } = guardar(bloques);
  assert.ok(error, 'tenía que rechazarse');
  if (motivo) assert.match(error, motivo);
};

describe('la presentación de un bloque', () => {
  test('sin presentación, el bloque se guarda como siempre', () => {
    vale([TEXTO]);
  });

  test('acepta las opciones comunes y las propias de su tipo', () => {
    vale([{
      ...TEXTO,
      presentacion: {
        fondo: 'papel', ancho: 'estrecho', espacio: 'amplio', alineacionTitulo: 'izquierda', separador: true,
        estilo: 'entradilla', columnas: '2', capitular: true, ancla: 'bienvenida', desde: '2026-10-01', hasta: '2026-10-31',
      },
    }]);
  });

  test('una opción de otro tipo de bloque se rechaza nombrándola', () => {
    falla([{ ...TEXTO, presentacion: { disposicion: 'mosaico' } }], /disposicion/);
  });

  test('un valor que no está en la lista se rechaza', () => {
    falla([{ ...TEXTO, presentacion: { fondo: 'fucsia' } }], /fondo/);
  });

  test('un sí/no tiene que ser sí o no, no un texto', () => {
    falla([{ ...TEXTO, presentacion: { separador: 'true' } }], /separador/);
  });

  test('el fondo de foto necesita una foto nuestra', () => {
    falla([{ ...TEXTO, presentacion: { fondo: 'foto' } }], /fondoFoto/);
    falla([{ ...TEXTO, presentacion: { fondo: 'foto', fondoFoto: 'https://otro.test/a.jpg' } }], /fondoFoto/);
    vale([{ ...TEXTO, presentacion: { fondo: 'foto', fondoFoto: FOTO } }]);
  });

  test('las fechas tienen que existir y no cruzarse', () => {
    falla([{ ...TEXTO, presentacion: { desde: '2026-02-30' } }], /desde/);
    falla([{ ...TEXTO, presentacion: { desde: '2026-11-01', hasta: '2026-10-01' } }], /hasta/);
  });

  test('el ancla es como un slug y no se repite en la página', () => {
    falla([{ ...TEXTO, presentacion: { ancla: 'Con Espacios' } }], /ancla/);
    falla([
      { ...TEXTO, presentacion: { ancla: 'horario' } },
      { ...TEXTO, presentacion: { ancla: 'horario' } },
    ], /repite el ancla/);
  });

  test('el primer valor de cada lista es el de siempre, y todos son válidos', () => {
    // Recorre el catálogo entero: si alguien añade un valor que el esquema no
    // entiende, o una opción a un tipo que no existe, se ve aquí.
    for (const [tipo, opciones] of Object.entries(presentacion.porTipo)) {
      assert.ok(catalogoTipos.tipos.includes(tipo), `«${tipo}» no es un tipo de bloque`);
      for (const [clave, opcion] of Object.entries(opciones as Record<string, { valores?: string[] }>)) {
        for (const valor of opcion.valores ?? []) {
          assert.equal(problemaDePresentacion(tipo, { [clave]: valor }), null, `${tipo}.${clave} = ${valor}`);
        }
      }
    }
  });
});

describe('los enlaces con ancla', () => {
  test('una página que existe con un ancla bien formada vale', () => {
    assert.ok(esDestinoValido('/historia#fundacion'));
    assert.ok(esDestinoValido('/noticias/apertura-del-curso#fotos'));
  });

  test('ni una página inventada ni un ancla mal escrita', () => {
    assert.equal(esDestinoValido('/hola#fundacion'), false);
    assert.equal(esDestinoValido('/historia#'), false);
    assert.equal(esDestinoValido('/historia#Con Espacios'), false);
  });
});

describe('los bloques nuevos', () => {
  test('cada tipo del catálogo tiene esquema', () => {
    for (const tipo of catalogoTipos.tipos) assert.ok(esquemaDeBloque(tipo as never), `falta el esquema de «${tipo}»`);
  });

  test('foto con texto: foto nuestra con descripción, texto saneado y botón con destino', () => {
    const base = { tipo: 'fotoTexto', titulo: '', url: FOTO, alt: 'La Virgen', pie: '', html: '<p>Hola</p><script>x</script>', boton: '', enlace: '' };
    const { error, bloques } = guardar([base]);
    assert.equal(error, null);
    assert.ok(!String(bloques[0].html).includes('<script'), 'el HTML se sanea como el del texto');
    falla([{ ...base, alt: ' ' }], /alt/);
    falla([{ ...base, boton: 'Ver más' }], /enlace/);
    falla([{ ...base, enlace: '/historia' }], /boton/);
    vale([{ ...base, boton: 'Ver más', enlace: '/historia#fundacion' }]);
  });

  test('cita: el texto es obligatorio', () => {
    vale([{ tipo: 'cita', titulo: '', texto: 'Madre de los desamparados', autor: '', fuente: '' }]);
    falla([{ tipo: 'cita', titulo: '', texto: '  ', autor: 'Anónimo', fuente: '' }], /texto/);
  });

  test('vídeo: se guarda normalizado y exige portada y descripción', () => {
    const base = { tipo: 'video', titulo: '', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', portada: FOTO, alt: 'Salida de 2026', pie: '' };
    const { error, bloques } = guardar([base]);
    assert.equal(error, null);
    assert.equal(bloques[0].url, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    falla([{ ...base, portada: '' }]);
    falla([{ ...base, url: 'https://otro.test/video' }]);
  });

  test('botones: de uno a cuatro, con texto y a una página que exista', () => {
    const boton = { texto: 'Hazte hermano', enlace: '/hazte-hermano', estilo: 'principal' };
    vale([{ tipo: 'botones', titulo: '', botones: [boton, { ...boton, estilo: 'secundario' }] }]);
    falla([{ tipo: 'botones', titulo: '', botones: [] }]);
    falla([{ tipo: 'botones', titulo: '', botones: [boton, boton, boton, boton, boton] }]);
    falla([{ tipo: 'botones', titulo: '', botones: [{ ...boton, enlace: '/no-existe' }] }]);
  });

  test('preguntas: pregunta y respuesta, las dos', () => {
    vale([{ tipo: 'preguntas', titulo: '', preguntas: [{ pregunta: '¿Cuánto cuesta?', respuesta: 'La cuota es anual.' }] }]);
    falla([{ tipo: 'preguntas', titulo: '', preguntas: [{ pregunta: '¿Cuánto cuesta?', respuesta: '' }] }], /respuesta/);
  });

  test('descargas: solo PDF subidos desde el CMS', () => {
    vale([{ tipo: 'descargas', titulo: '', archivos: [{ titulo: 'Reglas', descripcion: '', url: PDF }] }]);
    falla([{ tipo: 'descargas', titulo: '', archivos: [{ titulo: 'Reglas', descripcion: '', url: 'https://otro.test/a.pdf' }] }]);
  });

  test('mapa: la dirección es obligatoria', () => {
    vale([{ tipo: 'mapa', titulo: '', lugar: 'Parroquia', direccion: 'Calle Eduardo Domínguez Ávila, 6, Málaga' }]);
    falla([{ tipo: 'mapa', titulo: '', lugar: 'Parroquia', direccion: '' }], /direccion/);
  });

  test('cuenta atrás: una fecha y hora que existan', () => {
    vale([{ tipo: 'cuentaAtras', titulo: '', fecha: '2027-03-20T18:00', texto: 'Sábado de Pasión', textoFinal: '¡Ya está en la calle!' }]);
    falla([{ tipo: 'cuentaAtras', titulo: '', fecha: '2027-02-30T18:00', texto: '', textoFinal: '' }], /fecha/);
    falla([{ tipo: 'cuentaAtras', titulo: '', fecha: 'mañana', texto: '', textoFinal: '' }]);
  });

  test('espacio: sin contenido, solo presentación', () => {
    vale([{ tipo: 'espacio', titulo: '', presentacion: { alto: 'grande', linea: true } }]);
  });

  test('las tarjetas pueden llevar foto (con descripción) o un icono de la lista', () => {
    const tarjeta = { titulo: 'Caridad', descripcion: '', enlace: '' };
    vale([{ tipo: 'tarjetas', titulo: '', tarjetas: [{ ...tarjeta, foto: FOTO, fotoAlt: 'Reparto', icono: '' }, { ...tarjeta, icono: 'corazon' }] }]);
    falla([{ tipo: 'tarjetas', titulo: '', tarjetas: [{ ...tarjeta, foto: FOTO, fotoAlt: '' }] }], /fotoAlt/);
    falla([{ tipo: 'tarjetas', titulo: '', tarjetas: [{ ...tarjeta, icono: 'dragon' }] }]);
  });

  test('problemaDeBloque dice dónde está el fallo, también en la presentación', () => {
    assert.deepEqual(problemaDeBloque({ ...TEXTO, presentacion: { fondo: 'fucsia' } })?.path, ['presentacion', 'fondo']);
    assert.deepEqual(problemaDeBloque({ tipo: 'carrusel3d' })?.path, ['tipo']);
  });
});
