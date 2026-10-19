/**
 * Las plantillas de los correos (sección Emails): cada una es para un uso, y
 * de cada uso hay como mucho una en uso. Los correos automáticos piden aquí
 * su plantilla; sin plantilla en uso, sale el original del catálogo.
 *
 * La plantilla en uso no se borra: primero se pone otra (o el original). Así
 * ningún correo se queda sin texto por un clic.
 */
import type { PlantillaCorreo, Prisma } from '@prisma/client';
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { comunes, componer, usoObligado, type Relleno } from './correos/componer.js';
import { conImagenesEnLinea, recuadro } from './correos/plantilla.js';
import type { Identidad } from '../domain/datos-entidad.js';
import { FICHEROS_MARCA } from '../domain/marca.js';
import { enviarCorreo } from './correos/envio.js';
import {
  CAMPOS_COMUNES, RUTA_DE_FOTO, USOS, avisosDePlantilla, leerCuerpo, plantillaLimpia, problemasDePlantilla, usoDe,
  type ClaveDeUso, type Linea, type Pieza, type PlantillaDeCorreo, type UsoDeCorreo,
} from '../domain/plantillas-correo.js';

export interface DatosPlantilla extends PlantillaDeCorreo { nombre: string; uso: string }

/** Las versiones que se guardan de cada plantilla. */
const VERSIONES_POR_PLANTILLA = 20;
/** Tope del JSON de las piezas: los del esquema, juntos, darían para un correo de megas. */
const TOPE_DEL_CONTENIDO = 120_000;

/**
 * La plantilla guardada, en piezas. Las de antes del editor por piezas no
 * tienen `contenido`: se leen de su cuerpo en el formato de texto.
 */
const deFila = (p: PlantillaCorreo): PlantillaDeCorreo => ({
  asunto: p.asunto,
  resumen: p.resumen,
  titulo: p.titulo,
  contenido: p.contenido === null ? leerCuerpo(p.cuerpo) : (p.contenido as unknown as Pieza[]),
  despedida: p.despedida,
});

// El cliente de Prisma no ve las uniones de `Pieza` como JSON: se le dice que lo son.
const comoJson = (x: unknown) => x as Prisma.InputJsonValue;
const datosDeVersion = (p: PlantillaDeCorreo) => comoJson({ asunto: p.asunto, resumen: p.resumen, titulo: p.titulo, contenido: p.contenido, despedida: p.despedida });

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

/** La plantilla limpia y revisada, o el error que impide guardarla. */
function revisada(uso: UsoDeCorreo, d: PlantillaDeCorreo): PlantillaDeCorreo {
  const p = plantillaLimpia(d);
  if (JSON.stringify(p.contenido).length > TOPE_DEL_CONTENIDO) throw new HttpError('El correo es demasiado largo: pártelo en dos o quita alguna pieza.');
  const problemas = problemasDePlantilla(uso, p);
  if (problemas.length) throw new HttpError(problemas.join(' '));
  return p;
}

/** Las fotos de unas piezas, para no borrarlas mientras se usen. */
const fotosDe = (...piezas: unknown[]) => subidasEnTexto(...piezas.map((x) => JSON.stringify(x ?? null)));

/**
 * Para la vista previa: cada campo del uso con su ejemplo y cada bloque fijo
 * como un recuadro que dice qué irá ahí. No se inventa una papeleta de
 * ejemplo: el bloque lo pinta el sistema igual que siempre.
 *
 * Los campos comunes no llevan ejemplo: van con los valores de verdad de la
 * instalación (`comunes()`, el mismo relleno que el correo real). Con el
 * ejemplo fijo del catálogo, otra corporación veía «al Grupo Parroquial» en
 * su propia vista previa, y {{grupo}} y {{titular}}, sin ejemplo, salían vacíos.
 */
