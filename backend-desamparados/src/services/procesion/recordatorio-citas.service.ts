import { EstadoCita } from '@prisma/client';
import db from '../../config/db.js';
import { articuloDe } from '../../domain/articulos.js';
import { diaMadridComoIntervalo } from '../../domain/contabilidad.js';
import { esDireccionDeNadie } from '../../domain/cuenta-de-custodia.js';
import { DOMINIO_CUENTA_ELIMINADA } from '../../domain/cuenta-anonimizada.js';
import { diaMadrid } from '../../domain/fecha-salida.js';
import { AvisosPersonalesService, type CorreoListo } from '../avisos-personales.service.js';
import { EmailService } from '../email.service.js';
import { ModulosService } from '../modulos.service.js';

/**
 * El recordatorio de la cita para recoger la papeleta, la víspera (pedido el
 * 20-10-2026). Uno por cuenta y día de reparto, con todas las fichas que
 * tienen cita: a una familia no le llegan tres. Sale como aviso personal: al
 * móvil si la cuenta lo tiene y, si no, por correo con el tope del día.
 */

const ZONA = 'Europe/Madrid';
/** De mañana: ni de madrugada, ni a última hora cuando ya no da tiempo a cambiar el día. */
export const HORA_DEL_RECORDATORIO = 10;

const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });
const horaMadrid = (instante: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hourCycle: 'h23' }).format(instante));

/**
 * Las citas de mañana sin recordar. Las pedidas hoy no: quien acaba de elegir
 * el día lo tiene delante. Devuelve cuántos avisos se han puesto en la cola.
 */
export async function recordarCitas(ahora: Date = new Date()): Promise<number> {
  if (horaMadrid(ahora) < HORA_DEL_RECORDATORIO) return 0;
  if (!(await ModulosService.activo('procesion'))) return 0;

  const hoy = diaMadridComoIntervalo(ahora);
  const manana = diaMadridComoIntervalo(hoy.hasta);
  const donde = {
    estado: EstadoCita.RESERVADA, recordadaEl: null, papeleta: null, createdAt: { lt: hoy.desde },
    turno: { activo: true, horaInicio: { gte: manana.desde, lt: manana.hasta } },
    hermano: { activo: true },
  };
  const candidatas = await db.cita.findMany({ where: donde, select: { id: true } });
  if (candidatas.length === 0) return 0;

  // Se apuntan antes de mandar, con una marca propia: si dos vueltas se
  // cruzan, cada cita se la lleva solo una y nadie recibe el aviso dos veces.
  const marca = new Date();
  await db.cita.updateMany({ where: { id: { in: candidatas.map((c) => c.id) }, recordadaEl: null }, data: { recordadaEl: marca } });
  try {
    return await avisarDeLasMarcadas(marca, candidatas.map((c) => c.id), manana.desde);
  } catch (error) {
    // La marca se puso antes de preparar los avisos: si algo falla después,
    // se quita, o esas citas se quedarían sin recordatorio para siempre. La
    // siguiente vuelta (diez minutos) lo intenta otra vez.
    await db.cita.updateMany({ where: { id: { in: candidatas.map((c) => c.id) }, recordadaEl: marca }, data: { recordadaEl: null } });
    throw error;
  }
}

/** Los avisos de las citas que se ha llevado esta vuelta (las que tienen su marca), a la cola. */
async function avisarDeLasMarcadas(marca: Date, ids: number[], dia: Date): Promise<number> {
  const citas = await db.cita.findMany({
    where: { id: { in: ids }, recordadaEl: marca },
    select: {
      hermano: {
        select: {
          nombre: true, apellidos: true,
          user: { select: { id: true, email: true, nombre: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } } },
        },
      },
      turno: { select: { id: true, horaInicio: true, horaFin: true, salida: { select: { nombre: true, articulo: true } } } },
    },
    orderBy: [{ hermano: { nombre: 'asc' } }, { id: 'asc' }],
  });

  const porCuenta = new Map<string, { user: NonNullable<(typeof citas)[number]['hermano']['user']>; turno: (typeof citas)[number]['turno']; fichas: string[] }>();
  for (const { hermano, turno } of citas) {
    const u = hermano.user;
    // Sin cuenta, o con la de nadie (custodia del censo importado, cuenta suprimida): no hay a quién avisar.
    if (!u?.email || esDireccionDeNadie(u.email) || u.email.endsWith(DOMINIO_CUENTA_ELIMINADA)) continue;
    const clave = `${u.id}:${turno.id}`;
    const grupo = porCuenta.get(clave) ?? { user: u, turno, fichas: [] };
    grupo.fichas.push(`${hermano.nombre} ${hermano.apellidos ?? ''}`.trim());
    porCuenta.set(clave, grupo);
  }

  const filas: { userId: number; email: string; correo: CorreoListo }[] = [];
  for (const { user, turno, fichas } of porCuenta.values()) {
    const correo = await EmailService.correoRecordatorioCita(user.nombre, user.hermanos[0]?.sexo ?? undefined, {
      fichas,
      fechaCita: formatoDia.format(turno.horaInicio),
      horario: `de ${formatoHora.format(turno.horaInicio)} a ${formatoHora.format(turno.horaFin)}`,
      salida: { nombre: turno.salida.nombre, articulo: articuloDe(turno.salida) },
    });
    filas.push({ userId: user.id, email: user.email, correo });
  }
  const diaDeLaCita = diaMadrid(dia);
  return AvisosPersonalesService.ponerEnCola(`cita:${diaDeLaCita}`, `Recordatorio de la cita · ${diaDeLaCita.split('-').reverse().join('/')}`, filas);
}

/**
 * Al arrancar el servidor: mira cada diez minutos si toca recordar las citas
 * de mañana, y de paso borra los avisos personales de hace más de un año.
 */
export function arrancarRecordatorios(): void {
  const vuelta = () => {
    recordarCitas().catch((error) => console.error('❌ [Recordatorio de citas] No se ha podido recordar las citas de mañana:', error));
    AvisosPersonalesService.limpiar().catch((error) => console.error('❌ [Avisos personales] No se han podido borrar los antiguos:', error));
  };
  vuelta();
  setInterval(vuelta, 10 * 60 * 1000).unref();
}
