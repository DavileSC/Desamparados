import { type } from 'arktype';
import { datosFiscales, email } from '../config/common.js';

// El donativo desde la web pública. Los límites del importe y el destino los
// comprueba el servicio contra el bloque de la página, no este esquema: aquí
// solo se acota lo que se lee.
export const donativoSchema = type({
    body: {
        pagina: type("string").matching(/^[a-z0-9-]{1,60}$/),
        importe: "0 < number <= 100000",
        "destino?": "string <= 60",
        "nombre?": "string <= 120",
        "email?": type(email).or("''"),
        metodo: "'TARJETA' | 'BIZUM'",
        // Si quiere el certificado para desgravar (con correo, lo exige el servicio).
        "fiscal?": datosFiscales.or("null"),
    }
});

// Cómo va un donativo, a la vuelta del banco: el pedido tiene la forma de `numeroDePedido`.
export const estadoDeDonativoSchema = type({
    params: { pedido: type("string").matching(/^\d{8}[A-Z0-9]{4}$/) }
});
