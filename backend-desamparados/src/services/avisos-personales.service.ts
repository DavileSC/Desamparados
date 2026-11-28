import db from '../config/db.js';
import { NotFoundError } from '../utils/error.handle.js';
import { despertarCola } from './correos/cola.js';
import { conImagenesEnLinea } from './correos/plantilla.js';

/**
 * Los avisos personales: lo de la papeleta pendiente de una cuenta (la
 * papeleta sin recoger, el recordatorio de la cita para recogerla).
 *
 * Salen por correo, por la cola, y se guardan para leerlos en la página Avisos
 * del área aunque se borre el correo. Lo demás que va a una sola cuenta (el
 * justificante de un pago, el cargo SEPA, la contraseña) va solo por correo:
 * la página es para lo que todavía hay que hacer, no un archivo de todo.
 */

/** Un correo ya compuesto (`PlantillasCorreoService.correo`). */
export interface CorreoListo { asunto: string; html: string; uso: string; resumen: string }
interface Para { userId: number; email: string }

function guardar(userId: number, c: CorreoListo) {
  return db.avisoPersonal.create({
    data: { userId, uso: c.uso, asunto: c.asunto.slice(0, 200), resumen: c.resumen.slice(0, 300), html: c.html },
  });
}

export class AvisosPersonalesService {
  /** Muchos de golpe (los recordatorios de un día de reparto): por la cola de correos, con su tope. */
  static async ponerEnCola(lote: string, titulo: string, filas: (Para & { correo: CorreoListo })[]): Promise<number> {
    if (filas.length === 0) return 0;
    const datos = [];
    for (const f of filas) {
      await guardar(f.userId, f.correo);
      datos.push({
        lote, titulo, userId: f.userId, para: f.email,
        asunto: f.correo.asunto.slice(0, 200), html: f.correo.html, uso: f.correo.uso,
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

  /** Al año se borran: la papeleta de entonces ya se recogió o ya pasó. */
  static async limpiar(ahora: Date = new Date()): Promise<void> {
    await db.avisoPersonal.deleteMany({ where: { creadoEn: { lt: new Date(ahora.getTime() - 365 * 24 * 3600 * 1000) } } });
  }
}
