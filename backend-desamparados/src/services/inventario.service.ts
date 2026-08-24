import db from '../config/db';
import { Prisma, EstadoPrenda } from '@prisma/client';
import { CreateEnserDto, UpdateEnserDto, EnserFilterDto } from '../dtos/inventario.dto';
// Asume que crearás estos DTOs para la ropa:
// import { CreatePrendaDto, UpdatePrendaDto, PrendaFilterDto } from '../dtos/prenda.dto';

export class InventarioService {

  // =================================================================
  //  BLOQUE 1: ENSERES GENERALES (Viacrucis, Hachetas...) -> LOTES
  // =================================================================

  static async getAllEnseres(filters: EnserFilterDto) {
    const where: Prisma.EnserWhereInput = {};

    if (filters.search) {
      where.OR = [
        { nombre: { contains: filters.search } },
        { referencia: { contains: filters.search } }
      ];
    }
    if (filters.categoria) where.categoria = filters.categoria;
    if (filters.necesitaReparacion === 'true') where.cantidadReparar = { gt: 0 };

    return await db.enser.findMany({ where, orderBy: { nombre: 'asc' } });
  }

  static async getEnserById(id: number) {
    const enser = await db.enser.findUnique({ where: { id } });
    if (!enser) throw new Error('Enser no encontrado');
    return enser;
  }

  static async createEnser(data: CreateEnserDto) {
    const optimo = data.cantidadOptimo || 0;
    const bueno = data.cantidadBueno || 0;
    const reparar = data.cantidadReparar || 0;
    
    return await db.enser.create({
      data: {
        ...data,
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
    if (!actual) throw new Error('Enser no encontrado');

    const optimo = data.cantidadOptimo ?? actual.cantidadOptimo;
    const bueno = data.cantidadBueno ?? actual.cantidadBueno;
    const reparar = data.cantidadReparar ?? actual.cantidadReparar;

    return await db.enser.update({
      where: { id },
      data: {
        ...data,
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

  static async getAllPrendas(filters: any) { // Usa tu PrendaFilterDto
    const where: Prisma.PrendaWhereInput = {};

    if (filters.numero) where.numero = { contains: filters.numero };
    if (filters.tipo) where.tipo = filters.tipo; // Filtra para ver solo Capirotes, o solo Túnicas
    if (filters.estado) where.estado = filters.estado;
    if (filters.talla) where.talla = { contains: filters.talla };

    return await db.prenda.findMany({
      where,
      orderBy: { numero: 'asc' },
      include: {
        // Traemos el nombre del hermano si la prenda está prestada
        hermano: { select: { nombre: true, apellidos: true, numeroHermano: true } }
      }
    });
  }

  static async createPrenda(data: any) { // Usa CreatePrendaDto
    const existe = await db.prenda.findUnique({ where: { numero: data.numero } });
    if (existe) throw new Error(`El número de prenda ${data.numero} ya existe.`);

    return await db.prenda.create({ data });
  }

  static async updatePrenda(id: number, data: any) { // Usa UpdatePrendaDto
    if (data.numero) {
      const existe = await db.prenda.findUnique({ where: { numero: data.numero } });
      if (existe && existe.id !== id) throw new Error(`El número ${data.numero} ya está en uso.`);
    }
    return await db.prenda.update({ where: { id }, data });
  }

  static async deletePrenda(id: number) {
    return await db.prenda.delete({ where: { id } });
  }

  // --- LÓGICA DE NEGOCIO: ASIGNACIONES ---

  static async asignarPrenda(prendaId: number, hermanoId: number) {
    const prenda = await db.prenda.findUnique({ where: { id: prendaId } });
    if (!prenda) throw new Error('Prenda no encontrada.');
    if (prenda.estado !== EstadoPrenda.DISPONIBLE) throw new Error('La prenda no está disponible.');

    const hermano = await db.hermano.findUnique({ where: { id: hermanoId } });
    if (!hermano) throw new Error('Hermano no encontrado.');

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
    if (!prenda) throw new Error('Prenda no encontrada.');

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