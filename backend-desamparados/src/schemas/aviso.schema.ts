import { type } from 'arktype';
import { textoRequerido } from '../config/common.js';
import { imagenOpcional } from './noticia.schema.js';

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

// La foto del retablo (null = la de siempre) y el punto que no se recorta, en %.
export const retabloSchema = type({
  body: {
    foto: imagenOpcional,
    x: '0 <= number <= 100',
    y: '0 <= number <= 100',
  },
});
