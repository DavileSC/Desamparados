import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import topes from '../../shared/topes-contenido.json' with { type: 'json' };
import { esquemaDeBloque } from '../src/schemas/bloques.schema.js';
import { TIPOS_BLOQUE } from '../src/domain/bloques.js';

type Tipo = 'texto' | 'foto' | 'galeria' | 'tarjetas' | 'llamada' | 'datos' | 'itinerario'
  | 'cronologia' | 'listado' | 'contacto';

const falla = (tipo: Tipo, valor: unknown) =>
  esquemaDeBloque(tipo)(valor) instanceof ArkErrors;

describe('el mapa de esquemas cubre el catálogo', () => {
  // `TipoBloque` es `string` a ojos del compilador (ver Tarea 1), así que
  // TypeScript no avisaría si este mapa se quedara corto al añadir un tipo al
  // catálogo. Lo vigila este test: sin él, un bloque nuevo daría un 500 al
  // guardar en vez de validarse.
  test('hay un esquema para cada tipo declarado', () => {
    for (const tipo of TIPOS_BLOQUE) {
      assert.ok(esquemaDeBloque(tipo as never), `falta el esquema del bloque «${tipo}»`);
    }
  });
});

describe('bloque de texto', () => {
  test('acepta el HTML que produce el editor', () => {
    assert.ok(!falla('texto', { tipo: 'texto', titulo: '', html: '<p>Hola</p><ul><li>Uno</li></ul>' }));
  });

  test('acepta un título de sección opcional', () => {
    assert.ok(!falla('texto', { tipo: 'texto', titulo: 'Explora la sección', html: '<p>Hola</p>' }));
  });

  test('rechaza un cuerpo vacío: un bloque sin nada no pinta nada', () => {
    assert.ok(falla('texto', { tipo: 'texto', titulo: '', html: '' }));
    // Solo espacios pasaba el tope de longitud y pintaba un hueco. El CMS ya
    // avisaba, pero un PUT hecho a mano se colaba igual.
    assert.ok(falla('texto', { tipo: 'texto', titulo: '', html: '   ' }), 'solo espacios: no es un párrafo');
  });
});

describe('bloque de foto', () => {
  const FOTO = { tipo: 'foto', titulo: '', url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', alt: 'La Virgen', pie: '' };

  test('acepta una foto nuestra con su descripción', () => {
    assert.ok(!falla('foto', FOTO));
  });

  test('rechaza una foto de fuera: filtraría la IP de quien visita', () => {
    assert.ok(falla('foto', { ...FOTO, url: 'https://ejemplo.test/foto.jpg' }));
  });

  test('rechaza una foto sin descripción', () => {
    assert.ok(falla('foto', { ...FOTO, alt: '' }));
    assert.ok(falla('foto', { ...FOTO, alt: '   ' }));
  });
});

describe('bloque de tarjetas', () => {
  const TARJETA = { titulo: 'Historia', descripcion: 'Orígenes del Grupo Parroquial.', enlace: '/historia' };
  const doc = (tarjetas: unknown[]) => ({ tipo: 'tarjetas', titulo: 'Explora la sección', tarjetas });

  test('acepta tarjetas con enlace interno', () => {
    assert.ok(!falla('tarjetas', doc([TARJETA])));
  });

  test('rechaza un enlace que se va fuera del sitio', () => {
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: 'https://otro.test' }])));
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: 'javascript:alert(1)' }])));
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: '//otro.test' }])),
      'relativo al protocolo: parece interno y no lo es');
  });

  test('rechaza una lista vacía y una desmedida', () => {
    assert.ok(falla('tarjetas', doc([])));
    assert.ok(falla('tarjetas', doc(Array.from({ length: 13 }, () => TARJETA))));
  });

  // El cliente (formularios.tsx, problemaDeBloque) avisa de lo mismo antes de
  // guardar, pero esa comprobación vive en el navegador: sin esta, una
  // tarjeta sin título —un recuadro vacío que lleva a alguna parte— se
  // guardaba igual con un PUT hecho a mano.
  test('rechaza una tarjeta sin título, y dice cuál', () => {
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, titulo: '' }])), 'título vacío');
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, titulo: '   ' }])), 'solo espacios: no es un título');
    const salida = esquemaDeBloque('tarjetas')(doc([TARJETA, { ...TARJETA, titulo: '' }]));
    assert.ok(salida instanceof ArkErrors);
    // Así escribe arktype el camino dentro de una lista: `tarjetas[1].titulo`.
    assert.ok(String(salida).includes('tarjetas[1].titulo'),
      `debe señalar la segunda tarjeta, no la primera; dijo: ${salida}`);
  });

  test('acepta una tarjeta con título y su enlace por defecto a la portada', () => {
    // El valor de partida de una tarjeta nueva (BLOQUE_NUEVO, formularios.tsx)
    // es exactamente este: no puede exigirse un enlace distinto de «/».
    assert.ok(!falla('tarjetas', doc([{ ...TARJETA, enlace: '/' }])));
  });
});

