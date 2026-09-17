/**
 * Vídeos de la galería: solo YouTube y Vimeo, y siempre guardados ya como la
 * dirección de incrustación.
 *
 * Por qué una lista cerrada y no una URL libre: el valor acaba en el `src` de un
 * iframe de la web pública. Con dirección libre, quien edite el CMS podría
 * incrustar cualquier página, y eso es tanto como dejarle meter contenido ajeno
 * dentro del sitio.
 *
 * Por qué se normaliza al guardar y no al pintar: así la web solo tiene que
 * poner el valor en el iframe, sin repetir en el navegador unas reglas de
 * seguridad que ya se aplicaron en el servidor.
 *
 * Y por qué `youtube-nocookie` y `dnt=1`: la forma normal de YouTube deja
 * cookies de terceros en cuanto el marco se carga, sin que el visitante haya
 * pulsado nada. La web además no carga el marco hasta que se le da al play.
 *
 * Puro y sin dependencias, para poder probarlo sin levantar nada.
 */

/** Identificador de YouTube: 11 caracteres de su alfabeto, ni uno más. */
const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

/** Los de Vimeo son numéricos. */
const ID_VIMEO = /^\d{6,12}$/;

const DOMINIOS_YOUTUBE = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
  'youtu.be', 'www.youtu.be',
]);

const DOMINIOS_VIMEO = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/**
 * La dirección de incrustación, o `null` si no es un vídeo que aceptemos.
 *
 * El dominio se compara contra una lista exacta y no con `includes`: con
 * `includes`, «youtube.com.sitio-malo.test» habría pasado por bueno.
 */
export function normalizarVideo(url: string): string | null {
  let analizada: URL;
  try {
    analizada = new URL(url.trim());
  } catch {
    return null;
  }

  if (analizada.protocol !== 'https:') return null;

  const host = analizada.hostname.toLowerCase();
  const partes = analizada.pathname.split('/').filter(Boolean);

  if (DOMINIOS_YOUTUBE.has(host)) {
    // youtu.be/ID · youtube.com/embed/ID · youtube.com/shorts/ID · watch?v=ID
    const id = host.endsWith('youtu.be')
      ? partes[0]
      : (partes[0] === 'embed' || partes[0] === 'shorts' || partes[0] === 'v')
        ? partes[1]
        : analizada.searchParams.get('v') ?? undefined;
    return id && ID_YOUTUBE.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  if (DOMINIOS_VIMEO.has(host)) {
    // vimeo.com/ID · player.vimeo.com/video/ID
    const id = partes[0] === 'video' ? partes[1] : partes[0];
    return id && ID_VIMEO.test(id) ? `https://player.vimeo.com/video/${id}?dnt=1` : null;
  }

  return null;
}
