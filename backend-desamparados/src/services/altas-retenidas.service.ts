import { Prisma } from '@prisma/client';
import db from '../config/db';
import { RegistroService, type ChoqueDeDni } from './registro.service';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { borrarDocumentosPrivados } from '../utils/documentos-privados.js';
import type { RegisterDto } from '../dtos/auth.dto';
import { apellidosTrasCambio } from '../domain/apellidos.js';

/**
 * Las altas por la web con un DNI ya registrado (ver `RegistroService.retener`).
 *
 * Quien se registró recibió la respuesta de cualquier alta: no se le puede
 * decir que el DNI ya está, porque eso diría quién es hermano. Aquí es
 * Secretaría quien lo ve, comprueba quién es la persona (por teléfono o en
 * persona) y decide: tramitarla con el DNI bueno, que la convierte en una
 * solicitud normal pendiente de aprobar, o descartarla.
 */

/** Lo que se guarda del formulario: el alta sin la contraseña, que va cifrada aparte. */
type DatosRetenidos = Omit<RegisterDto, 'usuario' | 'comentarioAdicional'> & { usuario: Omit<RegisterDto['usuario'], 'password'> };

/** Con quién choca un DNI, como lo ve Secretaría: la cuenta o la ficha y su situación hoy. */
type ConQuien =
  | { tipo: 'cuenta'; nombre: string; apellidos: string }
  | { tipo: 'ficha'; id: number; numeroHermano: number | null; nombre: string; apellidos: string; situacion: 'activo' | 'baja' | 'pendiente'; fechaBaja: Date | null }
  | { tipo: 'ya-no-esta' };

/** Pasados estos días sin atender, se borra con sus documentos: son datos personales sin uso. */
export const DIAS_DE_RETENCION = 60;

const MOTIVOS: Record<ChoqueDeDni['motivo'], string> = {
  dni_de_cuenta: 'ya es de otra cuenta',
  dni_en_el_censo: 'ya está en el censo',
  dni_de_menor_en_el_censo: 'ya está en el censo',
};

export class AltasRetenidasService {
  /**
   * Las retenidas, de la más antigua a la más reciente, con sus choques
   * buscados de nuevo: el que había al recibirla pudo resolverse (otra ficha
   * cambió de DNI) o cambiar de situación (una baja que ya volvió).
   */
  static async listar() {
    const filas = await db.altaRetenida.findMany({ orderBy: [{ creadaEl: 'asc' }, { id: 'asc' }] });
    return Promise.all(filas.map(async (fila) => {
      const datos = fila.datos as unknown as DatosRetenidos;
      const choques = await RegistroService.buscarChoquesDeDni(datos);
      const menores = datos.menores ?? [];
      return {
        id: fila.id,
        creadaEl: fila.creadaEl,
        nombre: datos.usuario.nombre,
        apellidos: datos.usuario.apellidos,
        email: datos.usuario.email,
        telefono: datos.usuario.telefono,
        // Quiénes trae el alta: el adulto (hermano o solo quien apunta) y los menores.
        personas: [
          { quien: 'adulto' as const, nombre: datos.usuario.nombre, apellidos: datos.usuario.apellidos, dni: datos.usuario.dni, fechaNacimiento: datos.titular?.fechaNacimiento ?? null, seHaceHermano: Boolean(datos.titular) },
          ...menores.map((menor, indice) => ({
            quien: indice, nombre: menor.nombre, apellidos: apellidosTrasCambio(menor)?.apellidos ?? datos.usuario.apellidos,
            dni: menor.dni || null, fechaNacimiento: menor.fechaNacimiento, seHaceHermano: true,
          })),
        ],
        choques: await Promise.all(choques.map(async (choque) => ({
          quien: choque.quien, motivo: choque.motivo, dni: choque.dni, con: await AltasRetenidasService.conQuien(choque),
        }))),
      };
    }));
  }

  private static async conQuien(choque: ChoqueDeDni): Promise<ConQuien> {
    if (choque.entidad === 'user') {
      const cuenta = await db.user.findUnique({ where: { id: choque.id }, select: { nombre: true, apellidos: true } });
      return cuenta ? { tipo: 'cuenta', ...cuenta } : { tipo: 'ya-no-esta' };
    }
    const ficha = await db.hermano.findUnique({
      where: { id: choque.id },
      select: { id: true, numeroHermano: true, nombre: true, apellidos: true, activo: true, fechaBaja: true },
    });
    if (!ficha) return { tipo: 'ya-no-esta' };
    const { activo, ...resto } = ficha;
    return { tipo: 'ficha', ...resto, situacion: activo ? 'activo' : ficha.fechaBaja ? 'baja' : 'pendiente' };
  }

