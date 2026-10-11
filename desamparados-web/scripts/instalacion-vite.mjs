// Los datos de la corporación en `npm run dev`, como los deja el contenedor de
// la web al arrancar (scripts/instalacion-web.mjs, con las mismas funciones):
// index.html con sus marcas rellenas y /instalacion.js, /manifest.json,
// /robots.txt y las imágenes de /marca/ servidos al vuelo. No se escribe nada
// en la carpeta de la web, que así no lleva datos de nadie.
//
// Solo al servir (apply: 'serve', que incluye `vite preview`): `vite build`
// deja las marcas sin rellenar, para que una misma web compilada sirva a
// cualquier corporación. En el preview, el index.html de dist/ se rellena al
// servirlo, como hace el contenedor al arrancar.
//
// Lo usa vite.config.ts; las pruebas no (src/test/setup.ts pone los datos).

import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { leerDatosEntidad, rutaDeDatosEntidad } from '../../shared/datos-entidad.mjs'
import { rutaDeMarca } from '../../shared/marca.mjs'
import { instalacionJs, leerMarcaDe, manifest, rellenarIndex, robots } from './instalacion-web.mjs'

const FICHEROS = {
  '/instalacion.js': ['text/javascript; charset=utf-8', instalacionJs],
  '/manifest.json': ['application/manifest+json; charset=utf-8', manifest],
  '/robots.txt': ['text/plain; charset=utf-8', robots],
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
