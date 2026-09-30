import { type } from 'arktype';

const anioParam = type('string').matching(/^\d{4}$/).describe('un año (por ejemplo, 2026)');

// Textos largos (presentación, epílogo, nota): van a un PDF, pero como todo
// texto libre del CMS, sin «<» ni «>».
const textoLargo = type('string <= 20000').matching(/^[^<>]*$/).describe('un texto sin «<» ni «>», de 20.000 caracteres como mucho').or('null');
const textoCorto = type('string <= 120').matching(/^[^<>\n]*$/).describe('una línea sin «<» ni «>», de 120 caracteres como mucho').or('null');

export const areaInformeSchema = type({
  params: { area: "'hermanos' | 'dinero' | 'procesion' | 'inventario' | 'web' | 'agenda'" },
});

export const anioInformeSchema = type({ params: { anio: anioParam } });

export const guardarInformeAnualSchema = type({
  params: { anio: anioParam },
  body: {
    'presentacion?': textoLargo,
    'firmaPresentacion?': textoCorto,
    'lugarFecha?': textoCorto,
    'epilogo?': textoLargo,
    'firmaEpilogo?': textoCorto,
    'notaPatrimonio?': textoLargo,
    'fechaCabildo?': textoCorto,
  },
});
