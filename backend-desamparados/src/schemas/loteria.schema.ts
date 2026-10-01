import { type } from 'arktype';
import { idParam } from '../config/common.js';

const texto = (max: number) => type(`string <= ${max}`).matching(/^[^<>]*$/);
// Euros con dos decimales como mucho: así se guardan exactos.
const importe = (max: number) => type(`0 < number <= ${max}`).narrow((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6).describe('un importe positivo con dos decimales como mucho');
const metodoPago = type("'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA'");
const numeroDeTalonario = type("1 <= number.integer <= 100000");

export const sorteoIdSchema = type({ params: { id: idParam } });

export const sorteoSchema = type({
    body: {
        nombre: texto(120).narrow((s) => s.trim().length > 0).describe('un nombre'),
        fecha: type(/^\d{4}-\d{2}-\d{2}$/).describe('una fecha'),
        numeros: type(/^\d{5}$/).describe('un número de cinco cifras').array().atLeastLength(1).atMostLength(10),
        precioDecimo: importe(10000),
        decimos: "1 <= number.integer <= 100000",
        precioParticipacion: importe(1000),
        jugado: importe(1000),
        porTalonario: "1 <= number.integer <= 500",
        leyenda: texto(1000),
    }
});

// Lo que gana un décimo de cada número, en el orden de los números; null si no tocó.
export const premiosSchema = type({ body: { premios: type("0 <= number <= 100000000").or("null").array().atMostLength(10) } });

export const compraSchema = type({ body: { metodoPago } });

export const nuevosTalonariosSchema = type({ body: { cantidad: "1 <= number.integer <= 500" } });

export const entregaSchema = type({
    body: {
        desde: numeroDeTalonario,
        hasta: numeroDeTalonario,
        responsable: texto(120).or("null"),
        telefono: texto(30).or("null"),
    }
});

export const liquidacionSchema = type({ body: { vendidas: "0 <= number.integer <= 500", metodoPago: metodoPago.or("null") } });

export const tramoSchema = type({ body: { desde: numeroDeTalonario, hasta: numeroDeTalonario } });
