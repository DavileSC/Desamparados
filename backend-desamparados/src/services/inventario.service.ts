import db from '../config/db';
import { Prisma, EstadoPrenda, TipoPrenda } from '@prisma/client';
import { CreateEnserDto, FichaPatrimonioDto, UpdateEnserDto, EnserFilterDto, CreatePrendaDto, UpdatePrendaDto, PrendaFilterDto } from '../dtos/inventario.dto';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { condicionBusqueda, palabrasDeBusqueda } from '../domain/busqueda-texto.js';
import { ORDENES_ENSERES, ORDENES_PRENDAS, ordenDe } from '../domain/ordenacion.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { estadoAlDevolver } from './procesion/ropa.js';

/** Los valores crudos de la consulta: quien decide qué es válido es sanearPaginacion. */
interface ConsultaPaginada {
  page?: unknown;
  limit?: unknown;
}

/** «Ya hay una túnica con el número…»: el tipo, con su artículo. */
const NOMBRE_TIPO: Record<TipoPrenda, string> = {
  TUNICA: 'una túnica', CAPIROTE: 'un capirote', FARAONA: 'una faraona', CAPA: 'una capa', OTRO: 'una prenda',
};

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
    // Cada palabra en alguno de los cuatro campos: «cirial sacristía» encuentra
    // los ciriales guardados en la sacristía.
    const where: Prisma.EnserWhereInput = {
      ...condicionBusqueda(filters.search, ['nombre', 'referencia', 'categoria', 'ubicacion'])
    };

    if (filters.categoria) where.categoria = filters.categoria;
    // Estaba declarado en el esquema pero nunca llegaba a la consulta.
    if (filters.ubicacion) where.ubicacion = filters.ubicacion;
    if (filters.necesitaReparacion === 'true') where.cantidadReparar = { gt: 0 };

    const [enseres, total] = await db.$transaction([
      db.enser.findMany({
        where,
        // Todos acaban en el id: ver domain/ordenacion.ts.
        orderBy: ordenDe(ORDENES_ENSERES, filters.orden),
        skip: paginacion.skip,
        take: paginacion.take
      }),
      db.enser.count({ where })
    ]);

    return respuestaPaginada(enseres, total, paginacion);
  }

  /**
   * Las categorías y ubicaciones que ya se usan, para los desplegables del
   * filtro. Son texto libre en la ficha: un desplegable fijo se quedaría corto
   * y uno de texto obligaría a acertar con la grafía exacta.
   */
  static async opcionesEnseres() {
    const [categorias, ubicaciones] = await db.$transaction([
      db.enser.findMany({ where: { categoria: { not: null } }, distinct: ['categoria'], select: { categoria: true }, orderBy: { categoria: 'asc' } }),
      db.enser.findMany({ where: { ubicacion: { not: null } }, distinct: ['ubicacion'], select: { ubicacion: true }, orderBy: { ubicacion: 'asc' } })
    ]);
    const limpias = (valores: (string | null)[]) => valores.filter((v): v is string => Boolean(v?.trim()));
    return {
      categorias: limpias(categorias.map((e) => e.categoria)),
      ubicaciones: limpias(ubicaciones.map((e) => e.ubicacion))
    };
  }

  /**
   * Lo de la ficha que llega en el cuerpo, listo para Prisma. Lo que no llega
   * no se toca; vacío o null, se borra. Las fotos sin dirección se descartan.
   */
  private static fichaDePatrimonio(d: FichaPatrimonioDto) {
    const texto = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    return {
      descripcion: texto(d.descripcion),
      autor: texto(d.autor),
      epoca: texto(d.epoca),
      materiales: texto(d.materiales),
      dimensiones: texto(d.dimensiones),
      conservacion: texto(d.conservacion),
      ...(d.fotos !== undefined ? { fotos: d.fotos.filter((f) => f.url).map((f) => ({ url: f.url!, pie: f.pie.trim() })) } : {}),
      ...(d.valorTasacion !== undefined ? { valorTasacion: d.valorTasacion === null ? null : new Prisma.Decimal(d.valorTasacion) } : {}),
      ...(d.fechaTasacion !== undefined ? { fechaTasacion: d.fechaTasacion ? new Date(d.fechaTasacion) : null } : {}),
      tasadoPor: texto(d.tasadoPor),
    };
  }

  /** Todas las fotos de un enser, la principal y las de la ficha. */
  private static fotosDe(e: { imagenUrl: string | null; fotos: Prisma.JsonValue }) {
    return subidasEnTexto(e.imagenUrl, e.fotos ? JSON.stringify(e.fotos) : null);
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
        fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : null,
        // El esquema la valida (ruta propia o vacía); antes se descartaba y la
        // foto subida quedaba huérfana en el disco.
        imagenUrl: data.imagenUrl || null,
        ...InventarioService.fichaDePatrimonio(data),
      }
    });
  }

  static async updateEnser(id: number, data: UpdateEnserDto) {
    const actual = await db.enser.findUnique({ where: { id } });
    if (!actual) throw new NotFoundError('Enser no encontrado');

    const optimo = data.cantidadOptimo ?? actual.cantidadOptimo;
    const bueno = data.cantidadBueno ?? actual.cantidadBueno;
    const reparar = data.cantidadReparar ?? actual.cantidadReparar;

    const actualizado = await db.enser.update({
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
        fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : undefined,
        // Sin `imagenUrl` en el cuerpo, la foto se queda; vacía o null, se quita.
        ...(data.imagenUrl !== undefined ? { imagenUrl: data.imagenUrl || null } : {}),
        ...InventarioService.fichaDePatrimonio(data),
      }
    });

    // Las fotos sustituidas o quitadas se borran del disco si nadie más las usa.
    await borrarSubidasHuerfanas(InventarioService.fotosDe(actual), {
      conservar: InventarioService.fotosDe(actualizado)
    });
    return actualizado;
  }

  static async deleteEnser(id: number) {
    const borrado = await db.enser.delete({ where: { id } });
    // Sus fotos salen del disco si nadie más las usa.
    await borrarSubidasHuerfanas(InventarioService.fotosDe(borrado));
    return borrado;
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
    // Cada palabra en la prenda o en quien la tiene prestada: «pérez» encuentra
    // lo que tiene Pérez, y «tun pérez», sus túnicas (el número lleva el tipo).
    const palabras = palabrasDeBusqueda(filters.q);
    const where: Prisma.PrendaWhereInput = palabras.length === 0 ? {} : {
      AND: palabras.map((p) => ({
        OR: [
          { numero: { contains: p } },
          { talla: { contains: p } },
          { observaciones: { contains: p } },
          { hermano: { is: { nombre: { contains: p } } } },
          { hermano: { is: { apellidos: { contains: p } } } }
        ]
      }))
    };

    if (filters.numero) where.numero = { contains: filters.numero };
    if (filters.tipo) where.tipo = filters.tipo; // Filtra para ver solo Capirotes, o solo Túnicas
    if (filters.estado) where.estado = filters.estado;
    if (filters.talla) where.talla = { contains: filters.talla };

    const [prendas, total] = await db.$transaction([
      db.prenda.findMany({
        where,
        orderBy: ordenDe(ORDENES_PRENDAS, filters.orden),
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
    // Único dentro de su tipo: el capirote 18 y la faraona 18 conviven.
    const existe = await db.prenda.findUnique({ where: { tipo_numero: { tipo: data.tipo, numero: data.numero } } });
    if (existe) throw new HttpError(`Ya hay ${NOMBRE_TIPO[data.tipo]} con el número ${data.numero}.`);

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
    const actual = await db.prenda.findUnique({ where: { id } });
    if (!actual) throw new NotFoundError('Prenda no encontrada');

    // PRESTADA va siempre con su titular: la ponen «Asignar» y «Devolver», que
    // guardan también quién la tiene. Editando el estado a mano salían prendas
    // prestadas a nadie o disponibles con un hermano todavía apuntado. Reenviar
    // el estado que ya tenía (el formulario manda la ficha entera) no es un cambio.
    if (data.estado !== undefined && data.estado !== actual.estado) {
      if (data.estado === EstadoPrenda.PRESTADA) {
        throw new HttpError('Para prestar una prenda usa «Asignar» en el listado del ropero: así queda anotado quién la tiene.');
      }
      if (actual.estado === EstadoPrenda.PRESTADA) {
        throw new HttpError('La prenda está prestada: registra antes su devolución con «Devolver» en el listado del ropero.');
      }
    }

    if (data.numero || data.tipo) {
      const tipo = data.tipo ?? actual.tipo;
      const numero = data.numero ?? actual.numero;
      const existe = await db.prenda.findUnique({ where: { tipo_numero: { tipo, numero } } });
      if (existe && existe.id !== id) throw new HttpError(`Ya hay ${NOMBRE_TIPO[tipo]} con el número ${numero}.`);
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

  /**
   * Se presta al hermano por su ficha: el CMS lo busca por nombre y apellidos
   * y manda su id. Antes se tecleaba el número de hermano, que la albacería no
   * se sabe, y un dígito de más se la prestaba a otro.
   */
  static async asignarPrenda(prendaId: number, hermanoId: number) {
    const hermano = await db.hermano.findFirst({ where: { id: hermanoId, activo: true }, select: { id: true } });
    if (!hermano) throw new NotFoundError('Ese hermano no está de alta en el censo.');

    // Condicionada al estado: si dos personas asignan la misma prenda a la vez,
    // la segunda no pisa a la primera.
    const { count } = await db.prenda.updateMany({
      where: { id: prendaId, estado: EstadoPrenda.DISPONIBLE },
      data: {
        estado: EstadoPrenda.PRESTADA,
        hermanoId: hermano.id,
        fechaAsignacion: new Date()
      }
    });
    if (count === 0) {
      const prenda = await db.prenda.findUnique({ where: { id: prendaId } });
      if (!prenda) throw new NotFoundError('Prenda no encontrada.');
      throw new HttpError('La prenda no está disponible.');
    }
    return InventarioService.getPrendaById(prendaId);
  }

  /**
   * Registrar que vuelve una prenda: la túnica, siempre al lavado; lo demás,
   * disponible; lo roto, al taller para arreglarlo.
   */
  static async devolverPrenda(prendaId: number, rota: boolean = false) {
    const prenda = await db.prenda.findUnique({ where: { id: prendaId } });
    if (!prenda) throw new NotFoundError('Prenda no encontrada.');
    const { count } = await db.prenda.updateMany({
      where: { id: prendaId, estado: EstadoPrenda.PRESTADA },
      data: {
        estado: estadoAlDevolver(prenda.tipo, rota),
        hermanoId: null, // Desvinculamos al hermano
        fechaAsignacion: null
      }
    });
    if (count === 0) throw new HttpError('La prenda no está prestada.');
    return InventarioService.getPrendaById(prendaId);
  }

  /** Las prendas del lavado que ya están limpias (sin `ids`, todas), de vuelta al ropero. */
  static async marcarLavadas(ids?: number[]) {
    return db.$transaction(async (tx) => {
      const lavando = await tx.prenda.findMany({
        where: { estado: EstadoPrenda.LAVADO, ...(ids && { id: { in: ids } }) },
        select: { id: true },
      });
      const idsLavadas = lavando.map((p) => p.id);
      await tx.prenda.updateMany({ where: { id: { in: idsLavadas }, estado: EstadoPrenda.LAVADO }, data: { estado: EstadoPrenda.DISPONIBLE } });
      return { ids: idsLavadas, lavadas: idsLavadas.length };
    });
  }

  // =================================================================
  //  DASHBOARD (Resumen Global)
  // =================================================================
  
  static async getResumenInventario() {
    // 1. Resumen de enseres (Lotes)
    const enseres = await db.enser.aggregate({
      _sum: { cantidadOptimo: true, cantidadBueno: true, cantidadReparar: true, cantidadTotal: true, valorTasacion: true },
      _count: { valorTasacion: true }
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
        total: enseres._sum.cantidadTotal || 0,
        // Lo que suman las tasaciones, y de cuántas piezas: el resto no está tasado.
        valorTasado: Number(enseres._sum.valorTasacion ?? 0),
        tasados: enseres._count.valorTasacion
      },
      ropero // Devuelve un array detallando ej: {tipo: TUNICA, estado: PRESTADA, count: 45}
    };
  }
}
