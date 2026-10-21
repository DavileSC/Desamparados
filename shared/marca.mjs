// Las imágenes de la marca de ESTA instalación: el escudo, los iconos y las
// imágenes de compartir y de los correos. Lo leen la API (correos y PDF), la
// orden que prepara la web al arrancar el contenedor y el servidor de Vite.
//
// Viven fuera de git, en instalacion/marca/ (como datos-entidad.json): cada
// corporación tiene las suyas y un «git pull» no debe chocar con ellas ni
// llevárselas. Todas son opcionales; la que falta se toma de la marca de
// partida (shared/marca-de-partida/: un escudo genérico sin símbolos), y eso se
// avisa sin impedir arrancar. Lo que sí impide arrancar es un fichero que está
// pero no sirve (otro formato con la extensión cambiada, roto, ilegible, un
// icono que no tiene su medida): saldría roto en todas las páginas, PDF y
// correos sin que nadie lo notara hasta verlos.
//
// Solo PNG y JPEG: PDFKit no lee otra cosa y Outlook no pinta WebP. Las
// cabeceras se leen a mano (sin sharp) porque esto lo carga también el arranque
// del contenedor de nginx, que no tiene dependencias.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

export const RUTA_MARCA = 'instalacion/marca'
export const RUTA_PARTIDA = 'shared/marca-de-partida'
/** La carpeta de la marca de partida, absoluta. */
export const CARPETA_PARTIDA = join(raiz, RUTA_PARTIDA)

const KB = 1024
const MB = 1024 * KB
/** Por encima, error: ninguna imagen de la marca necesita tanto, y es casi seguro un original sin preparar. */
export const PESO_MAXIMO = 2 * MB

/**
 * Lo que puede haber en instalacion/marca/. `partida`: si la marca de partida
 * trae uno (si no, la clave sale a null y cada sitio usa el respaldo que dice
 * `siFalta`).
 * `exacto`: medidas que tienen que ser esas (error); `altoMinimo`/`anchoMinimo`
 * y `pesoAviso` solo avisan. `transparencia`: 'si' avisa si no la tiene, 'no'
 * avisa si la tiene.
 */
export const CATALOGO_MARCA = Object.freeze([
  {
    clave: 'escudoSobreOscuro', fichero: 'escudo-sobre-oscuro.png', formato: 'png', partida: true,
    para: 'la web: barra, cajón, CMS, área de hermanos, acceso y placas de las noticias sin foto',
    altoMinimo: 176, altoIdeal: [176, 480], pesoAviso: 150 * KB, transparencia: 'si',
  },
  {
    clave: 'escudoSobreClaro', fichero: 'escudo-sobre-claro.png', formato: 'png', partida: true,
    para: 'el membrete de los correos y el pie de los PDF',
    altoMinimo: 200, altoIdeal: [200, 400], pesoAviso: 300 * KB, transparencia: 'si',
  },
  {
    clave: 'escudoDestacado', fichero: 'escudo-destacado.png', formato: 'png', partida: false,
    para: 'la papeleta en la web y en PDF, y los membretes de los PDF',
    siFalta: 'se usa escudo-sobre-claro.png en papel y escudo-sobre-oscuro.png en la banda negra y en la web',
    altoMinimo: 200, altoIdeal: [200, 600], pesoAviso: 300 * KB, transparencia: 'si',
  },
  { clave: 'favicon32', fichero: 'favicon-32.png', formato: 'png', partida: true, para: 'la pestaña del navegador', exacto: [32, 32] },
  {
    clave: 'appleTouchIcon', fichero: 'apple-touch-icon.png', formato: 'png', partida: true,
    para: 'el icono de iOS al añadir la web a la pantalla de inicio', exacto: [180, 180], transparencia: 'no',
  },
  { clave: 'icono192', fichero: 'icono-192.png', formato: 'png', partida: true, para: 'el manifest de Android', exacto: [192, 192] },
  { clave: 'icono512', fichero: 'icono-512.png', formato: 'png', partida: true, para: 'el manifest y, si no hay compartir.jpg, la imagen al compartir un enlace', exacto: [512, 512] },
  {
    clave: 'compartir', fichero: 'compartir.jpg', formato: 'jpeg', partida: false,
    para: 'la imagen al compartir un enlace en redes y mensajería, y la de los datos estructurados',
    siFalta: 'al compartir un enlace se ve icono-512.png, en pequeño',
    anchoMinimo: 600, proporcion: [1200, 630], pesoAviso: 1 * MB,
  },
  {
    clave: 'correoCabecera', fichero: 'correo-cabecera.jpg', formato: 'jpeg', partida: false,
    para: 'la imagen bajo el membrete de los correos a los hermanos',
    siFalta: 'los correos van sin imagen bajo el membrete',
    anchoMinimo: 600, pesoAviso: 150 * KB,
  },
].map((e) => Object.freeze(e)))

