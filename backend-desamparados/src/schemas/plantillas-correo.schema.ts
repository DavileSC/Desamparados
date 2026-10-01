import { type } from 'arktype';
import { idParam } from '../config/common.js';

// Los textos de una plantilla. Que los campos y bloques existan, y que estén
// los obligatorios, lo revisa el servicio contra el catálogo de usos.
const texto = {
    asunto: "string <= 200" as const,
    titulo: "string <= 200" as const,
    cuerpo: "string <= 20000" as const,
    despedida: "string <= 300" as const,
};

const uso = type(/^[a-z_]{1,40}$/).describe("un uso de correo");

export const plantillaSchema = type({
    body: { nombre: type("0 < string <= 120").narrow((s) => s.trim().length > 0).describe("un nombre"), uso, ...texto }
});

export const plantillaIdSchema = type({ params: { id: idParam } });

export const vistaPreviaSchema = type({ body: { uso, ...texto } });

// Poner en uso una plantilla de ese correo, o el texto original (null).
export const usarPlantillaSchema = type({ body: { uso, id: "number.integer > 0 | null" } });
