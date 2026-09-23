import { type } from 'arktype';
import { paginacionQuery, textoRequerido } from '../config/common.js';

const tipoEventoSchema = type("'CULTO' | 'PROCESION' | 'FORMACION' | 'ENSAYO' | 'REUNION' | 'SOCIAL' | 'OTRO'");

export const agendaSchema = type({
    body: {
        title: textoRequerido,
        "description?": "string",
        "location?": "string",
        startDate: type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        "endDate?": type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
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

// El listado del CMS: pasados o próximos (sin periodo, los próximos), con
// búsqueda en el título, la descripción y el lugar, y filtro de tipo.
export const queryAgendaAdminSchema = type({
    query: {
        ...paginacionQuery,
        "periodo?": "'proximos' | 'pasados'",
        "q?": "string",
        "tipo?": tipoEventoSchema
    }
});
