// El módulo que entrega scripts/instalacion-vite.mjs: los datos de la
// corporación de esta instalación, ya validados (shared/datos-entidad.mjs).
declare module '@instalacion/datos-entidad.json' {
  const datos: import('../../shared/datos-entidad.mjs').DatosEntidad
  export default datos
}
