import { type } from 'arktype';
import { ordenQuery, paginacionQuery, textoRequerido } from '../config/common';
import { ORDENES_ENSERES, ORDENES_PRENDAS } from '../domain/ordenacion.js';
import { imagenOpcional } from './noticia.schema';

// =================================================================
//  ENUMS COMUNES
// =================================================================

// Enums para el Ropero
const tipoPrendaSchema = type("'TUNICA' | 'CAPIROTE' | 'FARAONA' | 'CAPA' | 'OTRO'");
const estadoPrendaSchema = type("'DISPONIBLE' | 'PRESTADA' | 'LAVADO' | 'TALLER' | 'BAJA'");
// PRESTADA no se elige: la pone «Asignar», que es lo que guarda también quién
// la tiene. Dada de alta como prestada, la prenda quedaba prestada a nadie.
const estadoAltaPrendaSchema = type("'DISPONIBLE' | 'LAVADO' | 'TALLER' | 'BAJA'");

// Unidades de un lote: enteras. Un 2.5 llegaba hasta Prisma (columna Int) y
// salía como un 500. El tope solo evita desbordar la columna.
const cantidadSchema = type("0 <= number.integer <= 100000");

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
        "cantidadOptimo?": cantidadSchema,
        "cantidadBueno?": cantidadSchema,
        "cantidadReparar?": cantidadSchema,
        
        "imagenUrl?": imagenOpcional,
        "fechaAdquisicion?": fechaIsoSchema
    }
});

export const updateEnserSchema = type({
    body: {
        "nombre?": textoRequerido,
        "referencia?": "string",
        "categoria?": "string",
        "ubicacion?": "string",
        
        "cantidadOptimo?": cantidadSchema,
        "cantidadBueno?": cantidadSchema,
        "cantidadReparar?": cantidadSchema,
        
        "imagenUrl?": imagenOpcional,
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
        "necesitaReparacion?": "'true' | 'false'",
        "orden?": ordenQuery(ORDENES_ENSERES)
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
        "estado?": estadoAltaPrendaSchema,
        "observaciones?": "string"
    }
});

export const updatePrendaSchema = type({
    body: {
        "numero?": textoRequerido,
        "tipo?": tipoPrendaSchema,
        "talla?": "string",
        // Admite PRESTADA para que el formulario de edición pueda reenviar el
        // estado que ya tenía; cambiar a o desde PRESTADA lo impide el servicio.
        "estado?": estadoPrendaSchema,
        "observaciones?": "string"
    }
});

// Mismo motivo que en los enseres: el ropero pagina por su cuenta y necesita
// declarar page y limit para que lleguen al servicio.
export const queryPrendaSchema = type({
    query: {
        ...paginacionQuery,
        "q?": "string <= 100",
        "numero?": "string",
        "tipo?": tipoPrendaSchema,
        "estado?": estadoPrendaSchema,
        "talla?": "string",
        "orden?": ordenQuery(ORDENES_PRENDAS)
    }
});

// =================================================================
//  3. PRÉSTAMOS DEL ROPERO
// =================================================================

// Se presta por número de hermano, que es el que maneja la albacería; antes
// había que teclear el id interno de la base de datos, que nadie conoce.
const numeroHermanoSchema = type("number.integer > 0");

export const asignarPrendaSchema = type({ body: { numeroHermano: numeroHermanoSchema } });
// Vuelve rota (al taller) o no: la túnica va siempre al lavado.
export const devolverPrendaSchema = type({ body: { "rota?": "boolean" } });
// Las prendas del lavado que ya están limpias; sin ids, todas.
export const prendasLavadasSchema = type({ body: { "ids?": type("number.integer > 0").array().atMostLength(500) } });
export const totalCingulosSchema = type({ body: { total: type("number.integer >= 0").narrow((n) => n <= 5000).describe("un número de cíngulos entre 0 y 5000") } });
export const numeroHermanoParamSchema = type({
    params: { numeroHermano: type("string").matching(/^[1-9]\d{0,8}$/).describe("un número de hermano") }
});
