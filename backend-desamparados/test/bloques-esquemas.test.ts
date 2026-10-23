import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import topes from '../../shared/topes-contenido.json' with { type: 'json' };
import { esquemaDeBloque } from '../src/schemas/bloques.schema.js';
import { TIPOS_BLOQUE } from '../src/domain/bloques.js';

type Tipo = 'texto' | 'foto' | 'galeria' | 'tarjetas' | 'llamada' | 'datos' | 'itinerario'
  | 'cronologia' | 'listado' | 'contacto' | 'fotoFija' | 'horario' | 'dibujo' | 'mapa' | 'anillos' | 'puertas' | 'programa' | 'relacion' | 'carrusel' | 'donativo';

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

  test('la etiqueta es opcional y corta, como una línea encima del título', () => {
    assert.ok(!falla('tarjetas', doc([{ ...TARJETA, etiqueta: 'Durante el curso' }])));
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, etiqueta: 'x'.repeat(61) }])));
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

  test('la hora puede ir vacía mientras no se sepa', () => {
    assert.ok(!falla('itinerario', doc([{ ...PARADA, hora: '' }])));
  });

  test('acepta el recorrido sobre el mapa y las paradas situadas en él', () => {
    const conMapa = {
      ...doc([{ ...PARADA, enRuta: 0 }, { hora: '21:30', lugar: 'Entrada', enRuta: 1 }]),
      recorrido: {
        esquinas: [[-4.4487, 36.7122], [-4.4492, 36.7136]],
        linea: [[-4.4487, 36.7122], [-4.4489, 36.7129], [-4.4492, 36.7136]],
        pegado: true,
      },
    };
    assert.ok(!falla('itinerario', conMapa));
  });

  test('acepta el recorrido por calles, con salida, entrada y sitios de interés con su parada', () => {
    const porCalles = {
      ...doc([{ hora: '', lugar: 'Peña', enRuta: 0.7, nota: 'Saetas a la Virgen', minutos: 10 }]),
      recorrido: {
        esquinas: [], linea: [[-4.4487, 36.7122], [-4.4492, 36.7136]], pegado: true,
        salida: '18:00', entrada: '00:00',
        calles: [{ nombre: 'C. Mayor', desde: 0 }, { nombre: 'Cruce de la avenida', desde: 0.4, cruce: true }, { nombre: 'C. Real', desde: 0.5, hora: '21:00' }],
      },
    };
    assert.ok(!falla('itinerario', porCalles));
  });

  test('acepta un recorrido alternativo con sus paradas, y elegir cuál está en uso', () => {
    const mapa = { esquinas: [], linea: [[-4.44, 36.71], [-4.45, 36.72]], pegado: true };
    const conAlternativo = { ...doc([PARADA]), recorrido: mapa, alternativo: { paradas: [PARADA], recorrido: mapa }, enUso: 'alternativo' };
    assert.ok(!falla('itinerario', conAlternativo));
    assert.ok(!falla('itinerario', { ...conAlternativo, enUso: 'habitual' }));
    // Un alternativo sin mapa vale: la web lo enseña en lista.
    assert.ok(!falla('itinerario', { ...conAlternativo, alternativo: { paradas: [PARADA] } }));
    assert.ok(falla('itinerario', { ...conAlternativo, enUso: 'el otro' }));
  });

  test('el alternativo cumple lo mismo que el habitual, y no se usa si no lo hay', () => {
    const conAlternativo = (alternativo: unknown) => ({ ...doc([PARADA]), alternativo });
    assert.ok(falla('itinerario', conAlternativo({ paradas: [] })), 'sin paradas no pinta nada');
    const sinLugar = esquemaDeBloque('itinerario')(conAlternativo({ paradas: [{ ...PARADA, lugar: ' ' }] }));
    assert.ok(sinLugar instanceof ArkErrors);
    assert.ok(String(sinLugar).includes('alternativo.paradas[0].lugar'), `debe señalar la parada del alternativo; dijo: ${sinLugar}`);
    assert.ok(falla('itinerario', conAlternativo({ paradas: [PARADA], recorrido: { esquinas: [], linea: [[-4.44, 36.71]], pegado: true } })));
    assert.ok(falla('itinerario', { ...doc([PARADA]), enUso: 'alternativo' }), 'en uso el alternativo sin haberlo');
  });

  test('las calles van en orden, con nombre y sin desbordar; la parada no dura un día', () => {
    const conCalles = (calles: unknown[]) => ({ ...doc([PARADA]), recorrido: { esquinas: [], linea: [[-4.44, 36.71], [-4.45, 36.72]], pegado: false, calles } });
    assert.ok(falla('itinerario', conCalles([{ nombre: 'C. Real', desde: 0.5 }, { nombre: 'C. Mayor', desde: 0.2 }])), 'el trono no anda hacia atrás');
    assert.ok(falla('itinerario', conCalles([{ nombre: '  ', desde: 0 }])));
    assert.ok(falla('itinerario', conCalles([{ nombre: 'C. Mayor', desde: 0, hora: 'luego' }])));
    assert.ok(falla('itinerario', conCalles(Array.from({ length: topes.callesPorRecorrido + 1 }, (_, i) => ({ nombre: `C. ${i}`, desde: 0 })))));
    assert.ok(falla('itinerario', doc([{ ...PARADA, minutos: topes.minutosDeParada + 1 }])));
    assert.ok(falla('itinerario', doc([{ ...PARADA, minutos: 2.5 }])));
  });

  test('una línea de un punto, una coordenada imposible o una parada fuera del recorrido no valen', () => {
    const base = doc([PARADA]);
    const recorrido = (linea: unknown[]) => ({ ...base, recorrido: { esquinas: [], linea, pegado: false } });
    assert.ok(falla('itinerario', recorrido([[-4.44, 36.71]])), 'un punto suelto no es una línea');
    assert.ok(falla('itinerario', recorrido([[-4.44, 36.71], [-4.44, 136.71]])));
    assert.ok(falla('itinerario', recorrido([[-4.44, 36.71], ['-4.44', 36.71]])));
    assert.ok(falla('itinerario', doc([{ ...PARADA, enRuta: 1.5 }])));
  });
});

