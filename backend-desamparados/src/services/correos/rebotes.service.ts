/**
 * Las direcciones a las que no llegan los correos, según los avisos del
 * servicio de envío (`domain/avisos-de-envio.ts`).
 *
 * Se apuntan por dirección: el censo señala las fichas que la usan, la cola no
 * gasta cupo en ellas y el último envío que les salió pasa a «Rebotó». Al
 * corregir el correo en la ficha, la dirección nueva no está aquí y el aviso
 * desaparece solo; si el buzón vuelve a funcionar, Secretaría quita la marca.
 */
import { EstadoEnvio, type MotivoRebote } from '@prisma/client';
import db from '../../config/db';
import { enmascararEmail } from '../../utils/log-privacidad.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import type { AvisoDeEnvio } from '../../domain/avisos-de-envio.js';
// Ciclo con cola.ts (que pregunta aquí si una dirección rebota): solo se usan dentro de funciones.
import { retirarBoletinesPendientes } from './cola.js';

/** Cuánto atrás se busca el envío del que avisa: Brevo avisa en minutos, a veces en horas. */
const VENTANA_MS = 7 * 24 * 3600 * 1000;

export interface Rebote { motivo: MotivoRebote; detalle: string | null; desde: Date }

export class RebotesService {
  static async registrar(avisos: AvisoDeEnvio[], ahora: Date = new Date()): Promise<void> {
    for (const aviso of avisos) {
      let nuevo = false;
      if (aviso.motivo) {
        const antes = await db.correoQueRebota.findUnique({ where: { email: aviso.email }, select: { motivo: true } });
        await db.correoQueRebota.upsert({
          where: { email: aviso.email },
          create: { email: aviso.email, motivo: aviso.motivo, detalle: aviso.detalle },
          update: { motivo: aviso.motivo, detalle: aviso.detalle },
        });
        nuevo = antes?.motivo !== aviso.motivo;
        await RebotesService.marcarUltimoEnvio(aviso.email, ahora);
      }
      // Las fichas con esa dirección, o sin la suya y con la de su cuenta (los
      // menores), igual que la baja desde el enlace del correo.
      const bajas = aviso.bajaDelBoletin
        ? (await db.hermano.updateMany({
          where: { boletin: true, OR: [{ email: aviso.email }, { email: null, user: { email: aviso.email } }, { email: '', user: { email: aviso.email } }] },
          data: { boletin: false },
        })).count
        : 0;
      // El boletín siguiente puede estar aún en la cola, esperando al tope del día.
      if (aviso.bajaDelBoletin) await retirarBoletinesPendientes(aviso.email);
      // Un buzón bloqueado avisa en cada envío: solo se apunta lo que cambia algo.
      if (nuevo || bajas > 0) {
        await AuditoriaService.log(ACCIONES_AUDITORIA.CORREO_REBOTA, {}, 'email', undefined, {
          para: enmascararEmail(aviso.email),
          motivo: aviso.motivo,
          ...(bajas > 0 ? { bajasDelBoletin: bajas } : {}),
        });
      }
    }
  }

  /**
   * El último envío de la cola a esa dirección deja de contar como enviado. El
   * aviso de Brevo no trae nada nuestro con que reconocerlo, y el más reciente
   * es casi siempre el que rebotó; los correos sueltos (un alta, una
   * contraseña) no se guardan, así que de esos solo queda la marca.
   */
  private static async marcarUltimoEnvio(email: string, ahora: Date): Promise<void> {
    const donde = { estado: EstadoEnvio.ENVIADO, enviadoEl: { gte: new Date(ahora.getTime() - VENTANA_MS) } };
    const [comunicado, otro] = await Promise.all([
      db.comunicadoEnvio.findFirst({ where: { ...donde, email }, orderBy: [{ enviadoEl: 'desc' }, { id: 'desc' }], select: { id: true, enviadoEl: true } }),
      db.correoEnCola.findFirst({ where: { ...donde, para: email }, orderBy: [{ enviadoEl: 'desc' }, { id: 'desc' }], select: { id: true, enviadoEl: true } }),
    ]);
    const masReciente = comunicado && (!otro || comunicado.enviadoEl! >= otro.enviadoEl!) ? 'comunicado' : otro ? 'otro' : null;
    if (masReciente === 'comunicado') await db.comunicadoEnvio.update({ where: { id: comunicado!.id }, data: { estado: EstadoEnvio.REBOTADO } });
    if (masReciente === 'otro') await db.correoEnCola.update({ where: { id: otro!.id }, data: { estado: EstadoEnvio.REBOTADO } });
  }

  /** Si a esa dirección ya no se le escribe. */
  static async rebota(email: string): Promise<boolean> {
    return (await db.correoQueRebota.count({ where: { email: email.trim().toLowerCase() } })) > 0;
  }

  /** El rebote de una dirección, para la ficha del censo. */
  static async de(email: string | null | undefined): Promise<Rebote | null> {
    const direccion = email?.trim().toLowerCase();
    if (!direccion) return null;
    const fila = await db.correoQueRebota.findUnique({ where: { email: direccion } });
    return fila ? { motivo: fila.motivo, detalle: fila.detalle, desde: fila.creadoEn } : null;
  }

  /** Todas las direcciones marcadas, para el filtro del censo. Son pocas: las que fallan. */
  static async direcciones(): Promise<string[]> {
    return (await db.correoQueRebota.findMany({ select: { email: true }, orderBy: { id: 'asc' } })).map((f) => f.email);
  }

  /** Secretaría da la dirección por buena otra vez (el buzón ya funciona). */
  static async quitar(email: string, meta: MetaDeAuditoria): Promise<boolean> {
    const { count } = await db.correoQueRebota.deleteMany({ where: { email: email.trim().toLowerCase() } });
    if (count > 0) await AuditoriaService.log(ACCIONES_AUDITORIA.CORREO_REBOTA_QUITAR, meta, 'email', undefined, { para: enmascararEmail(email) });
    return count > 0;
  }
}
