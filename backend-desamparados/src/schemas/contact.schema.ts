import { type } from 'arktype';
import { email, textoRequerido, telefono } from '../config/common';

const boundedText = type('string <= 160');
const message = type('string >= 10 & string <= 5000');

export const contactSchema = type({
  body: {
    nombre: boundedText.and(textoRequerido),
    email,
    telefono,
    asunto: boundedText.and(textoRequerido),
    mensaje: message,
  },
});
