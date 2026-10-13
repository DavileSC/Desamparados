import { type } from 'arktype';
import { textoRequerido, paginacionQuery, ordenQuery } from '../config/common.js';
import { ORDENES_RECIBOS } from '../domain/ordenacion.js';
import { esDiaValido } from '../domain/contabilidad.js';

// Validar estado de pago basado en tu Enum
const estadoPagoSchema = type("'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO' | 'REEMBOLSADO'");
const metodoPagoSchema = type("'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'");

// Un año de verdad: entero. Un 2026.5 pasaba la validación y reventaba en
// Prisma con un 500, porque la columna `year` es Int.
const anioSchema = type("2000 <= number.integer <= 2100").describe("un año entero entre 2000 y 2100");

// Positivo, con dos decimales como mucho y que quepa en Decimal(10, 2): así lo
// que se guarda es exactamente lo que se escribió, sin redondeos de MariaDB.
const importeSchema = type("0 < number <= 99999999.99")
    .narrow((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6)
    .describe("un importe positivo con dos decimales como mucho");

// El concepto forma parte de la clave única del recibo y se imprime en el
// correo: sin HTML y con un largo que quepa en la columna (VARCHAR 191).
const conceptoSchema = type("string <= 150").and(textoRequerido)
    .describe("un concepto de hasta 150 caracteres, sin < ni >");

// Los tipos que se pueden emitir a mano. La papeleta de sitio queda fuera: su
// recibo nace en la mesa de reparto junto con la papeleta, y uno suelto sería
// un cobro sin sitio en la procesión.
const tipoEmitibleSchema = type("'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'");

export const generarCuotasSchema = type({
    body: {
        year: anioSchema,
        importe: importeSchema,
        concepto: conceptoSchema
    }
});

export const emitirReciboSchema = type({
    body: {
        hermanoId: type("number.integer > 0").describe("el identificador de un hermano"),
        year: anioSchema,
        concepto: conceptoSchema,
        importe: importeSchema,
        tipo: tipoEmitibleSchema,
        // El devuelto que vuelve a cobrar, si es una reemisión: el enlace es lo
        // que lo da por reemitido (ver domain/reemisiones).
        "reemisionDeId?": type("number.integer > 0").describe("el identificador del recibo devuelto")
    }
});

// Para cuando el tesorero edita un recibo/papeleta
export const updateReciboSchema = type({
    body: {
        "estado?": estadoPagoSchema,
        "puesto?": textoRequerido,
        "tramo?": "string",
        "observaciones?": "string",
        // Lo que cobra el banco al devolverlo; solo con estado DEVUELTO (lo comprueba el servicio).
        "comision?": importeSchema,
        // El día en que el banco lo devolvió; solo con estado DEVUELTO (lo comprueba el servicio).
        "fechaDevolucion?": type('string').narrow((valor) => esDiaValido(valor)).describe('una fecha AAAA-MM-DD que exista')
    }
});

export const marcarPagadoSchema = type({
    body: {
        "metodoPago?": metodoPagoSchema
    }
});

// Consultas de los listados. Sin esquema, `req.query` llegaba crudo y un
// parámetro repetido (`?estado=a&estado=b`) llega en Express 5 como lista: el
// controlador lo trataba como texto. Declarado aquí, una lista es un 400 con su
// motivo. Llevan `...paginacionQuery`: sin él, `validate` borraría page y limit
// en silencio y todas las páginas servirían la primera.
// Año, tipo y búsqueda: lo que comparten el listado y su resumen por estados.
const filtrosRecibosQuery = {
    "year?": type("string").matching(/^\d{4}$/).describe("un año de cuatro cifras"),
    "tipo?": type("'PAPELETA_SITIO' | 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'"),
    "q?": type("string <= 100").describe("un texto de búsqueda de hasta 100 caracteres"),
    "recibo?": type("string").matching(/^[1-9]\d{0,9}$/).describe("el número de un recibo"),
};

export const adminRecibosQuerySchema = type({
    query: {
        ...paginacionQuery,
        ...filtrosRecibosQuery,
        "estado?": estadoPagoSchema,
        "orden?": ordenQuery(ORDENES_RECIBOS)
    }
});

// Sin estado: el resumen cuenta todos para que se pueda elegir uno.
export const adminResumenQuerySchema = type({ query: filtrosRecibosQuery });

export const misRecibosQuerySchema = type({
    query: { ...paginacionQuery }
});

// Quién debe cuotas. `minimo`: cuántas cuotas sin pagar como poco (1 a 9).
export const impagosQuerySchema = type({
    query: {
        "incluirAnioActual?": "'true' | 'false'",
        "minimo?": type("string").matching(/^[1-9]$/),
        "page?": type("string").matching(/^[1-9]\d*$/),
        "limit?": type("string").matching(/^[1-9]\d*$/)
    }
});

// Buscador de hermanos de la ventana «Nuevo recibo». Dos letras como mínimo
// para no devolver medio censo con cada pulsación.
export const buscarHermanosQuerySchema = type({
    query: {
        q: type("2 <= string <= 100").describe("un texto de búsqueda de 2 a 100 caracteres")
    }
});

// Remesas SEPA: el día en que el banco carga los adeudos y, si se quiere, solo
// un año o un tipo de recibo (la cuota de este año, sin las papeletas…). Que
// la fecha sea un día hábil con margen suficiente lo decide el servicio.
export const remesaSchema = type({
    body: {
        fechaCobro: type(/^\d{4}-\d{2}-\d{2}$/).describe("una fecha AAAA-MM-DD"),
        "year?": anioSchema,
        "tipo?": "'PAPELETA_SITIO' | 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'"
    }
});