function rellenoDeEjemplo(uso: UsoDeCorreo, identidadInstalacion?: Identidad): Relleno {
  return {
    campos: { ...comunes(identidadInstalacion), ...Object.fromEntries(uso.campos.map((c) => [c.clave, c.ejemplo ?? ''])) },
    bloques: Object.fromEntries(uso.bloques.map((b) => [b.clave, recuadro(b.ayuda, 'Este bloque lo pone la web con los datos de cada correo.')])),
    identidad: identidadInstalacion,
  };
}

export class PlantillasCorreoService {
  /** La plantilla con que sale un correo: la que está en uso, o el original. */
  static async plantillaEnUso(clave: ClaveDeUso): Promise<PlantillaDeCorreo> {
    const uso = usoObligado(clave);
    try {
      const p = await db.plantillaCorreo.findFirst({ where: { uso: clave, enUso: true }, orderBy: { id: 'desc' } });
      return p ? deFila(p) : uso.porDefecto;
    } catch (e) {
      // Un aviso que no sale por no poder leer su plantilla es peor que uno con el texto de siempre.
      console.error(`Plantilla de correo «${clave}» sin leer; sale el texto original.`, e);
      return uso.porDefecto;
    }
  }

  /** El correo de un uso, listo para mandar. */
  static async correo(clave: ClaveDeUso, relleno: Relleno) {
    return componer(usoObligado(clave), await PlantillasCorreoService.plantillaEnUso(clave), relleno);
  }

