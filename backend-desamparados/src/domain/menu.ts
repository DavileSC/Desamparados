import catalogo from '../../../shared/entradas-del-menu.json' with { type: 'json' };

/**
 * Las entradas del menú público que pueden cambiar de nombre, con el de
 * siempre (`shared/entradas-del-menu.json`): las páginas por su ruta y los
 * títulos de primer nivel por `seccion:` y su ruta. El servidor no ve el menú
 * de la web (`navegacion.ts`): este catálogo es su copia, y una prueba de la
 * web vigila que coincidan.
 */
export const NOMBRES_DE_SIEMPRE: ReadonlyMap<string, string> = new Map(
  [...catalogo.entradas, ...catalogo.secciones].map((e) => [e.ruta, e.nombre]),
);

/** Más largo no cabe en la barra de escritorio. */
export const TOPE_NOMBRE_EN_MENU = catalogo.tope;

/** Los nombres guardados: solo los que cambian; lo que no está, el de siempre. */
export type NombresEnMenu = Record<string, string>;

/** Nada de etiquetas: el nombre es texto llano, aunque React lo escape al pintarlo. */
export const SIN_ETIQUETAS = /[<>]/;

/**
 * Lo guardado, sin lo que ya no vale: una ruta que dejó de estar en el menú
 * (se quitó o se movió) o un nombre que no es texto se ignoran al leer, en vez
 * de llegar a la web. Un nombre igual al de siempre tampoco se guarda: así
 * cambiar el de siempre en el código llega a quien nunca lo tocó.
 */
export function depurarNombres(guardado: unknown): NombresEnMenu {
  if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return {};
  const limpio: NombresEnMenu = {};
  for (const [ruta, valor] of Object.entries(guardado)) {
    if (typeof valor !== 'string') continue;
    const nombre = valor.trim();
    const deSiempre = NOMBRES_DE_SIEMPRE.get(ruta);
    if (!deSiempre || !nombre || nombre === deSiempre || nombre.length > TOPE_NOMBRE_EN_MENU || SIN_ETIQUETAS.test(nombre)) continue;
    limpio[ruta] = nombre;
  }
  return limpio;
}
