import { type } from 'arktype';
import { idParam } from '../config/common.js';

const sinEtiquetas = (max: number, que: string) =>
    type(`string <= ${max}`).narrow((s) => s.trim().length > 0).matching(/^[^<>]+$/).describe(`${que} de ${max} caracteres como mucho, sin «<» ni «>»`);

export const cabildoSchema = type({
    body: {
        tipo: "'ORDINARIO' | 'EXTRAORDINARIO'",
        // Día y hora en ISO; el servicio lo guarda tal cual.
        fecha: type("string.date.iso").describe("una fecha y hora"),
        lugar: sinEtiquetas(191, 'un lugar'),
        ordenDelDia: sinEtiquetas(300, 'un punto del orden del día').array().atMostLength(40),
    }
});

export const asistenteSchema = type({
    params: { id: idParam },
    body: { hermanoId: type("number.integer > 0").describe("el identificador de un hermano") }
});

export const quitarAsistenteSchema = type({ params: { id: idParam, hermanoId: idParam } });

const votos = type("0 <= number.integer <= 100000").describe("un número de votos");
export const votacionSchema = type({
    params: { id: idParam },
    body: {
        asunto: sinEtiquetas(300, 'un asunto'),
        mayoria: "'SIMPLE' | 'DOS_TERCIOS'",
        aFavor: votos,
        enContra: votos,
        abstenciones: votos,
    }
});

export const borrarVotacionSchema = type({ params: { id: idParam, votacionId: idParam } });

export const celebrarSchema = type({ params: { id: idParam }, body: { "enSegunda?": "boolean" } });

export const actaSchema = type({ params: { id: idParam }, body: { acta: type("string <= 1000000") } });

export const libroSchema = type({ params: { anio: type(/^\d{4}$/).describe("un año de cuatro cifras") } });