describe('bloque de galería', () => {
  const FOTO = {
    tipo: 'foto',
    url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp',
    portada: '', alt: 'La Virgen en su trono', pie: '',
  };
  const VIDEO = {
    tipo: 'video',
    url: 'https://www.youtube-nocookie.com/embed/aaaaaaaaaaa',
    portada: '/storage/public/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp',
    alt: 'Salida procesional de 2026', pie: 'Sábado de Pasión',
  };
  const doc = (medios: unknown[]) => ({ tipo: 'galeria', titulo: 'Galería', medios });

  test('acepta fotos nuestras y vídeos ya normalizados', () => {
    assert.ok(!falla('galeria', doc([FOTO, VIDEO])));
  });

  test('rechaza una foto de fuera: filtraría la IP de quien visita', () => {
    assert.ok(falla('galeria', doc([{ ...FOTO, url: 'https://ejemplo.test/foto.jpg' }])));
  });

  test('rechaza un vídeo que no es de YouTube ni de Vimeo', () => {
    assert.ok(falla('galeria', doc([{ ...VIDEO, url: 'https://ejemplo.test/video.mp4' }])));
    assert.ok(falla('galeria', doc([{ ...VIDEO, url: 'https://youtube.com.sitio-malo.test/embed/aaaaaaaaaaa' }])),
      'un dominio que solo empieza igual no es YouTube');
  });

  test('rechaza un vídeo sin portada propia', () => {
    // Sin ella habría que pedirle la miniatura a YouTube nada más abrir la
    // página, y eso ya avisa a un tercero de la visita.
    assert.ok(falla('galeria', doc([{ ...VIDEO, portada: '' }])));
  });

  test('rechaza un medio sin descripción, y dice cuál', () => {
    assert.ok(falla('galeria', doc([{ ...FOTO, alt: '' }])));
    assert.ok(falla('galeria', doc([{ ...FOTO, alt: '   ' }])), 'solo espacios: no describe nada');
    const salida = esquemaDeBloque('galeria')(doc([FOTO, { ...VIDEO, alt: '' }]));
    assert.ok(salida instanceof ArkErrors);
    assert.ok(String(salida).includes('medios[1].alt'),
      `debe señalar el segundo medio, no el primero; dijo: ${salida}`);
  });

  test('rechaza una galería vacía y una desmedida', () => {
    // Una galería vacía es un hueco en la página sin explicación. (La de la
    // Sagrada Titular sí admite quedarse vacía, pero allí eso oculta una
    // sección fija; aquí el bloque entero se quita y ya está.)
    assert.ok(falla('galeria', doc([])));
    assert.ok(falla('galeria', doc(Array.from({ length: 31 }, () => FOTO))));
  });
});

