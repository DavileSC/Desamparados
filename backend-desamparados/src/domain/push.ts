/**
 * Los servicios de push de los navegadores (Chrome y Android, Firefox, Safari
 * e iPhone, Edge). El servidor manda un POST a la URL que da el móvil: sin
 * esta lista, una cuenta podría apuntar como «móvil» una dirección de la red
 * interna del servidor y hacer que la API la llamara.
 */
const SERVICIOS_DE_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function esEndpointDePush(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.port === '' && !url.username && !url.password
    && SERVICIOS_DE_PUSH.some((re) => re.test(url.hostname));
}
