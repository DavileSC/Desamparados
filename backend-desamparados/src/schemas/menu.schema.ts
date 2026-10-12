import { type } from 'arktype';
import { depurarNombres, NOMBRES_DE_SIEMPRE, SIN_ETIQUETAS, TOPE_NOMBRE_EN_MENU } from '../domain/menu.js';

/**
 * CMS → Páginas, «Nombre en el menú»: todos los nombres de una vez, ruta a
 * nombre. Un nombre vacío o igual al de siempre se quita (vuelve el de
 * siempre); una ruta que no es del menú o un nombre que no cabe es un 400 con
 * la ruta en el campo (`nombres./ruta`; `ctx.reject` toma la ruta desde la
 * raíz de lo validado), para que el CMS diga cuál.
 */
const nombres = type('Record<string, string>')
  .narrow((valor, ctx) => {
    for (const [ruta, nombre] of Object.entries(valor)) {
      if (!NOMBRES_DE_SIEMPRE.has(ruta)) return ctx.reject({ path: ['body', 'nombres', ruta], problem: 'no es una entrada del menú' });
      const recortado = nombre.trim();
      if (recortado.length > TOPE_NOMBRE_EN_MENU) return ctx.reject({ path: ['body', 'nombres', ruta], problem: `debe tener ${TOPE_NOMBRE_EN_MENU} caracteres como mucho` });
      if (SIN_ETIQUETAS.test(recortado)) return ctx.reject({ path: ['body', 'nombres', ruta], problem: 'no puede llevar los signos < ni >' });
    }
    return true;
  })
  .pipe((valor) => depurarNombres(valor));

export const guardarNombresEnMenuSchema = type({ body: { nombres } });
