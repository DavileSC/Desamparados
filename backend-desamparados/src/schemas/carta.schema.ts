import { type } from 'arktype';
import { CLAVES_DE_FORMATO } from '../domain/etiquetas.js';

const texto = {
    asunto: "string <= 200",
    cuerpo: "0 < string <= 20000",
    firmaCargo: "0 < string <= 80",
    "firmaNombre?": type("string <= 120").or("null"),
} as const;

// Una carta guardada: su nombre, su texto, su firma y a quién va.
export const cartaSchema = type({
    body: { nombre: "0 < string <= 120", consulta: "string <= 1000", ...texto }
});

// El PDF, de una carta guardada o todavía sin guardar: la prueba es solo la del primero.
export const pdfCartaSchema = type({
    body: { consulta: "string <= 1000", "prueba?": "boolean", ...texto }
});

// Las etiquetas postales: de qué búsqueda, en qué hoja y cuántas de ella ya se gastaron.
export const etiquetasSchema = type({
    body: { consulta: "string <= 1000", formato: type.enumerated(...CLAVES_DE_FORMATO), saltar: "0 <= number.integer < 100", porDomicilio: "boolean" }
});

export const recuentoCartaSchema = type({
    query: { "consulta?": "string <= 1000" }
});
