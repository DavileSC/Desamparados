import { type } from 'arktype';
import { paginacionQuery, textoRequerido } from '../config/common.js';

const tipoEventoSchema = type("'CULTO' | 'PROCESION' | 'FORMACION' | 'ENSAYO' | 'REUNION' | 'SOCIAL' | 'OTRO'");
const visibilitySchema = type("'public' | 'members_only'");

export const agendaSchema = type({
    body: {
        title: textoRequerido,
        "description?": "string",
        "location?": "string",
        startDate: type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        "endDate?": type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        visibility: visibilitySchema,
        type: tipoEventoSchema // <--- AHORA ES OBLIGATORIO (Sin la '?')
    }
});

export const updateAgendaSchema = type({
    body: {
        "title?": textoRequerido,
        "description?": "string",
        "location?": "string",
        "startDate?": type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        "endDate?": type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).or("null"),
        "visibility?": visibilitySchema,
        "type?": tipoEventoSchema 
    }
});

// Sin `...paginacionQuery`, `validate` borra page y limit en silencio: la
// agenda serviría siempre la primera página y la portada pediría su ?limit=4
// sin que nadie lo escuchara.
export const queryAgendaSchema = type({
    query: {
        ...paginacionQuery,
        "from?": type("string").matching(/^\d{4}-\d{2}-\d{2}/),
        "to?": type("string").matching(/^\d{4}-\d{2}-\d{2}/),
        "type?": tipoEventoSchema
    }
});