describe('bloque de foto fija y texto que pasa', () => {
  const PASO = { titulo: 'El trono', texto: 'Una pieza del patrimonio.', foto: { url: '/images/trono-cera.webp', alt: 'Cirios del trono', pie: '' } };
  const doc = (pasos: unknown[]) => ({ tipo: 'fotoFija', titulo: '', pasos });

  test('acepta las partes con su foto', () => {
    assert.ok(!falla('fotoFija', doc([PASO, { ...PASO, titulo: '' }])));
  });

  test('cada parte necesita texto y una foto descrita', () => {
    assert.ok(falla('fotoFija', doc([{ ...PASO, texto: '  ' }])));
    assert.ok(falla('fotoFija', doc([{ ...PASO, foto: { ...PASO.foto, url: '' } }])), 'la foto es lo que cambia: no puede faltar');
    assert.ok(falla('fotoFija', doc([{ ...PASO, foto: { ...PASO.foto, alt: ' ' } }])));
  });

  test('ni vacío ni desmedido', () => {
    assert.ok(falla('fotoFija', doc([])));
    assert.ok(falla('fotoFija', doc(Array.from({ length: topes.pasosPorBloque + 1 }, () => PASO))));
  });
});

describe('bloque de horario', () => {
  const HORARIO = {
    tipo: 'horario', titulo: 'Horarios',
    misas: [
      { etiqueta: 'Lunes a sábado', dias: [1, 2, 3, 4, 5, 6], horas: ['09:30', '19:00'], horasVerano: ['09:30', '20:00'] },
      { etiqueta: 'Domingos y festivos', dias: [0], horas: ['10:00', '12:00'], horasVerano: [] },
    ],
    despacho: [{ dias: [2, 5], desde: '18:00', hasta: '20:00' }],
    verano: { desde: '07-01', hasta: '08-31' },
    lineas: [{ etiqueta: 'Teléfono', valor: '952 331 203' }],
  };

  test('acepta misas, despacho, verano y líneas', () => {
    assert.ok(!falla('horario', HORARIO));
    assert.ok(!falla('horario', { ...HORARIO, despacho: [], lineas: [], verano: { desde: '', hasta: '' } }), 'despacho, líneas y verano son opcionales');
  });

  test('las horas y los días tienen que ser de verdad', () => {
    const franja = HORARIO.misas[0];
    assert.ok(falla('horario', { ...HORARIO, misas: [{ ...franja, horas: ['19h'] }] }));
    assert.ok(falla('horario', { ...HORARIO, misas: [{ ...franja, horas: [''] }] }), 'aquí la hora no puede ir vacía');
    assert.ok(falla('horario', { ...HORARIO, misas: [{ ...franja, horas: [] }] }));
    assert.ok(falla('horario', { ...HORARIO, misas: [{ ...franja, dias: [7] }] }));
    assert.ok(falla('horario', { ...HORARIO, misas: [{ ...franja, dias: [] }] }));
    assert.ok(falla('horario', { ...HORARIO, misas: [{ ...franja, etiqueta: ' ' }] }));
  });

  test('el despacho cierra después de abrir y el verano va entero', () => {
    assert.ok(falla('horario', { ...HORARIO, despacho: [{ dias: [2], desde: '20:00', hasta: '18:00' }] }));
    assert.ok(falla('horario', { ...HORARIO, verano: { desde: '07-01', hasta: '' } }));
    assert.ok(falla('horario', { ...HORARIO, verano: { desde: '13-01', hasta: '08-31' } }));
  });
});

