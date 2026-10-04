import { type } from 'arktype';
import { email, idParam, telefono } from '../config/common.js';
import { imagenOpcional } from './noticia.schema.js';

const textoLimpio = (max: number, que: string) =>
    type(`string <= ${max}`).narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe(`${que} de ${max} caracteres como mucho, sin «<» ni «>»`);

export const compraSchema = type({
    body: {
        nombre: textoLimpio(120, 'un nombre'),
        email,
        telefono,
        metodo: "'TARJETA' | 'BIZUM'",
        lineas: type({ productoId: "number.integer > 0", "tallaId?": "number.integer > 0", cantidad: "1 <= number.integer <= 20" }).array().atLeastLength(1).atMostLength(30),
    }
});

export const tokenPedidoSchema = type({ params: { token: type(/^[a-f0-9]{32}$/).describe("un enlace de pedido") } });

// El precio, positivo y con dos decimales como mucho (así se guarda exacto).
const precio = type("0 < number <= 99999.99").narrow((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6).describe("un precio positivo con dos decimales como mucho");

// Las fotos de más de un producto: hasta ocho, cada una con su pie.
export const MAX_FOTOS_PRODUCTO = 8;
const fotosSchema = type({ url: imagenOpcional, pie: type("string <= 160").matching(/^[^<>]*$/) })
    .array().atMostLength(MAX_FOTOS_PRODUCTO);

// Las tallas: hasta veinte, cada una con su nombre (sin repetir, sin mirar
// mayúsculas) y lo que queda (null: sin límite). Las que ya estaban traen su id.
export const MAX_TALLAS = 20;
const tallasSchema = type({
    "id?": "number.integer > 0",
    nombre: textoLimpio(20, 'una talla'),
    existencias: type("0 <= number.integer <= 100000").or("null"),
}).array().atMostLength(MAX_TALLAS)
    .narrow((ts) => new Set(ts.map((t) => t.nombre.trim().toLowerCase())).size === ts.length)
    .describe("tallas sin repetir");

export const productoSchema = type({
    body: {
        nombre: textoLimpio(120, 'un nombre'),
        descripcion: type("string <= 2000").matching(/^[^<>]*$/),
        precio,
        foto: type("string <= 500").or("null"),
        // Opcional: quien no lo manda (una pantalla vieja) no borra las que hay.
        "fotos?": fotosSchema,
        // Opcional, como las fotos: quien no lo manda no toca las tallas.
        "tallas?": tallasSchema,

        existencias: type("0 <= number.integer <= 100000").or("null"),
        activo: "boolean",
        orden: "0 <= number.integer <= 10000",
        // Opcionales, como las fotos: quien no los manda no los toca.
        "categoriaId?": type("number.integer > 0").or("null"),
        "destacado?": "boolean",
    }
});

// Las categorías de la tienda: un nombre corto, que es lo que cabe en la píldora de filtros.
export const categoriaSchema = type({ body: { nombre: textoLimpio(40, 'un nombre') } });

// El orden de las categorías: todas, por sus ids, en el orden nuevo.
export const ordenCategoriasSchema = type({
    body: { ids: type("number.integer > 0").array().atMostLength(200).narrow((ids) => new Set(ids).size === ids.length).describe("ids sin repetir") },
});

export const productoIdSchema = type({ params: { id: idParam } });

export const pedidosQuerySchema = type({ query: { "estado?": "'PENDIENTE_PAGO' | 'PAGADO' | 'ENTREGADO' | 'CANCELADO'" } });