const TIPO_MIME = { png: 'image/png', jpeg: 'image/jpeg' }
const NOMBRE_FORMATO = { png: 'PNG', jpeg: 'JPEG' }

// ---------------------------------------------------------------------------
//  Cabeceras
// ---------------------------------------------------------------------------

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

let tablaCrc
/** CRC-32 de PNG: así se ve un PNG cortado o tocado, que con la cabecera sola parecería bueno. */
function crc32(buffer, desde, hasta) {
  if (!tablaCrc) {
    tablaCrc = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      tablaCrc[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = desde; i < hasta; i++) c = tablaCrc[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function cabeceraPng(b) {
  if (b.length < 33 || b.toString('latin1', 12, 16) !== 'IHDR') throw new Error('PNG sin cabecera IHDR: está roto o cortado.')
  const ancho = b.readUInt32BE(16)
  const alto = b.readUInt32BE(20)
  const tipoColor = b[25]
  const entrelazado = b[28] === 1
  let transparencia = tipoColor === 4 || tipoColor === 6
  let datos = false
  let fin = false
  // Se recorren todos los trozos con su CRC hasta IEND: un PNG cortado a
  // medias (una subida interrumpida) no llega a IEND.
  for (let i = 8; i + 12 <= b.length;) {
    const largo = b.readUInt32BE(i)
    const tipo = b.toString('latin1', i + 4, i + 8)
    if (i + 12 + largo > b.length) throw new Error(`PNG cortado: el trozo ${tipo} no cabe en el fichero.`)
    if (crc32(b, i + 4, i + 8 + largo) !== b.readUInt32BE(i + 8 + largo)) throw new Error(`PNG roto: el trozo ${tipo} no cuadra con su CRC.`)
    if (tipo === 'tRNS') transparencia = true
    if (tipo === 'IDAT') datos = true
    i += 12 + largo
    if (tipo === 'IEND') { fin = true; break }
  }
  if (!datos || !fin) throw new Error('PNG cortado: le falta la imagen o el final (IEND).')
  if (!ancho || !alto) throw new Error('PNG con medidas a cero.')
  return { formato: 'png', ancho, alto, transparencia, entrelazado }
}

const EOI = Buffer.from([0xff, 0xd9])

function cabeceraJpeg(b) {
  let i = 2
  let medidas = null
  let progresivo = false
  let datosTrasElFin = 0
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('JPEG roto: un marcador no empieza por 0xFF.')
    const marcador = b[i + 1]
    if (marcador === 0xff) { i++; continue }
    // Marcadores sin longitud: RSTn y TEM.
    if ((marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) { i += 2; continue }
    if (marcador === 0xd9) break
    const largo = b.readUInt16BE(i + 2)
    if (largo < 2 || i + 2 + largo > b.length) throw new Error('JPEG cortado: un segmento no cabe en el fichero.')
    // SOF0…SOF15 menos DHT (C4), JPG (C8) y DAC (CC): ahí van las medidas.
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      // Precisión, alto y ancho: 8 bytes con la longitud. Uno más corto
      // haría leer fuera del segmento (o del fichero, con el error crudo de Node).
      if (largo < 8) throw new Error('JPEG roto: el segmento de medidas (SOF) es demasiado corto.')
      medidas = { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) }
      progresivo = marcador === 0xc2 || marcador === 0xc6 || marcador === 0xca || marcador === 0xce
    }
    // Tras SOS vienen los datos comprimidos, sin marcadores que leer: se
    // comprueba solo que llega el EOI (FFD9), que es lo que falta en una
    // subida a medias. El primero tras el SOS es el de verdad: dentro de los
    // datos un 0xFF va siempre seguido de 00 o de un RSTn. No se exige que
    // sea lo último: las fotos en movimiento de Android llevan un vídeo
    // detrás, y algunos editores dejan restos; los visores lo ignoran, y
    // `comprobar` solo lo avisa por lo que pesa.
    if (marcador === 0xda) {
      const eoi = b.indexOf(EOI, i + 2 + largo)
      if (eoi === -1) throw new Error('JPEG cortado: no llega al marcador de fin (EOI).')
      // El relleno de ceros o saltos de línea del final no cuenta como resto.
      let fin = b.length
      while (fin > eoi + 2 && (b[fin - 1] === 0x00 || b[fin - 1] === 0x0a || b[fin - 1] === 0x0d)) fin--
      datosTrasElFin = fin - (eoi + 2)
      break
    }
    i += 2 + largo
  }
  if (!medidas) throw new Error('JPEG sin medidas (SOF): está roto o cortado.')
  if (!medidas.ancho || !medidas.alto) throw new Error('JPEG con medidas a cero.')
  const cabecera = { formato: 'jpeg', ...medidas, transparencia: false, entrelazado: progresivo }
  // Solo si los hay, para que la cabecera de un JPEG normal no cambie de forma.
  return datosTrasElFin ? { ...cabecera, datosTrasElFin } : cabecera
}

/**
 * El formato y las medidas de una imagen, leídos de sus bytes. Null si no es ni
 * PNG ni JPEG (un WebP, un texto, una página de error guardada como .png).
 * Lanza si tiene la firma de uno de los dos pero está cortada o rota.
 * `entrelazado`: PNG Adam7, o JPEG progresivo. `datosTrasElFin`: en un JPEG,
 * los bytes que siguen al EOI (el vídeo de una foto en movimiento), si los hay.
 */
export function leerCabeceraImagen(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (b.length >= 8 && b.subarray(0, 8).equals(FIRMA_PNG)) return cabeceraPng(b)
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return cabeceraJpeg(b)
  return null
}

/** Qué parece un fichero que no es PNG ni JPEG, para decirlo en el error. */
function queParece(b) {
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'un WebP'
  if (b.length >= 6 && /^GIF8[79]a/.test(b.toString('latin1', 0, 6))) return 'un GIF'
  if (b.length >= 12 && b.toString('latin1', 4, 8) === 'ftyp') return 'un HEIC/AVIF'
  const inicio = b.toString('utf8', 0, Math.min(b.length, 200)).trimStart().toLowerCase()
  if (inicio.startsWith('<svg') || inicio.startsWith('<?xml')) return 'un SVG'
  if (inicio.startsWith('<!doctype') || inicio.startsWith('<html')) return 'una página web (¿una descarga fallida?)'
  if (b.length === 0) return 'un fichero vacío'
  if (!b.subarray(0, 512).includes(0)) return 'un fichero de texto'
  return 'otra cosa'
}

// ---------------------------------------------------------------------------
//  Dónde está y qué hay
// ---------------------------------------------------------------------------

// NODE_TEST_CONTEXT lo pone el ejecutor de pruebas de Node; VITEST, Vitest
// (como en datos-entidad.mjs).
const enPruebas = (entorno) => Boolean(entorno.NODE_TEST_CONTEXT || entorno.VITEST)

/**
 * La carpeta de la marca, absoluta: la de `MARCA` si se da (relativa a la raíz
 * del repositorio; lanza si no existe) y, si no, instalacion/marca, exista o no
 * (si no, `resolverMarca` lo avisa).
 *
 * En las pruebas, null (solo la marca de partida: no dependen de las imágenes
 * de esta máquina), y `MARCA` no cuenta: el backend carga su .env con dotenv, y
 * una `MARCA` puesta allí para el servidor se colaría en todas las pruebas. La
 * prueba que quiera otra carpeta la pide con `MARCA_DE_PRUEBA`, que solo se
 * mira en las pruebas.
 */
export function rutaDeMarca(entorno = process.env) {
  const variable = enPruebas(entorno) ? 'MARCA_DE_PRUEBA' : 'MARCA'
  const pedida = entorno[variable]?.trim()
  if (pedida) {
    const ruta = resolve(raiz, pedida)
    if (!existsSync(ruta)) throw new Error(`${variable} apunta a ${ruta}, que no existe.`)
    return ruta
  }
  return variable === 'MARCA_DE_PRUEBA' ? null : resolve(raiz, RUTA_MARCA)
}

const version = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 8)

