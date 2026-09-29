import { type } from 'arktype';

const cursoParam = type('string').matching(/^\d{4}$/).describe('un curso por el año en que empieza (por ejemplo, 2025)');

// Textos largos (presentación, epílogo, nota): van a un PDF, pero como todo
// texto libre del CMS, sin «<» ni «>».
const textoLargo = type('string <= 20000').matching(/^[^<>]*$/).describe('un texto sin «<» ni «>», de 20.000 caracteres como mucho').or('null');
const textoCorto = type('string <= 120').matching(/^[^<>\n]*$/).describe('una línea sin «<» ni «>», de 120 caracteres como mucho').or('null');

export const areaInformeSchema = type({
  params: { area: "'hermanos' | 'dinero' | 'procesion' | 'inventario' | 'web' | 'agenda'" },
});

export const cursoMemoriaSchema = type({ params: { curso: cursoParam } });

export const guardarMemoriaSchema = type({
  params: { curso: cursoParam },
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
