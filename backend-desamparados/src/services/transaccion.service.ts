import db from '../config/db.js';
import { HttpError } from '../utils/error.handle';
import { AuditMeta, AuditService, AUDIT_ACTIONS } from './audit.service.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';

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

  static async getAll(query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    const [data, total] = await db.$transaction([
      db.transaccion.findMany({
        orderBy: { fecha: 'desc' },
        skip: paginacion.skip,
        take: paginacion.take,
        include: {
          categoria: { select: { nombre: true } }, // Traemos el nombre para que el Frontend lo pinte
          hermano: { select: { nombre: true, apellidos: true } },
        },
      }),
      db.transaccion.count(),
    ]);
    return respuestaPaginada(data, total, paginacion);
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
