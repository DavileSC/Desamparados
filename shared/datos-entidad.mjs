// Dónde están los datos de la corporación de ESTA instalación, para todo lo que
// los lee en Node: la API, la siembra, los guiones de la web y la configuración
// de Vite y el arranque del contenedor de la web. La web, en el navegador, los
// recibe en `window.__INSTALACION__` (/instalacion.js), que escribe con esta
// misma función desamparados-web/scripts/instalacion-web.mjs.
//
// El fichero de cada instalación vive fuera de git (instalacion/, junto al
// .env): si estuviera versionado, un «git pull» chocaría con los datos de cada
// cliente y `docker/actualizar.sh` no podría actualizar ninguna copia que no
// fuera la de Desamparados.
//
// Sin él se falla, y no se cae en el ejemplo: un servidor que arrancara con la
// corporación inventada mandaría correos y PDF con su nombre sin que nadie lo
// notara hasta verlos. Solo las pruebas usan el ejemplo sin pedirlo, porque así
// vigilan además que nada dependa de una corporación concreta.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// Lo importa también el arranque del contenedor de nginx: docker/web.Dockerfile
// tiene que copiar este módulo junto a datos-entidad.mjs.
import { avisosDeMarca } from './colores-de-marca.mjs'
import { unirTitulares } from './titulares.mjs'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

export const RUTA_INSTALACION = 'instalacion/datos-entidad.json'
export const RUTA_EJEMPLO = 'shared/datos-entidad.ejemplo.json'

// NODE_TEST_CONTEXT lo pone el ejecutor de pruebas de Node (el del backend) en
// cada fichero de prueba; VITEST, Vitest.
const enPruebas = (entorno) => Boolean(entorno.NODE_TEST_CONTEXT || entorno.VITEST)

/**
 * La ruta absoluta del fichero que toca: el de `DATOS_ENTIDAD` si se da
 * (relativa a la raíz del repositorio), el ejemplo en las pruebas y, si no,
 * el de la instalación. Lanza un error que dice qué hacer si no existe.
 */
export function rutaDeDatosEntidad(entorno = process.env) {
  const pedida = entorno.DATOS_ENTIDAD?.trim()
  const ruta = resolve(raiz, pedida || (enPruebas(entorno) ? RUTA_EJEMPLO : RUTA_INSTALACION))
  if (!existsSync(ruta)) {
    throw new Error(
      pedida
        ? `DATOS_ENTIDAD apunta a ${ruta}, que no existe.`
        : `Falta ${RUTA_INSTALACION}: los datos de la corporación de esta instalación. ` +
          `Cópialo de ${RUTA_EJEMPLO} y rellénalo (docs/despliegue.md, «Los datos de la corporación»).`,
    )
  }
  return ruta
}

/**
 * El texto de un fichero de datos, sin la marca BOM del principio. PowerShell
 * (`>` y `Out-File -Encoding utf8` en la 5.1) y el Bloc de notas la ponen al
 * guardar en Windows, y JSON.parse no la acepta: el 08-10-2026 llegó así al
 * servidor y la API no habría arrancado. Vite ya la quita al importar el JSON.
 */
export const sinBom = (texto) => (texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto)

/**
 * El contenido del fichero de la instalación (ver `rutaDeDatosEntidad`), ya
 * validado y con los opcionales rellenos. Si algo está mal, lanza un error que
 * los dice todos, para corregirlos de una vez.
 */
export function leerDatosEntidad(entorno = process.env) {
  const ruta = rutaDeDatosEntidad(entorno)
  let crudo
  try {
    crudo = JSON.parse(sinBom(readFileSync(ruta, 'utf8')))
  } catch (error) {
    throw new Error(`${ruta} no es un JSON válido: ${error instanceof Error ? error.message : error}`)
  }
  const { datos, errores, avisos } = validarDatosEntidad(crudo)
  if (errores.length) {
    const cuantos = errores.length === 1 ? 'un dato mal puesto' : `${errores.length} datos mal puestos`
    throw new Error(`${ruta} tiene ${cuantos}:\n${errores.map((e) => `  - ${e}`).join('\n')}`)
  }
  for (const aviso of avisos) console.warn(`[datos-entidad] ${aviso}`)
  return datos
}

// ---------------------------------------------------------------------------
//  La forma del fichero
// ---------------------------------------------------------------------------
//
// Validado a mano y no con arktype, que es lo que usa el resto del proyecto:
// desde shared/ no se llega a los node_modules de ningún lado (las
// importaciones ESM no miran NODE_PATH), y este módulo lo cargan la API, los
// guiones de la web y el arranque del contenedor de nginx, que no tiene
// dependencias. Un dato mal puesto (un «El» con mayúscula, un dominio sin
// «www.») compilaba y dejaba frases rotas en producción; ahora no arranca.

