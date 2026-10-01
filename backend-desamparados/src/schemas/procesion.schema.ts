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
/** Lo que la mesa elige con el cíngulo (DEVUELTO lo pone la devolución). */
const cingulo = type("'PRESTADO' | 'DEBIDO' | 'PROPIO' | 'NINGUNO'");
// «1,45», «1.5» o «145»: la convierte el servicio (alturaHombroEnCm).
const alturaHombro = type("string <= 8").describe("una altura de hombro");
const dia = type("string").matching(/^\d{4}-\d{2}-\d{2}$/).describe("una fecha válida (AAAA-MM-DD)");
const nombrePropio = type("string <= 80").narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe("un texto de 80 caracteres como mucho, sin «<» ni «>»");
const apellidoOpcional = type("string <= 80").matching(/^[^<>]*$/).describe("un apellido sin «<» ni «>»");
const salida = type("'PASION' | 'ROSARIO'");
const puesto = type("string <= 80").narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe("un puesto de 80 caracteres como mucho, sin «<» ni «>»");
// Euros, con dos decimales como mucho y con tope: la voluntad es libre, pero un 5000 es un error de tecleo.
const donativo = type("number >= 0").narrow((n) => n <= 1000 && Math.round(n * 100) === n * 100).describe("un importe entre 0 y 1000 €, con dos decimales como mucho");
// La clave que genera el ordenador de la mesa al abrir cada operación: la misma en cada reintento.
const claveOperacion = type("string").matching(/^[A-Za-z0-9-]{8,64}$/).describe("una clave de operación");
const observacionesMesa = type("string <= 500").matching(/^[^<>]*$/);

// 1. La solicitud de la papeleta desde el área de hermanos: el día (que dice
// la salida), quién va, el puesto que le gustaría y, en el Rosario, la voluntad.
export const avisarAsistenciaSchema = type({
    body: {
        turnoId: idCuerpo,
        hermanoId: idCuerpo,
        puesto: puesto,
        "donativo?": donativo,
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
        capacidadEstimada: "number.integer > 0",
        "salida?": salida
    }
});

// La salida de la que se habla, en la consulta: sin ella, la Pasión.
export const salidaQuerySchema = type({
    query: { "salida?": salida }
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
        "borradorNoticia?": "boolean",
        "salida?": salida
    }
});

// La fecha del Rosario vespertino (instante completo, en octubre) y su lugar.
export const fechaRosarioSchema = type({
    body: {
        inicio: fechaTexto,
        "lugar?": type("string <= 160").matching(/^[^<>]*$/).or("null")
    }
});

// ==========================================
//  LA MESA DE LA PROCESIÓN
// ==========================================

export const mesaBuscarSchema = type({
    query: {
        q: type("string <= 100"),
        "zona?": "'inscripcion' | 'tesoreria' | 'tunicas' | 'devolucion' | 'todas'",
        "salida?": salida,
    }
});

export const mesaEsperadosSchema = type({
    query: { "salida?": salida }
});

export const mesaPrendasSchema = type({
    query: { tipo: tipoRopa, q: numeroPrenda }
});

export const mesaListadoSchema = type({
    query: {
        "salida?": salida,
        "year?": type("string").matching(/^\d{4}$/),
        "q?": type("string <= 100"),
        "puesto?": type("string <= 80"),
        "faltaCingulo?": "'1'",
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
        "origenTunica?": "'ROPERO' | 'PROPIA' | 'NINGUNA'",
        "crearPrendas?": tipoRopa.array(),
        "cingulo?": cingulo,
    }
});

// Una solicitud aún sin recoger: el puesto que pide, las observaciones y,
// en el Rosario, la voluntad si aún no la ha pagado.
export const mesaEditarSolicitudSchema = type({
    body: {
        "puesto?": puesto,
        "observaciones?": observacionesMesa.or("null"),
        "donativo?": donativo,
    }
});

// ==========================================
//  LA MESA POR ZONAS
// ==========================================

export const mesaInscribirSchema = type({
    body: {
        hermanoId: idCuerpo,
        salida: salida,
        puesto: puesto,
        "observaciones?": observacionesMesa,
        "donativo?": donativo,
        "alturaHombro?": alturaHombro,
        "clave?": claveOperacion,
    }
});