describe('bloque de dibujo', () => {
  const DIBUJO = { tipo: 'dibujo', titulo: 'El templo', dibujo: 'templo', html: '<p>Una iglesia sin columnas.</p>' };

  test('acepta los dibujos de la lista', () => {
    assert.ok(!falla('dibujo', DIBUJO));
    assert.ok(!falla('dibujo', { ...DIBUJO, dibujo: 'signoPasionista' }));
  });

  test('una ilustración en lugar del dibujo, siempre descrita', () => {
    const foto = { url: '/images/templo-goretti.webp', alt: 'Ilustración del templo' };
    assert.ok(!falla('dibujo', { ...DIBUJO, foto }));
    assert.ok(!falla('dibujo', { ...DIBUJO, foto: { url: '', alt: '' } }), 'sin foto vale el dibujo de líneas');
    assert.ok(falla('dibujo', { ...DIBUJO, foto: { ...foto, alt: ' ' } }));
    assert.ok(falla('dibujo', { ...DIBUJO, foto: { ...foto, url: 'https://otra-web.com/templo.png' } }));
  });

  test('ni dibujos inventados ni texto vacío', () => {
    assert.ok(falla('dibujo', { ...DIBUJO, dibujo: 'catedral' }));
    assert.ok(falla('dibujo', { ...DIBUJO, html: '   ' }));
  });
});

describe('bloque de tres anillos', () => {
  const FIN = { titulo: 'Culto', texto: 'La eucaristía y el triduo.', boton: 'Ver los cultos', enlace: '/cultos' };
  const ANILLOS = { tipo: 'anillos', titulo: 'Tres cosas', centro: 'Desamparados', fines: [FIN, { ...FIN, titulo: 'Caridad' }, { ...FIN, titulo: 'Formación' }], texto: 'La salida es solo una parte.' };

  test('acepta tres fines, con botón o sin él', () => {
    assert.ok(!falla('anillos', ANILLOS));
    assert.ok(!falla('anillos', { ...ANILLOS, fines: ANILLOS.fines.map((f) => ({ ...f, boton: '', enlace: '' })) }));
  });

  test('siempre tres, con nombre, y botón con destino', () => {
    assert.ok(falla('anillos', { ...ANILLOS, fines: ANILLOS.fines.slice(0, 2) }));
    assert.ok(falla('anillos', { ...ANILLOS, fines: [...ANILLOS.fines, FIN] }));
    assert.ok(falla('anillos', { ...ANILLOS, fines: [{ ...FIN, titulo: ' ' }, FIN, FIN] }));
    assert.ok(falla('anillos', { ...ANILLOS, fines: [{ ...FIN, enlace: '' }, FIN, FIN] }));
    assert.ok(falla('anillos', { ...ANILLOS, fines: [{ ...FIN, enlace: '/no-existe' }, FIN, FIN] }));
  });
});

