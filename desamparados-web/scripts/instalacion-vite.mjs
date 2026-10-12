// Los datos de la corporación en `npm run dev`, como los deja el contenedor de
// la web al arrancar (scripts/instalacion-web.mjs, con las mismas funciones):
// index.html con sus marcas rellenas y /instalacion.js, /manifest.json,
// /robots.txt y las imágenes de /marca/ servidos al vuelo. Y las fotos de
// /images/ (instalacion/imagenes/) y el mapa del barrio, /mapas/barrio.json
// (instalacion/mapas/), como los `alias` de nginx. No se escribe nada en la
// carpeta de la web, que así no lleva datos de nadie.
//
// Solo al servir (apply: 'serve', que incluye `vite preview`): `vite build`
// deja las marcas sin rellenar, para que una misma web compilada sirva a
// cualquier corporación. En el preview, el index.html de dist/ se rellena al
// servirlo, como hace el contenedor al arrancar.
//
// Lo usa vite.config.ts; las pruebas no (src/test/setup.ts pone los datos).

import { readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { leerDatosEntidad, rutaDeDatosEntidad } from '../../shared/datos-entidad.mjs'
import { rutaDeMarca } from '../../shared/marca.mjs'
import { instalacionJs, leerMarcaDe, manifest, rellenarIndex, robots } from './instalacion-web.mjs'

const FICHEROS = {
  '/instalacion.js': ['text/javascript; charset=utf-8', instalacionJs],
  '/manifest.json': ['application/manifest+json; charset=utf-8', manifest],
  '/robots.txt': ['text/plain; charset=utf-8', robots],
}

/**
 * Las fotos de la instalación (fuera de git y de la imagen de Docker), que la
 * web pide en /images/. En producción las sirve nginx con un `alias` al
 * montaje (docker/nginx/ubicaciones.conf).
 */
// Sin `new URL(…, import.meta.url)`: en las pruebas (jsdom) URL es la del
// navegador y no da una URL file: que fileURLToPath acepte.
export const CARPETA_IMAGENES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'instalacion', 'imagenes')

/** Las que se sirven, con su tipo: otra cosa en la carpeta es un 404, como un fichero que no está. */
const TIPOS_DE_IMAGEN = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
}

/**
 * El fichero de `carpeta` que pide la ruta (lo de después de /images/), o null.
 * Sin salir de la carpeta: «..» o una barra invertida no casan, y se comprueba
 * además el camino ya resuelto. Leído en cada petición: una foto que se añade
 * se ve al recargar, sin reiniciar Vite. Sin la carpeta, null (404), y la web
 * pinta su fondo donde iba la foto.
 */
export function imagenDeLaInstalacion(ruta, carpeta = CARPETA_IMAGENES) {
  let relativa
  try {
    relativa = decodeURIComponent(ruta)
  } catch {
    return null
  }
  if (!/^(?:[\w-]+\/)*[\w.-]+$/.test(relativa) || relativa.split('/').some((t) => t.startsWith('.'))) return null
  const tipo = TIPOS_DE_IMAGEN[extname(relativa).toLowerCase()]
  const fichero = resolve(carpeta, relativa)
  if (!tipo || !fichero.startsWith(resolve(carpeta) + sep)) return null
  try {
    if (!statSync(fichero).isFile()) return null
    return { tipo, contenido: readFileSync(fichero) }
  } catch {
    return null
  }
}

/**
 * El mapa del barrio de la instalación (components/mapa/barrio.ts). Solo ese
 * fichero: las fuentes del mapa (/mapas/fuentes/) son genéricas y siguen en
 * public/.
 */
export const MAPA_DEL_BARRIO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'instalacion', 'mapas', 'barrio.json')

/** El mapa del barrio, o null (404) si esta instalación no lo tiene. */
export function mapaDelBarrio(fichero = MAPA_DEL_BARRIO) {
  try {
    return statSync(fichero).isFile() ? readFileSync(fichero) : null
  } catch {
    return null
  }
}