describe('bloque de llamada', () => {
  const LLAMADA = {
    tipo: 'llamada', titulo: '¿Quieres ser hermano?',
    texto: 'Las solicitudes se abren cada año en septiembre.',
    boton: 'Hazte hermano', enlace: '/hazte-hermano',
  };

  test('acepta una llamada con su botón y su destino', () => {
    assert.ok(!falla('llamada', LLAMADA));
  });

  test('acepta una llamada sin texto: basta el título y el botón', () => {
    assert.ok(!falla('llamada', { ...LLAMADA, texto: '' }));
  });

  test('rechaza un botón sin etiqueta: prometería una acción que no se lee', () => {
    assert.ok(falla('llamada', { ...LLAMADA, boton: '' }));
    assert.ok(falla('llamada', { ...LLAMADA, boton: '   ' }));
  });

  test('rechaza un destino fuera del sitio', () => {
    assert.ok(falla('llamada', { ...LLAMADA, enlace: 'https://otro.test' }));
    assert.ok(falla('llamada', { ...LLAMADA, enlace: 'javascript:alert(1)' }));
    assert.ok(falla('llamada', { ...LLAMADA, enlace: '//otro.test' }),
      'relativo al protocolo: parece interno y no lo es');
  });
});

describe('bloque de datos', () => {
  const LINEA = { etiqueta: 'Misa de hermandad', valor: 'Primer viernes de mes, a las 20:00' };
  const doc = (lineas: unknown[]) => ({ tipo: 'datos', titulo: 'Horario de cultos', lineas });

  test('acepta una lista de pares', () => {
    assert.ok(!falla('datos', doc([LINEA, { etiqueta: 'Rosario', valor: 'Sábados, a las 19:30' }])));
  });

  test('acepta un valor vacío: la etiqueta puede quedar pendiente de confirmar', () => {
    assert.ok(!falla('datos', doc([{ ...LINEA, valor: '' }])));
  });

  test('rechaza una línea sin etiqueta, y dice cuál', () => {
    assert.ok(falla('datos', doc([{ ...LINEA, etiqueta: '' }])));
    assert.ok(falla('datos', doc([{ ...LINEA, etiqueta: '   ' }])), 'solo espacios: no nombra nada');
    const salida = esquemaDeBloque('datos')(doc([LINEA, { ...LINEA, etiqueta: '' }]));
    assert.ok(salida instanceof ArkErrors);
    assert.ok(String(salida).includes('lineas[1].etiqueta'),
      `debe señalar la segunda línea, no la primera; dijo: ${salida}`);
  });

  test('rechaza una lista vacía y una desmedida', () => {
    assert.ok(falla('datos', doc([])));
    assert.ok(falla('datos', doc(Array.from({ length: 21 }, () => LINEA))));
  });
});

describe('bloque de itinerario', () => {
  const PARADA = { hora: '17:30', lugar: 'Salida desde la Parroquia de los Desamparados' };
  const doc = (paradas: unknown[]) => ({ tipo: 'itinerario', titulo: 'Itinerario y horarios', paradas });

  test('acepta las paradas con su hora', () => {
    assert.ok(!falla('itinerario', doc([PARADA, { hora: '20:00', lugar: 'Plaza del Obispo' }])));
  });

  test('la hora tiene que parecer una hora', () => {
    // Se enseña tal cual dentro de la pastilla: sin esto cabía un párrafo donde
    // caben cinco caracteres.
    assert.ok(falla('itinerario', doc([{ ...PARADA, hora: 'por la tarde' }])));
    assert.ok(falla('itinerario', doc([{ ...PARADA, hora: '25:00' }])));
    assert.ok(falla('itinerario', doc([{ ...PARADA, hora: '7:30' }])), 'sin el cero delante no cuadra la columna');
  });

  test('rechaza una parada sin lugar, y dice cuál', () => {
    assert.ok(falla('itinerario', doc([{ ...PARADA, lugar: '' }])));
    const salida = esquemaDeBloque('itinerario')(doc([PARADA, { ...PARADA, lugar: '   ' }]));
    assert.ok(salida instanceof ArkErrors);
    assert.ok(String(salida).includes('paradas[1].lugar'),
      `debe señalar la segunda parada, no la primera; dijo: ${salida}`);
  });

  test('rechaza un itinerario vacío y uno desmedido', () => {
    // Vacío no pinta nada; la página puede no llevar bloque de itinerario.
    assert.ok(falla('itinerario', doc([])));
    assert.ok(falla('itinerario', doc(Array.from({ length: 61 }, () => PARADA))));
  });
});

