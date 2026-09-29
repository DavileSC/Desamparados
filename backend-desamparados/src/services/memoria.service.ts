import { Role } from '@prisma/client';
import db from '../config/db';
import { HttpError } from '../utils/error.handle.js';
import { cursoDeHoy, periodoDe, ANIO_MINIMO_DATOS } from '../domain/periodo-datos.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';
import type { TextosMemoria } from './informes/informes.js';

/**
 * Los textos a mano de la Memoria del curso: la presentación del Hermano
 * Mayor, el epílogo del Secretario, la nota de patrimonio, el lugar y la fecha
 * de las firmas y la fecha del cabildo de la portada.
 *
 * Secretaría solo escribe su epílogo y su firma; el Hermano Mayor y
 * Administración, todo.
 */

export const CAMPOS_MEMORIA = ['presentacion', 'firmaPresentacion', 'lugarFecha', 'epilogo', 'firmaEpilogo', 'notaPatrimonio', 'fechaCabildo'] as const;
export type CampoMemoria = typeof CAMPOS_MEMORIA[number];

const DE_SECRETARIA: CampoMemoria[] = ['epilogo', 'firmaEpilogo'];

export function puedeEscribir(role: string, campo: CampoMemoria): boolean {
  if (role === Role.ADMIN || role === Role.HERMANO_MAYOR) return true;
  return role === Role.SECRETARIA && DE_SECRETARIA.includes(campo);
}

export interface MemoriaResponse {
  curso: number;
  etiqueta: string;
  desde: string;
  hasta: string;
  textos: TextosMemoria;
  /** Lo que falta para poder generar la Memoria definitiva. */
  faltan: ('presentacion' | 'epilogo')[];
  actualizada: string | null;
}

const VACIA: TextosMemoria = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: null, fechaCabildo: null };

/** Un curso con sentido: ya empezado, y no antes de que haya datos. */
export function leerCurso(valor: string, hoy = new Date()): number {
  const curso = Number(valor);
  if (!Number.isInteger(curso) || curso < ANIO_MINIMO_DATOS || curso > cursoDeHoy(hoy)) {
    throw new HttpError('Ese curso todavía no ha empezado o no existe.', 400);
  }
  return curso;
}

/** Sin espacios sobrantes; vacío es no haberlo escrito. Los párrafos se respetan. */
const limpiar = (texto: string | null | undefined) => {
  const t = (texto ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length ? t : null;
};

export class MemoriaService {
  static async leer(curso: number, hoy = new Date()): Promise<MemoriaResponse> {
    const fila = await db.memoriaCurso.findUnique({ where: { curso } });
    const textos: TextosMemoria = fila ? Object.fromEntries(CAMPOS_MEMORIA.map((c) => [c, fila[c]])) as unknown as TextosMemoria : VACIA;
    const p = periodoDe('curso', curso, hoy);
    return {
      curso,
      etiqueta: p.etiqueta,
      desde: p.desde,
      hasta: p.hasta,
      textos,
      faltan: [...(textos.presentacion ? [] : ['presentacion' as const]), ...(textos.epilogo ? [] : ['epilogo' as const])],
      actualizada: fila?.updatedAt.toISOString() ?? null,
    };
  }

  static async guardar(curso: number, cambios: Partial<Record<CampoMemoria, string | null>>, usuario: { id: number; role: string }, meta: MetaDeAuditoria): Promise<MemoriaResponse> {
    const campos = CAMPOS_MEMORIA.filter((c) => c in cambios);
    const ajenos = campos.filter((c) => !puedeEscribir(usuario.role, c));
    if (ajenos.length) {
      throw new HttpError('Secretaría escribe el epílogo y su firma; el resto de la Memoria lo escriben el Hermano Mayor o Administración.', 403);
    }
    if (campos.length === 0) return MemoriaService.leer(curso);
    const datos = Object.fromEntries(campos.map((c) => [c, limpiar(cambios[c])]));
    await db.memoriaCurso.upsert({ where: { curso }, update: datos, create: { curso, ...datos } });
    // En la auditoría, qué se tocó y cuánto mide: los textos enteros no hacen falta ahí.
    await AuditoriaService.log(ACCIONES_AUDITORIA.MEMORIA_ACTUALIZAR, meta, 'memoria', curso, {
      campos: Object.fromEntries(campos.map((c) => [c, datos[c] ? `${(datos[c] as string).length} caracteres` : 'vacío'])),
    });
    return MemoriaService.leer(curso);
  }
}
