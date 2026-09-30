import { type } from 'arktype';

// El boletín o el aviso: asunto, cuerpo (HTML del editor, se sanea en el
// servicio) y el segmento. Un cuerpo de boletín con fotos pasa del límite
// general de JSON: por eso la ruta lleva su propio tope (ver app.ts).
const segmento = type({
    "conPapeleta?": "'PASION' | 'ROSARIO' | null",
    "conDeuda?": "boolean",
    "edad?": "'MAYORES' | 'MENORES' | null",
    "poblacion?": type("string <= 100").matching(/^[^<>]*$/).or("null"),
});

const comunicado = {
    tipo: "'BOLETIN' | 'AVISO'",
    asunto: type("string <= 150").narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe("un asunto de 150 caracteres como mucho, sin «<» ni «>»"),
    cuerpo: type("string <= 500000").narrow((s) => s.trim().length > 0).describe("el texto del comunicado"),
    segmento,
} as const;

export const comunicadoSchema = type({ body: comunicado });

export const destinatariosSchema = type({ body: { tipo: comunicado.tipo, segmento } });

export const bajaBoletinSchema = type({
    body: { token: type("string <= 400").describe("el enlace de baja del correo") }
});
