/**
 * El cortejo de cada salida: sus tramos (en la fila de la salida, porque cada
 * corporación y cada salida tiene los suyos) y el reparto de las papeletas del año en ellos,
 * por antigüedad. La regla vive en `domain/cortejo.ts`; aquí, leerla, enseñar
 * lo que haría y aplicarla.
 */
import type { Prisma } from '@prisma/client';
import db from '../../config/db';
import { HttpError } from '../../utils/error.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service.js';
import { anioDeLaMesa } from './zonas.service.js';
import type { SalidaConActo } from './salidas.service.js';
import { diaDe } from '../../domain/fechas-hermano.js';
import {
  cortejoPorDefecto, problemaConfiguracion, puestosSinRepetir, repartirCortejo, seReparte, type ConfiguracionCortejo,
} from '../../domain/cortejo.js';

/** La configuración como objeto JSON simple, para la auditoría. */
const aJson = (c: ConfiguracionCortejo) => ({ tramos: c.tramos.map((t) => ({ nombre: t.nombre, plazas: t.plazas })), puestos: [...c.puestos] });

/** Lo guardado, si es válido; si no (nunca se guardó, o se estropeó a mano), lo de por defecto. */
export function leerConfiguracion(salida: Pick<SalidaConActo, 'cortejo' | 'puestos'>): ConfiguracionCortejo {
  const guardada = salida.cortejo as ConfiguracionCortejo | null;
  if (Array.isArray(guardada?.tramos) && Array.isArray(guardada?.puestos) && !problemaConfiguracion(guardada)) return guardada;
  return cortejoPorDefecto(salida.puestos as unknown as { nombre: string }[]);
}

async function papeletasDelAnio(salida: SalidaConActo, year: number) {
  return db.papeletaSitio.findMany({
    where: { year, salidaId: salida.id },
    select: {
      id: true, puesto: true, tramo: true, numero: true,
      hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true, fechaAlta: true, activo: true } },
    },
  });
}

type PapeletaDelAnio = Awaited<ReturnType<typeof papeletasDelAnio>>[number];

/**
 * El reparto por antigüedad, solo con quien está en activo. Dar de baja no
 * anula una papeleta pagada (lo decide la Junta), pero no va a salir: no se
 * le guarda sitio, y la puerta no le deja entrar.
 */
function repartir(config: ConfiguracionCortejo, papeletas: PapeletaDelAnio[]) {
  const reparto = repartirCortejo(config, papeletas.filter((p) => p.hermano.activo).map((p) => ({
    id: p.id, puesto: p.puesto, fechaAlta: diaDe(p.hermano.fechaAlta), numeroHermano: p.hermano.numeroHermano, hermanoId: p.hermano.id,
  })));
  // Las de baja de un puesto que se reparte pierden el lugar que tuvieran:
  // si no, dos papeletas acabarían con el mismo número en el mismo tramo.
  const sinLugar = papeletas
    .filter((p) => !p.hermano.activo && seReparte(config, p.puesto))
    .map((p) => ({ papeletaId: p.id, tramo: null, numero: null }));
  return { ...reparto, asignaciones: [...reparto.asignaciones, ...sinLugar], deBaja: papeletas.filter((p) => !p.hermano.activo).length };
}

