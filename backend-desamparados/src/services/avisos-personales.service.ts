import db from '../config/db.js';
import { NotFoundError } from '../utils/error.handle.js';
import { AvisosHermanosService } from './avisos-hermanos.service.js';
import { despertarCola } from './correos/cola.js';
import { enviarCorreo } from './correos/envio.js';
import { conImagenesEnLinea } from './correos/plantilla.js';
import type { AvisoAHermano } from './push.js';

/**
 * Los avisos personales: lo que va a una sola cuenta y no a todos (el
 * justificante de un pago, la papeleta sin recoger, el recordatorio de la
 * cita). Pedido el 20-10-2026 para que no dependan del correo.
 *
 * Se guardan siempre, para leerlos en la página Avisos del área. Llegan al
 * móvil si la cuenta lo tiene; si no, o si no llega a ninguno, por correo.
 * Nunca los dos: el servicio de envío gratis tiene tope diario. Lo que pide la
 * ley o la seguridad (el cargo SEPA, la contraseña) no pasa por aquí: va
 * siempre por correo.
 */

/** Un correo ya compuesto (`PlantillasCorreoService.correo`). */
export interface CorreoListo { asunto: string; html: string; uso: string; resumen: string }
interface Para { userId: number; email: string }

const urlDelAviso = (id: number) => `/area-hermano/avisos/personal/${id}`;

function alMovil(a: { id: number; asunto: string; resumen: string }): Omit<AvisoAHermano, 'tipo'> {
  return { etiqueta: `personal-${a.id}`, titulo: a.asunto, cuerpo: a.resumen.slice(0, 140), url: urlDelAviso(a.id) };
}

function guardar(userId: number, c: CorreoListo) {
  return db.avisoPersonal.create({
    data: { userId, uso: c.uso, asunto: c.asunto.slice(0, 200), resumen: c.resumen.slice(0, 300), html: c.html },
    select: { id: true, asunto: true, resumen: true },
  });
}

export class AvisosPersonalesService {
  /**
   * Uno suelto y al momento (el justificante de un pago): por la cola
   * esperaría detrás de un envío a todos los hermanos, quizá hasta mañana.
   */
  static async mandar(para: Para, correo: CorreoListo): Promise<void> {
    const aviso = await guardar(para.userId, correo);
    if (await AvisosHermanosService.avisarALaCuenta(para.userId, alMovil(aviso))) return;
    await enviarCorreo(para.email, correo.asunto, correo.html, { uso: correo.uso });
  }

  /**
   * Muchos de golpe (los recordatorios de un día de reparto): por la cola de
   * correos, que manda primero al móvil y después los correos con su tope.
   */
  static async ponerEnCola(lote: string, titulo: string, filas: (Para & { correo: CorreoListo })[]): Promise<number> {
    if (filas.length === 0) return 0;
    const conMovil = await AvisosHermanosService.cuentasConMovil(filas.map((f) => f.userId));
    const datos = [];
    for (const f of filas) {
      const aviso = await guardar(f.userId, f.correo);
      datos.push({
        lote, titulo, userId: f.userId, porMovil: conMovil.has(f.userId), para: f.email,
        asunto: f.correo.asunto.slice(0, 200), html: f.correo.html, uso: f.correo.uso, aviso: alMovil(aviso),
      });
    }
    for (let i = 0; i < datos.length; i += 100) await db.correoEnCola.createMany({ data: datos.slice(i, i + 100) });
    void despertarCola();
    return datos.length;
  }

  static async listar(userId: number) {
    const avisos = await db.avisoPersonal.findMany({
      where: { userId },
      select: { id: true, asunto: true, resumen: true, creadoEn: true },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return avisos.map((a) => ({ id: a.id, asunto: a.asunto, extracto: a.resumen, enviadoEl: a.creadoEn.toISOString() }));
  }

  /** La carta entera, con el escudo dentro: las imágenes `cid:` solo las entiende un lector de correo. */
  static async obtener(userId: number, id: number) {
    const aviso = await db.avisoPersonal.findFirst({ where: { id, userId } });
    if (!aviso) throw new NotFoundError('Ese aviso no está entre los tuyos.');
    return { id: aviso.id, asunto: aviso.asunto, enviadoEl: aviso.creadoEn.toISOString(), html: conImagenesEnLinea(aviso.html) };
  }

  /** Al año se borran: el justificante sigue en Recibos y lo demás ya pasó. */
  static async limpiar(ahora: Date = new Date()): Promise<void> {
    await db.avisoPersonal.deleteMany({ where: { creadoEn: { lt: new Date(ahora.getTime() - 365 * 24 * 3600 * 1000) } } });
  }
}
