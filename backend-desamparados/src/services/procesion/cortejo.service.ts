/**
 * El cortejo de cada salida: sus tramos (en `Configuracion`, porque cada
 * corporación tiene los suyos) y el reparto de las papeletas del año en ellos,
 * por antigüedad. La regla vive en `domain/cortejo.ts`; aquí, leerla, enseñar
 * lo que haría y aplicarla.
 */
import type { Salida } from '@prisma/client';
import db from '../../config/db';
import { HttpError } from '../../utils/error.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service.js';
import { anioDeLaMesa } from './zonas.service.js';
import { diaDe } from '../../domain/fechas-hermano.js';
import {
  CORTEJO_POR_DEFECTO, problemaConfiguracion, puestosSinRepetir, repartirCortejo, seReparte, type ConfiguracionCortejo,
} from '../../domain/cortejo.js';

const clave = (salida: Salida) => `cortejo_${salida}`;

/** La configuración como objeto JSON simple, para la auditoría. */
const aJson = (c: ConfiguracionCortejo) => ({ tramos: c.tramos.map((t) => ({ nombre: t.nombre, plazas: t.plazas })), puestos: [...c.puestos] });

/** Lo guardado, si es válido; si no (nunca se guardó, o se estropeó a mano), lo de por defecto. */
async function leerConfiguracion(salida: Salida): Promise<ConfiguracionCortejo> {
  const fila = await db.configuracion.findUnique({ where: { key: clave(salida) } });
  if (fila) {
    try {
      const guardada = JSON.parse(fila.value) as ConfiguracionCortejo;
      if (Array.isArray(guardada?.tramos) && Array.isArray(guardada?.puestos) && !problemaConfiguracion(guardada)) return guardada;
    } catch { /* se estropeó a mano: vale lo de por defecto */ }
  }
  return CORTEJO_POR_DEFECTO[salida];
}

async function papeletasDelAnio(salida: Salida, year: number) {
  return db.papeletaSitio.findMany({
    where: { year, salida },
    select: {
      id: true, puesto: true, tramo: true, numero: true,
      hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true, fechaAlta: true } },
    },
  });
}

export class CortejoService {
  /**
   * Cómo está el cortejo y cómo quedaría repartido: los tramos, lo que
   * cambiaría al aplicar y la lista de cada tramo tal como está ahora.
   */
  static async estado(salida: Salida, anio?: number) {
    const year = anio ?? await anioDeLaMesa(salida);
    const [config, papeletas] = await Promise.all([leerConfiguracion(salida), papeletasDelAnio(salida, year)]);
    const reparto = repartirCortejo(config, papeletas.map((p) => ({
      id: p.id, puesto: p.puesto, fechaAlta: diaDe(p.hermano.fechaAlta), numeroHermano: p.hermano.numeroHermano, hermanoId: p.hermano.id,
    })));
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
          })),
      }));

    return { salida, year, config, papeletas: papeletas.length, reparto: { tramos: reparto.tramos, fuera: reparto.fuera, cambios }, actual };
  }

  static async guardarConfiguracion(salida: Salida, config: ConfiguracionCortejo, meta?: MetaDeAuditoria) {
    const limpia: ConfiguracionCortejo = {
      tramos: config.tramos.map((t) => ({ nombre: t.nombre.trim(), plazas: t.plazas })),
      puestos: puestosSinRepetir(config.puestos),
    };
    const problema = problemaConfiguracion(limpia);
    if (problema) throw new HttpError(problema);
    const antes = await leerConfiguracion(salida);
    await db.configuracion.upsert({
      where: { key: clave(salida) },
      update: { value: JSON.stringify(limpia) },
      create: { key: clave(salida), value: JSON.stringify(limpia), descripcion: `Tramos del cortejo (${salida}) y puestos que se reparten en ellos` },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.CONFIG_UPDATE, meta ?? {}, 'configuracion', clave(salida), { antes: aJson(antes), despues: aJson(limpia) });
    return limpia;
  }

  /**
   * Escribe en cada papeleta el tramo y el lugar que le tocan. Solo las de los
   * puestos que se reparten; y solo las que cambian, en una transacción.
   */
  static async aplicar(salida: Salida, year: number, meta?: MetaDeAuditoria) {
    const [config, papeletas] = await Promise.all([leerConfiguracion(salida), papeletasDelAnio(salida, year)]);
    const { asignaciones } = repartirCortejo(config, papeletas.map((p) => ({
      id: p.id, puesto: p.puesto, fechaAlta: diaDe(p.hermano.fechaAlta), numeroHermano: p.hermano.numeroHermano, hermanoId: p.hermano.id,
    })));
    if (asignaciones.length === 0) throw new HttpError('No hay papeletas de los puestos que se reparten.', 409);
    const porId = new Map(papeletas.map((p) => [p.id, p]));
    const cambian = asignaciones.filter((a) => {
      const p = porId.get(a.papeletaId)!;
      return p.tramo !== a.tramo || p.numero !== a.numero;
    });
    await db.$transaction(
      cambian.map((a) => db.papeletaSitio.update({ where: { id: a.papeletaId }, data: { tramo: a.tramo, numero: a.numero } })),
    );
    await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_REPARTIR, meta ?? {}, 'cortejo', `${salida}:${year}`, {
      despues: { salida, year, repartidas: asignaciones.length, cambiadas: cambian.length, tramos: config.tramos.length },
    });
    return {
      message: cambian.length === 0
        ? 'El cortejo ya estaba repartido así: no ha cambiado nada.'
        : `Cortejo repartido: ${cambian.length === 1 ? '1 papeleta ha cambiado' : `${cambian.length} papeletas han cambiado`} de tramo o de lugar.`,
      cambiadas: cambian.length,
    };
  }
}
