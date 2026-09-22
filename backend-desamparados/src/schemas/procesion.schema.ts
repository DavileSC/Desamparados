import { type } from 'arktype';
import { textoRequerido, paginacionQuery } from '../config/common.js';
import { esFechaValida, instanteLimiteAusencias } from '../domain/datos-procesion.js';

const metodoPagoSchema = type("'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA'");

// Identificadores enteros: un 3.5 pasaba como "number" y reventaba en Prisma con un 500.
const idCuerpo = type("number.integer > 0").describe("un identificador válido");

const fechaTexto = type("string").narrow((s) => esFechaValida(s)).describe("una fecha válida");

// 1. Esquema para el Hermano (Pedir Cita)
export const avisarAsistenciaSchema = type({
    body: {
        turnoId: idCuerpo,
        hermanoId: idCuerpo
    }
});

// 2. Esquema para Secretaría/Tesorería (Crear Papeleta y Cobrar)
// Sin `importe`: lo calcula siempre el servidor con los precios de la
// configuración. Pedirlo aquí solo servía para que la mesa creyera que
// mandaba algo que luego se ignoraba.
export const inscribirManualSchema = type({
    body: {
        hermanoId: idCuerpo,
        metodoPago: metodoPagoSchema,
        puesto: textoRequerido,

        "tramo?": "string",
        "numTunicaAsignada?": "string",
        "numCapiroteAsignado?": "string",
        "observaciones?": "string",
        "citaId?": idCuerpo
    }
});

// --- LOS NUEVOS ESQUEMAS QUE NOS TRAEMOS DE LAS RUTAS ---

// 3. Validar el año en la URL (/admin/listado/2026)
export const yearParamSchema = type({
    params: {
        year: type("string").matching(/^\d{4}$/)
    }
});

// 4. Validar la creación de un nuevo día de reparto
export const crearTurnoSchema = type({
    body: {
        fecha: fechaTexto, // Fecha ISO
        horaInicio: fechaTexto,
        horaFin: fechaTexto,
        capacidadEstimada: "number.integer > 0"
    }
});

// 5. Procesar ausencias. El cuerpo es opcional (sin él, la fecha es «ahora»):
// Express 5 deja `req.body` en undefined cuando no llega JSON.
// La fecha no puede ser futura: marcaría NO_PRESENTADO a hermanos cuya cita
// aún no ha llegado y les mandaría el correo de «no vino». Un día AAAA-MM-DD
// se lee en hora de Madrid (ver instanteLimiteAusencias).
export const procesarAusenciasSchema = type({
    "body?": type({
        "fechaLimite?": type("string")
            .narrow((s) => instanteLimiteAusencias(s) !== null)
            .describe("una fecha válida que no sea posterior a hoy"),
        "cierreDefinitivo?": "boolean"
    }).or("undefined")
});

// 6. Histórico de papeletas del hermano: solo paginación, declarada para que
// un parámetro repetido sea un 400 y no llegue crudo al servicio.
export const misPapeletasQuerySchema = type({
    query: { ...paginacionQuery }
});

// 7. Abrir o cerrar la solicitud de papeletas del área de hermanos. Avisar por
// correo y dejar un borrador de noticia solo cuentan al abrir.
export const plazoPapeletasSchema = type({
    body: {
        abierto: "boolean",
        "avisar?": "boolean",
        "borradorNoticia?": "boolean"
    }
});
