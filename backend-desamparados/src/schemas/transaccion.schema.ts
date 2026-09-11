import { type } from 'arktype';
import { paginacionQuery } from '../config/common';

const tipoTransaccion = type("'INGRESO' | 'GASTO'");
const dia = type('string').matching(/^\d{4}-\d{2}-\d{2}$/).describe('una fecha AAAA-MM-DD');

// Filtros del libro mayor y del resumen. Declarados uno a uno: `validate`
// borra en silencio lo que no esté aquí, y un filtro perdido enseña cifras de más.
const filtrosContablesQuery = {
    "tipo?": tipoTransaccion,
    "desde?": dia,
    "hasta?": dia,
    "categorias?": type('string').matching(/^\d+(,\d+)*$/).describe('una lista de ids separados por comas'),
    "metodo?": type("'EFECTIVO' | 'TARJETA' | 'BIZUM' | 'TRANSFERENCIA' | 'DOMICILIACION'"),
    "q?": type('string').matching(/^[^<>]{0,100}$/).describe('un texto de búsqueda de hasta 100 caracteres'),
};

export const libroMayorQuerySchema = type({ query: { ...paginacionQuery, ...filtrosContablesQuery } });
export const resumenQuerySchema = type({ query: filtrosContablesQuery });

// Esquema para crear un apunte contable
export const createTransaccionSchema = type({
    body: {
        tipo: tipoTransaccion,
        categoriaId: "number > 0", // <-- Ahora es el ID numérico
        concepto: "string > 3",
        importe: "number > 0",
        "fecha?": "string",
        "metodoPago?": type("'EFECTIVO' | 'TARJETA' | 'BIZUM' | 'TRANSFERENCIA' | 'DOMICILIACION'")
    }
});

// Esquema para que el Tesorero cree una categoría (Ej: "Donativos Extraordinarios")
export const createCategoriaSchema = type({
    body: {
        nombre: "string > 2",
        tipo: tipoTransaccion
    }
});