export class CortejoService {
  /**
   * Cómo está el cortejo y cómo quedaría repartido: los tramos, lo que
   * cambiaría al aplicar y la lista de cada tramo tal como está ahora.
   */
  static async estado(salida: SalidaConActo, anio?: number) {
    const year = anio ?? anioDeLaMesa(salida);
    const config = leerConfiguracion(salida);
    const papeletas = await papeletasDelAnio(salida, year);
    const reparto = repartir(config, papeletas);
    const actualPorId = new Map(papeletas.map((p) => [p.id, p]));
    const cambios = reparto.asignaciones.filter((a) => {
      const p = actualPorId.get(a.papeletaId)!;
      return p.tramo !== a.tramo || p.numero !== a.numero;
    }).length;

    // La lista de ahora, por tramos: primero los de la configuración, en su
    // orden; después cualquier otro que se haya escrito a mano; al final, sin tramo.
    const orden = new Map(config.tramos.map((t, i) => [t.nombre, i]));
    const grupos = new Map<string | null, typeof papeletas>();
    for (const p of papeletas) grupos.set(p.tramo, [...(grupos.get(p.tramo) ?? []), p]);
    const actual = [...grupos.entries()]
      .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : (orden.get(a) ?? 999) - (orden.get(b) ?? 999) || a.localeCompare(b, 'es')))
      .map(([tramo, lista]) => ({
        tramo,
        hermanos: lista
          .sort((a, b) => (a.numero ?? 9999) - (b.numero ?? 9999) || a.hermano.apellidos.localeCompare(b.hermano.apellidos, 'es'))
          .map((p) => ({
            papeletaId: p.id, numero: p.numero, puesto: p.puesto, seReparte: seReparte(config, p.puesto),
            nombre: p.hermano.nombre, apellidos: p.hermano.apellidos, numeroHermano: p.hermano.numeroHermano,
            deBaja: !p.hermano.activo,
          })),
      }));

    return {
      salida: salida.slug, year, config, papeletas: papeletas.length,
      /** Papeletas cuyo hermano está de baja: fuera del reparto. */
      deBaja: reparto.deBaja,
      reparto: { tramos: reparto.tramos, fuera: reparto.fuera, cambios }, actual,
    };
  }

  static async guardarConfiguracion(salida: SalidaConActo, config: ConfiguracionCortejo, meta?: MetaDeAuditoria) {
    const limpia: ConfiguracionCortejo = {
      tramos: config.tramos.map((t) => ({ nombre: t.nombre.trim(), plazas: t.plazas })),
      puestos: puestosSinRepetir(config.puestos),
    };
    const problema = problemaConfiguracion(limpia);
    if (problema) throw new HttpError(problema);
    const antes = leerConfiguracion(salida);
    await db.salida.update({ where: { id: salida.id }, data: { cortejo: aJson(limpia) as Prisma.InputJsonValue } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CONFIG_UPDATE, meta ?? {}, 'salida', salida.id, { antes: aJson(antes), despues: aJson(limpia) });
    return limpia;
  }

  /**
   * Escribe en cada papeleta el tramo y el lugar que le tocan. Solo las de los
   * puestos que se reparten; y solo las que cambian, en una transacción.
   */
  static async aplicar(salida: SalidaConActo, year: number, meta?: MetaDeAuditoria) {
    const config = leerConfiguracion(salida);
    const papeletas = await papeletasDelAnio(salida, year);
    const { asignaciones } = repartir(config, papeletas);
    if (asignaciones.length === 0) throw new HttpError('No hay papeletas de los puestos que se reparten.', 409);
    const porId = new Map(papeletas.map((p) => [p.id, p]));
    const cambian = asignaciones.filter((a) => {
      const p = porId.get(a.papeletaId)!;
      return p.tramo !== a.tramo || p.numero !== a.numero;
    });
    await db.$transaction(
      cambian.map((a) => db.papeletaSitio.update({ where: { id: a.papeletaId }, data: { tramo: a.tramo, numero: a.numero } })),
    );
    await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_REPARTIR, meta ?? {}, 'cortejo', `${salida.slug}:${year}`, {
      despues: { salida: salida.slug, year, repartidas: asignaciones.filter((a) => a.tramo !== null).length, cambiadas: cambian.length, tramos: config.tramos.length },
    });
    return {
      message: cambian.length === 0
        ? 'El cortejo ya estaba repartido así: no ha cambiado nada.'
        : `Cortejo repartido: ${cambian.length === 1 ? '1 papeleta ha cambiado' : `${cambian.length} papeletas han cambiado`} de tramo o de lugar.`,
      cambiadas: cambian.length,
    };
  }
}
