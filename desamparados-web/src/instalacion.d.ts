// Lo que /instalacion.js deja en `window` antes de que arranque la web: la
// identidad y la marca de la corporación de esta instalación, ya validadas. Lo
// escribe scripts/instalacion-web.mjs al arrancar el contenedor (en desarrollo,
// lo sirve el plugin de Vite). Se lee solo desde src/config/instalacion.ts.
type Identidad = import('../../shared/datos-entidad.mjs').Identidad
/** Los dos colores y las URL de las imágenes de la marca (/marca/…?v=…), ya con su respaldo. */
type MarcaPublica = import('../scripts/instalacion-web.mjs').MarcaPublica

interface Instalacion {
  identidad: Identidad
  marca: MarcaPublica
}

interface Window {
  __INSTALACION__?: Instalacion
}
