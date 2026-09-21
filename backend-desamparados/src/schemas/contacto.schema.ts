import { type } from 'arktype';
import { email, textoRequerido } from '../config/common';

const boundedText = type('string <= 160');
const message = type('string >= 10 & string <= 5000');

// El email del visitante acaba en el Reply-To del correo. La regla común
// (`email` de config/common.ts) admite cosas como `"x"<a@b.c>` o
// `a,b@c.d`, que nodemailer lee como otra dirección o como dos: quien
// escribe podía hacer que «Responder» se fuera a un tercero. Aquí solo pasan
// los caracteres de una dirección normal: nada de comas, espacios, comillas
// ni ángulos.
export const emailVisitante = email
  .and(type('string').matching(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/))
  .describe('un email válido');

// Opcional y no solo español: escribe gente de fuera (familias en el
// extranjero, otras corporaciones). Cifras con espacios, puntos, guiones o
// paréntesis, con o sin prefijo «+»; entre 6 y 15 cifras (el máximo de E.164).
export const telefonoContacto = type('string')
  .narrow((valor) => {
    if (!/^\+?[0-9 ().-]+$/.test(valor.trim())) return false;
    const cifras = valor.replace(/\D/g, '').length;
    return cifras >= 6 && cifras <= 15;
  })
  .describe('un teléfono válido (entre 6 y 15 cifras; puede empezar por + y el prefijo del país)');

export const contactoSchema = type({
  body: {
    nombre: boundedText.and(textoRequerido),
    email: emailVisitante,
    'telefono?': telefonoContacto.or("''"),
    asunto: boundedText.and(textoRequerido),
    mensaje: message,
    // Trampa para robots: un campo que la web esconde y que una persona no ve
    // ni rellena. Ver contact.controller.ts.
    'comentarioAdicional?': 'string <= 500',
    // Milisegundos entre que se abrió el formulario y se envió, medidos en el
    // navegador. Ver contact.controller.ts.
    'tiempoRelleno?': 'number >= 0',
  },
});