/** La distancia de edición: para proponer el nombre bueno a una errata. */
function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = arriba
    }
  }
  return fila[b.length]
}

/** El aviso de un fichero que no es de la marca, con el nombre que probablemente quería ser. */
function avisoDesconocido(nombre) {
  // Solo cambian las mayúsculas (escudo-sobre-oscuro.PNG, lo que deja la
  // cámara o Windows): no se usa, porque en el servidor (Linux) el nombre que
  // se busca no es ese, y lo que en este PC funcionaría saldría con el escudo
  // genérico al desplegar. Mejor el mismo aviso aquí que allí.
  const sinMayusculas = CATALOGO_MARCA.find((e) => e.fichero === nombre.toLowerCase())
  if (sinMayusculas) {
    return `${nombre}: renómbralo a ${sinMayusculas.fichero}, en minúsculas (en el servidor las mayúsculas cuentan). Mientras, se ignora.`
  }
  const base = nombre.slice(0, nombre.length - extname(nombre).length).toLowerCase()
  const mismoNombre = CATALOGO_MARCA.find((e) => e.fichero.slice(0, -extname(e.fichero).length) === base)
  if (mismoNombre) {
    return `${nombre}: no es de la marca; ¿${mismoNombre.fichero}? Tiene que ser ${NOMBRE_FORMATO[mismoNombre.formato]} ` +
      '(convertido, no basta con cambiarle la extensión). Se ignora.'
  }
  const cerca = CATALOGO_MARCA
    .map((e) => ({ e, d: distancia(nombre.toLowerCase(), e.fichero) }))
    .sort((x, y) => x.d - y.d)[0]
  if (cerca && cerca.d <= 4) return `${nombre}: no es de la marca; ¿${cerca.e.fichero}? Se ignora.`
  return `${nombre}: no es de la marca y se ignora (los nombres que se leen son ${CATALOGO_MARCA.map((e) => e.fichero).join(', ')}).`
}

