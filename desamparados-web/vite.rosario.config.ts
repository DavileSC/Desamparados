import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

/**
 * La página suelta del Rosario en directo (src/rosario-en-directo/), servida
 * en desamparadosmalaga.com/Rosario/ mientras la web sigue en pruebas. Se
 * construye aparte de la web con `npm run rosario:construir` y sale a
 * dist-rosario/, que se copia tal cual al servidor (docs/servidor.md,
 * «Rosario en directo»).
 */

const aqui = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url))

/** Unos 400 m alrededor del recorrido: lo que cabe en pantalla al alejar el mapa. */
const MARGEN_GRADOS = 0.004

/**
 * El barrio entero pesa 1,2 MB, para el recorrido de la Pasión. Se recorta a
 * lo que rodea al del Rosario, que se abre en el móvil y en la calle.
 */
async function recortar(): Promise<string> {
  const RUTA = JSON.parse(readFileSync(aqui('src/rosario-en-directo/ruta.json'), 'utf8')) as [number, number][]
  const xs = RUTA.map((p) => p[0]), ys = RUTA.map((p) => p[1])
  const caja: [number, number, number, number] = [
    Math.min(...xs) - MARGEN_GRADOS, Math.min(...ys) - MARGEN_GRADOS,
    Math.max(...xs) + MARGEN_GRADOS, Math.max(...ys) + MARGEN_GRADOS,
  ]
  const dentro = ([x, y]: number[]) => x >= caja[0] && x <= caja[2] && y >= caja[1] && y <= caja[3]
  const puntos = (g: { type: string; coordinates: unknown }): number[][] =>
    g.type === 'LineString' ? g.coordinates as number[][] : (g.coordinates as number[][][]).flat()
  const barrio = JSON.parse(readFileSync(aqui('../instalacion/mapas/barrio.json'), 'utf8'))
  for (const capa of ['calles', 'edificios', 'verdes']) {
    barrio[capa].features = barrio[capa].features.filter((f: { geometry: { type: string; coordinates: unknown } }) => puntos(f.geometry).some(dentro))
  }
  barrio.caja = caja
  return JSON.stringify(barrio)
}

function barrioRecortado(): Plugin {
  return {
    name: 'barrio-del-rosario',
    configureServer(servidor) {
      servidor.middlewares.use('/Rosario/barrio.json', (_req, res) => {
        void recortar().then((json) => { res.setHeader('Content-Type', 'application/json'); res.end(json) })
      })
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'barrio.json', source: await recortar() })
    },
  }
}

export default defineConfig({
  root: aqui('src/rosario-en-directo'),
  base: '/Rosario/',
  // Las letras del mapa, que salen a /Rosario/fuentes/.
  publicDir: aqui('public/mapas'),
  plugins: [barrioRecortado()],
  server: {
    proxy: {
      // En local, la posición la da el backend de siempre.
      '/Rosario/posicion': { target: process.env.VITE_DEV_BACKEND_URL || 'http://localhost:3001', changeOrigin: true, rewrite: () => '/api/cortejo-directo' },
    },
  },
  build: {
    outDir: aqui('dist-rosario'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
