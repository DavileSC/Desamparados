// Las claves VAPID para los avisos al móvil (aprobar la entrada al CMS). Se
// pegan en el .env tal cual; VAPID_CONTACTO se rellena a mano.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLICA=${publicKey}`);
console.log(`VAPID_PRIVADA=${privateKey}`);
console.log('VAPID_CONTACTO=mailto:');
