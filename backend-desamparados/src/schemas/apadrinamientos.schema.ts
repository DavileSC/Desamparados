import { type } from 'arktype';
import { datosFiscales, email, idParam, telefono } from '../config/common.js';

const textoLimpio = (max: number, que: string) =>
    type(`string <= ${max}`).narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe(`${que} de ${max} caracteres como mucho, sin «<» ni «>»`);

export const apadrinarSchema = type({
    body: {
        piezaId: "number.integer > 0",
        nombre: textoLimpio(120, 'un nombre'),
        email,
        telefono,
        dedicatoria: type("string <= 200").matching(/^[^<>]*$/).or("null"),
        mostrarNombre: "boolean",
        metodo: "'TARJETA' | 'BIZUM'",
        // Si quiere el certificado de donación para desgravar.
        "fiscal?": datosFiscales.or("null"),
    }
});

export const tokenApadrinamientoSchema = type({ params: { token: type(/^[a-f0-9]{32}$/).describe("un enlace de apadrinamiento") } });
export const campanaIdSchema = type({ params: { id: idParam } });
export const piezaIdSchema = type({ params: { id: idParam, piezaId: idParam } });

export const campanaSchema = type({
    body: {
        titulo: textoLimpio(150, 'un título'),
        descripcion: type("string <= 3000").matching(/^[^<>]*$/),
        foto: type("string <= 500").narrow((s) => s.trim().length > 0).describe("la foto de la campaña"),
        activa: "boolean",
    }
});

// La posición, en porcentaje del ancho y del alto de la foto.
const porcentaje = type("0 <= number <= 100").describe("un porcentaje entre 0 y 100");
export const piezaSchema = type({
    body: {
        nombre: textoLimpio(120, 'un nombre'),
        precio: type("0 < number <= 99999.99").narrow((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6).describe("un precio positivo con dos decimales como mucho"),
        x: porcentaje,
        y: porcentaje,
    }
});
