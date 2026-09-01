import db from '../config/db';
import { Prisma, EstadoPrenda } from '@prisma/client';
import { CreateEnserDto, UpdateEnserDto, EnserFilterDto, CreatePrendaDto, UpdatePrendaDto, PrendaFilterDto } from '../dtos/inventario.dto';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';

/** Los valores crudos de la consulta: quien decide qué es válido es sanearPaginacion. */
interface ConsultaPaginada {
  page?: unknown;
  limit?: unknown;
}

export class InventarioService {

  // =================================================================
  //  BLOQUE 1: ENSERES GENERALES (Viacrucis, Hachetas...) -> LOTES
  // =================================================================

  /**
   * Devuelve `{ data, meta }`. Enseres y ropero comparten pantalla pero no
   * paginación: cada uno cuenta y recorta lo suyo.
   */
  static async getAllEnseres(filters: EnserFilterDto & ConsultaPaginada) {
    const paginacion = sanearPaginacion(filters);
    const where: Prisma.EnserWhereInput = {};

    if (filters.search) {
      where.OR = [
        { nombre: { contains: filters.search } },
        { referencia: { contains: filters.search } }
      ];
    }
    if (filters.categoria) where.categoria = filters.categoria;
    if (filters.necesitaReparacion === 'true') where.cantidadReparar = { gt: 0 };

    const [enseres, total] = await db.$transaction([
      db.enser.findMany({
        where,
        // El desempate por id no es adorno: `nombre` no es único en el modelo
        // (nada impide dos lotes llamados «Insignias de tramo»), y con nombres
        // repetidos MariaDB no garantiza el mismo orden en la consulta de la
        // página 1 y en la de la 2: con skip/take uno saldría repetido y otro
        // no saldría nunca.
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip: paginacion.skip,
        take: paginacion.take
      }),
      db.enser.count({ where })
    ]);

    return respuestaPaginada(enseres, total, paginacion);
  }

  static async getEnserById(id: number) {
    const enser = await db.enser.findUnique({ where: { id } });
    if (!enser) throw new NotFoundError('Enser no encontrado');
    return enser;
  }

  static async createEnser(data: CreateEnserDto) {
    const optimo = data.cantidadOptimo || 0;
    const bueno = data.cantidadBueno || 0;
    const reparar = data.cantidadReparar || 0;
    
    return await db.enser.create({
      data: {
        nombre: data.nombre,
        referencia: data.referencia,
        categoria: data.categoria,
        ubicacion: data.ubicacion,
        cantidadOptimo: optimo,
        cantidadBueno: bueno,
        cantidadReparar: reparar,
        cantidadTotal: optimo + bueno + reparar,
        fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : null
      }
    });
  }

  static async updateEnser(id: number, data: UpdateEnserDto) {
    const actual = await db.enser.findUnique({ where: { id } });
    if (!actual) throw new NotFoundError('Enser no encontrado');

    const optimo = data.cantidadOptimo ?? actual.cantidadOptimo;
    const bueno = data.cantidadBueno ?? actual.cantidadBueno;
    const reparar = data.cantidadReparar ?? actual.cantidadReparar;

    return await db.enser.update({
      where: { id },
      data: {
        nombre: data.nombre,
        referencia: data.referencia,
        categoria: data.categoria,
        ubicacion: data.ubicacion,
        cantidadOptimo: optimo,
        cantidadBueno: bueno,
        cantidadReparar: reparar,
        cantidadTotal: optimo + bueno + reparar,
        fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : undefined
      }
    });
  }

  static async deleteEnser(id: number) {
    return await db.enser.delete({ where: { id } });
  }

  // =================================================================
  //  BLOQUE 2: ROPERO (Túnicas, Capirotes, Faraonas) -> UNITARIO
  // =================================================================

  /** Lo que se muestra de quien tiene la prenda prestada: nunca más que esto. */
  private static readonly hermanoDeLaPrenda = {
    hermano: { select: { nombre: true, apellidos: true, numeroHermano: true } }
  };

