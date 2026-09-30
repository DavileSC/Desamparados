import { type } from 'arktype';
import { email, idParam, telefono } from '../config/common.js';

const textoLimpio = (max: number, que: string) =>
    type(`string <= ${max}`).narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe(`${que} de ${max} caracteres como mucho, sin «<» ni «>»`);

export const compraSchema = type({
    body: {
        nombre: textoLimpio(120, 'un nombre'),
        email,
        telefono,
        metodo: "'TARJETA' | 'BIZUM'",
        lineas: type({ productoId: "number.integer > 0", cantidad: "1 <= number.integer <= 20" }).array().atLeastLength(1).atMostLength(30),
    }
});

export const tokenPedidoSchema = type({ params: { token: type(/^[a-f0-9]{32}$/).describe("un enlace de pedido") } });

// El precio, positivo y con dos decimales como mucho (así se guarda exacto).
const precio = type("0 < number <= 99999.99").narrow((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6).describe("un precio positivo con dos decimales como mucho");

export const productoSchema = type({
    body: {
        nombre: textoLimpio(120, 'un nombre'),
        descripcion: type("string <= 2000").matching(/^[^<>]*$/),
        precio,
        foto: type("string <= 500").or("null"),
        existencias: type("0 <= number.integer <= 100000").or("null"),
        activo: "boolean",
        orden: "0 <= number.integer <= 10000",
    }
});

export const productoIdSchema = type({ params: { id: idParam } });

export const pedidosQuerySchema = type({ query: { "estado?": "'PENDIENTE_PAGO' | 'PAGADO' | 'ENTREGADO' | 'CANCELADO'" } });