/** Comprueba un fichero de la instalación contra su entrada del catálogo. */
function comprobar(entrada, bytes, errores, avisos) {
  const f = entrada.fichero
  if (bytes.length > PESO_MAXIMO) {
    errores.push(`${f}: pesa ${(bytes.length / MB).toFixed(1).replace('.', ',')} MB y el máximo es 2 MB. Prepáralo (npm run marca, docs/despliegue.md «La marca»).`)
    return null
  }
  let cabecera
  try {
    cabecera = leerCabeceraImagen(bytes)
  } catch (error) {
    errores.push(`${f}: ${error instanceof Error ? error.message : error} Vuelve a copiarlo.`)
    return null
  }
  if (!cabecera) {
    errores.push(`${f}: no es una imagen ${NOMBRE_FORMATO[entrada.formato]}, es ${queParece(bytes)}. Conviértelo a ${NOMBRE_FORMATO[entrada.formato]}; no basta con cambiarle la extensión.`)
    return null
  }
  if (cabecera.formato !== entrada.formato) {
    errores.push(`${f}: es un ${NOMBRE_FORMATO[cabecera.formato]} con extensión de ${NOMBRE_FORMATO[entrada.formato]}. Conviértelo a ${NOMBRE_FORMATO[entrada.formato]}; no basta con cambiarle la extensión.`)
    return null
  }
  const { ancho, alto } = cabecera
  if (entrada.exacto && (ancho !== entrada.exacto[0] || alto !== entrada.exacto[1])) {
    errores.push(`${f}: mide ${ancho}×${alto} y tiene que medir ${entrada.exacto[0]}×${entrada.exacto[1]} exactos (npm run marca -- --escudo … los genera).`)
    return null
  }
  if (entrada.altoMinimo && alto < entrada.altoMinimo) avisos.push(`${f}: mide ${ancho}×${alto}; con menos de ${entrada.altoMinimo} px de alto se verá borroso en ${entrada.para}.`)
  else if (entrada.altoIdeal && alto > entrada.altoIdeal[1] * 2) avisos.push(`${f}: mide ${ancho}×${alto}, mucho más de lo que se ve (hasta ${entrada.altoIdeal[1]} px de alto); pesa sin ganar nada (npm run marca -- --optimizar …).`)
  if (entrada.anchoMinimo && ancho < entrada.anchoMinimo) avisos.push(`${f}: mide ${ancho}×${alto}; con menos de ${entrada.anchoMinimo} px de ancho se verá borroso.`)
  if (entrada.proporcion) {
    const [pa, pb] = entrada.proporcion
    if (Math.abs(ancho / alto - pa / pb) > 0.15) avisos.push(`${f}: mide ${ancho}×${alto}; las redes la recortan a ${pa}×${pb} (1,91:1) y se perderá parte.`)
  }
  if (cabecera.datosTrasElFin) {
    avisos.push(`${f}: lleva ${Math.ceil(cabecera.datosTrasElFin / KB)} KB de datos tras el final de la imagen (¿una foto en movimiento, o restos de un editor?). ` +
      'No se ven y pesan en cada correo y página; quítalos guardándola de nuevo (npm run marca -- --optimizar …).')
  }
  if (entrada.pesoAviso && bytes.length > entrada.pesoAviso) {
    avisos.push(`${f}: pesa ${Math.round(bytes.length / KB)} KB (lo recomendable es hasta ${Math.round(entrada.pesoAviso / KB)} KB); va en ${entrada.para}.`)
  }
  if (entrada.transparencia === 'si' && !cabecera.transparencia) avisos.push(`${f}: no tiene transparencia; se verá un recuadro alrededor del escudo.`)
  if (entrada.transparencia === 'no' && cabecera.transparencia) avisos.push(`${f}: tiene canal de transparencia (alfa), y iOS pinta de negro lo transparente. Si es opaco, guárdalo sin canal alfa (los iconos de «npm run marca -- --escudo» ya salen así).`)
  return cabecera
}

