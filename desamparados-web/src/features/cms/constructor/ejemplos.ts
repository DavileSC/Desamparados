import type { Bloque, MedioGaleria } from '../../../lib/api/contenido'

/**
 * Lo que se ve en la vista previa de «Añadir bloque»: cada tipo con un
 * contenido de ejemplo, pintado por el mismo componente que la web. Un bloque
 * recién añadido nace en blanco y no pinta nada; este enseña cómo queda lleno.
 *
 * El texto es neutro y habla del propio bloque: el CMS es el mismo para
 * cualquier corporación, y no puede nombrar ninguna. Las fotos son las de la
 * página que se edita (su cabecera y sus bloques); si no tiene, un hueco.
 */

/** Un hueco con forma de foto: sin fotos en la página, algo tiene que ocupar su sitio. */
export const FOTO_DE_EJEMPLO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">'
  + '<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3036"/><stop offset="1" stop-color="#1c171b"/></linearGradient></defs>'
  + '<rect width="1600" height="1000" fill="url(#c)"/>'
  + '<path d="M0 760 L420 470 L700 690 L980 420 L1600 820 L1600 1000 L0 1000 Z" fill="#2a2228"/>'
  + '<circle cx="1180" cy="270" r="80" fill="#4a3f45"/></svg>',
)}`

/** Las fotos que se pueden enseñar de ejemplo: lo que en la página parezca una foto subida. */
export function fotosDeLaPagina(documento: unknown): string[] {
  const fotos = new Set<string>()
  const recorrer = (valor: unknown) => {
    if (typeof valor === 'string') {
      if (/^\/[^\s]+\.(webp|jpe?g|png)$/i.test(valor)) fotos.add(valor)
    } else if (Array.isArray(valor)) {
      valor.forEach(recorrer)
    } else if (valor && typeof valor === 'object') {
      Object.values(valor).forEach(recorrer)
    }
  }
  recorrer(documento)
  return [...fotos]
}

/** Dentro de un mes a las 18:00, como AAAA-MM-DDTHH:mm: así la cuenta atrás cuenta algo. */
function dentroDeUnMes(): string {
  const fecha = new Date()
  fecha.setMonth(fecha.getMonth() + 1)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T18:00`
}

/**
 * Los bloques de ejemplo de un tipo. Casi siempre uno; el espacio va entre dos
 * textos, porque solo no se ve nada.
 */
