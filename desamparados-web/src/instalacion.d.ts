// Lo que /instalacion.js deja en `window` antes de que arranque la web: la
// identidad y la marca de la corporación de esta instalación, ya validadas. Lo
// escribe scripts/instalacion-web.mjs al arrancar el contenedor (en desarrollo,
// lo sirve el plugin de Vite). Se lee solo desde src/config/instalacion.ts.
type Identidad = import('../../shared/datos-entidad.mjs').Identidad
type Marca = import('../../shared/datos-entidad.mjs').Marca

interface Instalacion {
  identidad: Identidad
  marca: Marca
}

interface Window {
  __INSTALACION__?: Instalacion
}
