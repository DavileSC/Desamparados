import { type } from 'arktype';
import { textoRequerido } from '../config/common.js';
import { imagenOpcional } from './noticia.schema.js';
import { rutaImagenPublica } from './portada.schema.js';
import { MAX_TIEMPOS, esDiaDelAnio } from '../domain/retablo.js';

const cargo = type("'ADMIN' | 'HERMANO_MAYOR' | 'SECRETARIA' | 'TESORERIA' | 'REDES' | 'ALBACERIA'");

// Un aviso de la junta: qué hay que hacer (una línea, como mucho 160), para
// qué cargo (null = toda la junta), hasta cuándo y si es urgente desde ya.
export const crearAvisoSchema = type({
  body: {
    texto: textoRequerido.and('string <= 160'),
    para: cargo.or('null'),
    'hasta?': type('string').matching(/^\d{4}-\d{2}-\d{2}$/).or('null'),
    'urgente?': 'boolean',
  },
});

const porcentaje = type('0 <= number <= 100');
const diaDelAnio = type('string').narrow((v) => esDiaDelAnio(v)).describe('un día del año en MM-DD');

// Cada tiempo lleva su foto (sin foto no tiene nada que poner) y su punto.
const encuadreDeTiempo = { foto: rutaImagenPublica, x: porcentaje, y: porcentaje };
const tiempo = type({ tiempo: "'cuaresma' | 'semana-santa' | 'navidad'", ...encuadreDeTiempo })
  .or({ tiempo: "'a-mano'", nombre: textoRequerido.and('string <= 40').matching(/^[^<>]*$/), desde: diaDelAnio, hasta: diaDelAnio, ...encuadreDeTiempo });

const cuenta = type({ tipo: "'proxima' | 'ninguna'" })
  .or({ tipo: "'salida'", salidaId: 'number.integer > 0' })
  .or({ tipo: "'acto'", eventoId: 'number.integer > 0' });

// El retablo: la foto de todo el año (null = la de siempre) con su punto, en %,
// las fotos de otros tiempos y hasta qué cuenta los días. `tiempos` y `cuenta`
// son opcionales: sin ellos se queda lo que hubiera guardado.
export const retabloSchema = type({
  body: {
    foto: imagenOpcional,
    x: porcentaje,
    y: porcentaje,
    'tiempos?': tiempo.array().atMostLength(MAX_TIEMPOS)
      // Un tiempo calculado repetido no aporta nada y no se sabría cuál manda.
      .narrow((lista) => {
        const calculados = lista.filter((t) => t.tiempo !== 'a-mano').map((t) => t.tiempo);
        return new Set(calculados).size === calculados.length;
      })
      .describe(`hasta ${MAX_TIEMPOS} tiempos, sin repetir la Cuaresma, la Semana Santa ni la Navidad`),
    'cuenta?': cuenta,
  },
});
