/**
 * La puerta del templo: los diputados leen el QR de cada papeleta al entrar
 * y la Junta ve en vivo cuántos faltan por tramo.
 *
 * La entrada se guarda en la propia papeleta (`entradaEl`, `entradaPor`), no
 * en la auditoría: son cientos en una tarde y ya dicen quién y cuándo. Solo
 * deshacer una entrada pasa por la auditoría, que es lo que alguien puede
 * querer explicar después.
 */
import db from '../../config/db.js';
import { NotFoundError } from '../../utils/error.handle.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from '../auditoria.service.js';
import { leerCodigoDeFamilia, leerCodigoDePapeleta } from '../../domain/papeleta-qr.js';
import { cuentasPorTramo, veredicto, type Veredicto } from '../../domain/puerta.js';
import { anioDeLaMesa } from './zonas.service.js';
import { leerConfiguracion } from './cortejo.service.js';
import type { SalidaConActo } from './salidas.service.js';

const DE_LA_PAPELETA = {
  id: true, year: true, salidaId: true, salida: { select: { slug: true } }, puesto: true, tramo: true, numero: true, entradaEl: true, entradaPor: true,
  hermano: { select: { nombre: true, apellidos: true, numeroHermano: true } },
} as const;

type Fila = NonNullable<Awaited<ReturnType<typeof buscar>>>;

const buscar = (id: number) => db.papeletaSitio.findUnique({ where: { id }, select: DE_LA_PAPELETA });

/** Lo que se enseña de una papeleta en la puerta: quién es y dónde va, nada más. */
const aPapeleta = (p: Fila) => ({
  id: p.id,
  nombre: p.hermano.nombre,
  apellidos: p.hermano.apellidos,
  numeroHermano: p.hermano.numeroHermano,
  puesto: p.puesto,
  tramo: p.tramo,
  numero: p.numero,
  year: p.year,
  salida: p.salida.slug,
  entradaEl: p.entradaEl?.toISOString() ?? null,
  entradaPor: p.entradaPor,
});

export type PapeletaEnPuerta = ReturnType<typeof aPapeleta>;

export interface Lectura {
  /** `FAMILIA`: el QR de la familia; nadie ha entrado aún, la lista va en `familia`. */
  veredicto: Veredicto | 'FAMILIA';
  papeleta: PapeletaEnPuerta | null;
  /**
   * Solo al leer un QR de familia: sus papeletas de esta salida, también las
   * que ya entraron (`entradaEl`). Vacía si el código es de otra salida o año
   * (`OTRA_SALIDA`) o si ya no le queda ninguna (`ANULADA`).
   */
  familia?: PapeletaEnPuerta[];
}

async function nombreDe(meta: MetaDeAuditoria) {
  if (!meta.userId) return null;
  const u = await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true } });
  return u?.nombre?.slice(0, 120) ?? null;
}

export class PuertaService {
  /** Las cuentas por tramo, las últimas entradas y quién falta, para la salida de este año. */
  static async estado(salida: SalidaConActo) {
    const year = anioDeLaMesa(salida);
    const config = leerConfiguracion(salida);
    const papeletas = await db.papeletaSitio.findMany({ where: { year, salidaId: salida.id }, select: DE_LA_PAPELETA });
    const tramos = cuentasPorTramo(papeletas, config.tramos.map((t) => t.nombre));
    const faltan = papeletas
      .filter((p) => !p.entradaEl)
      .sort((a, b) => (a.numero ?? 9999) - (b.numero ?? 9999) || a.hermano.apellidos.localeCompare(b.hermano.apellidos, 'es') || a.id - b.id)
      .map(aPapeleta);
    const ultimas = papeletas
      .filter((p) => p.entradaEl)
      .sort((a, b) => b.entradaEl!.getTime() - a.entradaEl!.getTime() || b.id - a.id)
      .slice(0, 12)
      .map(aPapeleta);
    return {
      salida: salida.slug, year,
      total: papeletas.length,
      dentro: papeletas.length - faltan.length,
      tramos, faltan, ultimas,
    };
  }

  /** Un QR leído en la puerta. Si vale y no había entrado, queda dentro. */
  static async escanear(codigo: string, salida: SalidaConActo, meta: MetaDeAuditoria): Promise<Lectura> {
    const id = leerCodigoDePapeleta(codigo);
    if (id !== null) return PuertaService.entrar(id, salida, meta);
    const familia = leerCodigoDeFamilia(codigo);
    if (familia) return PuertaService.familia(familia.cuenta, familia.salidaId, familia.year, salida);
    return { veredicto: 'FALSO', papeleta: null };
  }

  /**
   * El QR de una familia: no apunta a nadie, solo dice quiénes son. El
   * diputado confirma quién está y cada uno entra con `entrar`, como a mano;
   * el que no ha venido entra luego con el QR de su papeleta.
   */
  static async familia(cuenta: number, salidaId: number, year: number, salida: SalidaConActo): Promise<Lectura> {
    if (salidaId !== salida.id || year !== anioDeLaMesa(salida)) return { veredicto: 'OTRA_SALIDA', papeleta: null, familia: [] };
    const papeletas = await db.papeletaSitio.findMany({
      where: { salidaId, year, hermano: { userId: cuenta } },
      orderBy: [{ hermano: { esTitular: 'desc' } }, { hermano: { fechaNacimiento: 'asc' } }],
      select: DE_LA_PAPELETA,
    });
    if (papeletas.length === 0) return { veredicto: 'ANULADA', papeleta: null, familia: [] };
    return { veredicto: 'FAMILIA', papeleta: null, familia: papeletas.map(aPapeleta) };
  }

  /**
   * La entrada de una papeleta: por el QR o a mano, para quien llega sin ella.
   * El `updateMany` con `entradaEl: null` hace que dos diputados leyendo la
   * misma papeleta a la vez no la apunten dos veces: el segundo ve «ya entró».
   */
  static async entrar(id: number, salida: SalidaConActo, meta: MetaDeAuditoria): Promise<Lectura> {
    const year = anioDeLaMesa(salida);
    const antes = await buscar(id);
    const v = veredicto(antes, { year, salidaId: salida.id });
    if (v !== 'ENTRA') return { veredicto: v, papeleta: antes ? aPapeleta(antes) : null };

    const { count } = await db.papeletaSitio.updateMany({
      where: { id, entradaEl: null },
      data: { entradaEl: new Date(), entradaPor: await nombreDe(meta) },
    });
    const despues = await buscar(id);
    if (!despues) return { veredicto: 'ANULADA', papeleta: null };
    return { veredicto: count === 1 ? 'ENTRA' : 'REPETIDA', papeleta: aPapeleta(despues) };
  }

  /** Se apuntó por error (otro hermano, o se dio la vuelta sin salir): vuelve a faltar. */
  static async deshacer(id: number, meta: MetaDeAuditoria) {
    const antes = await buscar(id);
    if (!antes) throw new NotFoundError('Papeleta no encontrada');
    if (!antes.entradaEl) return aPapeleta(antes);
    await db.papeletaSitio.update({ where: { id }, data: { entradaEl: null, entradaPor: null } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PUERTA_DESHACER, meta, 'papeleta', id, {
      antes: { entradaEl: antes.entradaEl.toISOString(), entradaPor: antes.entradaPor },
      despues: { entradaEl: null },
    });
    return aPapeleta((await buscar(id))!);
  }
}
