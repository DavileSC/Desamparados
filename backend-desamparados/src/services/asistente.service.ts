import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';

/** La fila de `Configuracion` con el estado del asistente, en JSON. */
const CLAVE = 'asistente_inicial';
const DESCRIPCION = 'Asistente de primer arranque del CMS: en qué paso va y qué se ha saltado';

/** Los pasos que se pueden saltar; el nombre (el primero) no, y «Listo» no guarda nada. */
export const PASOS_SALTABLES = ['escudo', 'colores', 'contacto', 'legales', 'secciones'] as const;
export type PasoSaltable = (typeof PASOS_SALTABLES)[number];

export interface EstadoDelAsistente {
  /** El paso en que se dejó, de 0 (el nombre) a 6 (Listo): al volver se sigue ahí. */
  paso: number;
  saltados: PasoSaltable[];
  /** Cuándo se terminó; null mientras quede algo. */
  terminado: string | null;
}

const PENDIENTE: EstadoDelAsistente = { paso: 0, saltados: [], terminado: null };

function leer(valor: string): EstadoDelAsistente {
  try {
    const { paso, saltados, terminado } = JSON.parse(valor) as Partial<EstadoDelAsistente>;
    return {
      paso: Number.isInteger(paso) ? Math.min(Math.max(paso!, 0), 6) : 0,
      saltados: (Array.isArray(saltados) ? saltados : []).filter((s): s is PasoSaltable => (PASOS_SALTABLES as readonly string[]).includes(s)),
      terminado: typeof terminado === 'string' ? terminado : null,
    };
  } catch {
    // Una fila rota no vuelve a sacar el asistente a una web en marcha: se da por hecho.
    console.error(`[Asistente] La fila ${CLAVE} no es un JSON válido: se da por terminado.`);
    return { ...PENDIENTE, paso: 6, terminado: new Date(0).toISOString() };
  }
}

/** Si la base ya tiene hermanos o noticias: entonces es una web en marcha. */
async function tieneDatos(): Promise<boolean> {
  const [hermanos, noticias] = await Promise.all([db.hermano.count(), db.noticia.count()]);
  return hermanos + noticias > 0;
}

/**
 * El asistente que lleva a Administración por lo que hace suya la web (nombre,
 * escudo, colores, contacto, datos legales y secciones) la primera vez que
 * entra en el CMS. No guarda datos propios: cada paso guarda con las rutas de
 * su pantalla de siempre, y aquí solo se apunta por dónde va.
 */
export class AsistenteService {
  /**
   * Al arrancar, la primera vez: una base que ya tiene hermanos o noticias es
   * una web en marcha (la del Grupo, la de pruebas), y el asistente no tiene
   * nada que enseñarle, así que nace terminado. Una base recién instalada, pendiente.
   */
  static async cargar(enMarcha: () => Promise<boolean> = tieneDatos): Promise<void> {
    if (await db.configuracion.findUnique({ where: { key: CLAVE }, select: { key: true } })) return;
    const estado: EstadoDelAsistente = await enMarcha()
      ? { paso: 6, saltados: [], terminado: new Date().toISOString() }
      : PENDIENTE;
    // `upsert` y no `create`: dos arranques a la vez no chocan.
    await db.configuracion.upsert({
      where: { key: CLAVE }, update: {},
      create: { key: CLAVE, value: JSON.stringify(estado), descripcion: DESCRIPCION },
    });
  }

  static async estado(): Promise<EstadoDelAsistente> {
    const fila = await db.configuracion.findUnique({ where: { key: CLAVE } });
    return fila ? leer(fila.value) : PENDIENTE;
  }

  /** Apunta el paso y los saltados; con `terminar`, lo da por acabado (y queda en la auditoría). */
  static async guardar(
    { paso, saltados, terminar }: { paso: number; saltados: PasoSaltable[]; terminar: boolean },
    meta: MetaDeAuditoria,
  ): Promise<EstadoDelAsistente> {
    const antes = await AsistenteService.estado();
    const estado: EstadoDelAsistente = {
      paso,
      saltados: [...new Set(saltados)],
      // Una vez terminado se queda terminado: repasarlo luego no lo vuelve a sacar solo.
      terminado: antes.terminado ?? (terminar ? new Date().toISOString() : null),
    };
    await db.configuracion.upsert({
      where: { key: CLAVE },
      update: { value: JSON.stringify(estado) },
      create: { key: CLAVE, value: JSON.stringify(estado), descripcion: DESCRIPCION },
    });
    if (terminar && !antes.terminado) {
      await AuditoriaService.log(ACCIONES_AUDITORIA.ASISTENTE_TERMINAR, meta, 'config', CLAVE, { saltados: estado.saltados });
    }
    return estado;
  }
}
