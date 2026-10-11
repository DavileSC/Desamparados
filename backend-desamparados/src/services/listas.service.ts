/**
 * Las búsquedas guardadas de los listados del CMS («Menores con túnica
 * propia», «Sin correo»): un nombre y los filtros tal como van en la URL. Las
 * comparte toda la junta que ve el listado.
 *
 * Solo se guardan los filtros que el listado conoce: lo demás de la URL (la
 * ficha abierta, la página) no es parte de una lista, y un filtro inventado no
 * debe viajar de un ordenador a otro.
 */
import db from '../config/db.js';
import { NotFoundError } from '../utils/error.handle.js';

/** Los filtros de cada listado que se pueden guardar. */
const FILTROS_GUARDABLES = {
  censo: ['q', 'estado', 'numero', 'correo', 'cuenta', 'edad', 'medalla', 'boletin', 'orden'],
} as const;

type PantallaConListas = keyof typeof FILTROS_GUARDABLES;

/** La consulta, con solo los filtros del listado y en su orden: dos listas iguales se escriben igual. */
export function consultaLimpia(pantalla: PantallaConListas, consulta: string): string {
  const leida = new URLSearchParams(consulta);
  const limpia = new URLSearchParams();
  for (const clave of FILTROS_GUARDABLES[pantalla]) {
    const valor = leida.get(clave)?.trim();
    if (valor) limpia.set(clave, valor.slice(0, 120));
  }
  return limpia.toString();
}

export class ListasService {
  static listar(pantalla: PantallaConListas) {
    return db.listaGuardada.findMany({
      where: { pantalla },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      select: { id: true, nombre: true, consulta: true },
    });
  }

  /** Guarda la lista; con un nombre que ya existe, la sustituye (se ha afinado la búsqueda). */
  static guardar(pantalla: PantallaConListas, nombre: string, consulta: string, autorId?: number) {
    const datos = { consulta: consultaLimpia(pantalla, consulta), autorId: autorId ?? null };
    return db.listaGuardada.upsert({
      where: { pantalla_nombre: { pantalla, nombre: nombre.trim() } },
      create: { pantalla, nombre: nombre.trim(), ...datos },
      update: datos,
      select: { id: true, nombre: true, consulta: true },
    });
  }

  static async borrar(id: number) {
    const { count } = await db.listaGuardada.deleteMany({ where: { id } });
    if (count !== 1) throw new NotFoundError('Esa lista ya no existe.');
  }
}
