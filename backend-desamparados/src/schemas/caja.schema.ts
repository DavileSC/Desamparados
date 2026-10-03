import { type } from 'arktype';
import { idParam } from '../config/common.js';

// Importes en euros con dos decimales como mucho: el fondo y el efectivo contado.
const euros = type("0 <= number <= 100000").narrow((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6).describe("un importe en euros con dos decimales como mucho");

export const abrirCajaSchema = type({ body: { fondoInicial: euros } });

// Una línea: un producto del catálogo (`productoId`), o algo suelto con su
// nombre y su precio (en céntimos, para no arrastrar decimales). Una sola
// forma con campos opcionales y no una unión: `validate` quita las claves no
// declaradas, y arktype no sabe a cuál de las dos ramas aplicarlo. Que traiga
// lo uno o lo otro lo decide el controlador.
const linea = type({
    "productoId?": "number.integer > 0",
    "tallaId?": "number.integer > 0",
    "nombre?": type("0 < string <= 120").matching(/^[^<>]+$/),
    "centimos?": "number.integer > 0",
    cantidad: "number.integer > 0",
}).narrow((l) => l.productoId !== undefined || (l.nombre !== undefined && l.centimos !== undefined))
    .describe("un producto del catálogo, o algo suelto con su nombre y su precio");

export const venderSchema = type({
    body: { lineas: linea.array().atLeastLength(1).atMostLength(40), metodo: "'EFECTIVO' | 'TARJETA' | 'BIZUM'" }
});

export const ventaIdSchema = type({ params: { id: idParam } });

export const cerrarCajaSchema = type({
    body: { efectivoContado: euros, "observaciones?": type("string <= 1000").matching(/^[^<>]*$/).or("null") }
});
