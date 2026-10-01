/**
 * Las plantillas de los correos (sección Emails): cada una es para un uso, y
 * de cada uso hay como mucho una en uso. Los correos automáticos piden aquí
 * su texto; sin plantilla en uso, sale el original del catálogo.
 *
 * La plantilla en uso no se borra: primero se pone otra (o el original). Así
 * ningún correo se queda sin texto por un clic.
 */
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { componer, usoObligado, type Relleno } from './correos/componer.js';
import { conImagenesEnLinea, recuadro } from './correos/plantilla.js';
import { enviarCorreo } from './correos/envio.js';
import {
  CAMPOS_COMUNES, USOS, problemasDePlantilla, usoDe, type ClaveDeUso, type TextoDePlantilla, type UsoDeCorreo,
} from '../domain/plantillas-correo.js';
import { identidad } from '../domain/datos-entidad.js';

export interface DatosPlantilla extends TextoDePlantilla { nombre: string; uso: string }

const aTexto = (p: TextoDePlantilla): TextoDePlantilla => ({ asunto: p.asunto, titulo: p.titulo, cuerpo: p.cuerpo, despedida: p.despedida });

async function nombreDe(meta: MetaDeAuditoria) {
  if (!meta.userId) return null;
  const u = await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true, apellidos: true } });
  return u ? `${u.nombre} ${u.apellidos ?? ''}`.trim().slice(0, 120) : null;
}

function usoValido(clave: string): UsoDeCorreo {
  const uso = usoDe(clave);
  if (!uso) throw new HttpError('Ese uso de correo no existe.');
  return uso;
}

function revisar(uso: UsoDeCorreo, d: TextoDePlantilla) {
  const problemas = problemasDePlantilla(uso, d);
  if (problemas.length) throw new HttpError(problemas.join(' '));
}

/** Lo que se guarda: recortado, con saltos de línea normales. */
const limpio = (d: DatosPlantilla) => ({
  nombre: d.nombre.trim(), uso: d.uso,
  asunto: d.asunto.trim(), titulo: d.titulo.trim(),
  cuerpo: d.cuerpo.replace(/\r\n?/g, '\n').trim(), despedida: d.despedida.trim(),
});

/**
 * Para la vista previa: cada campo con su ejemplo y cada bloque fijo como un
 * recuadro que dice qué irá ahí. No se inventa una papeleta de ejemplo: el
 * bloque lo pinta el sistema igual que siempre.
 */
function rellenoDeEjemplo(uso: UsoDeCorreo): Relleno {
  return {
    campos: Object.fromEntries([...CAMPOS_COMUNES, ...uso.campos].map((c) => [c.clave, c.ejemplo ?? ''])),
    bloques: Object.fromEntries(uso.bloques.map((b) => [b.clave, recuadro(`[[${b.clave}]]`, `Aquí irá: ${b.ayuda.charAt(0).toLowerCase()}${b.ayuda.slice(1)}.`)])),
  };
}

export class PlantillasCorreoService {
  /** El texto con que sale un correo: el de su plantilla en uso, o el original. */
  static async textoEnUso(clave: ClaveDeUso): Promise<TextoDePlantilla> {
    const uso = usoObligado(clave);
    try {
      const p = await db.plantillaCorreo.findFirst({ where: { uso: clave, enUso: true }, orderBy: { id: 'desc' } });
      return p ? aTexto(p) : uso.porDefecto;
    } catch (e) {
      // Un aviso que no sale por no poder leer su plantilla es peor que uno con el texto de siempre.
      console.error(`Plantilla de correo «${clave}» sin leer; sale el texto original.`, e);
      return uso.porDefecto;
    }
  }

  /** El correo de un uso, listo para mandar. */
  static async correo(clave: ClaveDeUso, relleno: Relleno) {
    return componer(usoObligado(clave), await PlantillasCorreoService.textoEnUso(clave), relleno);
  }

  /** Todos los usos con sus plantillas, para la sección Emails. */
  static async listar() {
    const plantillas = await db.plantillaCorreo.findMany({ orderBy: [{ uso: 'asc' }, { nombre: 'asc' }, { id: 'asc' }] });
    return {
      comunes: CAMPOS_COMUNES,
      usos: USOS.map((u) => ({
        clave: u.clave, grupo: u.grupo, nombre: u.nombre, descripcion: u.descripcion, libre: Boolean(u.libre),
        campos: u.campos, bloques: u.bloques, original: u.porDefecto,
        plantillas: plantillas.filter((p) => p.uso === u.clave).map((p) => ({
          id: p.id, nombre: p.nombre, asunto: p.asunto, enUso: p.enUso, autorNombre: p.autorNombre, updatedAt: p.updatedAt,
        })),
      })),
    };
  }

  static async obtener(id: number) {
    const p = await db.plantillaCorreo.findUnique({ where: { id } });
    if (!p) throw new NotFoundError('Esa plantilla no existe.');
    return p;
  }

