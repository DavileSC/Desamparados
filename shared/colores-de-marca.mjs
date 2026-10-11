// Los colores de la marca de cada corporación, derivados de los dos que pone su
// fichero de datos (`marca.colorPrincipal` y `marca.colorAcento`).
//
// Por qué una paleta entera y no dos colores: la web usa una docena de tonos de
// cada familia (el relleno de los botones, su hover, el mismo tono aclarado
// para escribir sobre el fondo oscuro, el de las gráficas…), y cada uno tiene
// un papel con su propio suelo de contraste. Si la instalación diera solo los
// dos colores y la web los usara tal cual, un burdeos claro dejaría los botones
// ilegibles con letra blanca y un oro oscuro, los enlaces invisibles en la barra.
//
// La regla:
//   1. Con null, o con el color de partida (#6e1822 / #dec72b), cada papel es
//      EXACTAMENTE el hex de hoy: Desamparados no cambia ni un píxel.
//   2. Con otro color, cada papel toma el tono (hue) del color dado, la
//      luminosidad de su papel en la paleta de partida y una saturación
//      proporcional; y si así no cumple su suelo de contraste, se oscurece o
//      aclara (por bisección en OKLCH) lo justo hasta cumplirlo.
//   3. El papel base de cada familia (`principal`, `acento`) usa el color dado
//      tal cual si cumple; si no, se corrige igual y `avisosDeMarca` lo dice.
//
// Puro y sin `node:`: lo importan el navegador (theme/marca.ts), la API (PDF y
// correos) y los guiones de Node. Los PDF y los correos tienen su propia
// paleta (`paletaDeImprenta`) porque el papel es blanco y los tonos de pantalla
// no sirven allí.

// ---------------------------------------------------------------------------
//  Contraste WCAG
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i

/** El color en minúsculas si es un `#rrggbb`; si no, null. */
const normalizar = (color) => (typeof color === 'string' && HEX.test(color.trim()) ? color.trim().toLowerCase() : null)

const canales = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

