import { Role } from '@prisma/client';
import db from '../config/db';
import { HttpError } from '../utils/error.handle.js';
import { anioDeHoy, periodoDe, ANIO_MINIMO_DATOS } from '../domain/periodo-datos.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';
import type { TextosInforme } from './informes/informes.js';

/**
 * Los textos a mano del Informe anual: la presentación del Hermano Mayor, el
 * epílogo del Secretario, la nota de patrimonio, el lugar y la fecha de las
 * firmas y la fecha del cabildo de la portada.
 *
 * Secretaría solo escribe su epílogo y su firma; el Hermano Mayor y
 * Administración, todo.
 */

export const CAMPOS_INFORME = ['presentacion', 'firmaPresentacion', 'lugarFecha', 'epilogo', 'firmaEpilogo', 'notaPatrimonio', 'fechaCabildo'] as const;
export type CampoInforme = typeof CAMPOS_INFORME[number];

const DE_SECRETARIA: CampoInforme[] = ['epilogo', 'firmaEpilogo'];

export function puedeEscribir(role: string, campo: CampoInforme): boolean {
  if (role === Role.ADMIN || role === Role.HERMANO_MAYOR) return true;
  return role === Role.SECRETARIA && DE_SECRETARIA.includes(campo);
}

export interface InformeAnualResponse {
  anio: number;
  desde: string;
  hasta: string;
  textos: TextosInforme;
  /** Lo que falta para poder generar el Informe definitivo. */
  faltan: ('presentacion' | 'epilogo')[];
  actualizada: string | null;
}

const VACIO: TextosInforme = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: null, fechaCabildo: null };

/** Un año con sentido: ya empezado (el de ahora se prepara mientras transcurre), y no antes de que haya datos. */
export function leerAnio(valor: string, hoy = new Date()): number {
  const anio = Number(valor);
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO_DATOS || anio > anioDeHoy(hoy)) {
    throw new HttpError('Ese año todavía no ha empezado o no existe.', 400);
  }
  return anio;
}

/** Sin espacios sobrantes; vacío es no haberlo escrito. Los párrafos se respetan. */
const limpiar = (texto: string | null | undefined) => {
  const t = (texto ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length ? t : null;
};

export class InformeAnualService {
  static async leer(anio: number, hoy = new Date()): Promise<InformeAnualResponse> {
    const fila = await db.informeAnual.findUnique({ where: { anio } });
    const textos: TextosInforme = fila ? Object.fromEntries(CAMPOS_INFORME.map((c) => [c, fila[c]])) as unknown as TextosInforme : VACIO;
    const p = periodoDe(anio, hoy);
    return {
      anio,
      desde: p.desde,
      hasta: p.hasta,
      textos,
      faltan: [...(textos.presentacion ? [] : ['presentacion' as const]), ...(textos.epilogo ? [] : ['epilogo' as const])],
      actualizada: fila?.updatedAt.toISOString() ?? null,
    };
  }

  static async guardar(anio: number, cambios: Partial<Record<CampoInforme, string | null>>, usuario: { id: number; role: string }, meta: MetaDeAuditoria): Promise<InformeAnualResponse> {
    const campos = CAMPOS_INFORME.filter((c) => c in cambios);
    const ajenos = campos.filter((c) => !puedeEscribir(usuario.role, c));
    if (ajenos.length) {
      throw new HttpError('Secretaría escribe el epílogo y su firma; el resto del Informe anual lo escriben el Hermano Mayor o Administración.', 403);
    }
    if (campos.length === 0) return InformeAnualService.leer(anio);
    const datos = Object.fromEntries(campos.map((c) => [c, limpiar(cambios[c])]));
    await db.informeAnual.upsert({ where: { anio }, update: datos, create: { anio, ...datos } });
    // En la auditoría, qué se tocó y cuánto mide: los textos enteros no hacen falta ahí.
    await AuditoriaService.log(ACCIONES_AUDITORIA.INFORME_ANUAL_ACTUALIZAR, meta, 'informe-anual', anio, {
      campos: Object.fromEntries(campos.map((c) => [c, datos[c] ? `${(datos[c] as string).length} caracteres` : 'vacío'])),
    });
    return InformeAnualService.leer(anio);
  }
}