  /** Devuelve `{ data, meta }`, con su propio contador: el ropero no comparte página con los enseres. */
  static async getAllPrendas(filters: PrendaFilterDto & ConsultaPaginada) {
    const paginacion = sanearPaginacion(filters);
    const where: Prisma.PrendaWhereInput = {};

    if (filters.numero) where.numero = { contains: filters.numero };
    if (filters.tipo) where.tipo = filters.tipo; // Filtra para ver solo Capirotes, o solo Túnicas
    if (filters.estado) where.estado = filters.estado;
    if (filters.talla) where.talla = { contains: filters.talla };

    const [prendas, total] = await db.$transaction([
      db.prenda.findMany({
        where,
        // Mismo motivo que en los enseres: `numero` es único hoy, pero el orden
        // solo es estable si el criterio lo es; el id lo cierra sin coste.
        orderBy: [{ numero: 'asc' }, { id: 'asc' }],
        skip: paginacion.skip,
        take: paginacion.take,
        include: InventarioService.hermanoDeLaPrenda
      }),
      db.prenda.count({ where })
    ]);

    return respuestaPaginada(prendas, total, paginacion);
  }

  /**
   * Lectura individual del ropero. Antes el cliente se traía el listado entero
   * y buscaba dentro con un `.find()`: con el listado paginado, una prenda
   * fuera del recorte era imposible de editar.
   */
  static async getPrendaById(id: number) {
    const prenda = await db.prenda.findUnique({
      where: { id },
      include: InventarioService.hermanoDeLaPrenda
    });
    if (!prenda) throw new NotFoundError('Prenda no encontrada');
    return prenda;
  }

  static async createPrenda(data: CreatePrendaDto) {
    const existe = await db.prenda.findUnique({ where: { numero: data.numero } });
    if (existe) throw new HttpError(`El número de prenda ${data.numero} ya existe.`);

    return await db.prenda.create({
      data: {
        numero: data.numero,
        tipo: data.tipo,
        talla: data.talla,
        estado: data.estado,
        observaciones: data.observaciones
      }
    });
  }

  static async updatePrenda(id: number, data: UpdatePrendaDto) {
    if (data.numero) {
      const existe = await db.prenda.findUnique({ where: { numero: data.numero } });
      if (existe && existe.id !== id) throw new HttpError(`El número ${data.numero} ya está en uso.`);
    }
    return await db.prenda.update({
      where: { id },
      data: {
        numero: data.numero,
        tipo: data.tipo,
        talla: data.talla,
        estado: data.estado,
        observaciones: data.observaciones
      }
    });
  }

  static async deletePrenda(id: number) {
    return await db.prenda.delete({ where: { id } });
  }

  // --- LÓGICA DE NEGOCIO: ASIGNACIONES ---

  static async asignarPrenda(prendaId: number, hermanoId: number) {
    const prenda = await db.prenda.findUnique({ where: { id: prendaId } });
    if (!prenda) throw new NotFoundError('Prenda no encontrada.');
    if (prenda.estado !== EstadoPrenda.DISPONIBLE) throw new HttpError('La prenda no está disponible.');

    const hermano = await db.hermano.findUnique({ where: { id: hermanoId, activo: true } });
    if (!hermano) throw new NotFoundError('Hermano no encontrado.');

    return await db.prenda.update({
      where: { id: prendaId },
      data: {
        estado: EstadoPrenda.PRESTADA,
        hermanoId: hermanoId,
        fechaAsignacion: new Date()
      }
    });
  }

  static async devolverPrenda(prendaId: number, necesitaLavado: boolean = false) {
    const prenda = await db.prenda.findUnique({ where: { id: prendaId } });
    if (!prenda) throw new NotFoundError('Prenda no encontrada.');

    return await db.prenda.update({
      where: { id: prendaId },
      data: {
        estado: necesitaLavado ? EstadoPrenda.TALLER : EstadoPrenda.DISPONIBLE,
        hermanoId: null, // Desvinculamos al hermano
        fechaAsignacion: null
      }
    });
  }

  // =================================================================
  //  DASHBOARD (Resumen Global)
  // =================================================================
  
  static async getResumenInventario() {
    // 1. Resumen de enseres (Lotes)
    const enseres = await db.enser.aggregate({
      _sum: { cantidadOptimo: true, cantidadBueno: true, cantidadReparar: true, cantidadTotal: true }
    });

    // 2. Resumen de Ropero (Unitario)
    const ropero = await db.prenda.groupBy({
      by: ['tipo', 'estado'],
      _count: { id: true }
    });

    return {
      enseres: {
        optimos: enseres._sum.cantidadOptimo || 0,
        reparar: enseres._sum.cantidadReparar || 0,
        total: enseres._sum.cantidadTotal || 0
      },
      ropero // Devuelve un array detallando ej: {tipo: TUNICA, estado: PRESTADA, count: 45}
    };
  }
}
