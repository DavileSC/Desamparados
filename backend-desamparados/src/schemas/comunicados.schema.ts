import { type } from 'arktype';

// El boletín o el aviso: asunto, cuerpo (HTML del editor, se sanea en el
// servicio) y el segmento. Un cuerpo de boletín con fotos pasa del límite
// general de JSON: por eso la ruta lleva su propio tope (ver app.ts).
const segmento = type({
    "conPapeleta?": "number.integer > 0 | null",
    "apuntadosA?": "number.integer > 0 | null",
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

/** La clave de un envío a muchos, como la da `GET /comunicados/envios`: `comunicado:<id>` o el lote de la cola. */
export const reintentarEnvioSchema = type({
    body: { clave: type("1 <= string <= 60").describe("la clave del envío") }
});

export const bajaBoletinSchema = type({
    body: { token: type("string <= 400").describe("el enlace de baja del correo") }
});

/** La baja en un clic: el token en la dirección. El cuerpo (List-Unsubscribe=One-Click) no se mira. */
export const bajaDirectaSchema = type({
    query: { t: type("string <= 400").describe("el enlace de baja del correo") }
});
