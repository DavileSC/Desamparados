import db from '../config/db.js';
import { EstadoPrenda, type TipoPrenda } from '@prisma/client';
import { palabrasDeBusqueda } from '../domain/busqueda-texto.js';
import { esCuentaDeCustodia } from '../domain/cuenta-de-custodia.js';

export class RoperoService {
  /**
   * Cuántas prendas hay de cada tipo en cada estado: las cabeceras de los
   * grupos del ropero («Capirotes 44: 30 disponibles, 9 prestados…»). Sin
   * filtros: es el estado del ropero entero, se busque lo que se busque.
   */
  static async recuento() {
    const filas = await db.prenda.groupBy({ by: ['tipo', 'estado'], _count: { _all: true } });
    const porTipo = new Map<TipoPrenda, { tipo: TipoPrenda; total: number; estados: Partial<Record<EstadoPrenda, number>> }>();
    for (const f of filas) {
      const grupo = porTipo.get(f.tipo) ?? { tipo: f.tipo, total: 0, estados: {} };
      grupo.total += f._count._all;
      grupo.estados[f.estado] = f._count._all;
      porTipo.set(f.tipo, grupo);
    }
    return [...porTipo.values()];
  }

  /**
   * Hermanos de alta por su nombre, para prestarles algo: con lo justo para
   * no confundir a dos que se llaman igual (número, nacimiento, quién lleva su
   * cuenta si no es suya) y lo que ya tienen del ropero.
   */
  static async buscarHermanos(texto: string) {
    const palabras = palabrasDeBusqueda(texto);
    if (palabras.join('').length < 2) return [];
    const hermanos = await db.hermano.findMany({
      where: {
        activo: true,
        AND: palabras.map((p) => ({ OR: [{ nombre: { contains: p } }, { apellidos: { contains: p } }] })),
      },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
      take: 8,
      select: {
        id: true, numeroHermano: true, nombre: true, apellidos: true, fechaNacimiento: true, puesto: true, esTitular: true,
        user: { select: { nombre: true, apellidos: true, email: true } },
        prendas: { where: { estado: EstadoPrenda.PRESTADA }, select: { tipo: true, numero: true, talla: true }, orderBy: { numero: 'asc' } },
      },
    });
    return hermanos.map(({ esTitular, user, ...h }) => ({
      ...h,
      // Quien lleva la cuenta, si no es la suya: el padre, una tía, el padrino…
      // La de custodia no la lleva nadie: «Censo importado» no es una persona.
      gestor: esTitular || esCuentaDeCustodia(user) ? null : `${user.nombre} ${user.apellidos}`.trim(),
    }));
  }
}
