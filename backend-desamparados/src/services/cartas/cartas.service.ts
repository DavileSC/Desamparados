/**
 * Las cartas y circulares de Secretaría: se guardan para reutilizarlas y se
 * imprimen para los hermanos que salen en una búsqueda del censo.
 *
 * Los destinatarios los elige la misma búsqueda que el listado del censo
 * (`CensoService.whereDelCenso`), con una excepción que no depende de los
 * filtros: a un hermano difunto no se le escribe nunca. A quien no tiene
 * dirección en su ficha (un menor, alguien a cargo) se le pone la del titular
 * de su cuenta, que es donde vive.
 */
import { MotivoBaja, type Prisma } from '@prisma/client';
import db from '../../config/db.js';
import { NotFoundError } from '../../utils/error.handle.js';
import type { SearchHermanoQuery } from '../hermanos/comunes.js';
import { CensoService } from '../censo.service.js';
import { consultaLimpia } from '../listas.service.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from '../auditoria.service.js';
import { cartasEnPdf, type DestinatarioConDireccion, type TextoDeCarta } from './carta-pdf.js';

/** Tope de cartas de una vez: un censo entero cabe de sobra, y un PDF de más no lo imprime nadie. */
export const MAX_CARTAS = 3000;

export interface DatosDeCarta extends TextoDeCarta {
  nombre: string;
  consulta: string;
}

const NO_DIFUNTO: Prisma.HermanoWhereInput = { OR: [{ motivoBaja: null }, { motivoBaja: { not: MotivoBaja.FALLECIMIENTO } }] };

const vacio = (s: string | null | undefined) => !s || !s.trim();

export class CartasService {
  static listar() {
    return db.carta.findMany({ orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
  }

  static crear(d: DatosDeCarta, autorId?: number) {
    return db.carta.create({ data: { ...d, consulta: consultaLimpia('censo', d.consulta), firmaNombre: d.firmaNombre?.trim() || null, autorId: autorId ?? null } });
  }

  static async actualizar(id: number, d: DatosDeCarta) {
    const { count } = await db.carta.updateMany({ where: { id }, data: { ...d, consulta: consultaLimpia('censo', d.consulta), firmaNombre: d.firmaNombre?.trim() || null } });
    if (count !== 1) throw new NotFoundError('Esa carta ya no existe.');
    return db.carta.findUniqueOrThrow({ where: { id } });
  }

  static async borrar(id: number) {
    const { count } = await db.carta.deleteMany({ where: { id } });
    if (count !== 1) throw new NotFoundError('Esa carta ya no existe.');
  }

  /** Los hermanos de una búsqueda del censo, sin difuntos y con su dirección (o la del titular). */
  static async destinatarios(consulta: string, tope = MAX_CARTAS): Promise<DestinatarioConDireccion[]> {
    const query = Object.fromEntries(new URLSearchParams(consultaLimpia('censo', consulta))) as SearchHermanoQuery;
    const hermanos = await db.hermano.findMany({
      where: { AND: [CensoService.whereDelCenso(query), NO_DIFUNTO] },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
      take: tope,
      select: {
        nombre: true, apellidos: true, sexo: true, tratamiento: true, numeroHermano: true, userId: true,
        direccion: true, codigoPostal: true, poblacion: true, provincia: true,
      },
    });
    const sinDireccion = [...new Set(hermanos.filter((h) => vacio(h.direccion)).map((h) => h.userId))];
    const titulares = sinDireccion.length
      ? await db.hermano.findMany({ where: { userId: { in: sinDireccion }, esTitular: true }, select: { userId: true, direccion: true, codigoPostal: true, poblacion: true, provincia: true } })
      : [];
    const deLaCuenta = new Map(titulares.map((t) => [t.userId, t]));
    return hermanos.map(({ userId, ...h }) => {
      const titular = vacio(h.direccion) ? deLaCuenta.get(userId) : undefined;
      return titular && !vacio(titular.direccion)
        ? { ...h, direccion: titular.direccion, codigoPostal: titular.codigoPostal, poblacion: titular.poblacion, provincia: titular.provincia }
        : h;
    });
  }

  /** Cuántas cartas saldrían y cuántas sin dirección (esas no caben en un sobre). */
  static async recuento(consulta: string) {
    const todos = await this.destinatarios(consulta, MAX_CARTAS + 1);
    return {
      total: Math.min(todos.length, MAX_CARTAS),
      demasiados: todos.length > MAX_CARTAS,
      sinDireccion: todos.filter((d) => vacio(d.direccion)).length,
    };
  }

  /** El PDF: todas las cartas o, en la prueba, solo la del primero. */
  static async pdf(texto: TextoDeCarta, consulta: string, prueba: boolean, meta: MetaDeAuditoria) {
    const destinatarios = await this.destinatarios(consulta, prueba ? 1 : MAX_CARTAS);
    if (destinatarios.length === 0) throw new NotFoundError('Nadie sale en esa búsqueda: no hay a quién escribir.');
    const pdf = await cartasEnPdf(texto, destinatarios);
    if (!prueba) await AuditoriaService.log(ACCIONES_AUDITORIA.CARTAS_GENERAR, meta, 'carta', undefined, { asunto: texto.asunto, consulta: consultaLimpia('censo', consulta), cartas: destinatarios.length });
    return pdf;
  }
}
