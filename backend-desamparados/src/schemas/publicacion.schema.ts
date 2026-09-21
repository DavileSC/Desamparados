import { type } from 'arktype';
import { idParam, paginacionQuery, textoRequerido } from '../config/common';
import { imagenAlEditar, imagenOpcional } from './noticia.schema';
import { aRutaPropia, esPdfPropio, PDF_DE_RELLENO } from '../utils/rutas-propias';

// Se reexporta: lo usan los tests y es parte de la regla del PDF.
export { PDF_DE_RELLENO };

const categorySchema = type("'boletin' | 'dossier' | 'anuario' | 'historia'");

// El PDF de la publicación: lo que devuelve la subida del CMS (32 hex en la raíz
// de /storage/public, con la extensión en mayúsculas o minúsculas) o el de
// relleno del seed. Nada de URLs externas: el botón de descarga de la web
// apuntaría a donde quisiera quien escribió el campo. Una URL absoluta a un PDF
// nuestro se guarda como ruta relativa.
const normalizarPdf = (valor: string) => aRutaPropia(valor, esPdfPropio);

export const rutaPdfPublica = type('string')
  .pipe(normalizarPdf, type('string').narrow(esPdfPropio).describe('un PDF subido desde el CMS (/storage/public/….pdf)'));

// Al editar se valida en el servicio contra lo guardado (ver `imagenAlEditar`).
const pdfAlEditar = type('string').pipe(normalizarPdf);

// Sin declarar page y limit, `validate` los borra en silencio y el listado sirve
// siempre la primera página.
export const categoryParamSchema = type({ params: { category: categorySchema }, query: { ...paginacionQuery } });
export const publicacionesQuerySchema = type({ query: { ...paginacionQuery } });

// Los apartados del listado del CMS. «Incompletas» son las que salen cojas en la
// web (sin portada o sin descripción), estén publicadas o no.
export const ESTADOS_PUBLICACION = ['publicadas', 'borradores', 'incompletas'] as const;
export type EstadoPublicacion = (typeof ESTADOS_PUBLICACION)[number];

// Listado del CMS: búsqueda por palabras, apartado, tipo y página.
export const publicacionesCmsQuerySchema = type({
  query: {
    'q?': 'string <= 100',
    'estado?': "'publicadas' | 'borradores' | 'incompletas'",
    'categoria?': categorySchema,
    ...paginacionQuery,
  },
});
export const crearPublicacionSchema = type({
  body: {
    titulo: textoRequerido,
    archivoUrl: rutaPdfPublica,
    categoria: categorySchema,
    'descripcion?': 'string',
    'imagenUrl?': imagenOpcional,
    'fecha?': type('string').matching(/^\d{4}-\d{2}-\d{2}/),
    'visible?': 'boolean',
  },
});
export const actualizarPublicacionSchema = type({
  body: {
    'titulo?': textoRequerido,
    'archivoUrl?': pdfAlEditar,
    'categoria?': categorySchema,
    'descripcion?': 'string',
    'imagenUrl?': imagenAlEditar,
    'fecha?': type('string').matching(/^\d{4}-\d{2}-\d{2}/),
    'visible?': 'boolean',
    // La destacada de la portada. Solo al editar: se destaca algo que ya existe
    // y está publicado, no se crea destacado.
    'fijada?': 'boolean',
  },
});
export const publicacionIdParamSchema = type({ params: { id: idParam } });
