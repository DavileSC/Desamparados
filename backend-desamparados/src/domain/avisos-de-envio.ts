/**
 * Los avisos de que un correo que ya salió no ha llegado. El servidor de
 * correo (OVH) acepta el envío al momento; el rebote de verdad llega minutos
 * u horas después, del servidor del destinatario, como un correo más al buzón
 * que envía (noreply@). Sin leerlo, el envío seguía como «Enviado».
 *
 * Todo puro. Quién abre el buzón es `correos/buzon-de-rebotes`, y qué se hace
 * con cada aviso lo decide `correos/rebotes.service`.
 */

export type MotivoRebote = 'REBOTE' | 'INVALIDO' | 'BLOQUEADO' | 'SPAM';

export interface AvisoDeEnvio {
  /** En minúsculas, como la guarda la cola de correos. */
  email: string;
  /** Por qué no le llegan los correos; null si el aviso no lo dice (una baja). */
  motivo: MotivoRebote | null;
  /** Deja de recibir el boletín: lo pidió o se quejó de él. */
  bajaDelBoletin: boolean;
  /** Lo que contestó el servidor del destinatario, recortado. */
  detalle: string | null;
}

const esDireccion = (email: string) => email.length <= 191 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email);

/**
 * El motivo según el código de estado (RFC 3463). 5.1.x es la dirección: el
 * buzón o el dominio no existen. 5.7.x es una política: el destinatario nos
 * rechaza (lista negra, SPF, DMARC). El resto de 5.x, que no llega por otra
 * cosa. Los 4.x no están: son temporales y el servidor sigue intentándolo.
 */
function motivoDe(estado: string): MotivoRebote {
  if (estado.startsWith('5.1.')) return 'INVALIDO';
  if (estado.startsWith('5.7.')) return 'BLOQUEADO';
  return 'REBOTE';
}

/** Los campos de un bloque «Campo: valor» del informe, con las líneas partidas ya unidas. */
function campos(bloque: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const linea of bloque.split('\n')) {
    const dosPuntos = linea.indexOf(':');
    if (dosPuntos > 0) mapa.set(linea.slice(0, dosPuntos).trim().toLowerCase(), linea.slice(dosPuntos + 1).trim());
  }
  return mapa;
}

/** «rfc822; Ana@Ejemplo.org» → «Ana@Ejemplo.org». */
const trasElTipo = (valor: string | undefined) => valor?.slice(valor.indexOf(';') + 1).trim().replace(/^<|>$/g, '') ?? '';

/**
 * Los rebotes que trae un correo, leído entero (la fuente tal cual llega por
 * IMAP). Solo vale el informe normalizado de entrega (RFC 3464, la parte
 * `message/delivery-status`), que es lo que manda cualquier servidor serio y
 * el de OVH: un correo normal que hable de «rebotes» no marca a nadie, y una
 * respuesta automática («estoy de vacaciones») tampoco.
 *
 * Un informe puede traer varios destinatarios; solo cuentan los que fallaron
 * del todo (`Action: failed` y estado 5.x). Lo que no se entiende se descarta
 * sin error: el correo se queda en el buzón para quien quiera mirarlo.
 */
export function leerRebote(fuente: string): AvisoDeEnvio[] {
  const texto = fuente.replace(/\r\n?/g, '\n');
  const cabecera = /^content-type:[ \t]*message\/(?:global-)?delivery-status\b/im.exec(texto);
  if (!cabecera) return [];
  const desdeLaParte = texto.slice(cabecera.index);
  const finDeCabeceras = desdeLaParte.indexOf('\n\n');
  if (finDeCabeceras < 0) return [];
  let informe = desdeLaParte.slice(finDeCabeceras + 2);
  // Hasta el separador de la parte siguiente.
  const separador = informe.search(/^--/m);
  if (separador >= 0) informe = informe.slice(0, separador);
  // Una línea que empieza con espacio sigue la anterior.
  informe = informe.replace(/\n[ \t]+/g, ' ');

  const avisos = new Map<string, AvisoDeEnvio>();
  for (const bloque of informe.split(/\n[ \t]*\n/)) {
    const c = campos(bloque);
    const email = trasElTipo(c.get('final-recipient') ?? c.get('original-recipient')).toLowerCase();
    const estado = /^\d\.\d{1,3}\.\d{1,3}/.exec(c.get('status') ?? '')?.[0];
    if (c.get('action')?.toLowerCase() !== 'failed' || !estado?.startsWith('5.') || !esDireccion(email)) continue;
    const diagnostico = trasElTipo(c.get('diagnostic-code'));
    avisos.set(email, {
      email,
      motivo: motivoDe(estado),
      bajaDelBoletin: false,
      detalle: (diagnostico || estado).slice(0, 250),
    });
  }
  return [...avisos.values()];
}
