import { type } from 'arktype';
import { idParam } from '../config/common.js';
import { esDiaValido } from '../domain/contabilidad.js';

// Un importe en euros, positivo y con dos decimales como mucho.
const euros = type("0 < number <= 100000").narrow((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6).describe("un importe en euros con dos decimales como mucho");

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

// El efectivo llevado al banco: el día (AAAA-MM-DD) y cuánto, con una nota si hace falta.
export const ingresoSchema = type({
    body: {
        fecha: type("string").narrow((d) => esDiaValido(d)).describe("una fecha AAAA-MM-DD que exista"),
        importe: euros,
        "nota?": type("string <= 300").matching(/^[^<>]*$/).or("null"),
    }
});

export const ingresoIdSchema = type({ params: { id: idParam } });
