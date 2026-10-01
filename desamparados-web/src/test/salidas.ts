import type { Salida } from '../lib/api/salidas'

/**
 * Las dos salidas de siempre como las devuelve `GET /salidas`, con el catálogo
 * de puestos de la siembra, para las pruebas de las pantallas que trabajan con
 * una salida elegida.
 */
export const salidaPasion: Salida = {
  id: 1, slug: 'sabado-de-pasion', nombre: 'Sábado de Pasión', articulo: 'el', orden: 0, activa: true, conRopa: true,
  cobro: 'CUOTA', importeCuota: 0, fecha: 'PASCUA', diasDesdePascua: -8, horaSalida: '19:00', lugar: 'Templo parroquial',
  eventoId: null, plazoAbierto: false,
  puestos: [
    { nombre: 'Nazareno', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
    { nombre: 'Trono', tunica: true, tocado: null, alturaHombro: true },
    { nombre: 'Guardería', tunica: true, tocado: 'FARAONA', alturaHombro: false },
    { nombre: 'Viacrucis', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
    { nombre: 'Bocina', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
    { nombre: 'Diputado de tramo', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
    { nombre: 'Acólito', tunica: true, tocado: null, alturaHombro: false },
    { nombre: 'Monaguillo', tunica: true, tocado: null, alturaHombro: false },
    { nombre: 'Monaguillo guardería', tunica: true, tocado: null, alturaHombro: false },
    { nombre: 'Mayordomo guardería', tunica: true, tocado: null, alturaHombro: false },
    { nombre: 'Mantilla', tunica: false, tocado: null, alturaHombro: false },
  ],
  cortejo: null, indicaciones: null, anio: 2027, fechaDelAnio: '2027-03-20', acto: null,
}

export const salidaRosario: Salida = {
  id: 2, slug: 'rosario-vespertino', nombre: 'Rosario vespertino', articulo: 'el', orden: 1, activa: true, conRopa: false,
  cobro: 'DONATIVO', importeCuota: 0, fecha: 'MANUAL', diasDesdePascua: null, horaSalida: null, lugar: null,
  eventoId: null, plazoAbierto: false,
  puestos: [
    { nombre: 'Cruz de guía', tunica: false, tocado: null, alturaHombro: false },
    { nombre: 'Farol', tunica: false, tocado: null, alturaHombro: false },
    { nombre: 'Estandarte', tunica: false, tocado: null, alturaHombro: false },
    { nombre: 'Simpecado', tunica: false, tocado: null, alturaHombro: false },
    { nombre: 'Vela', tunica: false, tocado: null, alturaHombro: false },
    { nombre: 'Rezo de un misterio', tunica: false, tocado: null, alturaHombro: false },
    { nombre: 'Acólito', tunica: false, tocado: null, alturaHombro: false },
    { nombre: 'Trono', tunica: false, tocado: null, alturaHombro: true },
  ],
  cortejo: null, indicaciones: null, anio: 2026, fechaDelAnio: null, acto: null,
}

export const salidasDePrueba = [salidaPasion, salidaRosario]

/** La lista de salidas activas: `/api/salidas`, y no `/cms/procesion/salidas` ni otra que acabe parecido. */
export const esListaDeSalidas = (url: string) => /\/salidas(\?|$)/.test(url) && !url.includes('/cms/')
