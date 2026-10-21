// Cómo se preparan las imágenes de la marca: los cuatro iconos que salen del
// escudo y cada imagen reducida a lo que se ve. Lo usan la API, al subirlas
// desde el CMS (Sistema → Datos de la corporación), y `npm run marca`
// (desamparados-web/scripts/preparar-marca.mjs), para prepararlas a mano.
//
// `sharp` llega de quien llama y no se importa aquí: es del backend, y este
// fichero lo carga también el guion de la web, que lo toma prestado de allí.
//
// Por qué los iconos se componen sobre la tinta: un escudo blanco sobre
// transparente sería invisible en una pestaña clara o en la pantalla de inicio
// blanca de un móvil. La tinta es el `#100e11` del velo de la barra, el fondo
// que el escudo ya lleva detrás en la web.

/** La tinta del sitio: el mismo `#100e11` del velo de la barra. */
export const TINTA = { r: 0x10, g: 0x0e, b: 0x11, alpha: 1 }

/**
 * Cuánto del alto ocupa el escudo dentro del cuadrado. El resto es margen: los
 * iconos se ven pequeños y pegados al borde quedan apretados, y iOS además
 * recorta las esquinas para redondearlas.
 */
export const PROPORCION = 0.66

/**
 * `apple-touch-icon.png` sin sufijo de tamaño a propósito: iOS lo busca por ese
 * nombre exacto en la raíz cuando la página no lo declara.
 */
export const ICONOS = Object.freeze([
  { clave: 'favicon32', fichero: 'favicon-32.png', lado: 32 },
  { clave: 'appleTouchIcon', fichero: 'apple-touch-icon.png', lado: 180 },
  { clave: 'icono192', fichero: 'icono-192.png', lado: 192 },
  { clave: 'icono512', fichero: 'icono-512.png', lado: 512 },
])

/** El alto del escudo de la web: de sobra para la barra en pantallas 2x, y poco peso. */
export const ALTO_WEB = { minimo: 176, maximo: 300 }

/**
 * Hasta dónde se reduce cada imagen al subirla: lo que se ve en su sitio más
 * bien que mal en una pantalla 2x (los altos ideales de shared/marca.mjs). Los
 * escudos en PNG de paleta salvo el destacado, que suele llevar degradados de
 * oro que la paleta deja en bandas.
 */
const COMO_SE_PREPARA = {
  escudoSobreOscuro: { formato: 'png', paleta: true, alto: ALTO_WEB.maximo },
  escudoSobreClaro: { formato: 'png', paleta: true, alto: 400 },
  escudoDestacado: { formato: 'png', paleta: false, alto: 600 },
  compartir: { formato: 'jpeg', ancho: 1200 },
  correoCabecera: { formato: 'jpeg', ancho: 1200 },
}

/** Las claves que se suben desde el CMS: los iconos no, salen del escudo. */
export const CLAVES_QUE_SE_SUBEN = Object.freeze(Object.keys(COMO_SE_PREPARA))

/**
 * La imagen subida, en el formato de su sitio y reducida a lo que se ve:
 * cualquier PNG, JPEG o WebP vale, girado según su EXIF y sin metadatos (la
 * ubicación de una foto hecha con el móvil no tiene por qué publicarse). Un
 * JPEG no tiene transparencia: lo transparente sale negro, el fondo de la web.
 */
export async function prepararImagenDeMarca(sharp, clave, bytes) {
  const como = COMO_SE_PREPARA[clave]
  if (!como) throw new Error(`${clave} no se sube: sale del escudo sobre oscuro.`)
  let imagen = sharp(bytes, { failOn: 'error' }).rotate()
  if (como.alto) imagen = imagen.resize({ height: como.alto, withoutEnlargement: true })
  if (como.ancho) imagen = imagen.resize({ width: como.ancho, withoutEnlargement: true })
  if (como.formato === 'png') {
    // Calidad 80: a 300 px no se distingue de 90 y pesa una sexta parte menos.
    return imagen.png(como.paleta ? { palette: true, quality: 80, effort: 10, compressionLevel: 9 } : { compressionLevel: 9 }).toBuffer()
  }
  return imagen.flatten({ background: '#000000' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
}

/**
 * Los cuatro iconos, con el escudo que da `escudoAlLado(alto)` centrado sobre
 * la tinta. Sin canal alfa: apple-touch-icon tiene que ser opaco (iOS pinta de
 * negro lo transparente) y a los demás no les hace falta.
 */
export async function iconosDeMarca(sharp, escudoAlLado) {
  const iconos = []
  for (const { clave, fichero, lado } of ICONOS) {
    const bytes = await sharp({ create: { width: lado, height: lado, channels: 4, background: TINTA } })
      .composite([{ input: await escudoAlLado(Math.round(lado * PROPORCION)), gravity: 'center' }])
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer()
    iconos.push({ clave, fichero, lado, bytes })
  }
  return iconos
}

/**
 * Un escudo que cabe en un cuadrado de `lado`, no solo de alto: uno apaisado
 * reducido por el alto saldría más ancho que el icono y sharp no lo compone.
 */
export const escudoQueCabe = (sharp, escudo) => (lado) =>
  sharp(escudo).resize({ width: lado, height: lado, fit: 'inside' }).png().toBuffer()