export const ARTICULOS = ['el', 'la', 'los', 'las']
export const REDES = ['facebook', 'instagram', 'x', 'tiktok', 'youtube']
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DOMINIO = /^www\.[a-z0-9-]+(\.[a-z0-9-]+)+$/
const URL_HTTPS = /^https:\/\/\S+$/
const COLOR = /^#[0-9a-f]{6}$/i
const GRUPOS = ['identidad', 'marca', 'secretaria', 'sede', 'redes', 'privacidad', 'modulos']

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Comprueba el fichero de una instalación. Devuelve los datos con los
 * opcionales rellenos (`null`: «pendiente de confirmar»), los errores (que
 * impiden arrancar) y los avisos (que no). Los `_comentario` se ignoran;
 * cualquier otra clave desconocida es un error, porque casi siempre es una
 * errata («artículo», «nombre_corto») que deja el dato bueno sin poner.
 */
export function validarDatosEntidad(crudo) {
  const errores = []
  const avisos = []

  /** Un grupo: tiene que ser un objeto y no traer claves de más. */
  const grupo = (ruta, valor, claves, { puedeFaltar = false } = {}) => {
    if (valor === undefined && puedeFaltar) return {}
    if (!esObjeto(valor)) { errores.push(`${ruta}: falta, o no es un objeto { … }.`); return {} }
    for (const clave of Object.keys(valor)) {
      if (clave !== '_comentario' && !claves.includes(clave)) {
        errores.push(`${ruta}.${clave}: no es un dato conocido (los de «${ruta}» son ${claves.join(', ')}).`)
      }
    }
    return valor
  }
  /** Un texto obligatorio y no vacío. */
  const texto = (ruta, v, patron, explicacion) => {
    if (typeof v !== 'string' || v.trim() === '') { errores.push(`${ruta}: falta, o está vacío.`); return '' }
    if (patron && !patron.test(v.trim())) errores.push(`${ruta}: ${explicacion} (está puesto «${v}»).`)
    return v.trim()
  }
  /** Un texto que puede faltar o ir a null. Vacío cuenta como null. */
  const opcional = (ruta, v, patron, explicacion) => {
    if (v === undefined || v === null) return null
    if (typeof v !== 'string') { errores.push(`${ruta}: tiene que ser un texto o null.`); return null }
    if (v.trim() === '') return null
    if (patron && !patron.test(v.trim())) errores.push(`${ruta}: ${explicacion} (está puesto «${v}»).`)
    return v.trim()
  }

  if (!esObjeto(crudo)) return { datos: null, errores: ['El fichero tiene que ser un objeto JSON { … }.'], avisos }
  for (const clave of Object.keys(crudo)) {
    if (clave === 'escudoUrl') {
      avisos.push('escudoUrl ya no se usa y se puede quitar: el escudo es un fichero, instalacion/marca/escudo-sobre-oscuro.png ' +
        '(y escudo-sobre-claro.png y escudo-destacado.png para correos y PDF). Ver docs/despliegue.md, «La marca».')
    }
    else if (clave !== '_comentario' && !GRUPOS.includes(clave)) errores.push(`${clave}: no es un dato conocido (los del fichero son ${GRUPOS.join(', ')}).`)
  }

  const i = grupo('identidad', crudo.identidad, [
    'nombre', 'nombreCorto', 'tipo', 'tipoCorto', 'articulo', 'titular', 'titulares', 'localidad', 'dominio', 'descripcion',
    'denominacion', 'domicilio', 'normas',
  ])
  // Uno («titular», como el fichero de siempre) o varios («titulares», una
  // lista en orden, el principal primero); no los dos, que no se sabría cuál vale.
  let titulares = []
  if (i.titular !== undefined && i.titulares !== undefined) {
    errores.push('identidad: lleva «titular» y «titulares»; deja solo uno (con varios, «titulares»: ["…", "…"]).')
  } else if (i.titulares !== undefined) {
    if (!Array.isArray(i.titulares) || i.titulares.length === 0) {
      errores.push('identidad.titulares: tiene que ser una lista con al menos uno, como ["Nuestro Padre Jesús…", "María Santísima…"].')
    } else {
      titulares = i.titulares.map((t, n) => texto(`identidad.titulares[${n}]`, t))
    }
  } else {
    titulares = [texto('identidad.titular', i.titular)]
  }
  const articulo = texto('identidad.articulo', i.articulo)
  if (articulo && !ARTICULOS.includes(articulo)) {
    errores.push(`identidad.articulo: tiene que ser el, la, los o las, en minúscula (está puesto «${articulo}»).`)
  }
  let normas = null
  if (i.normas !== undefined && i.normas !== null) {
    const n = grupo('identidad.normas', i.normas, ['titulo', 'url'])
    normas = {
      titulo: texto('identidad.normas.titulo', n.titulo),
      url: texto('identidad.normas.url', n.url, URL_HTTPS, 'tiene que ser una dirección https://'),
    }
  }
  const identidad = {
    nombre: texto('identidad.nombre', i.nombre),
    nombreCorto: texto('identidad.nombreCorto', i.nombreCorto),
    tipo: texto('identidad.tipo', i.tipo),
    tipoCorto: texto('identidad.tipoCorto', i.tipoCorto),
    articulo,
    titulares,
    titular: unirTitulares(titulares),
    localidad: texto('identidad.localidad', i.localidad),
    dominio: texto('identidad.dominio', i.dominio, DOMINIO, 'tiene que ser del tipo www.ejemplo.com, sin https:// ni barra al final'),
    descripcion: texto('identidad.descripcion', i.descripcion),
    denominacion: opcional('identidad.denominacion', i.denominacion),
    domicilio: opcional('identidad.domicilio', i.domicilio),
    normas,
  }

  const m = grupo('marca', crudo.marca, ['colorPrincipal', 'colorAcento'], { puedeFaltar: true })
  // En minúsculas: así se comparan con los de partida y salen igual en el CSS.
  const color = (ruta, v) => opcional(ruta, v, COLOR, 'tiene que ser un color #rrggbb, como #6e1822 (sin nombres ni la forma corta #abc)')?.toLowerCase() ?? null
  const marca = {
    colorPrincipal: color('marca.colorPrincipal', m.colorPrincipal),
    colorAcento: color('marca.colorAcento', m.colorAcento),
  }
  // Un color que no da el contraste no impide arrancar: la paleta lo corrige
  // (shared/colores-de-marca.mjs) y aquí se dice con qué cifra y por cuál.
  if (!errores.some((e) => e.startsWith('marca.'))) avisos.push(...avisosDeMarca(marca))

  const se = grupo('secretaria', crudo.secretaria, ['horario', 'telefono', 'email'])
  const sd = grupo('sede', crudo.sede, ['nombre', 'calle', 'codigoPostal', 'localidad'])
  const r = grupo('redes', crudo.redes, REDES, { puedeFaltar: true })
  const p = grupo('privacidad', crudo.privacidad, ['emailDerechos'], { puedeFaltar: true })
  const secretaria = {
    horario: opcional('secretaria.horario', se.horario),
    telefono: opcional('secretaria.telefono', se.telefono),
    email: opcional('secretaria.email', se.email, CORREO, 'no parece un correo'),
  }
  const sede = {
    nombre: opcional('sede.nombre', sd.nombre),
    calle: opcional('sede.calle', sd.calle),
    codigoPostal: opcional('sede.codigoPostal', sd.codigoPostal),
    localidad: opcional('sede.localidad', sd.localidad),
  }
  const redes = Object.fromEntries(REDES.map((red) => [red, opcional(`redes.${red}`, r[red], URL_HTTPS, 'tiene que ser una dirección https://')]))
  const privacidad = { emailDerechos: opcional('privacidad.emailDerechos', p.emailDerechos, CORREO, 'no parece un correo') }

  const mo = grupo('modulos', crudo.modulos, ['activos'])
  let activos = []
  if (!Array.isArray(mo.activos) || mo.activos.some((c) => typeof c !== 'string')) {
    errores.push('modulos.activos: tiene que ser una lista de claves de módulo, como ["noticias", "agenda"].')
  } else {
    activos = mo.activos
    // Un aviso y no un error: un módulo que se quitó del catálogo no debe
    // impedir arrancar a una instalación vieja; la siembra lo ignora.
    // Las de instalación (`deInstalacion`, como «paginas-propias») también valen:
    // no se cambian desde el CMS, pero se encienden justo aquí.
    const { modulos, deInstalacion = [] } = JSON.parse(readFileSync(join(raiz, 'shared/modulos.json'), 'utf8'))
    const catalogo = new Set([...modulos, ...deInstalacion].map((m) => m.clave))
    const desconocidos = activos.filter((c) => !catalogo.has(c))
    if (desconocidos.length) avisos.push(`modulos.activos: ${desconocidos.join(', ')} no ${desconocidos.length === 1 ? 'es un módulo' : 'son módulos'} del catálogo (shared/modulos.json); se ignora.`)
  }

  return { datos: { identidad, marca, secretaria, sede, redes, privacidad, modulos: { activos } }, errores, avisos }
}
