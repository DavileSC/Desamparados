/**
 * De una plantilla al correo: el texto de Secretaría (o el original del uso)
 * con sus campos rellenos y sus bloques fijos, dentro de la maqueta común
 * (escudo, firma del cargo, pie).
 *
 * Todo lo que escribe Secretaría y todo campo se escapa: el único HTML que
 * entra es el de esta función y el de los bloques fijos, que pone el código.
 */
import { identidad, type Identidad } from '../../domain/datos-entidad.js';
import { aLaCorporacion, deLaCorporacion, laCorporacion, nuestraCorporacion } from '../../domain/articulos.js';
import {
  leerCuerpo, leerLinea, rellenar, resumenDe, usoDe,
  type Bloque, type ClaveDeUso, type TextoDePlantilla, type UsoDeCorreo,
} from '../../domain/plantillas-correo.js';
import { esc, firma, maquetar, parrafo, recuadro, type Destinatario } from './plantilla.js';

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

function lineaHtml(linea: string, campos: Record<string, string>): string {
  return leerLinea(linea)
    .map((t) => {
      const html = esc(rellenar(t.texto, campos));
      return t.tipo === 'negrita' ? `<strong>${html}</strong>` : html;
    })
    .join('');
}

function bloqueHtml(b: Bloque, campos: Record<string, string>, fijos: Record<string, string>, enRecuadro = false): string {
  // Dentro de un recuadro, menos aire entre párrafos: el recuadro ya tiene el suyo.
  const margen = enRecuadro ? 'margin: 0 0 8px 0;' : 'margin: 0 0 16px 0;';
  switch (b.tipo) {
    case 'fijo': return fijos[b.clave] ?? '';
    case 'parrafo': {
      const html = b.lineas.map((l) => lineaHtml(l, campos)).join('<br>');
      if (!html.replace(/<br>|\s/g, '')) return '';
      return enRecuadro ? `<p style="${margen}">${html}</p>` : parrafo(html);
    }
    case 'lista':
      return `<ul style="${margen} padding-left: 22px;">${b.elementos.map((e) => `<li style="margin: 0 0 6px 0;">${lineaHtml(e, campos)}</li>`).join('')}</ul>`;
    case 'recuadro':
      return recuadro(b.titulo ? rellenar(b.titulo, campos) : null, b.bloques.map((x) => bloqueHtml(x, campos, fijos, true)).join(''));
  }
}

/** Los campos como texto, con los comunes de la corporación. */
const aTexto = (campos: Relleno['campos'] = {}, identidadInstalacion?: Identidad) => ({
  ...comunes(identidadInstalacion),
  ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
});

/** Compone el correo de un uso con el texto dado. */
export function componer(uso: UsoDeCorreo, texto: TextoDePlantilla, r: Relleno = {}): { asunto: string; html: string; uso: string } {
  const campos = aTexto(r.campos, r.identidad);
  const contenido = leerCuerpo(texto.cuerpo).map((b) => bloqueHtml(b, campos, r.bloques ?? {})).join('');
  const despedida = rellenar(texto.despedida, campos).trim();
  return {
    // La clave del uso viaja con el correo: si el envío falla, es lo que se
    // apunta en la auditoría en vez del asunto, que puede llevar un nombre.
    uso: uso.clave,
    // El asunto es texto, no HTML: sin escapar («O'Brien» llegaba como «O&#39;Brien»).
    asunto: rellenar(texto.asunto, campos).replace(/\s+/g, ' ').trim(),
    html: maquetar({
      titulo: rellenar(texto.titulo, campos),
      antetitulo: rellenar(uso.antetitulo, campos),
      resumen: resumenDe(texto.cuerpo, campos),
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
