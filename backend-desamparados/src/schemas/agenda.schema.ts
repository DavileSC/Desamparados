import { type } from 'arktype';
import { paginacionQuery, textoRequerido } from '../config/common.js';
import { imagenOpcional } from './noticia.schema.js';

const tipoEventoSchema = type("'CULTO' | 'PROCESION' | 'FORMACION' | 'ENSAYO' | 'REUNION' | 'SOCIAL' | 'OTRO'");

// El cartel de la Agenda pública: si el acto sale en él, su dedicatoria y su
// foto, con la regla de las fotos de las noticias (solo rutas del propio
// sitio: acaba en el `src` de una <img>). Vacías o null, se quitan.
const camposDelCartel = {
    "cartel?": "boolean",
    "dedicatoria?": type("string <= 191").or("null"),
    "fotoCartel?": imagenOpcional,
} as const;

export const agendaSchema = type({
    body: {
        title: textoRequerido,
        "description?": "string",
        "location?": "string",
        startDate: type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        "endDate?": type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        type: tipoEventoSchema, // <--- AHORA ES OBLIGATORIO (Sin la '?')
        ...camposDelCartel
    }
});

export const updateAgendaSchema = type({
    body: {
        "title?": textoRequerido,
        "description?": "string",
        "location?": "string",
        "startDate?": type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        "endDate?": type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).or("null"),
        "type?": tipoEventoSchema,
        ...camposDelCartel
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

// El calendario del CMS: la rejilla del mes, de `desde` a `hasta` (instantes
// ISO, la medianoche del navegador), sin paginar.
export const queryAgendaCalendarioSchema = type({
    query: {
        desde: type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        hasta: type("string").matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        "q?": "string",
        "tipo?": tipoEventoSchema
    }
});
