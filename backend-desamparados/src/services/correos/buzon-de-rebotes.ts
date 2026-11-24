/**
 * Los rebotes, leídos del buzón que envía. OVH no avisa a la web de los
 * correos que no llegan, como hacía Brevo: el aviso llega como un correo más a
 * noreply@. Cada cuarto de hora se abre el buzón por IMAP, con la misma cuenta
 * que envía, y lo no leído que sea un informe de rebote se apunta
 * (`RebotesService`) y se aparta a la carpeta «Rebotes»; lo demás se marca
 * como leído y se queda en la bandeja para quien quiera mirarlo.
 *
 * Sin EMAIL_IMAP_HOST no se abre nada: los rebotes llegan al buzón y no se
 * apuntan, como antes de tener servicio de envío.
 */
import { ImapFlow } from 'imapflow';
import { leerRebote } from '../../domain/avisos-de-envio.js';
import { RebotesService } from './rebotes.service.js';
import { resumenDelFallo } from './envio.js';

/** Adonde van los rebotes ya apuntados: fuera de la bandeja, pero a mano si hace falta mirar uno. */
export const CARPETA_DE_REBOTES = 'Rebotes';

/** Un informe de rebote ocupa unos KB; un correo con fotos que alguien mande a noreply@ no hace falta bajarlo entero. */
const TAMANO_MAXIMO = 512 * 1024;

/** Por vuelta: el primer día puede haber cientos de correos viejos en la bandeja. */
const POR_VUELTA = 200;

/** Lo que se hace con el buzón; así las pruebas ponen uno de mentira sin servidor. */
export interface BuzonAbierto {
  /** Los UID de lo no leído de la bandeja, de más antiguo a más reciente. */
  noLeidos(): Promise<number[]>;
  /** El correo entero, sin marcarlo como leído. */
  fuente(uid: number): Promise<string | null>;
  apartar(uids: number[], carpeta: string): Promise<void>;
  marcarLeidos(uids: number[]): Promise<void>;
  cerrar(): Promise<void>;
}

type Entorno = Readonly<Record<string, string | undefined>>;

export function buzonConfigurado(entorno: Entorno = process.env): boolean {
  return Boolean(entorno.EMAIL_IMAP_HOST?.trim() && entorno.EMAIL_USER && entorno.EMAIL_PASS);
}

/** El buzón de verdad. 993 cifra desde el primer byte, que es lo que da OVH. */
export async function abrirBuzon(entorno: Entorno = process.env): Promise<BuzonAbierto> {
  const cliente = new ImapFlow({
    host: entorno.EMAIL_IMAP_HOST!.trim(),
    port: Number(entorno.EMAIL_IMAP_PORT?.trim() || 993),
    secure: true,
    auth: { user: entorno.EMAIL_USER!, pass: entorno.EMAIL_PASS! },
    // Su registro saca cada orden IMAP, con direcciones dentro.
    logger: false,
  });
  await cliente.connect();
  const candado = await cliente.getMailboxLock('INBOX');
  return {
    async noLeidos() {
      const uids = await cliente.search({ seen: false }, { uid: true });
      return uids ? [...uids].sort((a, b) => a - b) : [];
    },
    async fuente(uid) {
      const correo = await cliente.fetchOne(String(uid), { source: { maxLength: TAMANO_MAXIMO } }, { uid: true });
      return correo && correo.source ? correo.source.toString('utf8') : null;
    },
    async apartar(uids, carpeta) {
      // Ya existe casi siempre: crearla otra vez no es un fallo que importe.
      await cliente.mailboxCreate(carpeta).catch(() => undefined);
      await cliente.messageMove(uids.join(','), carpeta, { uid: true });
    },
    async marcarLeidos(uids) {
      await cliente.messageFlagsAdd(uids.join(','), ['\\Seen'], { uid: true });
    },
    async cerrar() {
      candado.release();
      await cliente.logout();
    },
  };
}

/**
 * Una vuelta por el buzón. Devuelve cuántos rebotes ha apuntado. Un correo
 * que no se puede leer se deja sin tocar y se intenta en la vuelta siguiente.
 */
export async function revisarBuzon(abrir: () => Promise<BuzonAbierto> = () => abrirBuzon()): Promise<number> {
  const buzon = await abrir();
  try {
    const rebotes: number[] = [];
    const otros: number[] = [];
    let apuntados = 0;
    for (const uid of (await buzon.noLeidos()).slice(0, POR_VUELTA)) {
      const fuente = await buzon.fuente(uid);
      if (fuente === null) continue;
      const avisos = leerRebote(fuente);
      if (avisos.length === 0) {
        otros.push(uid);
        continue;
      }
      await RebotesService.registrar(avisos);
      apuntados += avisos.length;
      rebotes.push(uid);
    }
    if (rebotes.length) await buzon.apartar(rebotes, CARPETA_DE_REBOTES);
    if (otros.length) await buzon.marcarLeidos(otros);
    return apuntados;
  } finally {
    await buzon.cerrar();
  }
}

let enMarcha = false;

/** Cada cuarto de hora, si hay buzón. Una vuelta no empieza mientras otra sigue. */
export function arrancarBuzonDeRebotes(): void {
  if (!buzonConfigurado() || process.env.NODE_TEST_CONTEXT !== undefined) return;
  const vuelta = async () => {
    if (enMarcha) return;
    enMarcha = true;
    try {
      const apuntados = await revisarBuzon();
      if (apuntados > 0) console.log(`📭 [Rebotes] ${apuntados} dirección(es) apuntada(s) desde el buzón.`);
    } catch (error) {
      // Sin la contraseña ni direcciones: solo el código del fallo.
      console.error(`❌ [Rebotes] No se ha podido leer el buzón: ${resumenDelFallo(error)}`);
    } finally {
      enMarcha = false;
    }
  };
  void vuelta();
  setInterval(() => void vuelta(), 15 * 60 * 1000).unref();
}
