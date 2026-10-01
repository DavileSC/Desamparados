import { type } from 'arktype';

const ejercicio = type("string").pipe((v: string) => Number(v), type("2000 <= number.integer <= 2100")).describe("un año de cuatro cifras");

export const ejercicioQuerySchema = type({ query: { ejercicio } });

// El número de justificante lo pone quien presenta: trece cifras que empiezan por 182.
export const ficheroModelo182Schema = type({
    query: { ejercicio, justificante: type(/^182\d{10}$/).describe("trece cifras que empiecen por 182") }
});

// Los certificados: los de todos los donantes, o el de uno (por su NIF).
export const certificadosQuerySchema = type({
    query: { ejercicio, "nif?": type(/^[0-9A-Z]{9}$/).describe("un NIF") }
});

export const configuracionModelo182Schema = type({
    body: {
        nif: type("string <= 12").or("null"),
        telefono: type("string <= 20").matching(/^[\d\s+]*$/),
        contacto: type("string <= 80").matching(/^[^<>]*$/),
        firmanteNombre: type("string <= 120").matching(/^[^<>]*$/),
        firmanteCargo: type("string <= 60").matching(/^[^<>]*$/),
        cuotas: "boolean",
    }
});