  /**
   * Tramitarla con los DNI corregidos: se crean la cuenta y las fichas como en
   * cualquier alta y pasa a Solicitudes, donde se aprueba como las demás. Si
   * algún DNI sigue registrado, se dice cuál: quien lo ve es Secretaría.
   */
  static async tramitar(
    id: number,
    correcciones: { adulto?: string; menores?: { indice: number; dni: string }[] },
    meta: MetaDeAuditoria = {},
  ) {
    const fila = await db.altaRetenida.findUnique({ where: { id } });
    if (!fila) throw new NotFoundError('Esa solicitud retenida ya no está: puede que otra persona la haya tramitado o descartado.');

    const datos = structuredClone(fila.datos as unknown as DatosRetenidos);
    const menores = datos.menores ?? [];
    if (correcciones.adulto) datos.usuario.dni = correcciones.adulto;
    for (const { indice, dni } of correcciones.menores ?? []) {
      if (!menores[indice]) throw new HttpError('Ese menor no está en la solicitud.');
      menores[indice].dni = dni;
    }
    const dnisDeMenores = menores.map((m) => m.dni).filter((d): d is string => Boolean(d));
    if (new Set(dnisDeMenores).size !== dnisDeMenores.length || dnisDeMenores.includes(datos.usuario.dni)) {
      throw new HttpError('Hay dos personas de la solicitud con el mismo DNI.');
    }

    if (await db.user.findFirst({ where: { email: datos.usuario.email }, select: { id: true } })) {
      throw new HttpError('El correo de esta solicitud ya es de otra cuenta, así que no se puede tramitar: descártala y ayúdale a entrar con su cuenta.', 409);
    }
    const siguen = await RegistroService.buscarChoquesDeDni(datos);
    if (siguen.length > 0) {
      const cuales = siguen.map((c) => `${c.dni} (${c.quien === 'adulto' ? 'del adulto' : `de ${menores[c.quien]?.nombre ?? 'un menor'}`}) ${MOTIVOS[c.motivo]}`);
      throw new HttpError(`Sigue registrado: ${cuales.join('; ')}. Corrígelo o descarta la solicitud.`, 409);
    }

    let creada;
    try {
      creada = await RegistroService.crearCuentaYFichas(datos, fila.password, fila.creadaEl);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError('Otra alta con ese DNI o ese correo acaba de entrar. Vuelve a cargar las solicitudes.', 409);
      }
      throw error;
    }
    // Los documentos pasan a la ficha: se borra la fila, no los ficheros.
    await db.altaRetenida.deleteMany({ where: { id } });

    await AuditoriaService.log(ACCIONES_AUDITORIA.ALTA_RETENIDA_TRAMITAR, meta, 'user', creada.user.id, {
      retenida: id,
      corregidos: [...(correcciones.adulto ? ['adulto'] : []), ...(correcciones.menores ?? []).map((m) => `menor ${m.indice + 1}`)],
    });
    return { message: 'Tramitada: ya está entre las solicitudes, lista para aprobar.' };
  }

  /**
   * Descartarla: se borra con sus documentos. No se escribe a nadie: el correo
   * del formulario puede ser de quien usó un DNI ajeno, y si era un error,
   * Secretaría ya habrá hablado con la persona.
   */
  static async descartar(id: number, meta: MetaDeAuditoria = {}) {
    const fila = await db.altaRetenida.findUnique({ where: { id }, select: { datos: true } });
    if (!fila) throw new NotFoundError('Esa solicitud retenida ya no está: puede que otra persona la haya tramitado o descartado.');
    await db.altaRetenida.deleteMany({ where: { id } });
    const documentos = (fila.datos as unknown as DatosRetenidos).documentos ?? {};
    await borrarDocumentosPrivados([documentos.foto, documentos.certificadoBautismo]);
    // Solo el id: guardar aquí el nombre desharía el borrado.
    await AuditoriaService.log(ACCIONES_AUDITORIA.ALTA_RETENIDA_DESCARTAR, meta, 'altaRetenida', id, {});
    return { message: 'Solicitud descartada y borrada.' };
  }

  /** Las que llevan más de `DIAS_DE_RETENCION` días sin atender: fuera, con sus documentos. */
  static async borrarCaducadas(ahora = new Date()) {
    const limite = new Date(ahora.getTime() - DIAS_DE_RETENCION * 24 * 60 * 60 * 1000);
    const viejas = await db.altaRetenida.findMany({ where: { creadaEl: { lt: limite } }, select: { id: true, datos: true } });
    for (const vieja of viejas) {
      await db.altaRetenida.deleteMany({ where: { id: vieja.id } });
      const documentos = (vieja.datos as unknown as DatosRetenidos).documentos ?? {};
      await borrarDocumentosPrivados([documentos.foto, documentos.certificadoBautismo]);
    }
    return viejas.length;
  }
}
