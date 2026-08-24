import { type } from 'arktype';
import { textoRequerido } from '../config/common'; // Ajusta la ruta

export const savePaginaSchema = type({
    body: {
        // Quitamos el .matching() estricto. Dejamos que el servicio lo limpie.
        slug: textoRequerido, 
        titulo: textoRequerido,
        contenido: "string" 
    }
});

// Reutilizamos el concepto del slug del módulo de noticias
export const slugParamSchema = type({
    params: {
        slug: type("string").matching(/^[a-z0-9-]+$/)
    }
});