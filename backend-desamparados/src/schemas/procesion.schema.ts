import { type } from 'arktype';
import { textoRequerido } from '../config/common.js'; // Ajusta la ruta

const metodoPagoSchema = type("'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA'");

// 1. Esquema para el Hermano (Pedir Cita)
export const avisarAsistenciaSchema = type({
    body: {
        turnoId: "number",
        hermanoId: "number"
    }
});

// 2. Esquema para Secretaría/Tesorería (Crear Papeleta y Cobrar)
export const inscribirManualSchema = type({
    body: {
        hermanoId: "number",
        importe: "number >= 0", // Pequeño extra de seguridad
        metodoPago: metodoPagoSchema,
        puesto: textoRequerido,
        
        "tramo?": "string",
        "numTunicaAsignada?": "string",
        "numCapiroteAsignado?": "string",
        "observaciones?": "string",
        "citaId?": "number" 
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
        fecha: "string", // Fecha ISO
        horaInicio: "string",
        horaFin: "string",
        capacidadEstimada: "number > 0"
    }
});