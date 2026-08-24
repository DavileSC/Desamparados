import { type } from 'arktype';
import { textoRequerido } from '../config/common.js'; // Ajusta la ruta

// Validar estado de pago basado en tu Enum
const estadoPagoSchema = type("'PENDIENTE' | 'PAGADO' | 'ANULADO' | 'DEVUELTO'");

export const generarCuotasSchema = type({
    body: {
        // En ArkType, los rangos numéricos se ponen directamente en la definición
        year: type("number >= 2000").describe("un año válido a partir del 2000"),
        
        // Lo mismo para el importe: le decimos que debe ser mayor que 0
        importe: type("number > 0").describe("un importe decimal positivo"),
            
        concepto: textoRequerido
    }
});

// Para cuando el tesorero edita un recibo/papeleta
export const updateReciboSchema = type({
    body: {
        "estado?": estadoPagoSchema,
        "puesto?": textoRequerido,
        "tramo?": "string",
        "observaciones?": "string"
    }
});