import { type } from 'arktype';
import { paginacionQuery, textoRequerido } from '../config/common';

// =================================================================
//  ENUMS COMUNES
// =================================================================

// Enums para el Ropero
const tipoPrendaSchema = type("'TUNICA' | 'CAPIROTE' | 'FARAONA' | 'CAPA' | 'OTRO'");
const estadoPrendaSchema = type("'DISPONIBLE' | 'PRESTADA' | 'TALLER' | 'BAJA'");

// Validador de fecha común
const fechaIsoSchema = type("string").matching(/^\d{4}-\d{2}-\d{2}/);

// =================================================================
//  1. SCHEMAS DE ENSERES (Lotes)
// =================================================================

export const createEnserSchema = type({
    body: {
        nombre: textoRequerido,
        "referencia?": "string",
        "categoria?": "string",
        "ubicacion?": "string",
        
        // Cantidades desglosadas (opcionales, si no vienen el servicio asume 0)
        "cantidadOptimo?": "number >= 0",
        "cantidadBueno?": "number >= 0",
        "cantidadReparar?": "number >= 0",
        
        "imagenUrl?": "string",
        "fechaAdquisicion?": fechaIsoSchema
    }
});

export const updateEnserSchema = type({
    body: {
        "nombre?": textoRequerido,
        "referencia?": "string",
        "categoria?": "string",
        "ubicacion?": "string",
        
        "cantidadOptimo?": "number >= 0",
        "cantidadBueno?": "number >= 0",
        "cantidadReparar?": "number >= 0",
        
        "imagenUrl?": "string",
        "fechaAdquisicion?": fechaIsoSchema
    }
});

// Sin `...paginacionQuery`, `validate` borra page y limit en silencio y el
// listado sirve siempre la primera página. Cubierto por test/integration.test.ts.
export const queryEnserSchema = type({
    query: {
        ...paginacionQuery,
        "search?": "string",
        "ubicacion?": "string",
        "categoria?": "string",
        "necesitaReparacion?": "'true' | 'false'"
    }
});

// =================================================================
//  2. SCHEMAS DE ROPERO (Unitario)
// =================================================================

export const createPrendaSchema = type({
    body: {
        numero: textoRequerido, // Obligatorio, es el identificador de la túnica
        tipo: tipoPrendaSchema, // Obligatorio
        "talla?": "string",
        "estado?": estadoPrendaSchema,
        "observaciones?": "string"
    }
});

export const updatePrendaSchema = type({
    body: {
        "numero?": textoRequerido,
        "tipo?": tipoPrendaSchema,
        "talla?": "string",
        "estado?": estadoPrendaSchema,
        "observaciones?": "string"
    }
});

// Mismo motivo que en los enseres: el ropero pagina por su cuenta y necesita
// declarar page y limit para que lleguen al servicio.
export const queryPrendaSchema = type({
    query: {
        ...paginacionQuery,
        "numero?": "string",
        "tipo?": tipoPrendaSchema,
        "estado?": estadoPrendaSchema,
        "talla?": "string"
    }
});