  /** Todos los usos con sus plantillas, para la sección Emails. */
  static async listar() {
    const plantillas = await db.plantillaCorreo.findMany({
      orderBy: [{ uso: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
      select: { id: true, nombre: true, uso: true, asunto: true, enUso: true, autorNombre: true, updatedAt: true },
    });
    const valoresComunes = comunes();
    return {
      // Sin `correo-cabecera.jpg` en la marca, los correos van sin imagen bajo el membrete.
      conCabecera: FICHEROS_MARCA.correoCabecera !== null,
      // El ejemplo de cada campo común, el de esta instalación: escrito en el
      // catálogo, otra corporación veía de ayuda «al Grupo Parroquial».
      comunes: CAMPOS_COMUNES.map((c) => ({ ...c, ejemplo: valoresComunes[c.clave as keyof typeof valoresComunes] })),
      usos: USOS.map((u) => ({
        clave: u.clave, grupo: u.grupo, nombre: u.nombre, descripcion: u.descripcion, libre: Boolean(u.libre),
        antetitulo: u.antetitulo, firma: u.firma,
        campos: u.campos, bloques: u.bloques, original: u.porDefecto,
        plantillas: plantillas.filter((p) => p.uso === u.clave).map(({ uso: _uso, ...p }) => p),
      })),
    };
  }

  static async obtener(id: number) {
    const p = await db.plantillaCorreo.findUnique({ where: { id } });
    if (!p) throw new NotFoundError('Esa plantilla no existe.');
    return { id: p.id, nombre: p.nombre, uso: p.uso, enUso: p.enUso, autorNombre: p.autorNombre, updatedAt: p.updatedAt, ...deFila(p) };
  }

  static async crear(d: DatosPlantilla, meta: MetaDeAuditoria) {
    const uso = usoValido(d.uso);
    const plantilla = revisada(uso, d);
    const autorNombre = await nombreDe(meta);
    const p = await db.$transaction(async (tx) => {
      const creada = await tx.plantillaCorreo.create({
        data: { nombre: d.nombre.trim(), uso: uso.clave, ...plantilla, contenido: comoJson(plantilla.contenido), cuerpo: '', autorNombre },
      });
      await tx.versionPlantillaCorreo.create({ data: { plantillaId: creada.id, datos: datosDeVersion(plantilla), autorNombre: autorNombre ?? '' } });
      return creada;
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PLANTILLA_CORREO_CREAR, meta, 'plantillaCorreo', p.id, { despues: { nombre: p.nombre, uso: p.uso } });
    return PlantillasCorreoService.obtener(p.id);
  }

  /** Cambia las piezas (y el nombre). El uso no cambia: una plantilla es de un correo. */
  static async actualizar(id: number, d: DatosPlantilla, meta: MetaDeAuditoria) {
    const fila = await db.plantillaCorreo.findUnique({ where: { id } });
    if (!fila) throw new NotFoundError('Esa plantilla no existe.');
    if (d.uso !== fila.uso) throw new HttpError('Una plantilla no cambia de correo: crea otra para ese uso.');
    const plantilla = revisada(usoValido(fila.uso), d);
    const antes = deFila(fila);
    const autorNombre = await nombreDe(meta);

    await db.$transaction(async (tx) => {
      await tx.plantillaCorreo.update({
        where: { id },
        data: { nombre: d.nombre.trim(), ...plantilla, contenido: comoJson(plantilla.contenido), cuerpo: '', autorNombre },
      });
      // Una plantilla de antes del historial estrena el suyo con cómo era:
      // si no, la primera vez que se guarda no habría a qué volver.
      if ((await tx.versionPlantillaCorreo.count({ where: { plantillaId: id } })) === 0) {
        await tx.versionPlantillaCorreo.create({ data: { plantillaId: id, datos: datosDeVersion(antes), autorNombre: fila.autorNombre ?? '', createdAt: fila.updatedAt } });
      }
      await tx.versionPlantillaCorreo.create({ data: { plantillaId: id, datos: datosDeVersion(plantilla), autorNombre: autorNombre ?? '' } });
    });

    const sobrantes = await db.versionPlantillaCorreo.findMany({
      where: { plantillaId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: VERSIONES_POR_PLANTILLA,
      select: { id: true, datos: true },
    });
    if (sobrantes.length) await db.versionPlantillaCorreo.deleteMany({ where: { id: { in: sobrantes.map((v) => v.id) } } });
    await borrarSubidasHuerfanas(fotosDe(antes.contenido, ...sobrantes.map((v) => v.datos)), { conservar: fotosDe(plantilla.contenido) });

    await AuditoriaService.log(ACCIONES_AUDITORIA.PLANTILLA_CORREO_ACTUALIZAR, meta, 'plantillaCorreo', id, {
      antes: { nombre: fila.nombre, asunto: fila.asunto }, despues: { nombre: d.nombre.trim(), asunto: plantilla.asunto },
    });
    return PlantillasCorreoService.obtener(id);
  }

  static async borrar(id: number, meta: MetaDeAuditoria) {
    const p = await db.plantillaCorreo.findUnique({ where: { id }, include: { versiones: { select: { datos: true } } } });
    if (!p) throw new NotFoundError('Esa plantilla no existe.');
    if (p.enUso) throw new HttpError('Es la plantilla en uso: pon antes otra, o el texto original, y después bórrala.', 409);
    await db.plantillaCorreo.delete({ where: { id } });
    await borrarSubidasHuerfanas(fotosDe(p.contenido, ...p.versiones.map((v) => v.datos)));
    await AuditoriaService.log(ACCIONES_AUDITORIA.PLANTILLA_CORREO_BORRAR, meta, 'plantillaCorreo', id, { antes: { nombre: p.nombre, uso: p.uso } });
    return { message: `Plantilla «${p.nombre}» borrada.` };
  }

  /** Las versiones guardadas de una plantilla, de la más reciente a la más antigua, con sus piezas. */
  static async versiones(id: number) {
    await PlantillasCorreoService.obtener(id);
    const filas = await db.versionPlantillaCorreo.findMany({ where: { plantillaId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return filas.map((v) => ({ id: v.id, autorNombre: v.autorNombre, createdAt: v.createdAt, datos: v.datos as unknown as PlantillaDeCorreo }));
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

  /**
   * Cómo quedaría, con datos de ejemplo; lo que impediría guardarla y lo que
   * conviene mirar. La identidad solo la pasan las pruebas, como en
   * `componer`: producción usa la de esta instalación.
   */
  static vistaPrevia(uso: string, plantilla: PlantillaDeCorreo, identidadInstalacion?: Identidad) {
    const u = usoValido(uso);
    const p = plantillaLimpia(plantilla);
    const { asunto, html } = componer(u, p, rellenoDeEjemplo(u, identidadInstalacion));
    return { asunto, html: conImagenesEnLinea(html), problemas: problemasDePlantilla(u, p), avisos: avisosDePlantilla(p) };
  }

  /** La vista previa por correo, a quien la está escribiendo. */
  static async enviarPrueba(uso: string, plantilla: PlantillaDeCorreo, meta: MetaDeAuditoria) {
    const u = usoValido(uso);
    const usuario = meta.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { email: true } }) : null;
    if (!usuario?.email) throw new HttpError('Tu cuenta no tiene correo al que mandar la prueba.', 409);
    const { asunto, html } = componer(u, plantillaLimpia(plantilla), rellenoDeEjemplo(u));
    const ok = await enviarCorreo(usuario.email, `[Prueba] ${asunto || u.nombre}`, html, { uso: `prueba_${u.clave}` });
    if (!ok) throw new HttpError('No se ha podido mandar la prueba. Revisa la cuenta de correo de la web.', 502);
    return { message: `Prueba mandada a ${usuario.email}.` };
  }

  /** Las plantillas libres, para empezar un aviso en «Boletín y avisos»: el cuerpo ya en HTML del editor. */
  static async libres() {
    const lista = await db.plantillaCorreo.findMany({ where: { uso: 'libre' }, orderBy: [{ nombre: 'asc' }, { id: 'asc' }] });
    return lista.map((p) => ({ id: p.id, nombre: p.nombre, asunto: p.asunto, cuerpo: cuerpoParaElEditor(deFila(p).contenido) }));
  }
}

/**
 * Las piezas de una plantilla libre como HTML sencillo para el editor del
 * boletín (el de las noticias: párrafos, negritas, cursivas, enlaces, listas,
 * citas y fotos). Los campos comunes se rellenan (la expresión regular
 * recorre `CAMPOS_COMUNES` en vez de listarlos a mano, para no olvidar
 * ninguno al añadir uno nuevo); un recuadro se queda en su título en negrita
 * y sus párrafos, y un botón, en un enlace.
 */
export function cuerpoParaElEditor(contenido: Pieza[]): string {
  const campos: Record<string, string> = comunes();
  const clavesComunes = CAMPOS_COMUNES.map((c) => c.clave).join('|');
  const reComunes = new RegExp(`\\{\\{\\s*(${clavesComunes})\\s*\\}\\}`, 'g');
  const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const texto = (t: string) => escapar(t.replace(reComunes, (_, c: string) => campos[c] ?? '')).replace(/\n/g, '<br>');
  const linea = (l: Linea) => l.map((t) => {
    let html = texto(t.texto);
    if (t.cursiva) html = `<em>${html}</em>`;
    if (t.negrita) html = `<strong>${html}</strong>`;
    if (t.enlace) html = `<a href="${escapar(t.enlace)}">${html}</a>`;
    return html;
  }).join('');
  const pieza = (x: Pieza): string => {
    switch (x.tipo) {
      case 'parrafo': return `<p>${linea(x.trozos)}</p>`;
      case 'lista': return `<ul>${x.elementos.map((e) => `<li><p>${linea(e)}</p></li>`).join('')}</ul>`;
      case 'recuadro': return `${x.titulo ? `<p><strong>${texto(x.titulo)}</strong></p>` : ''}${x.piezas.map(pieza).join('')}`;
      case 'oracion': return `<blockquote><p>${linea(x.trozos)}</p></blockquote>`;
      case 'boton': return `<p><a href="${escapar(x.enlace)}">${texto(x.texto)}</a></p>`;
      case 'foto': return RUTA_DE_FOTO.test(x.src) ? `<img src="${escapar(x.src)}" alt="${escapar(x.alt)}">${x.pie ? `<p><em>${texto(x.pie)}</em></p>` : ''}` : '';
      case 'separador': case 'fijo': return '';
    }
  };
  return contenido.map(pieza).filter(Boolean).join('');
}