describe('bloque de cronología', () => {
  const HITO = {
    periodo: 'Años 50', etiqueta: 'Los orígenes', titulo: 'La devoción crece',
    relato: 'Primer párrafo.\n\nSegundo párrafo.',
    foto: { url: '', alt: '', pie: '' }, tono: 'ninguno',
  };
  const doc = (hitos: unknown[]) => ({ tipo: 'cronologia', titulo: 'Cronología', hitos });

  test('acepta hitos con varios párrafos y sin foto', () => {
    assert.ok(!falla('cronologia', doc([HITO])));
  });

  test('el tono es uno de los tres de la web', () => {
    assert.ok(!falla('cronologia', doc([{ ...HITO, tono: 'oro' }])));
    assert.ok(falla('cronologia', doc([{ ...HITO, tono: 'verde' }])), 'un color libre no responde a nada de la web');
  });

  test('una foto de hito lleva descripción y es nuestra', () => {
    const foto = { url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', alt: '', pie: '' };
    const salida = esquemaDeBloque('cronologia')(doc([HITO, { ...HITO, foto }]));
    assert.ok(salida instanceof ArkErrors);
    assert.match(salida.summary, /hitos\[1\]\.foto\.alt/, 'dice qué hito es');
    assert.ok(!falla('cronologia', doc([{ ...HITO, foto: { ...foto, alt: 'La Virgen' } }])));
    assert.ok(falla('cronologia', doc([{ ...HITO, foto: { ...foto, url: 'https://fuera.test/a.jpg', alt: 'x' } }])));
  });

  test('rechaza un hito sin periodo: es lo que forma el índice', () => {
    assert.ok(falla('cronologia', doc([{ ...HITO, periodo: '  ' }])));
  });

  test('rechaza una cronología vacía y una desmedida', () => {
    assert.ok(falla('cronologia', doc([])));
    assert.ok(falla('cronologia', doc(Array(topes.hitosPorCronologia + 1).fill(HITO))));
    assert.ok(!falla('cronologia', doc(Array(topes.hitosPorCronologia).fill(HITO))));
  });
});

describe('bloque de listado', () => {
  test('acepta cada una de las fuentes que ya existían en la web', () => {
    for (const fuente of ['noticias-recientes', 'agenda-proxima', 'noticias', 'agenda', 'publicaciones', 'boletines', 'dossier']) {
      assert.ok(!falla('listado', { tipo: 'listado', titulo: '', fuente }), fuente);
    }
  });

  test('rechaza una fuente inventada: cada fuente es una consulta concreta', () => {
    assert.ok(falla('listado', { tipo: 'listado', titulo: '', fuente: 'hermanos' }));
    assert.ok(falla('listado', { tipo: 'listado', titulo: '' }));
  });
});

describe('bloque de contacto', () => {
  const LINEA = { etiqueta: 'Email', valor: 'info@desamparados.es' };
  const doc = (lineas: unknown[]) => ({ tipo: 'contacto', titulo: '', tituloDatos: 'Datos de contacto', lineas });

  test('acepta la tarjeta con sus líneas, y también sin ninguna', () => {
    assert.ok(!falla('contacto', doc([LINEA])));
    assert.ok(!falla('contacto', doc([])), 'sin líneas el formulario ocupa todo el ancho');
  });

  test('rechaza una línea sin etiqueta y una lista desmedida', () => {
    assert.ok(falla('contacto', doc([{ ...LINEA, etiqueta: '' }])));
    assert.ok(falla('contacto', doc(Array(topes.lineasPorBloque + 1).fill(LINEA))));
  });

  test('el título de la tarjeta no admite HTML', () => {
    assert.ok(falla('contacto', { ...doc([LINEA]), tituloDatos: '<b>Hola</b>' }));
  });
});