describe('bloque de dos puertas', () => {
  const DATO = { etiqueta: 'Despacho', valor: 'Martes y viernes', nota: '18:00 – 20:00', copiable: false };
  const PUERTA = { ceja: 'Si lo necesitas', titulo: 'Necesito ayuda', texto: 'Acude a Cáritas parroquial.', datos: [DATO], boton: 'Escríbenos', enlace: '/contacto' };
  const PUERTAS = { tipo: 'puertas', titulo: '', puertas: [PUERTA, { ...PUERTA, titulo: 'Quiero ayudar' }] };

  test('acepta dos puertas, con datos y botón o sin ellos, y un dato aún sin valor', () => {
    assert.ok(!falla('puertas', PUERTAS));
    assert.ok(!falla('puertas', { ...PUERTAS, puertas: PUERTAS.puertas.map((p) => ({ ...p, datos: [], boton: '', enlace: '' })) }));
    assert.ok(!falla('puertas', { ...PUERTAS, puertas: [{ ...PUERTA, datos: [{ ...DATO, valor: '', copiable: true }] }, PUERTA] }));
  });

  test('siempre dos, con título, datos con nombre y botón con destino', () => {
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [PUERTA] }));
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [PUERTA, PUERTA, PUERTA] }));
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [{ ...PUERTA, titulo: ' ' }, PUERTA] }));
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [{ ...PUERTA, datos: [{ ...DATO, etiqueta: '' }] }, PUERTA] }));
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [{ ...PUERTA, datos: [DATO, DATO, DATO, DATO] }, PUERTA] }));
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [{ ...PUERTA, enlace: '' }, PUERTA] }));
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [{ ...PUERTA, boton: '' }, PUERTA] }));
    assert.ok(falla('puertas', { ...PUERTAS, puertas: [{ ...PUERTA, enlace: '/no-existe' }, PUERTA] }));
  });
});

describe('bloque de programa', () => {
  const FILA = { cuando: 'Octubre', mes: 10, titulo: 'Rosario vespertino', texto: 'La Virgen por el barrio.', boton: '', enlace: '' };
  const PROGRAMA = { tipo: 'programa', titulo: 'Programa del curso', filas: [FILA, { ...FILA, cuando: 'Cada mes', mes: 0 }] };

  test('acepta filas con mes o sin mes fijo', () => {
    assert.ok(!falla('programa', PROGRAMA));
    assert.ok(!falla('programa', { ...PROGRAMA, filas: [{ ...FILA, boton: 'El Sábado de Pasión', enlace: '/sabado-de-pasion' }] }));
  });

  test('el mes va de 0 a 12, y cuándo y título no quedan en blanco', () => {
    assert.ok(falla('programa', { ...PROGRAMA, filas: [] }));
    assert.ok(falla('programa', { ...PROGRAMA, filas: [{ ...FILA, mes: 13 }] }));
    assert.ok(falla('programa', { ...PROGRAMA, filas: [{ ...FILA, mes: 2.5 }] }));
    assert.ok(falla('programa', { ...PROGRAMA, filas: [{ ...FILA, cuando: '' }] }));
    assert.ok(falla('programa', { ...PROGRAMA, filas: [{ ...FILA, titulo: ' ' }] }));
    assert.ok(falla('programa', { ...PROGRAMA, filas: [{ ...FILA, enlace: '/agenda' }] }));
  });
});

describe('bloque de relación', () => {
  const FILA = { cargo: 'Hermano Mayor', nombre: '', texto: 'Representa al Grupo Parroquial.', enlace: '' };
  const RELACION = { tipo: 'relacion', titulo: 'Junta de Gobierno', mandato: '', nota: '', filas: [FILA] };

  test('acepta cargos sin nombre todavía, con enlace o sin él', () => {
    assert.ok(!falla('relacion', RELACION));
    assert.ok(!falla('relacion', { ...RELACION, mandato: '2024 — 2028', filas: [{ ...FILA, nombre: 'Nombre Apellido', enlace: '/cultos' }] }));
  });

  test('siempre con cargo, sin enlaces inventados y sin filas de más', () => {
    assert.ok(falla('relacion', { ...RELACION, filas: [] }));
    assert.ok(falla('relacion', { ...RELACION, filas: [{ ...FILA, cargo: ' ' }] }));
    assert.ok(falla('relacion', { ...RELACION, filas: [{ ...FILA, enlace: '/no-existe' }] }));
    assert.ok(falla('relacion', { ...RELACION, filas: Array(21).fill(FILA) }));
  });
});