const lineal = (c8) => {
  const c = c8 / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Luminancia relativa de WCAG 2 (0 el negro, 1 el blanco). */
export function luminancia(hex) {
  const [r, g, b] = canales(hex).map(lineal)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste de WCAG 2 entre dos colores, de 1 a 21, sin redondear. */
export function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/**
 * La cifra como la escriben los avisos: «2,1». Truncada y no redondeada, para
 * que un 4,47 no salga «4,5» en un aviso que dice que no llega a 4,5.
 */
export const cifraDeContraste = (n) => (Math.floor(n * 10) / 10).toFixed(1).replace('.', ',')

/** `rgba(r, g, b, a)` de un hex: sustituye a los `rgba(110, 24, 34, …)` escritos a mano. */
export function alfa(hex, a) {
  return `rgba(${componentes(hex)}, ${a})`
}

/** «r, g, b» de un hex, para los sitios que componen el `rgba()` ellos mismos. */
export function componentes(hex) {
  return canales(hex).join(', ')
}

// ---------------------------------------------------------------------------
//  OKLCH (Björn Ottosson), ida y vuelta, con ajuste a sRGB
// ---------------------------------------------------------------------------
//
// OKLCH y no HSL: en HSL un amarillo y un azul con la misma «luminosidad»
// tienen contrastes muy distintos, y la luminosidad de un papel no se
// conservaría al cambiar de tono. En OKLCH la L se parece a la que ve el ojo.

const aOklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const desdeOklab = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** `{ l, c, h }` de un hex: l de 0 a 1, c desde 0, h en grados. */
export function aOklch(hex) {
  const [L, a, b] = aOklab(canales(hex).map(lineal))
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return { l: L, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h }
}

const linealASrgb8 = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

const rgbLineal = ({ l, c, h }) => {
  const rad = (h * Math.PI) / 180
  return desdeOklab([l, c * Math.cos(rad), c * Math.sin(rad)])
}

const dentroDeSrgb = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/**
 * El hex de un `{ l, c, h }`. Si cae fuera de sRGB, baja la saturación (no la
 * luminosidad ni el tono) hasta que entra: así un papel conserva el contraste
 * que se le buscó, que depende sobre todo de la luminosidad.
 */
export function desdeOklch({ l, c, h }) {
  const L = Math.min(1, Math.max(0, l))
  let C = Math.max(0, c)
  if (!dentroDeSrgb(rgbLineal({ l: L, c: C, h }))) {
    let bajo = 0
    let alto = C
    for (let i = 0; i < 30; i++) {
      const medio = (bajo + alto) / 2
      if (dentroDeSrgb(rgbLineal({ l: L, c: medio, h }))) bajo = medio
      else alto = medio
    }
    C = bajo
  }
  return '#' + rgbLineal({ l: L, c: C, h }).map(linealASrgb8).map((v) => v.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
//  Los papeles
// ---------------------------------------------------------------------------

/** Los colores de partida: el burdeos y el oro de Desamparados. */
export const PARTIDA = Object.freeze({ colorPrincipal: '#6e1822', colorAcento: '#dec72b' })

/**
 * Los fondos contra los que se mide cada papel: los de verdad de la web, el
 * CMS y el papel. Son neutros y no cambian con la marca.
 */
export const FONDOS = Object.freeze({
  blanco: '#ffffff',
  /** El fondo de la web pública (notas-del-proyecto §11). */
  publico: '#262326',
  /** `palette.background` de la web y el lienzo del CMS oscuro. */
  profundo: '#121113',
  /** La tarjeta del CMS oscuro y la tinta de la portada. */
  tarjetaCms: '#0c0b0d',
  /** El fondo de los mapas. */
  mapa: '#0b0a0c',
  /** El fondo de los carteles de culto. */
  cartel: '#120f11',
  /** El lienzo del CMS claro. */
  lienzoCms: '#f4f2ee',
  /** El rosa viejo de los días solemnes del calendario. */
  solemne: '#ead9d0',
  /** La crema de las piezas apadrinadas. */
  crema: '#f3ebdc',
  /** El velo de las piezas sin apadrinar (`rgba(20, 17, 17, .72)` sobre la foto, a lo peor). */
  velo: '#141111',
  /** El negro de los PDF (`NEGRO` de informes/pdf.ts). */
  negroImprenta: '#161214',
  /** El marfil de los PDF. */
  marfil: '#f4efe5',
})

// Cada papel: su familia, su hex de partida y sus suelos de contraste, como
// [fondo, mínimo]. El fondo es un hex o el nombre de otro papel YA calculado
// (va antes en la tabla), para los textos que se escriben encima de un relleno
// de la marca. `relativo: true` hace que la luminosidad no sea la de partida
// sino la del papel base corrida lo mismo que en la partida: un hover es «un
// escalón más oscuro que el botón», sea cual sea el botón.

/** @type {Record<string, { familia: 'principal' | 'acento', partida: string, suelos?: [string, number][], relativo?: boolean }>} */
const PAPELES_WEB = {
  // --- Familia del color principal (el burdeos) ---
  principal: { familia: 'principal', partida: '#6e1822', suelos: [[FONDOS.blanco, 4.5], [FONDOS.lienzoCms, 4.5]] },
  principalHover: { familia: 'principal', partida: '#5a131c', relativo: true, suelos: [[FONDOS.blanco, 4.5]] },
  principalRealce: { familia: 'principal', partida: '#7a1c27', relativo: true, suelos: [[FONDOS.blanco, 4.5]] },
  principalMedio: { familia: 'principal', partida: '#a03d44', suelos: [[FONDOS.blanco, 4.5]] },
  principalOscuro: { familia: 'principal', partida: '#81262e', suelos: [[FONDOS.blanco, 4.5]] },
  principalVivo: { familia: 'principal', partida: '#a3303f' },
  principalPieza: { familia: 'principal', partida: '#6e1a20', suelos: [[FONDOS.crema, 4.5]] },
  principalProfundo: { familia: 'principal', partida: '#5a1620' },
  principalSombra: { familia: 'principal', partida: '#2a0a0f' },
  principalTostado: { familia: 'principal', partida: '#2a1216' },
  principalNoche: { familia: 'principal', partida: '#1d0a0e' },
  principalTinta: { familia: 'principal', partida: '#3a1016', suelos: [[FONDOS.solemne, 4.5]] },
  principalClaro: { familia: 'principal', partida: '#fc858a', suelos: [[FONDOS.publico, 4.5], [FONDOS.profundo, 4.5]] },
  principalPalido: { familia: 'principal', partida: '#ffb3b4', suelos: [[FONDOS.publico, 4.5], [FONDOS.tarjetaCms, 4.5]] },
  principalGrafica: { familia: 'principal', partida: '#f08a93', suelos: [[FONDOS.tarjetaCms, 3]] },
  principalLegible: { familia: 'principal', partida: '#e06a78', suelos: [[FONDOS.mapa, 4.5]] },
  principalPuntoClaro: { familia: 'principal', partida: '#b8283d', suelos: [[FONDOS.blanco, 3], [FONDOS.lienzoCms, 3]] },
  principalPuntoOscuro: { familia: 'principal', partida: '#ff9fa6', suelos: [[FONDOS.tarjetaCms, 3]] },
  sobrePrincipal: { familia: 'principal', partida: '#fbe9e7', suelos: [['principal', 4.5]] },
  sobrePrincipalSuave: { familia: 'principal', partida: '#f1d9d6', suelos: [['principal', 4.5], ['principalRealce', 4.5]] },
  sobrePrincipalTexto: { familia: 'principal', partida: '#f3dedb', suelos: [['principal', 4.5], ['principalRealce', 4.5]] },

  // --- Familia del color de acento (el oro) ---
  acento: { familia: 'acento', partida: '#dec72b', suelos: [[FONDOS.publico, 4.5], [FONDOS.profundo, 4.5]] },
  acentoMedio: { familia: 'acento', partida: '#c1ac00', suelos: [[FONDOS.publico, 4.5]] },
  acentoOscuro: { familia: 'acento', partida: '#6b5f00' },
  acentoClaro: { familia: 'acento', partida: '#fce348' },
  acentoApagado: { familia: 'acento', partida: '#c4af79', suelos: [[FONDOS.publico, 4.5]] },
  acentoArena: { familia: 'acento', partida: '#cdae72', suelos: [[FONDOS.publico, 4.5]] },
  acentoCartel: { familia: 'acento', partida: '#c9b25a', suelos: [[FONDOS.cartel, 4.5]] },
  acentoAviso: { familia: 'acento', partida: '#c9ab3c', suelos: [[FONDOS.publico, 3]] },
  acentoPieza: { familia: 'acento', partida: '#d9b36c', suelos: [[FONDOS.velo, 4.5], ['principalPieza', 3]] },
  acentoRelieve: { familia: 'acento', partida: '#8a7630' },
  acentoViejo: { familia: 'acento', partida: '#d9bf7a', suelos: [[FONDOS.tarjetaCms, 4.5], [FONDOS.profundo, 4.5]] },
  acentoViejoSobreClaro: { familia: 'acento', partida: '#8a6a1c', suelos: [[FONDOS.blanco, 4.5], [FONDOS.lienzoCms, 4.5]] },
  acentoGraficaClaro: { familia: 'acento', partida: '#b08f3e', suelos: [[FONDOS.blanco, 3]] },
  acentoGraficaOscuro: { familia: 'acento', partida: '#c8a95a', suelos: [[FONDOS.tarjetaCms, 3]] },
}

/** @type {typeof PAPELES_WEB} */
const PAPELES_IMPRENTA = {
  burdeos: { familia: 'principal', partida: '#5c1622', suelos: [[FONDOS.blanco, 4.5], [FONDOS.marfil, 4.5]] },
  burdeosVivo: { familia: 'principal', partida: '#a3303f', suelos: [[FONDOS.blanco, 3]] },
  acentoCorreo: { familia: 'principal', partida: '#6e1a20', suelos: [[FONDOS.blanco, 4.5]] },
  oro: { familia: 'acento', partida: '#b08d52' },
  oroClaro: { familia: 'acento', partida: '#cdae72', suelos: [[FONDOS.negroImprenta, 4.5]] },
  oroPalido: { familia: 'acento', partida: '#ddd0b3' },
  oroMedio: { familia: 'acento', partida: '#cbb48a' },
  oroTexto: { familia: 'acento', partida: '#8a6a30', suelos: [[FONDOS.blanco, 4.5]] },
}

/** Las tablas de papeles, para las pruebas y para quien quiera ver de dónde sale cada color. */
export const PAPELES_DE_MARCA = PAPELES_WEB
export const PAPELES_DE_IMPRENTA = PAPELES_IMPRENTA

const BASE = { principal: 'principal', acento: 'acento' }
const CLAVE_DATO = { principal: 'colorPrincipal', acento: 'colorAcento' }

/**
 * Por encima de esta luminancia un fondo es «claro»: el contraste con el negro
 * y con el blanco es el mismo en ~0,179. Contra un fondo claro el papel se
 * oscurece para cumplir; contra uno oscuro, se aclara.
 */
const LUMINANCIA_MEDIA = 0.179

const cumple = (hex, suelos) => suelos.every(([fondo, minimo]) => contraste(hex, fondo) >= minimo)

/**
 * Corre la luminosidad de `{ l, c, h }` hasta que cumple los suelos, sin
 * moverla más de lo necesario. La dirección la da el primer fondo; todos los de
 * un mismo papel están del mismo lado.
 */
function corregir(oklch, suelos) {
  const inicial = desdeOklch(oklch)
  if (!suelos.length || cumple(inicial, suelos)) return inicial
  const oscurecer = luminancia(suelos[0][0]) > LUMINANCIA_MEDIA
  // `bien` cumple siempre (el negro contra un fondo claro, el blanco contra
  // uno oscuro); `mal` es la luminosidad de partida, que no cumple.
  let bien = oscurecer ? 0 : 1
  let mal = oklch.l
  for (let i = 0; i < 40; i++) {
    const medio = (bien + mal) / 2
    if (cumple(desdeOklch({ ...oklch, l: medio }), suelos)) bien = medio
    else mal = medio
  }
  return desdeOklch({ ...oklch, l: bien })
}

/** Los dos colores de la marca, normalizados; null el que falte, esté mal o sea el de partida. */
function coloresDados(marca) {
  const dado = (familia) => {
    const color = normalizar(marca?.[CLAVE_DATO[familia]])
    return color && color !== PARTIDA[CLAVE_DATO[familia]] ? color : null
  }
  return { principal: dado('principal'), acento: dado('acento') }
}

function derivar(tabla, marca, base) {
  const dados = coloresDados(marca)
  const fuente = Object.fromEntries(Object.keys(dados).map((f) => [f, dados[f] && aOklch(dados[f])]))
  const partidaBase = Object.fromEntries(Object.keys(dados).map((f) => [f, aOklch(PARTIDA[CLAVE_DATO[f]])]))
  const salida = {}
  for (const [nombre, papel] of Object.entries(tabla)) {
    const color = dados[papel.familia]
    if (!color) { salida[nombre] = papel.partida; continue }
    const suelos = (papel.suelos ?? []).map(([fondo, minimo]) => [salida[fondo] ?? fondo, minimo])
    if (base && nombre === BASE[papel.familia]) {
      salida[nombre] = cumple(color, suelos) ? color : corregir(fuente[papel.familia], suelos)
      continue
    }
    const deFamilia = partidaBase[papel.familia]
    const delPapel = aOklch(papel.partida)
    const dado = fuente[papel.familia]
    // La saturación, en proporción a la del dado: un gris da una paleta gris,
    // y un color muy vivo, papeles igual de vivos.
    const c = deFamilia.c > 0 ? delPapel.c * (dado.c / deFamilia.c) : 0
    const l = papel.relativo ? aOklch(salida[BASE[papel.familia]]).l + (delPapel.l - deFamilia.l) : delPapel.l
    salida[nombre] = corregir({ l, c, h: dado.h }, suelos)
  }
  return Object.freeze(salida)
}

/**
 * Los colores de la web (pública, CMS y área de hermanos) para la marca de la
 * instalación. Con `null`, o con los colores de partida, la paleta de hoy.
 * Qué papel va dónde: colores-de-marca.d.mts.
 */
export function paletaDeMarca(marca) {
  return derivar(PAPELES_WEB, marca, true)
}

/** Los colores de los PDF y de los correos, que van sobre papel blanco. */
export function paletaDeImprenta(marca) {
  return derivar(PAPELES_IMPRENTA, marca, false)
}

/**
 * Lo que `validarDatosEntidad` avisa de los colores: el que no cumple su
 * contraste (con la cifra y el color que se usará en su lugar) y los dos casi
 * iguales. No impide arrancar: la paleta ya los corrige.
 */
export function avisosDeMarca(marca) {
  const avisos = []
  const dados = coloresDados(marca)
  const paleta = paletaDeMarca(marca)
  if (dados.principal && paleta.principal !== dados.principal) {
    avisos.push(
      `marca.colorPrincipal ${dados.principal}: con letra blanca da ${cifraDeContraste(contraste(dados.principal, FONDOS.blanco))}:1 ` +
        `(AA pide 4,5:1); los botones usarán ${paleta.principal}.`,
    )
  }
  if (dados.acento && paleta.acento !== dados.acento) {
    avisos.push(
      `marca.colorAcento ${dados.acento}: sobre el fondo oscuro de la web (${FONDOS.publico}) da ` +
        `${cifraDeContraste(contraste(dados.acento, FONDOS.publico))}:1 (AA pide 4,5:1); los enlaces, filetes y focos usarán ${paleta.acento}.`,
    )
  }
  if (dados.principal || dados.acento) {
    const principal = dados.principal ?? PARTIDA.colorPrincipal
    const acento = dados.acento ?? PARTIDA.colorAcento
    const entreEllos = contraste(principal, acento)
    if (entreEllos < 1.3) {
      avisos.push(
        `marca: colorPrincipal ${principal} y colorAcento ${acento} casi no se distinguen (${cifraDeContraste(entreEllos)}:1 entre ellos); ` +
          'el acento no destacará sobre el principal. Conviene que uno sea bastante más claro que el otro.',
      )
    }
  }
  return avisos
}