export function datosDeLaInstalacion() {
  // Validados una vez y vueltos a leer cuando cambia el fichero: leerlos en
  // cada petición repetiría los avisos del validador en cada recarga. Igual
  // la marca, que además lee y resume cada imagen.
  let datos = null
  let marca = null
  const carpetaMarca = rutaDeMarca()
  const alDia = () => {
    datos ??= leerDatosEntidad()
    marca ??= leerMarcaDe(carpetaMarca)
    return [datos, marca]
  }

  /** `escribir` da el contenido, o null para un 404. */
  const responder = (logger, res, tipo, escribir) => {
    let contenido
    try {
      contenido = escribir(...alDia())
    } catch (error) {
      // Un dato mal puesto con el servidor ya en marcha: la web enseña el
      // aviso de que faltan los datos y aquí se dice por qué.
      logger.error(`[instalacion] ${error instanceof Error ? error.message : error}`)
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(error instanceof Error ? error.message : String(error))
      return
    }
    if (contenido === null) {
      res.statusCode = 404
      res.end()
      return
    }
    res.setHeader('Content-Type', tipo)
    res.setHeader('Cache-Control', 'no-cache')
    res.end(contenido)
  }

  const servir = (logger) => (req, res, next) => {
    const ruta = req.url?.split('?')[0] ?? ''
    const fichero = FICHEROS[ruta]
    if (fichero) return responder(logger, res, ...fichero)
    if (ruta === '/mapas/barrio.json') {
      const mapa = mapaDelBarrio()
      res.statusCode = mapa ? 200 : 404
      if (mapa) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
      }
      res.end(mapa ?? undefined)
      return
    }
    if (ruta.startsWith('/images/')) {
      // Antes que el estático de Vite: public/images ya no existe, y sin esto
      // el reenvío de la SPA daría la portada con un 200 en vez de un 404.
      const imagen = imagenDeLaInstalacion(ruta.slice('/images/'.length))
      if (!imagen) {
        res.statusCode = 404
        res.end()
        return
      }
      res.setHeader('Content-Type', imagen.tipo)
      res.setHeader('Cache-Control', 'no-cache')
      res.end(imagen.contenido)
      return
    }
    if (!ruta.startsWith('/marca/')) return next()
    // Por el nombre del catálogo, no por la ruta pedida: así no se puede salir
    // de la carpeta con «..», y un nombre que no es de la marca da 404.
    const nombre = ruta.slice('/marca/'.length)
    const tipo = nombre.endsWith('.png') ? 'image/png' : 'image/jpeg'
    responder(logger, res, tipo, (_, ficheros) => {
      const imagen = Object.values(ficheros).find((f) => f?.fichero === nombre)
      return imagen ? readFileSync(imagen.ruta) : null
    })
  }

  // El index.html de dist/ conserva las marcas: sin esto, `vite preview`
  // enseñaba {{nombre}} en el título y en la vista previa de los enlaces.
  const servirIndex = (server) => {
    const index = resolve(server.config.root, server.config.build.outDir, 'index.html')
    return (req, res, next) => {
      const ruta = req.url?.split('?')[0]
      if (!['GET', 'HEAD'].includes(req.method ?? '') || (ruta !== '/' && ruta !== '/index.html')) return next()
      responder(server.config.logger, res, 'text/html; charset=utf-8', (d, m) => rellenarIndex(readFileSync(index, 'utf8'), d, m))
    }
  }

  return {
    name: 'datos-de-la-instalacion',
    apply: 'serve',
    // Al arrancar y no en la primera petición: con un dato mal puesto, o una
    // imagen de la marca que no sirve, Vite no arranca y dice cuál.
    configResolved() {
      alDia()
    },
    configureServer(server) {
      const ruta = rutaDeDatosEntidad()
      // Fuera de la carpeta de la web: Vite no lo vigila si no se le pide.
      // La carpeta de la marca, aunque aún no exista: al crearla, se ve.
      server.watcher.add(ruta)
      if (carpetaMarca) server.watcher.add(carpetaMarca)
      const enMarca = (cambiado) => carpetaMarca !== null && (resolve(cambiado) === carpetaMarca || resolve(cambiado).startsWith(carpetaMarca + sep))
      // También al borrarlo o al volver a crearlo: un editor que guarda
      // escribiendo uno nuevo y renombrándolo no siempre da «change». Con la
      // marca, recarga entera: las URL llevan la versión nueva en `?v=`.
      server.watcher.on('all', (evento, cambiado) => {
        if (!['add', 'change', 'unlink', 'addDir', 'unlinkDir'].includes(evento)) return
        if (resolve(cambiado) === ruta) datos = null
        else if (enMarca(cambiado)) marca = null
        else return
        server.ws.send({ type: 'full-reload' })
      })
      // Sin devolver función: va antes que los de Vite, que si no darían la
      // página de inicio para /manifest.json, /robots.txt o /marca/….
      server.middlewares.use(servir(server.config.logger))
    },
    configurePreviewServer(server) {
      server.middlewares.use(servir(server.config.logger))
      // Dos veces: antes que Vite, para «/» y «/index.html», que si no los
      // sirve tal cual el estático de dist/; y al final (la función devuelta),
      // para las rutas de la SPA, que el fallback de Vite ya ha reescrito a
      // /index.html. Antes que Vite no puede ir con ellas: aún no ha pasado el
      // proxy y una ruta sin extensión puede ser de /api.
      server.middlewares.use(servirIndex(server))
      return () => server.middlewares.use(servirIndex(server))
    },
    transformIndexHtml: {
      // Antes que Vite: si no, intentaría resolver el og:image con la marca.
      order: 'pre',
      handler: (html) => rellenarIndex(html, ...alDia()),
    },
  }
}