describe('bloque de carrusel', () => {
  const PIEZA = {
    familia: 'Insignias', titulo: 'Cruz de guía', texto: 'Abre el cortejo.',
    foto: { url: '/images/enseres/cruz.jpg', alt: 'La cruz de guía', pie: '' },
    datos: [{ etiqueta: 'Año', valor: '1997' }],
  };
  const CARRUSEL = { tipo: 'carrusel', titulo: '', piezas: [PIEZA] };

  test('acepta piezas con cartela o sin ella', () => {
    assert.ok(!falla('carrusel', CARRUSEL));
    assert.ok(!falla('carrusel', { ...CARRUSEL, piezas: [{ ...PIEZA, familia: '', texto: '', datos: [] }] }));
  });

  test('cada pieza con nombre, foto descrita y datos enteros', () => {
    assert.ok(falla('carrusel', { ...CARRUSEL, piezas: [] }));
    assert.ok(falla('carrusel', { ...CARRUSEL, piezas: [{ ...PIEZA, titulo: ' ' }] }));
    assert.ok(falla('carrusel', { ...CARRUSEL, piezas: [{ ...PIEZA, foto: { ...PIEZA.foto, alt: '' } }] }));
    assert.ok(falla('carrusel', { ...CARRUSEL, piezas: [{ ...PIEZA, foto: { ...PIEZA.foto, url: 'https://otra.web/foto.jpg' } }] }));
    assert.ok(falla('carrusel', { ...CARRUSEL, piezas: [{ ...PIEZA, datos: [{ etiqueta: 'Año', valor: '' }] }] }));
    assert.ok(falla('carrusel', { ...CARRUSEL, piezas: [{ ...PIEZA, datos: Array(5).fill(PIEZA.datos[0]) }] }));
    assert.ok(falla('carrusel', { ...CARRUSEL, piezas: Array(21).fill(PIEZA) }));
  });
});

describe('bloque de mapa', () => {
  test('las indicaciones son opcionales y en texto plano', () => {
    const MAPA = { tipo: 'mapa', titulo: '', lugar: 'Parroquia', direccion: 'C. Corregidor Paz Guzmán, 13, Málaga' };
    assert.ok(!falla('mapa', MAPA));
    assert.ok(!falla('mapa', { ...MAPA, indicaciones: 'En Cruz de Humilladero.' }));
    assert.ok(falla('mapa', { ...MAPA, indicaciones: '<b>No</b>' }));
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

describe('bloque de donativo', () => {
  const doc = (extra: Record<string, unknown> = {}) => ({ tipo: 'donativo', titulo: 'Colabora', texto: '', importes: [5, 10, 20], destinos: ['Caridad', 'Cultos'], ...extra });

  test('acepta sus importes y sus destinos, y también sin destinos', () => {
    assert.ok(!falla('donativo', doc()));
    assert.ok(!falla('donativo', doc({ destinos: [] })), 'sin destinos no se elige: va a lo que haga falta');
  });

  test('al menos un importe, enteros y dentro de los límites, sin repetir', () => {
    assert.ok(falla('donativo', doc({ importes: [] })));
    assert.ok(falla('donativo', doc({ importes: [0] })));
    assert.ok(falla('donativo', doc({ importes: [topes.donativoMaximoEuros + 1] })));
    assert.ok(falla('donativo', doc({ importes: [7.5] })), 'los sugeridos, en euros enteros');
    assert.ok(falla('donativo', doc({ importes: [10, 10] })));
    assert.ok(falla('donativo', doc({ importes: Array.from({ length: topes.importesPorDonativo + 1 }, (_, i) => i + 1) })));
  });

  test('un destino no queda en blanco ni se repite', () => {
    assert.ok(falla('donativo', doc({ destinos: ['Caridad', ' '] })));
    assert.ok(falla('donativo', doc({ destinos: ['Caridad', 'caridad'] })));
    assert.ok(falla('donativo', doc({ destinos: ['<b>Caridad</b>'] })), 'sin HTML');
  });
});
