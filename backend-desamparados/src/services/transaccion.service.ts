import db from '../config/db.js';
import { HttpError } from '../utils/error.handle';
import { AuditMeta, AuditService, AUDIT_ACTIONS } from './audit.service.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { agruparEnSerie, granularidad, inicioDiaMadrid, leerFiltros, periodoAnterior, whereContable } from '../domain/contabilidad.js';

export class TransaccionService {
  
  // ==========================================
  //  GESTIÓN DE CATEGORÍAS (Para los Ajustes)
  // ==========================================

  static async getCategorias(tipo?: 'INGRESO' | 'GASTO') {
    return await db.categoriaTransaccion.findMany({
      where: { 
        activa: true,
        ...(tipo && { tipo }) // Si me piden solo las de ingreso, filtro
      },
      orderBy: { nombre: 'asc' }
    });
  }

  static async createCategoria(nombre: string, tipo: 'INGRESO' | 'GASTO', meta?: AuditMeta) {
    const result = await db.categoriaTransaccion.create({
      data: { nombre, tipo }
    });
    AuditService.log(AUDIT_ACTIONS.CATEGORIA_CREAR, meta ?? {}, 'categoria', result.id);
    return result;
  }

  static async toggleCategoria(id: number, activa: boolean) {
    return await db.categoriaTransaccion.update({
      where: { id },
      data: { activa }
    });
  }

  // ==========================================
  //  LIBRO MAYOR (Actualizado)
  // ==========================================

  static async create(data: any, meta?: AuditMeta) {
    // 1. Verificación de seguridad: Comprobar que la categoría existe y cuadra con el tipo
    const categoria = await db.categoriaTransaccion.findUnique({ where: { id: data.categoriaId } });
    if (!categoria) throw new HttpError("La categoría seleccionada no existe.");
    if (categoria.tipo !== data.tipo) throw new HttpError(`Conflicto: Intentas usar una categoría de ${categoria.tipo} en un ${data.tipo}.`);

    const result = await db.transaccion.create({
      data: {
        tipo: data.tipo,
        categoriaId: data.categoriaId,
        concepto: data.concepto,
        importe: data.importe,
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
        metodoPago: data.metodoPago
      }
    });
    AuditService.log(AUDIT_ACTIONS.TRANSACCION_CREAR, meta ?? {}, 'transaccion', result.id);
    return result;
  }

  static async getAll(query: Record<string, unknown> = {}) {
    const paginacion = sanearPaginacion(query);
    const where = whereContable(leerFiltros(query));
    const [data, total] = await db.$transaction([
      db.transaccion.findMany({
        where,
        orderBy: [
          { fecha: 'desc' },
          { id: 'asc' } // Desempate: los apuntes de un mismo día comparten `fecha` al
                        // milisegundo (los de demostración se generan con inicioDelDia),
                        // así que sin este criterio MariaDB los ordena a su antojo y con
                        // skip/take uno saldría en dos páginas y otro en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
        include: {
          categoria: { select: { nombre: true } }, // Traemos el nombre para que el Frontend lo pinte
          hermano: { select: { nombre: true, apellidos: true } },
        },
      }),
      db.transaccion.count({ where }),
    ]);
    return respuestaPaginada(data, total, paginacion);
  }

  /**
   * Lo que enseña la cabecera de la contabilidad para los mismos filtros que el
   * libro mayor: totales, el mismo tramo del año anterior, la serie por mes (o
   * por año) y el reparto por categoría.
   */
  static async getResumen(query: Record<string, unknown> = {}) {
    const filtros = leerFiltros(query);
    const where = whereContable(filtros);
    const anterior = periodoAnterior(filtros);

    const [porTipo, porCategoria, filas, categorias, porTipoAnterior] = await Promise.all([
      db.transaccion.groupBy({ by: ['tipo'], where, _sum: { importe: true }, _count: { _all: true } }),
      db.transaccion.groupBy({ by: ['categoriaId'], where, _sum: { importe: true }, _count: { _all: true } }),
      // Solo tres columnas por apunte: la serie se agrupa por mes de Madrid, y
      // eso MariaDB no lo sabe hacer con groupBy de Prisma.
      db.transaccion.findMany({ where, select: { fecha: true, tipo: true, importe: true }, orderBy: { fecha: 'asc' } }),
      // También las inactivas: el historial sigue nombrando la categoría que ya no se usa.
      db.categoriaTransaccion.findMany({ select: { id: true, nombre: true, tipo: true } }),
      anterior
        ? db.transaccion.groupBy({ by: ['tipo'], where: whereContable({ ...filtros, ...anterior }), _sum: { importe: true } })
        : Promise.resolve(null),
    ]);

    const suma = (grupos: { tipo: string; _sum: { importe: unknown } }[] | null, tipo: 'INGRESO' | 'GASTO') =>
      Number(grupos?.find((g) => g.tipo === tipo)?._sum.importe ?? 0);
    const apuntes = (tipo: 'INGRESO' | 'GASTO') => porTipo.find((g) => g.tipo === tipo)?._count._all ?? 0;
    const ingresos = suma(porTipo, 'INGRESO');
    const gastos = suma(porTipo, 'GASTO');

    // Sin fechas en el filtro, la serie va del primer apunte al último.
    const desde = filtros.desde ? inicioDiaMadrid(filtros.desde) : filas[0]?.fecha;
    const hasta = filtros.hasta ? inicioDiaMadrid(filtros.hasta) : filas.at(-1)?.fecha;
    const gran = desde && hasta ? granularidad(desde, hasta) : 'mes';
    const puntos = desde && hasta
      ? agruparEnSerie(filas.map((f) => ({ fecha: f.fecha, tipo: f.tipo, importe: Number(f.importe) })), gran, desde, hasta)
      : [];

    const nombres = new Map(categorias.map((c) => [c.id, c]));
    return {
      totales: {
        ingresos,
        gastos,
        resultado: Math.round((ingresos - gastos) * 100) / 100,
        apuntesIngreso: apuntes('INGRESO'),
        apuntesGasto: apuntes('GASTO'),
      },
      anterior: anterior && { ...anterior, ingresos: suma(porTipoAnterior, 'INGRESO'), gastos: suma(porTipoAnterior, 'GASTO') },
      serie: { granularidad: gran, puntos },
      categorias: porCategoria
        .map((g) => ({
          id: g.categoriaId,
          nombre: nombres.get(g.categoriaId)?.nombre ?? 'Sin categoría',
          tipo: nombres.get(g.categoriaId)?.tipo ?? 'GASTO',
          total: Number(g._sum.importe ?? 0),
          apuntes: g._count._all,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  // 3. LA JOYA DE LA CORONA: EL BALANCE GENERAL
  static async getBalance() {
    // Agrupamos y sumamos todos los importes, separados por INGRESO y GASTO
    const sumatorios = await db.transaccion.groupBy({
      by: ['tipo'],
      _sum: { importe: true }
    });

    let totalIngresos = 0;
    let totalGastos = 0;

    sumatorios.forEach(agrupacion => {
      const suma = Number(agrupacion._sum.importe) || 0;
      if (agrupacion.tipo === 'INGRESO') totalIngresos = suma;
      if (agrupacion.tipo === 'GASTO') totalGastos = suma;
    });

    return {
      ingresos: totalIngresos,
      gastos: totalGastos,
      // Lo que queda limpio en la cuenta bancaria / caja
      balanceTotal: totalIngresos - totalGastos 
    };
  }
}