/**
 * Una imagen suelta contra su entrada del catálogo, con las mismas reglas que
 * al arrancar: la que sube Administración desde el CMS. `cabecera` es null si
 * no sirve, y entonces `errores` dice por qué.
 */
export function comprobarImagenDeMarca(clave, bytes) {
  const entrada = CATALOGO_MARCA.find((e) => e.clave === clave)
  if (!entrada) throw new Error(`${clave} no es una imagen de la marca.`)
  const errores = []
  const avisos = []
  const cabecera = comprobar(entrada, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes), errores, avisos)
  return { cabecera, errores, avisos }
}

/**
 * Qué fichero se usa para cada clave del catálogo: el de `carpeta` (la de la
 * instalación; null = solo partida, sin avisos) si está y sirve, y si no, el de
 * `partida`. Las claves sin partida (escudoDestacado, compartir,
 * correoCabecera) salen a null si faltan. `version`: los 8 primeros del sha256,
 * para las URL `?v=` que hacen visible un cambio sin esperar a la caché.
 * Un fichero con error se sustituye igual por el de partida, pero `errores` no
 * va vacío y quien llama no debe arrancar.
 */
export function resolverMarca({ carpeta: pedida = null, partida = CARPETA_PARTIDA } = {}) {
  // Absoluta, para que `ruta` lo sea aunque se pida una relativa (desde el cwd).
  const carpeta = pedida === null || pedida === undefined ? null : resolve(pedida)
  const errores = []
  const avisos = []
  const ficheros = {}

  let presentes = new Set()
  const usarInstalacion = carpeta !== null
  if (usarInstalacion) {
    if (!existsSync(carpeta)) {
      avisos.push(`No hay carpeta de la marca (${carpeta}): se usa la marca de partida, con un escudo genérico (docs/despliegue.md, «La marca»).`)
    } else {
      try {
        for (const e of readdirSync(carpeta, { withFileTypes: true })) {
          // Las subcarpetas (originales/) y los ocultos (.DS_Store) no son de la marca.
          if (e.isDirectory() || e.name.startsWith('.')) continue
          if (CATALOGO_MARCA.some((c) => c.fichero === e.name)) presentes.add(e.name)
          else avisos.push(avisoDesconocido(e.name))
        }
      } catch (error) {
        errores.push(`No se puede leer la carpeta ${carpeta}: ${error instanceof Error ? error.message : error}. Tiene que poder leerla el usuario del contenedor (chmod 755).`)
        presentes = new Set()
      }
    }
  }

  const deCarpeta = (dir, entrada, origen, bytes, cabecera) => ({
    ruta: join(dir, entrada.fichero), fichero: entrada.fichero, origen, version: version(bytes),
    tipo: TIPO_MIME[entrada.formato], ancho: cabecera.ancho, alto: cabecera.alto,
  })

  for (const entrada of CATALOGO_MARCA) {
    if (presentes.has(entrada.fichero)) {
      const ruta = join(carpeta, entrada.fichero)
      let bytes = null
      try {
        bytes = readFileSync(ruta)
      } catch (error) {
        const codigo = error && typeof error === 'object' && 'code' in error ? error.code : ''
        errores.push(`${entrada.fichero}: no se puede leer (${codigo || (error instanceof Error ? error.message : error)}). ` +
          'Tiene que poder leerlo el usuario del contenedor: chmod 644 (o «install -m 644» al copiarlo).')
      }
      const cabecera = bytes && comprobar(entrada, bytes, errores, avisos)
      if (cabecera) { ficheros[entrada.clave] = deCarpeta(carpeta, entrada, 'instalacion', bytes, cabecera); continue }
    } else if (usarInstalacion && existsSync(carpeta)) {
      avisos.push(entrada.partida
        ? `Falta ${entrada.fichero}, para ${entrada.para}: se usa el de la marca de partida.`
        : `Falta ${entrada.fichero}, para ${entrada.para}: ${entrada.siFalta}.`)
    }
    if (!entrada.partida) { ficheros[entrada.clave] = null; continue }
    const ruta = join(partida, entrada.fichero)
    const bytes = readFileSync(ruta)
    const cabecera = leerCabeceraImagen(bytes)
    if (!cabecera) throw new Error(`La marca de partida está rota: ${ruta} no es una imagen.`)
    ficheros[entrada.clave] = deCarpeta(partida, entrada, 'partida', bytes, cabecera)
  }

  return { ficheros, errores, avisos }
}

/**
 * La marca de la instalación (ver `rutaDeMarca`), ya resuelta. Si algo no
 * sirve, lanza un error que lo dice todo; los avisos van a la consola.
 */
export function leerMarca(entorno = process.env) {
  const carpeta = rutaDeMarca(entorno)
  const { ficheros, errores, avisos } = resolverMarca({ carpeta })
  if (errores.length) {
    const cuantos = errores.length === 1 ? 'un fichero que no sirve' : `${errores.length} ficheros que no sirven`
    throw new Error(`La marca (${carpeta}) tiene ${cuantos}:\n${errores.map((e) => `  - ${e}`).join('\n')}`)
  }
  for (const aviso of avisos) console.warn(`[marca] ${aviso}`)
  return ficheros
}
