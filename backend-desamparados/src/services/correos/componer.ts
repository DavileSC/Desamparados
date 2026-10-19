/**
 * De una plantilla al correo: las piezas de Secretaría (o el original del uso)
 * con sus campos rellenos y sus bloques fijos, dentro de la maqueta común
 * (escudo, firma del cargo, pie).
 *
 * Todo lo que escribe Secretaría y todo campo se escapa: el único HTML que
 * entra es el de las piezas de `plantilla.ts` y el de los bloques fijos, que
 * pone el código.
 */
import { identidad, type Identidad } from '../../domain/datos-entidad.js';
import { aLaCorporacion, deLaCorporacion, laCorporacion, nuestraCorporacion } from '../../domain/articulos.js';
import {
  RUTA_DE_FOTO, enlaceValido, rellenar, resumenDe, usoDe,
  type ClaveDeUso, type Linea, type Pieza, type PlantillaDeCorreo, type UsoDeCorreo,
} from '../../domain/plantillas-correo.js';
import { boton, enlace, esc, firma, foto, maquetar, oracion, parrafo, recuadro, separador, urlDeLaWeb, type Destinatario } from './plantilla.js';

export interface Relleno {
  /** Los valores de los campos, en texto plano: se escapan aquí. */
  campos?: Record<string, string | number | null | undefined>;
  /** El HTML de cada bloque fijo. Vacío o ausente, el bloque no se pinta. */
  bloques?: Record<string, string>;
  para?: Destinatario;
  /** Otra instalación: para las pruebas (igual que en domain/articulos.ts). */
  identidad?: Identidad;
}

/**
 * Los campos que lleva todo correo: el nombre y la advocación, y la
 * corporación con su artículo (domain/articulos.ts), para no escribir «Grupo
 * Parroquial» a mano en cada plantilla. `cuerpoParaElEditor` reutiliza esta
 * misma función para el editor del boletín.
 */
export const comunes = (identidadInstalacion: Identidad = identidad) => ({
  grupo: identidadInstalacion.nombre,
  titular: identidadInstalacion.titular,
  la_corporacion: laCorporacion({ identidad: identidadInstalacion }),
  de_la_corporacion: deLaCorporacion({ identidad: identidadInstalacion }),
  a_la_corporacion: aLaCorporacion({ identidad: identidadInstalacion }),
  nuestra_corporacion: nuestraCorporacion({ identidad: identidadInstalacion }),
  la_corporacion_corto: laCorporacion({ corto: true, identidad: identidadInstalacion }),
  de_la_corporacion_corto: deLaCorporacion({ corto: true, identidad: identidadInstalacion }),
});

/** Una dirección de la plantilla, lista para el correo: las de la web, con su dominio. */
const direccion = (e: string) => (e.startsWith('/') ? urlDeLaWeb(e) : e);

function lineaHtml(linea: Linea, campos: Record<string, string>): string {
  return linea
    .map((t) => {
      let html = esc(rellenar(t.texto, campos)).replace(/\n/g, '<br>');
      if (t.cursiva) html = `<em>${html}</em>`;
      if (t.negrita) html = `<strong>${html}</strong>`;
      // Un enlace que no vale (la revisión no deja guardarlo) se queda en texto.
      if (t.enlace !== undefined && enlaceValido(t.enlace)) html = enlace(direccion(t.enlace.trim()), html);
      return html;
    })
    .join('');
}

const vacio = (html: string) => !html.replace(/<br>|<\/?(strong|em)>|\s/g, '');

function piezaHtml(x: Pieza, campos: Record<string, string>, fijos: Record<string, string>, enRecuadro = false): string {
  // Dentro de un recuadro, menos aire entre párrafos: el recuadro ya tiene el suyo.
  const margen = enRecuadro ? 'margin: 0 0 8px 0;' : 'margin: 0 0 16px 0;';
  switch (x.tipo) {
    case 'fijo': return fijos[x.clave] ?? '';
    case 'parrafo': {
      const html = lineaHtml(x.trozos, campos);
      if (vacio(html)) return '';
      return enRecuadro ? `<p style="${margen}">${html}</p>` : parrafo(html);
    }
    case 'lista': {
      const elementos = x.elementos.map((e) => lineaHtml(e, campos)).filter((h) => !vacio(h));
      if (!elementos.length) return '';
      return `<ul style="${margen} padding-left: 22px;">${elementos.map((e) => `<li style="margin: 0 0 6px 0;">${e}</li>`).join('')}</ul>`;
    }
    case 'recuadro': {
      const dentro = x.piezas.map((p) => piezaHtml(p, campos, fijos, true)).join('');
      if (!dentro && !x.titulo.trim()) return '';
      return recuadro(x.titulo.trim() ? rellenar(x.titulo, campos) : null, dentro);
    }
    case 'oracion': {
      const html = lineaHtml(x.trozos, campos);
      return vacio(html) ? '' : oracion(html);
    }
    case 'boton':
      return x.texto.trim() && enlaceValido(x.enlace) ? boton(rellenar(x.texto, campos), direccion(x.enlace.trim())) : '';
    case 'foto': {
      const nombre = RUTA_DE_FOTO.exec(x.src)?.[1];
      return nombre ? foto(nombre, rellenar(x.alt, campos), rellenar(x.pie, campos)) : '';
    }
    case 'separador': return separador();
  }
}

/** Los campos como texto, con los comunes de la corporación. */
const aTexto = (campos: Relleno['campos'] = {}, identidadInstalacion?: Identidad) => ({
  ...comunes(identidadInstalacion),
  ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
});

/** Compone el correo de un uso con la plantilla dada. */
export function componer(uso: UsoDeCorreo, plantilla: PlantillaDeCorreo, r: Relleno = {}): { asunto: string; html: string; uso: string } {
  const campos = aTexto(r.campos, r.identidad);
  const contenido = plantilla.contenido.map((x) => piezaHtml(x, campos, r.bloques ?? {})).join('');
  const despedida = rellenar(plantilla.despedida, campos).trim();
  return {
    // La clave del uso viaja con el correo: si el envío falla, es lo que se
    // apunta en la auditoría en vez del asunto, que puede llevar un nombre.
    uso: uso.clave,
    // El asunto es texto, no HTML: sin escapar («O'Brien» llegaba como «O&#39;Brien»).
    asunto: rellenar(plantilla.asunto, campos).replace(/\s+/g, ' ').trim(),
    html: maquetar({
      titulo: rellenar(plantilla.titulo, campos),
      antetitulo: rellenar(uso.antetitulo, campos),
      resumen: resumenDe(plantilla, campos),
      contenido: contenido + firma(despedida || null, uso.firma, r.identidad),
      para: r.para,
      identidad: r.identidad,
    }),
  };
}

/** El uso por su clave; si no existe, es un error de programación, no del usuario. */
export function usoObligado(clave: ClaveDeUso): UsoDeCorreo {
  const uso = usoDe(clave);
  if (!uso) throw new Error(`No existe el uso de correo «${clave}» en shared/usos-de-correo.json.`);
  return uso;
}
