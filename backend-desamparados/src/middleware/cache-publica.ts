import type { RequestHandler } from 'express';

/**
 * Cabecera de caché de las lecturas públicas del contenido (páginas, portada,
 * noticias y publicaciones). Solo en rutas que respondan igual a todo el
 * mundo: nunca en una que dependa de la sesión.
 *
 * `no-cache` y no `max-age=60`: el CMS lee y vuelve a pedir estas mismas rutas
 * justo después de publicar (React Query las invalida al guardar), y con un
 * `max-age` el navegador del editor le devolvería la versión de antes durante
 * ese minuto, como si no se hubiera guardado. Con `no-cache` el navegador
 * guarda la respuesta pero pregunta siempre con su ETag (Express la calcula
 * sola), y si nada ha cambiado el servidor contesta un 304 sin cuerpo: se
 * ahorra la transferencia del JSON, no la consulta. `public` deja que la guarde
 * una caché compartida, que tampoco puede servirla sin revalidar.
 */
export const cachePublica: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, no-cache');
  next();
};