export function ejemploDe(tipo: string, fotos: string[]): Bloque[] {
  const foto = (n: number) => (fotos.length > 0 ? fotos[n % fotos.length] : FOTO_DE_EJEMPLO)
  const sinTitulo = { titulo: '' }

  switch (tipo) {
    case 'texto':
      return [{
        tipo, titulo: 'Título de la sección',
        html: '<p>Aquí va el texto de la página, con su formato: <strong>negritas</strong>, enlaces y párrafos que se leen con calma, a un ancho cómodo.</p><p>Un segundo párrafo continúa. También admite listas y subtítulos, y en «Presentación» puede ir como entradilla, destacado o carta.</p>',
      }]
    case 'cita':
      return [{ tipo, ...sinTitulo, texto: 'Unas palabras que merecen ir en grande, para que se lean despacio.', autor: 'Quién lo dijo', fuente: 'Dónde' }]
    case 'preguntas':
      return [{
        tipo, titulo: 'Preguntas frecuentes', presentacion: { abrirPrimera: true },
        preguntas: [
          { pregunta: '¿Cómo se hace uno hermano?', respuesta: 'La respuesta se abre al pulsar la pregunta y se cierra al volver a pulsarla.' },
          { pregunta: '¿Cuándo se recoge la papeleta?', respuesta: 'Cada respuesta puede tener varios párrafos.' },
          { pregunta: '¿Dónde está el despacho?', respuesta: 'Con su dirección y su horario.' },
        ],
      }]
    case 'foto':
      return [{ tipo, ...sinTitulo, url: foto(0), alt: 'Foto de ejemplo', pie: 'El pie de la foto, en una línea.' }]
    case 'fotoTexto':
      return [{
        tipo, ...sinTitulo, url: foto(1), alt: 'Foto de ejemplo', pie: '',
        html: '<h3>Un texto junto a su foto</h3><p>La foto a un lado y el texto al otro. En el móvil, la foto va encima.</p>',
        boton: 'Saber más', enlace: '/',
      }]
    case 'galeria':
      return [{
        tipo, ...sinTitulo, presentacion: { disposicion: 'cuadricula' },
        medios: [0, 1, 2, 3, 4, 5].map((n): MedioGaleria => ({ tipo: 'foto', url: foto(n), portada: '', alt: `Foto ${n + 1} de ejemplo`, pie: '' })),
      }]
    case 'carrusel':
      return [{
        tipo, ...sinTitulo,
        piezas: [0, 1].map((n) => ({
          familia: 'Familia de la pieza', titulo: 'Nombre de la pieza', texto: 'Su historia en dos o tres líneas: qué es y qué la hace única.',
          foto: { url: foto(n), alt: 'Foto de ejemplo', pie: '' }, datos: [{ etiqueta: 'Autor', valor: 'Taller' }, { etiqueta: 'Año', valor: 'Año' }],
        })),
      }]
    case 'fotoFija':
      return [{
        tipo, ...sinTitulo,
        pasos: ['La primera parte', 'La siguiente', 'La última'].map((titulo, n) => ({
          titulo, texto: 'Mientras se lee esta parte, la foto del fondo es la suya; al bajar, cambia con un fundido.', foto: { url: foto(n), alt: 'Foto de ejemplo', pie: '' },
        })),
      }]
    case 'video':
      return [{ tipo, ...sinTitulo, url: 'https://www.youtube-nocookie.com/embed/ejemplo', portada: foto(2), alt: 'Vídeo de ejemplo', pie: 'No se carga nada de YouTube hasta darle al play.' }]
    case 'dibujo':
      return [{ tipo, titulo: 'Un dibujo que se traza', dibujo: 'templo', html: '<p>El dibujo se traza solo al bajar por la página, con su texto al lado.</p>' }]
    case 'tarjetas':
      return [{
        tipo, titulo: 'Lo que hacemos',
        tarjetas: [
          { titulo: 'Primera', descripcion: 'Un texto corto y, si se quiere, un enlace.', enlace: '', icono: 'iglesia' },
          { titulo: 'Segunda', descripcion: 'Con icono o con una foto arriba.', enlace: '', icono: 'corazon' },
          { titulo: 'Tercera', descripcion: 'Hasta doce, en rejilla.', enlace: '', icono: 'libro' },
        ],
      }]
    case 'llamada':
      return [{ tipo, ...sinTitulo, texto: 'Un párrafo que invita a dar el paso, con un solo botón que lleva a otra página.', boton: 'El botón', enlace: '/' }]
    case 'botones':
      return [{
        tipo, ...sinTitulo,
        botones: [
          { texto: 'Principal', enlace: '/', estilo: 'principal' },
          { texto: 'Secundario', enlace: '/', estilo: 'secundario' },
          { texto: 'Otro', enlace: '/', estilo: 'secundario' },
        ],
      }]
    case 'puertas':
      return [{
        tipo, ...sinTitulo,
        puertas: [
          { ceja: 'Para unos', titulo: 'Primera puerta', texto: 'Para quien llega buscando una cosa.', datos: [{ etiqueta: 'Un dato', valor: 'Su valor', nota: '', copiable: false }], boton: 'Su botón', enlace: '/' },
          { ceja: 'Para otros', titulo: 'Segunda puerta', texto: 'Para quien llega buscando otra.', datos: [{ etiqueta: 'Otro dato', valor: 'Copiable', nota: '', copiable: true }], boton: 'Su botón', enlace: '/' },
        ],
      }]
    case 'anillos':
      return [{
        tipo, ...sinTitulo, centro: '', texto: '',
        fines: [
          { titulo: 'Culto', texto: 'Su texto, junto a su anillo.', boton: '', enlace: '' },
          { titulo: 'Caridad', texto: 'Cada fin con el suyo.', boton: '', enlace: '' },
          { titulo: 'Formación', texto: 'Los tres van juntos.', boton: '', enlace: '' },
        ],
      }]
    case 'espacio':
      return [
        { tipo: 'texto', ...sinTitulo, html: '<p>El bloque de encima.</p>' },
        { tipo, ...sinTitulo, presentacion: { linea: true } },
        { tipo: 'texto', ...sinTitulo, html: '<p>El bloque de debajo.</p>' },
      ]
    case 'datos':
      return [{
        tipo, titulo: 'Datos',
        lineas: [{ etiqueta: 'Concepto', valor: 'Su valor' }, { etiqueta: 'Otro concepto', valor: 'Otro valor' }, { etiqueta: 'Medidas', valor: 'Alto × ancho' }],
      }]
    case 'itinerario':
      return [{
        tipo, titulo: 'Itinerario', presentacion: { disposicion: 'linea' },
        paradas: [{ hora: '17:30', lugar: 'Salida del templo' }, { hora: '18:15', lugar: 'Una calle del recorrido' }, { hora: '19:40', lugar: 'Una plaza' }, { hora: '', lugar: 'Entrada en el templo' }],
      }]
    case 'cronologia':
      return [{
        tipo, ...sinTitulo, presentacion: { disposicion: 'horizontal' },
        hitos: [
          { periodo: 'Año', etiqueta: 'El comienzo', titulo: 'El primer momento', relato: 'Cada momento con su fecha y su relato.', foto: { url: '', alt: '', pie: '' }, tono: 'ninguno' },
          { periodo: 'Año', etiqueta: 'Un cambio', titulo: 'Un momento señalado', relato: 'Uno puede ir en granate, para destacarlo.', foto: { url: '', alt: '', pie: '' }, tono: 'granate' },
          { periodo: 'Hoy', etiqueta: 'Ahora', titulo: 'El momento actual', relato: 'Y el de ahora, en dorado.', foto: { url: '', alt: '', pie: '' }, tono: 'oro' },
        ],
      }]
    case 'horario':
      return [{
        tipo, ...sinTitulo,
        misas: [
          { etiqueta: 'Lunes a sábado', dias: [1, 2, 3, 4, 5, 6], horas: ['19:00'], horasVerano: [] },
          { etiqueta: 'Domingos y festivos', dias: [0], horas: ['10:00', '12:00'], horasVerano: [] },
        ],
        despacho: [{ dias: [2, 4], desde: '18:00', hasta: '20:00' }],
        verano: { desde: '', hasta: '' },
        lineas: [],
      }]
    case 'mapa':
      return [{ tipo, ...sinTitulo, lugar: 'Nombre del lugar', direccion: 'Calle, número y ciudad', indicaciones: 'Unas indicaciones para llegar: el barrio, la entrada.', presentacion: { disposicion: 'lado' } }]
    case 'relacion':
      return [{
        tipo, titulo: 'Junta de Gobierno', mandato: 'Años', nota: '',
        filas: [
          { cargo: 'Primer cargo', nombre: 'Nombre y apellidos', texto: 'Lo que hace, en una línea.', enlace: '' },
          { cargo: 'Segundo cargo', nombre: 'Nombre y apellidos', texto: 'Su función.', enlace: '' },
          { cargo: 'Tercer cargo', nombre: '', texto: 'Sin nombre, sale solo el cargo.', enlace: '' },
        ],
      }]
    case 'descargas':
      return [{
        tipo, titulo: 'Documentos',
        archivos: [
          { titulo: 'Un documento', descripcion: 'Una línea que lo describe.', url: '#' },
          { titulo: 'Otro documento', descripcion: '', url: '#' },
        ],
      }]
    case 'cuentaAtras':
      return [{ tipo, ...sinTitulo, fecha: dentroDeUnMes(), texto: 'Lo que llega', textoFinal: '' }]
    case 'listado':
      return [{ tipo, titulo: 'Últimas noticias', fuente: 'noticias-recientes' }]
    case 'programa':
      return [{
        tipo, titulo: 'Programa del año',
        filas: [
          { cuando: 'Cada mes', mes: 0, titulo: 'Un culto que se repite', texto: '', boton: '', enlace: '' },
          { cuando: 'Cuaresma', mes: 3, titulo: 'Un culto de la temporada', texto: 'Una o dos líneas.', boton: '', enlace: '' },
        ],
      }]
    case 'contacto':
      return [{
        tipo, ...sinTitulo, tituloDatos: 'Datos de contacto',
        lineas: [{ etiqueta: 'Correo', valor: 'correo@ejemplo.es' }, { etiqueta: 'Teléfono', valor: '600 000 000' }, { etiqueta: 'Dirección', valor: 'Calle y número' }],
      }]
    case 'donativo':
      return [{ tipo, ...sinTitulo, texto: 'Unas líneas sobre a qué se destina lo que se da.', importes: [5, 10, 20, 50], destinos: [] }]
    default:
      return []
  }
}
