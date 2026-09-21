import { type } from 'arktype';
import { textoRequerido } from '../config/common';
import { rutaImagenPublica } from './portada.schema';
import { aRutaPropia, esImagenPropia } from '../utils/rutas-propias';

// El contenido del CMS viene de un editor WYSIWYG: aceptamos HTML.
// La defensa contra XSS NO es este schema, sino el sanitizeHtml() del servicio
// (que elimina <script>, event handlers, etc. y conserva el formato legítimo).
const contenidoHtml = type("string > 0").describe("el contenido HTML de la noticia");

// La foto es la ruta que devuelve la subida del CMS, con la misma regla que las
// fotos de la portada: nada de URLs externas (rastrean a quien lee) ni de
// esquemas raros. La cadena vacía (o null) es «sin foto»: es lo que manda el
// CMS al pulsar «Quitar foto». Una URL absoluta a una foto nuestra
// (`https://…/storage/public/<hex>.jpg`) se guarda como ruta relativa.
export const imagenOpcional = type('string | null')
    .pipe((valor: string | null) => (valor === null ? null : aRutaPropia(valor, esImagenPropia)), rutaImagenPublica.or("'' | null"));

// Al editar, la foto no se valida aquí sino en el servicio, contra lo que ya
// estaba guardado (utils/rutas-propias.ts, `rutaAlEditar`): el formulario reenvía
// la ficha entera, y una foto guardada antes de esta validación no debe impedir
// guardar el resto. Solo se normalizan las URL absolutas propias.
export const imagenAlEditar = type('string | null')
    .pipe((valor: string | null) => (valor === null ? null : aRutaPropia(valor, esImagenPropia)));

// Esquema para crear (titulo y contenido obligatorios)
export const createNewsSchema = type({
    body: {
        titulo: textoRequerido,
        contenido: contenidoHtml,
        "extracto?": "string",
        "imagenUrl?": imagenOpcional,
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
        "imagenUrl?": imagenAlEditar,
        "visible?": "boolean",
        // La destacada de la portada. Solo al editar: se destaca algo que ya
        // existe y está publicado, no se crea destacado.
        "fijada?": "boolean",
        "fecha?": type("string").matching(/^\d{4}-\d{2}-\d{2}/),
        "slug?": type("string").matching(/^[a-z0-9-]+$/)
    }
});

// Los apartados del listado del CMS. «Incompletas» son las que salen cojas en la
// web (sin foto o sin extracto), estén publicadas o no.
export const ESTADOS_NOTICIA = ['publicadas', 'borradores', 'incompletas'] as const;
export type EstadoNoticia = (typeof ESTADOS_NOTICIA)[number];

// Listado del CMS: búsqueda por palabras, apartado y página.
export const adminArchiveQuerySchema = type({
    query: {
        "q?": "string <= 100",
        "estado?": "'publicadas' | 'borradores' | 'incompletas'",
        "page?": type("string").matching(/^[1-9]\d*$/),
        "limit?": type("string").matching(/^[1-9]\d*$/)
    }
});

// Validar parámetros de la URL
export const slugParamSchema = type({
    params: {
        slug: type("string").matching(/^[a-z0-9-]+$/)
    }
});
