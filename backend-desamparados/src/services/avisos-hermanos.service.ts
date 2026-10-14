import crypto from 'node:crypto';
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { ModulosService } from './modulos.service.js';
import { avisosConfigurados, clavePublicaVapid, enviarAviso, type AvisoAHermano, type SuscripcionPush } from './push.js';
import { extractoPlano } from '../utils/sanear-html.js';

/**
 * Los avisos al móvil del área de hermanos: la apertura de papeletas y los
 * avisos de la Junta llegan al móvil en vez de por correo, que con un servicio
 * de envío gratis tiene tope diario (traspaso-2026-10-14 §5).
 *
 * No pide contraseña ni guarda clave del dispositivo: el móvil solo recibe,
 * no prueba nada de quien lo lleva.
 */

const sha256 = (texto: string) => crypto.createHash('sha256').update(texto).digest('hex');

/** Encendido en Sistema → Módulos y con las claves VAPID en el servidor. */
async function disponible(): Promise<boolean> {
  return avisosConfigurados() && (await ModulosService.activo('avisos-a-los-hermanos'));
}

export class AvisosHermanosService {
  static disponible = disponible;

  static async listar(userId: number) {
    const moviles = await db.movilDeAvisos.findMany({
      where: { userId },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
      select: { id: true, nombre: true, creadoEn: true },
    });
    const hay = await disponible();
    return { disponible: hay, clavePublica: hay ? clavePublicaVapid() : null, moviles: moviles.map((m) => ({ ...m, creadoEn: m.creadoEn.toISOString() })) };
  }

  /**
   * El mismo navegador otra vez (o con otra cuenta) sustituye a su fila: la
   * suscripción es del navegador, y los avisos tienen que ir a quien entra
   * ahora en él, no a quien entró antes.
   */
  static async apuntar(userId: number, datos: { nombre: string; suscripcion: SuscripcionPush }) {
    if (!(await disponible())) throw new HttpError('Los avisos en el móvil no están disponibles en esta instalación.', 409);
    const endpointHash = sha256(datos.suscripcion.endpoint);
    const movil = await db.$transaction(async (tx) => {
      await tx.movilDeAvisos.deleteMany({ where: { endpointHash } });
      return tx.movilDeAvisos.create({
        data: {
          userId, nombre: datos.nombre.trim().slice(0, 60), endpoint: datos.suscripcion.endpoint, endpointHash,
          p256dh: datos.suscripcion.p256dh, auth: datos.suscripcion.auth,
        },
        select: { id: true, nombre: true, creadoEn: true },
      });
    });
    return { ...movil, creadoEn: movil.creadoEn.toISOString() };
  }

  static async quitar(userId: number, movilId: number): Promise<void> {
    const { count } = await db.movilDeAvisos.deleteMany({ where: { id: movilId, userId } });
    if (count !== 1) throw new NotFoundError('Ese móvil no recibe avisos de tu cuenta.');
  }

  /** De esas cuentas, las que tienen algún móvil para los avisos. Vacío si no hay avisos. */
  static async cuentasConMovil(userIds?: readonly number[]): Promise<Set<number>> {
    if (!(await disponible())) return new Set();
    const filas = await db.movilDeAvisos.findMany({
      where: userIds ? { userId: { in: [...userIds] } } : {},
      select: { userId: true },
      distinct: ['userId'],
    });
    return new Set(filas.map((f) => f.userId));
  }

  /**
   * Manda el aviso a todos los móviles de la cuenta. true si llegó a alguno:
   * si no, quien llama manda el correo. Los que el servicio da por muertos
   * (se quitó el permiso o se borró la web) se borran.
   */
  static async avisarALaCuenta(userId: number, aviso: Omit<AvisoAHermano, 'tipo'>): Promise<boolean> {
    if (!(await disponible())) return false;
    const moviles = await db.movilDeAvisos.findMany({ where: { userId } });
    let llego = false;
    for (const movil of moviles) {
      const resultado = await enviarAviso({ endpoint: movil.endpoint, p256dh: movil.p256dh, auth: movil.auth }, { tipo: 'aviso', ...aviso });
      if (resultado === 'enviado') {
        llego = true;
        await db.movilDeAvisos.update({ where: { id: movil.id }, data: { usadoEn: new Date() } });
      } else if (resultado === 'muerta') {
        await db.movilDeAvisos.deleteMany({ where: { id: movil.id } });
      }
    }
    return llego;
  }
}

/**
 * Los avisos de la Junta que recibió la cuenta, para leerlos en el área: el
 * aviso al móvil solo cabe en dos líneas y abre aquí el entero. Los que aún
 * esperan en la cola no se enseñan: todavía no se han mandado.
 */
export class MisAvisosService {
  private static donde(userId: number) {
    return { userId, estado: { not: 'PENDIENTE' as const }, comunicado: { tipo: 'AVISO' as const } };
  }

  static async listar(userId: number) {
    const envios = await db.comunicadoEnvio.findMany({
      where: MisAvisosService.donde(userId),
      select: { comunicado: { select: { id: true, asunto: true, cuerpo: true, enviadoEl: true } } },
      orderBy: { comunicadoId: 'desc' },
      take: 100,
    });
    // Una cuenta con dos direcciones en el segmento tiene dos envíos del mismo aviso.
    const vistos = new Set<number>();
    return envios.flatMap(({ comunicado: c }) => {
      if (vistos.has(c.id)) return [];
      vistos.add(c.id);
      return [{ id: c.id, asunto: c.asunto, extracto: extractoPlano(c.cuerpo).slice(0, 180), enviadoEl: c.enviadoEl?.toISOString() ?? null }];
    });
  }

  static async obtener(userId: number, id: number) {
    const envio = await db.comunicadoEnvio.findFirst({
      where: { ...MisAvisosService.donde(userId), comunicadoId: id },
      select: { comunicado: { select: { id: true, asunto: true, cuerpo: true, enviadoEl: true } } },
    });
    if (!envio) throw new NotFoundError('Ese aviso no está entre los tuyos.');
    const c = envio.comunicado;
    return { id: c.id, asunto: c.asunto, cuerpo: c.cuerpo, enviadoEl: c.enviadoEl?.toISOString() ?? null };
  }
}
