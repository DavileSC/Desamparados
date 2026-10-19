import { IMPRENTA } from '../../../../theme/marca'

/**
 * Los colores y letras de la carta, los mismos que pinta el correo
 * (backend `services/correos/plantilla.ts`, `COLORES`). El editor escribe
 * sobre la hoja tal como llega: si aquí cambia algo, cambia allí también.
 * La hoja es blanca también con el CMS en oscuro: es el papel del correo.
 */
export const HOJA = {
  negro: '#141111',
  fondo: '#eeeae7',
  acento: IMPRENTA.acentoCorreo,
  papel: '#ffffff',
  panel: '#f5f2f0',
  linea: '#ddd5d0',
  texto: '#1f1a19',
  suave: '#5c5452',
  serif: "Georgia, 'Times New Roman', Times, serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const
