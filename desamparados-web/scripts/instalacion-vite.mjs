// Los datos de la corporación en `npm run dev`, como los deja el contenedor de
// la web al arrancar (scripts/instalacion-web.mjs, con las mismas funciones):
// index.html con sus marcas rellenas y /instalacion.js, /manifest.json y
// /robots.txt servidos al vuelo. No se escribe nada en la carpeta de la web,
// que así no lleva datos de nadie.
//
// Solo al servir (apply: 'serve', que incluye `vite preview`): `vite build`
// deja las marcas sin rellenar, para que una misma web compilada sirva a
// cualquier corporación. En el preview, el index.html de dist/ se rellena al
// servirlo, como hace el contenedor al arrancar.
//
// Lo usa vite.config.ts; las pruebas no (src/test/setup.ts pone los datos).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { leerDatosEntidad, rutaDeDatosEntidad } from '../../shared/datos-entidad.mjs'
import { instalacionJs, manifest, rellenarIndex, robots } from './instalacion-web.mjs'

const FICHEROS = {
  '/instalacion.js': ['text/javascript; charset=utf-8', instalacionJs],
  '/manifest.json': ['application/manifest+json; charset=utf-8', manifest],
  '/robots.txt': ['text/plain; charset=utf-8', robots],
}

export function datosDeLaInstalacion() {
  // Validados una vez y vueltos a leer cuando cambia el fichero: leerlos en
  // cada petición repetiría los avisos del validador en cada recarga.
  let datos = null
  const alDia = () => (datos ??= leerDatosEntidad())

  const responder = (logger, res, tipo, escribir) => {
    let contenido
    try {
      contenido = escribir(alDia())
    } catch (error) {
      // Un dato mal puesto con el servidor ya en marcha: la web enseña el
      // aviso de que faltan los datos y aquí se dice por qué.
      logger.error(`[instalacion] ${error instanceof Error ? error.message : error}`)
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(error instanceof Error ? error.message : String(error))
      return
    }
    res.setHeader('Content-Type', tipo)
    res.setHeader('Cache-Control', 'no-cache')
    res.end(contenido)
  }

  const servir = (logger) => (req, res, next) => {
    const fichero = FICHEROS[req.url?.split('?')[0] ?? '']
    if (!fichero) return next()
    responder(logger, res, ...fichero)
  }

  // El index.html de dist/ conserva las marcas: sin esto, `vite preview`
  // enseñaba {{nombre}} en el título y en la vista previa de los enlaces.
  const servirIndex = (server) => {
    const index = resolve(server.config.root, server.config.build.outDir, 'index.html')
    return (req, res, next) => {
      const ruta = req.url?.split('?')[0]
      if (!['GET', 'HEAD'].includes(req.method ?? '') || (ruta !== '/' && ruta !== '/index.html')) return next()
      responder(server.config.logger, res, 'text/html; charset=utf-8', (datos) => rellenarIndex(readFileSync(index, 'utf8'), datos))
    }
  }

  return {
    name: 'datos-de-la-instalacion',
    apply: 'serve',
    // Al arrancar y no en la primera petición: con un dato mal puesto, Vite no
    // arranca y dice cuál.
    configResolved() {
      alDia()
    },
    configureServer(server) {
      const ruta = rutaDeDatosEntidad()
      // Fuera de la carpeta de la web: Vite no lo vigila si no se le pide.
      server.watcher.add(ruta)
      // También al borrarlo o al volver a crearlo: un editor que guarda
      // escribiendo uno nuevo y renombrándolo no siempre da «change».
      server.watcher.on('all', (evento, cambiado) => {
        if (!['add', 'change', 'unlink'].includes(evento) || resolve(cambiado) !== ruta) return
        datos = null
        server.ws.send({ type: 'full-reload' })
      })
      // Sin devolver función: va antes que los de Vite, que si no darían la
      // página de inicio para /manifest.json y /robots.txt.
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
      handler: (html) => rellenarIndex(html, alDia()),
    },
  }
}
