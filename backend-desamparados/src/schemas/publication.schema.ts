import { type } from 'arktype';
import { idParam, textoRequerido } from '../config/common';

const categorySchema = type("'boletin' | 'dossier' | 'anuario' | 'historia'");

export const categoryParamSchema = type({ params: { category: categorySchema } });
export const createPublicationSchema = type({
  body: {
    titulo: textoRequerido,
    archivoUrl: textoRequerido,
    categoria: categorySchema,
    'descripcion?': 'string',
    'imagenUrl?': 'string',
    'fecha?': type('string').matching(/^\d{4}-\d{2}-\d{2}/),
    'visible?': 'boolean',
  },
});
export const updatePublicationSchema = type({
  body: {
    'titulo?': textoRequerido,
    'archivoUrl?': textoRequerido,
    'categoria?': categorySchema,
    'descripcion?': 'string',
    'imagenUrl?': 'string',
    'fecha?': type('string').matching(/^\d{4}-\d{2}-\d{2}/),
    'visible?': 'boolean',
  },
});
export const publicationIdParamSchema = type({ params: { id: idParam } });
