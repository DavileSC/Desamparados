import { type } from 'arktype';
import { idParam, ordenQuery, paginacionQuery } from '../config/common';
import { ORDENES_LIBRO } from '../domain/ordenacion.js';
import { esDiaValido, fechasInvertidas, motivoImporteInvalido } from '../domain/contabilidad.js';

const tipoTransaccion = type("'INGRESO' | 'GASTO'");
const metodoPago = type("'EFECTIVO' | 'TARJETA' | 'BIZUM' | 'TRANSFERENCIA' | 'DOMICILIACION'");
// Un día que exista: el patrón solo dejaba pasar el 2026-02-30, que acababa en el 2 de marzo.
const dia = type('string').narrow((valor) => esDiaValido(valor)).describe('una fecha AAAA-MM-DD que exista');

// Filtros del libro mayor y del resumen. Declarados uno a uno: `validate`
// borra en silencio lo que no esté aquí, y un filtro perdido enseña cifras de más.
const filtrosContablesQuery = {
    "tipo?": tipoTransaccion,
    "desde?": dia,
    "hasta?": dia,
    "categorias?": type('string').matching(/^\d+(,\d+)*$/).describe('una lista de ids separados por comas'),
    "metodo?": metodoPago,
    "q?": type('string').matching(/^[^<>]{0,100}$/).describe('un texto de búsqueda de hasta 100 caracteres'),
    "recibo?": type('string').matching(/^[1-9]\d{0,9}$/).describe('el número de un recibo'),
};

/**
 * Un periodo al revés se rechaza aquí, con 400: antes llegaba al servicio y la
 * serie salía con 1.201 meses vacíos (de 2026-12 a 2126-12).
 */
const FECHAS_AL_REVES = { path: ['query', 'hasta'], problem: 'no puede ser anterior a la fecha «desde»' };

// El orden solo lo tiene el libro: al resumen le da igual en qué orden se sumen.
export const libroMayorQuerySchema = type({ query: { ...paginacionQuery, ...filtrosContablesQuery, "orden?": ordenQuery(ORDENES_LIBRO) } })
    .narrow((datos, ctx) => !fechasInvertidas(datos.query) || ctx.reject(FECHAS_AL_REVES));
export const resumenQuerySchema = type({ query: filtrosContablesQuery })
    .narrow((datos, ctx) => !fechasInvertidas(datos.query) || ctx.reject(FECHAS_AL_REVES));

// `tipo` y `todas` declarados: sin esquema, `?tipo=INGRESO&tipo=GASTO` llegaba a
// Prisma como lista y respondía 500. `todas=true` trae también las desactivadas,
// que la gestión de categorías y los filtros del histórico necesitan ver.
export const categoriasQuerySchema = type({
    query: {
        "tipo?": tipoTransaccion,
        "todas?": "'true' | 'false'",
    }
});

// El concepto se guarda en un VARCHAR(191): más largo, la base de datos respondía 500.
const concepto = type('string')
    .narrow((s) => s.trim().length >= 4 && s.length <= 191 && !/[<>]/.test(s))
    .describe('un concepto de 4 a 191 caracteres, sin < ni >');

const importe = type('number').narrow((n, ctx) => {
    const motivo = motivoImporteInvalido(n);
    return motivo === null || ctx.reject({ problem: `el importe ${motivo}` });
});

// Lo que describe un apunte manual. El método es obligatorio: un apunte sin
// método desaparece en cuanto se filtra por cualquiera de ellos.
const apunte = {
    tipo: tipoTransaccion,
    categoriaId: type("number.integer > 0"),
    concepto,
    importe,
    metodoPago,
};

// Crear: la fecha es opcional y, si falta, es hoy.
export const createTransaccionSchema = type({
    body: { ...apunte, "fecha?": dia }
});

// Corregir: se manda el apunte entero, fecha incluida; el servicio decide si
// cambia (un apunte que sigue en su día conserva su hora).
export const updateTransaccionSchema = type({
    params: { id: idParam },
    body: { ...apunte, fecha: dia }
});

export const transaccionIdSchema = type({
    params: { id: idParam }
});

// El nombre de una categoría: de 3 a 60 caracteres útiles y sin < ni >. Se
// guarda sin espacios de sobra.
const nombreCategoria = type('string')
    .narrow((s) => { const limpio = s.trim(); return limpio.length >= 3 && limpio.length <= 60 && !/[<>]/.test(limpio); })
    .describe('un nombre de 3 a 60 caracteres, sin < ni >');

// Esquema para que el Tesorero cree una categoría (Ej: "Donativos Extraordinarios")
export const createCategoriaSchema = type({
    body: {
        nombre: nombreCategoria,
        tipo: tipoTransaccion
    }
});

export const renombrarCategoriaSchema = type({
    params: { id: idParam },
    body: { nombre: nombreCategoria }
});

// Desactivar o reactivar. Desactivada, deja de salir al apuntar pero sus apuntes siguen en el libro.
export const estadoCategoriaSchema = type({
    params: { id: idParam },
    body: { activa: 'boolean' }
});
