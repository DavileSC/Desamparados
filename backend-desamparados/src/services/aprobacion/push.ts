import webpush from 'web-push';

/**
 * Por dónde salen los avisos al móvil (Web Push). Como el correo
 * (`correos/envio.ts`), dentro de `node --test` nunca se sale a la red: los
 * avisos se apuntan en memoria para que las pruebas los miren, y una prueba
 * puede poner su propio envío para simular un móvil que ya no existe.
 */

export interface SuscripcionPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Lo que lee el service worker del móvil: el texto del aviso y adónde lleva. */
export interface AvisoDeEntrada {
  tipo: 'aprobar-entrada';
  id: string;
  titulo: string;
  cuerpo: string;
  url: string;
}

/**
 * Un aviso del área de hermanos (la apertura de papeletas, un aviso de la
 * Junta). `etiqueta` agrupa: uno nuevo con la misma sustituye al anterior.
 */
export interface AvisoAHermano {
  tipo: 'aviso';
  etiqueta: string;
  titulo: string;
  cuerpo: string;
  url: string;
}

export type AvisoAlMovil = AvisoDeEntrada | AvisoAHermano;

/**
 * `muerta`: el servicio de push dice que esa suscripción ya no existe (404 o
 * 410: se desinstaló la web o se quitó el permiso). Se borra el móvil.
 */
export type ResultadoDeEnvio = 'enviado' | 'muerta' | 'fallo';

type Envio = (suscripcion: SuscripcionPush, aviso: AvisoAlMovil) => Promise<ResultadoDeEnvio>;

/**
 * Las tres variables, leídas en cada llamada: las pruebas las ponen después de
 * importar, y así tampoco queda nada fijado antes de que `dotenv` cargue.
 */
function claves() {
  const publica = process.env.VAPID_PUBLICA?.trim();
  const privada = process.env.VAPID_PRIVADA?.trim();
  const contacto = process.env.VAPID_CONTACTO?.trim();
  return publica && privada && contacto ? { publica, privada, contacto } : null;
}

/** Sin las tres claves VAPID no hay avisos: se queda solo el código de la app. */
export const avisosConfigurados = (): boolean => claves() !== null;

/** La clave pública: el navegador la necesita para suscribirse. */
export const clavePublicaVapid = (): string | null => claves()?.publica ?? null;

const enviarDeVerdad: Envio = async (suscripcion, aviso) => {
  const vapid = claves();
  if (!vapid) return 'fallo';
  try {
    await webpush.sendNotification(
      { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
      JSON.stringify(aviso),
      {
        vapidDetails: { subject: vapid.contacto, publicKey: vapid.publica, privateKey: vapid.privada },
        // La aprobación dura dos minutos: más tarde ya no sirve. Un aviso a un
        // hermano con el móvil apagado sí vale unos días después.
        TTL: aviso.tipo === 'aprobar-entrada' ? 120 : 3 * 24 * 3600,
        urgency: aviso.tipo === 'aprobar-entrada' ? 'high' : 'normal',
        timeout: 10_000,
      },
    );
    return 'enviado';
  } catch (error) {
    const estado = (error as { statusCode?: number }).statusCode;
    if (estado === 404 || estado === 410) return 'muerta';
    console.error('[Avisos] No se pudo mandar el aviso al móvil:', estado ?? error);
    return 'fallo';
  }
};

/** Los avisos que se habrían mandado dentro de las pruebas, en orden. */
export const avisosDePrueba: { suscripcion: SuscripcionPush; aviso: AvisoAlMovil }[] = [];

const apuntarDePrueba: Envio = async (suscripcion, aviso) => {
  avisosDePrueba.push({ suscripcion, aviso });
  return 'enviado';
};

let envioDePrueba: Envio | null = null;

/** Para las pruebas: otro envío (un móvil muerto, un fallo). Sin argumento, el de siempre. */
export function fijarEnvioDePrueba(envio: Envio | null = null): void {
  envioDePrueba = envio;
}

export function enviarAviso(suscripcion: SuscripcionPush, aviso: AvisoAlMovil): Promise<ResultadoDeEnvio> {
  if (process.env.NODE_TEST_CONTEXT !== undefined) return (envioDePrueba ?? apuntarDePrueba)(suscripcion, aviso);
  return enviarDeVerdad(suscripcion, aviso);
}
