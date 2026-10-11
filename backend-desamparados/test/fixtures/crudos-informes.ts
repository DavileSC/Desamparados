// test/fixtures/crudos-informes.ts
//
// Las cifras de conjunto inventadas con que se prueban «Datos e informes» y sus
// PDF sin base de datos. Viven aquí y no en datos-informes.test.ts porque
// también las usa marca-en-papel.ts, que genera el Informe anual en un proceso
// aparte con otra marca (test/marca-imprenta.test.ts).

import { periodoDe } from '../../src/domain/periodo-datos.js';
import type { DatosCrudos } from '../../src/domain/datos-areas.js';
import type { Articulo } from '../../src/domain/articulos.js';

// Un día cualquiera de 2026, con el año en marcha.
export const HOY = new Date('2026-09-29T12:00:00Z');

/** Unas cifras de conjunto inventadas, para probar las palabras sin base de datos. */
export function crudos(parcial: {
  papeletas?: number;
  /** La segunda salida (la que siempre cae en «otras salidas», nunca es la principal): para probar que concuerda con su propio artículo. */
  otraSalida?: { nombre?: string; articulo?: Articulo; papeletas?: number };
} = {}): DatosCrudos {
  const meses = periodoDe(2025, HOY).meses;
  return {
    hermanos: {
      activos: 228, activosAlEmpezar: 133, altas: 99, bajas: 4, anterior: { altas: 59, bajas: 3 },
      bajasPorMotivo: [{ motivo: 'IMPAGO', total: 3 }, { motivo: null, total: 1 }],
      porMes: meses.map((mes) => ({ mes, altas: 8, bajas: 0 })),
      cierres: [{ etiqueta: '2021', activos: 12 }, { etiqueta: '2025', activos: 228 }],
      edadMedia: 42.2, menores: 22, porEdad: [{ tramo: 'Menos de 18', total: 22 }],
    },
    dinero: {
      ingresos: 13806, gastos: 9492, anterior: { ingresos: 14186, gastos: 10736 },
      porMes: meses.map((mes) => ({ mes, ingresos: 1000, gastos: 700 })),
      porCategoria: [{ categoria: 'Cuotas de hermanos', tipo: 'INGRESO', importe: 5490 }, { categoria: 'Caridad', tipo: 'GASTO', importe: 2764 }],
      porCobrar: [{ estado: 'PENDIENTE', total: 10, importe: 350 }, { estado: 'DEVUELTO', total: 2, importe: 70 }],
    },
    procesion: {
      anio: 2026,
      porSalida: [
        {
          slug: 'sabado-de-pasion', nombre: 'Sábado de Pasión', articulo: 'el', conRopa: true,
          papeletas: parcial.papeletas ?? 183, papeletasAnioAnterior: 131, porPuesto: [{ etiqueta: 'Nazareno de cirio', total: 90 }],
          serie: [{ anio: 2025, total: 131 }, { anio: 2026, total: parcial.papeletas ?? 183 }],
        },
        {
          slug: 'rosario-vespertino', nombre: parcial.otraSalida?.nombre ?? 'Rosario vespertino', articulo: parcial.otraSalida?.articulo ?? 'el',
          conRopa: false, papeletas: parcial.otraSalida?.papeletas ?? 0, papeletasAnioAnterior: 0, porPuesto: [],
        },
      ],
      porCobrar: [],
    },
    inventario: {
      enseres: [{ nombre: 'Candelería del paso', optimo: 24, bueno: 6, reparar: 4, total: 34 }],
      prendas: [{ tipo: 'TUNICA', estado: 'DISPONIBLE', total: 72 }, { tipo: 'TUNICA', estado: 'TALLER', total: 3 }],
    },
    web: {
      noticias: 8, publicaciones: 3, cambios: 97, paginasTocadas: 7, anterior: { noticias: 0, publicaciones: 3 },
      noticiasPorMes: meses.map((mes) => ({ mes, total: 1 })), publicacionesPorMes: [], cambiosPorMes: [], boletin: 0, activos: 276,
    },
    agenda: {
      actos: [{ id: 1, title: 'Solemne triduo', startDate: '2025-11-05T18:00:00.000Z', type: 'CULTO', location: 'Parroquia' }],
      anterior: 12,
    },
  };
}
