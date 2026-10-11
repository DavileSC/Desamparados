// El módulo `@instalacion/datos-entidad.json` de la web: los datos de la
// corporación de esta instalación, ya validados y con los opcionales rellenos
// (shared/datos-entidad.mjs). Se entrega como módulo virtual y no como alias
// al fichero: un JSON importado tal cual no pasaría por el validador, y un
// «El» con mayúscula o un dato que falta compilaría y dejaría frases rotas.
//
// Lo usan vite.config.ts y vitest.config.ts (en las pruebas, el ejemplo).

import { leerDatosEntidad, rutaDeDatosEntidad } from '../../shared/datos-entidad.mjs'

const NOMBRE = '@instalacion/datos-entidad.json'
const VIRTUAL = '\0instalacion-datos-entidad'

export function datosDeLaInstalacion() {
  return {
    name: 'datos-de-la-instalacion',
    resolveId: (id) => (id === NOMBRE ? VIRTUAL : null),
    load(id) {
      if (id !== VIRTUAL) return null
      // Que Vite recargue al guardar el fichero, como con un import normal.
      this.addWatchFile(rutaDeDatosEntidad())
      return `export default ${JSON.stringify(leerDatosEntidad())}`
    },
  }
}