  static async crear(d: DatosPlantilla, meta: MetaDeAuditoria) {
    const uso = usoValido(d.uso);
    const datos = limpio(d);
    revisar(uso, datos);
    const p = await db.plantillaCorreo.create({ data: { ...datos, autorNombre: await nombreDe(meta) } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PLANTILLA_CORREO_CREAR, meta, 'plantillaCorreo', p.id, { despues: { nombre: p.nombre, uso: p.uso } });
    return p;
  }

  /** Cambia el texto (y el nombre). El uso no cambia: una plantilla es de un correo. */
  static async actualizar(id: number, d: DatosPlantilla, meta: MetaDeAuditoria) {
    const antes = await PlantillasCorreoService.obtener(id);
    if (d.uso !== antes.uso) throw new HttpError('Una plantilla no cambia de correo: crea otra para ese uso.');
    const datos = limpio(d);
    revisar(usoValido(antes.uso), datos);
    const p = await db.plantillaCorreo.update({ where: { id }, data: { ...datos, autorNombre: await nombreDe(meta) } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PLANTILLA_CORREO_ACTUALIZAR, meta, 'plantillaCorreo', id, {
      antes: { nombre: antes.nombre, asunto: antes.asunto }, despues: { nombre: p.nombre, asunto: p.asunto },
    });
    return p;
  }

  static async borrar(id: number, meta: MetaDeAuditoria) {
    const p = await PlantillasCorreoService.obtener(id);
    if (p.enUso) throw new HttpError('Es la plantilla en uso: pon antes otra, o el texto original, y después bórrala.', 409);
    await db.plantillaCorreo.delete({ where: { id } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PLANTILLA_CORREO_BORRAR, meta, 'plantillaCorreo', id, { antes: { nombre: p.nombre, uso: p.uso } });
    return { message: `Plantilla «${p.nombre}» borrada.` };
  }

  /** Pone en uso una plantilla (y deja de usarse la que lo estaba), o el original con `id = null`. */
  static async usar(uso: string, id: number | null, meta: MetaDeAuditoria) {
    const u = usoValido(uso);
    if (u.libre) throw new HttpError('Las plantillas libres no van con ningún correo automático: se eligen al redactar un aviso.');
    await db.$transaction(async (tx) => {
      if (id !== null) {
        const p = await tx.plantillaCorreo.findUnique({ where: { id } });
        if (!p || p.uso !== uso) throw new NotFoundError('Esa plantilla no es de este correo.');
      }
      await tx.plantillaCorreo.updateMany({ where: { uso, enUso: true, ...(id !== null ? { id: { not: id } } : {}) }, data: { enUso: false } });
      if (id !== null) await tx.plantillaCorreo.update({ where: { id }, data: { enUso: true } });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PLANTILLA_CORREO_USAR, meta, 'plantillaCorreo', id ?? uso, { despues: { uso, plantilla: id ?? 'original' } });
    return PlantillasCorreoService.listar();
  }

  /** Cómo quedaría, con datos de ejemplo, y lo que impediría guardarla. */
  static vistaPrevia(uso: string, texto: TextoDePlantilla) {
    const u = usoValido(uso);
    const { asunto, html } = componer(u, texto, rellenoDeEjemplo(u));
    return { asunto, html: conImagenesEnLinea(html), problemas: problemasDePlantilla(u, texto) };
  }

  /** La vista previa por correo, a quien la está escribiendo. */
  static async enviarPrueba(uso: string, texto: TextoDePlantilla, meta: MetaDeAuditoria) {
    const u = usoValido(uso);
    const usuario = meta.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { email: true } }) : null;
    if (!usuario?.email) throw new HttpError('Tu cuenta no tiene correo al que mandar la prueba.', 409);
    const { asunto, html } = componer(u, texto, rellenoDeEjemplo(u));
    const ok = await enviarCorreo(usuario.email, `[Prueba] ${asunto || u.nombre}`, html);
    if (!ok) throw new HttpError('No se ha podido mandar la prueba. Revisa la cuenta de correo de la web.', 502);
    return { message: `Prueba mandada a ${usuario.email}.` };
  }

  /** Las plantillas libres, para empezar un aviso en «Boletín y avisos»: el cuerpo ya en HTML del editor. */
  static async libres() {
    const lista = await db.plantillaCorreo.findMany({ where: { uso: 'libre' }, orderBy: [{ nombre: 'asc' }, { id: 'asc' }] });
    return lista.map((p) => ({ id: p.id, nombre: p.nombre, asunto: p.asunto, cuerpo: cuerpoParaElEditor(p.cuerpo) }));
  }
}

/**
 * El cuerpo de una plantilla libre como HTML sencillo para el editor del
 * boletín (párrafos, negritas y listas). Los campos comunes se rellenan; los
 * recuadros se quedan como párrafos con su título en negrita.
 */
export function cuerpoParaElEditor(cuerpo: string): string {
  const campos = { grupo: identidad.nombre, titular: identidad.titular };
  const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linea = (l: string) => escapar(l.replace(/\{\{\s*(grupo|titular)\s*\}\}/g, (_, c: 'grupo' | 'titular') => campos[c]))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return cuerpo.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
    const lineas = b.split('\n').map((l) => l.replace(/^>\s?/, ''));
    if (lineas.every((l) => /^-\s+/.test(l))) return `<ul>${lineas.map((l) => `<li><p>${linea(l.replace(/^-\s+/, ''))}</p></li>`).join('')}</ul>`;
    return `<p>${lineas.map(linea).join('<br>')}</p>`;
  }).join('');
}
