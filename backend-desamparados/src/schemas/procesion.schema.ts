import { type } from 'arktype';
import { textoRequerido, paginacionQuery, textoOpcional, email, telefono, dni } from '../config/common.js';
import { esFechaValida, instanteLimiteAusencias } from '../domain/datos-procesion.js';

const metodoPagoSchema = type("'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA'");

// Identificadores enteros: un 3.5 pasaba como "number" y reventaba en Prisma con un 500.
const idCuerpo = type("number.integer > 0").describe("un identificador válido");

const fechaTexto = type("string").narrow((s) => esFechaValida(s)).describe("una fecha válida");

// El número de una prenda como lo escribe la mesa: «145-31», «150», «21M».
const numeroPrenda = type("string <= 20").matching(/^[^<>]*$/).describe("un número de prenda de 20 caracteres como mucho");
const tipoRopa = type("'TUNICA' | 'CAPIROTE' | 'FARAONA'");
// «1,45», «1.5» o «145»: la convierte el servicio (alturaHombroEnCm).
const alturaHombro = type("string <= 8").describe("una altura de hombro");
const dia = type("string").matching(/^\d{4}-\d{2}-\d{2}$/).describe("una fecha válida (AAAA-MM-DD)");
const nombrePropio = type("string <= 80").narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe("un texto de 80 caracteres como mucho, sin «<» ni «>»");
const apellidoOpcional = type("string <= 80").matching(/^[^<>]*$/).describe("un apellido sin «<» ni «>»");

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
        "numTunicaAsignada?": numeroPrenda,
        "numCapiroteAsignado?": numeroPrenda,
        "numFaraonaAsignada?": numeroPrenda,
        "origenTunica?": "'ROPERO' | 'PROPIA' | 'NINGUNA'",
        "crearPrendas?": tipoRopa.array(),
        "alturaHombro?": alturaHombro,
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

// ==========================================
//  LA MESA DE LA PROCESIÓN
// ==========================================

export const mesaBuscarSchema = type({
    query: { q: type("string <= 100") }
});

export const mesaPrendasSchema = type({
    query: { tipo: tipoRopa, q: numeroPrenda }
});

export const mesaListadoSchema = type({
    query: {
        "year?": type("string").matching(/^\d{4}$/),
        "q?": type("string <= 100"),
        "puesto?": type("string <= 80"),
    }
});

// Alta en el momento. Un adulto trae DNI, correo y teléfono (se le abre la
// cuenta); un menor, su tutor: uno del censo o uno nuevo, que abre la cuenta.
export const mesaAltaSchema = type({
    body: {
        nombre: nombrePropio,
        primerApellido: nombrePropio,
        "segundoApellido?": apellidoOpcional,
        fechaNacimiento: dia,
        "sexo?": "'HOMBRE' | 'MUJER'",
        "telefono?": telefono,
        "email?": email,
        "dni?": dni,
        "parentesco?": "'HIJO' | 'SOBRINO' | 'NIETO' | 'AHIJADO' | 'OTRO'",
        // El tutor de un menor: uno del censo o uno nuevo (solo la cuenta).
        "tutorHermanoId?": idCuerpo,
        "tutorNuevo?": {
            nombre: nombrePropio,
            primerApellido: nombrePropio,
            "segundoApellido?": apellidoOpcional,
            dni: dni,
            telefono: telefono,
            email: email,
        },
    }
});

// «Editar antes de guardar»: los datos que la mesa comprueba con la persona.
export const mesaCorregirSchema = type({
    body: {
        "nombre?": nombrePropio,
        "primerApellido?": nombrePropio,
        "segundoApellido?": apellidoOpcional.or("null"),
        "fechaNacimiento?": dia,
        "telefono?": type(telefono).or("''").or("null"),
        "email?": type(email).or("''").or("null"),
        "alturaHombro?": alturaHombro.or("null"),
    }
});

export const mesaEditarPapeletaSchema = type({
    body: {
        "puesto?": textoRequerido,
        "tramo?": textoOpcional.or("null"),
        "observaciones?": type("string <= 500").matching(/^[^<>]*$/).or("null"),
        "numTunicaAsignada?": numeroPrenda.or("null"),
        "numCapiroteAsignado?": numeroPrenda.or("null"),
        "numFaraonaAsignada?": numeroPrenda.or("null"),
        "crearPrendas?": tipoRopa.array(),
    }
});
