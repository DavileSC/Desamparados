import { type } from 'arktype';
import { idParam } from '../config/common.js';

// La forma de las piezas (domain/plantillas-correo.ts). Que los campos y
// bloques existan, que estén los obligatorios y que los enlaces valgan lo
// revisa el servicio contra el catálogo de usos; aquí, solo la forma y los
// topes, para que nadie guarde un correo de megas.
const trozo = type({
    texto: "string <= 5000",
    "negrita?": "boolean",
    "cursiva?": "boolean",
    "enlace?": "string <= 500",
});
const linea = trozo.array().atMostLength(200);

const parrafo = type({ tipo: "'parrafo'", trozos: linea });
const lista = type({ tipo: "'lista'", elementos: linea.array().atMostLength(60) });
const deTexto = parrafo.or(lista);

const pieza = deTexto
    .or({ tipo: "'recuadro'", titulo: "string <= 200", piezas: deTexto.array().atMostLength(30) })
    .or({ tipo: "'oracion'", trozos: linea })
    .or({ tipo: "'boton'", texto: "string <= 120", enlace: "string <= 500" })
    .or({ tipo: "'foto'", src: "string <= 200", alt: "string <= 300", pie: "string <= 300" })
    .or({ tipo: "'separador'" })
    .or({ tipo: "'fijo'", clave: /^[a-z_]{1,40}$/ });

const plantilla = {
    asunto: "string <= 200" as const,
    resumen: "string <= 200" as const,
    titulo: "string <= 200" as const,
    contenido: pieza.array().atMostLength(80),
    despedida: "string <= 300" as const,
};

const uso = type(/^[a-z_]{1,40}$/).describe("un uso de correo");

export const plantillaSchema = type({
    body: { nombre: type("0 < string <= 120").narrow((s) => s.trim().length > 0).describe("un nombre"), uso, ...plantilla }
});

export const plantillaIdSchema = type({ params: { id: idParam } });

export const vistaPreviaSchema = type({ body: { uso, ...plantilla } });

// Poner en uso una plantilla de ese correo, o el texto original (null).
export const usarPlantillaSchema = type({ body: { uso, id: "number.integer > 0 | null" } });