export const mesaCobrarSchema = type({
    body: {
        hermanoId: idCuerpo,
        reciboIds: idCuerpo.array().atMostLength(30),
        "solicitudes?": type({ solicitudId: idCuerpo, "importe?": donativo }).array().atMostLength(30),
        metodoPago: metodoPagoSchema,
        "clave?": claveOperacion,
    }
});

// Lo que devuelve una persona después de la salida: sus prendas (la rota,
// al taller) y sus cíngulos, por la papeleta con que se prestaron.
export const mesaDevolverSchema = type({
    body: {
        hermanoId: idCuerpo,
        prendas: type({ id: idCuerpo, "rota?": "boolean" }).array().atMostLength(20),
        cingulos: idCuerpo.array().atMostLength(20),
        "clave?": claveOperacion,
    }
});

export const mesaPerdonarSchema = type({
    body: {
        reciboIds: idCuerpo.array().atLeastLength(1).atMostLength(30),
        "motivo?": type("string <= 300").matching(/^[^<>]*$/),
        "clave?": claveOperacion,
    }
});

export const mesaEntregarSchema = type({
    body: {
        solicitudId: idCuerpo,
        "puesto?": puesto,
        "origenTunica?": "'ROPERO' | 'PROPIA' | 'NINGUNA'",
        "numTunicaAsignada?": numeroPrenda,
        "numCapiroteAsignado?": numeroPrenda,
        "numFaraonaAsignada?": numeroPrenda,
        "crearPrendas?": tipoRopa.array(),
        "cingulo?": cingulo,
        "alturaHombro?": alturaHombro,
        "observaciones?": observacionesMesa,
        "clave?": claveOperacion,
    }
});

export const mesaFichaSchema = type({
    params: { id: type("string").matching(/^[1-9]\d{0,9}$/) },
    query: { "salida?": salida }
});

export const mesaPreparacionSchema = type({
    query: { "turnoId?": type("string").matching(/^[1-9]\d{0,9}$/) }
});

// El hermano paga en línea recibos de su familia, con tarjeta o Bizum.
export const pagarEnLineaSchema = type({
    body: {
        "reciboIds?": idCuerpo.array().atMostLength(30),
        "solicitudIds?": idCuerpo.array().atMostLength(30),
        "metodo?": "'TARJETA' | 'BIZUM'",
        "clave?": claveOperacion,
    }
});

// Cómo va un pago, a la vuelta del banco: el pedido tiene la forma de `numeroDePedido`.
export const estadoDePagoSchema = type({
    params: { pedido: type("string").matching(/^\d{8}[A-Z0-9]{4}$/) }
});

// El aviso de Redsys. Llega como formulario, no como JSON; la firma la
// comprueba el servicio, aquí solo se acota lo que se lee.
export const avisoRedsysSchema = type({
    body: {
        "Ds_SignatureVersion?": "string <= 40",
        Ds_MerchantParameters: "0 < string <= 8000",
        Ds_Signature: "0 < string <= 200",
    }
});

// El cortejo: los tramos (del primero al del trono) con sus plazas, y los
// puestos que se reparten en ellos. Que no se repitan y que no falte nada lo
// comprueba `problemaConfiguracion`, con mensajes en castellano.
const nombreTramo = type("string <= 60").matching(/^[^<>]+$/).describe("un nombre de tramo de 60 caracteres como mucho, sin «<» ni «>»");

export const cortejoQuerySchema = type({
    query: { "salida?": salida, "year?": type(/^\d{4}$/).describe("un año de cuatro cifras") }
});

export const cortejoConfiguracionSchema = type({
    body: {
        salida,
        tramos: type({ nombre: nombreTramo, plazas: type("1 <= number.integer <= 500").describe("entre 1 y 500 plazas") }).array().atMostLength(30),
        puestos: puesto.array().atMostLength(20),
    }
});

export const cortejoAplicarSchema = type({
    body: { salida, year: type("2000 <= number.integer <= 2100").describe("un año entre 2000 y 2100") }
});

// La puerta del templo. El código es el texto del QR (`DSP1.<id>.<firma>`): se
// acota el largo para no firmar textos enormes; si es bueno lo dice la firma.
export const puertaEscanearSchema = type({
    body: { codigo: "0 < string <= 64", salida }
});

export const puertaEntradaSchema = type({
    body: { salida }
});
