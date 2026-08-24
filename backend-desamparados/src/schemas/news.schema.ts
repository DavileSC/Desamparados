import { type } from 'arktype';
import { textoRequerido } from '../config/common';

// El contenido del CMS viene de un editor WYSIWYG: aceptamos HTML.
// La defensa contra XSS NO es este schema, sino el sanitizeHtml() del servicio
// (que elimina <script>, event handlers, etc. y conserva el formato legítimo).
const contenidoHtml = type("string > 0").describe("el contenido HTML de la noticia");

// Esquema para crear (titulo y contenido obligatorios)
export const createNewsSchema = type({
    body: {
        titulo: textoRequerido,
        contenido: contenidoHtml,
        "extracto?": "string",
        "imagenUrl?": "string",
        "visible?": "boolean",
        "fecha?": type("string").matching(/^\d{4}-\d{2}-\d{2}/), // Fecha ISO
        "slug?": type("string").matching(/^[a-z0-9-]+$/) // Solo letras minúsculas, números y guiones
    }
});

// Esquema para actualizar (todo opcional)
export const updateNewsSchema = type({
    body: {
        "titulo?": textoRequerido,
        "contenido?": contenidoHtml,
        "extracto?": "string",
        "imagenUrl?": "string",
        "visible?": "boolean",
        "fecha?": type("string").matching(/^\d{4}-\d{2}-\d{2}/),
        "slug?": type("string").matching(/^[a-z0-9-]+$/)
    }
});

// Esquema para la configuración del límite (Asegura que manden un número)
export const limitConfigSchema = type({
    body: {
        limit: "number"
    }
});

// Validar parámetros de la URL
export const slugParamSchema = type({
    params: {
        slug: type("string").matching(/^[a-z0-9-]+$/)
    }
});