// Tipos de colores-de-marca.mjs, para importarlo desde TypeScript (la web en
// theme/marca.ts y la API en los PDF y los correos).
//
// Cada papel es un hex `#rrggbb` en minúsculas. Con la marca a null, o con los
// colores de partida (#6e1822 y #dec72b), es EXACTAMENTE el valor de partida
// que se anota en cada uno: el que estaba escrito a mano en el código.
//
// Los neutros (tintas, cremas, grises, blanco), el rojo de error y de gasto,
// los colores de `dataviz` y los de significado (tipos de acto de la agenda,
// «Culto» incluido aunque su tono sea el burdeos de partida, estados de recibos, conservación del inventario, el
// `ROSA_URGENTE` y los rojos/azules/verdes de las gráficas del Retablo) NO son
// de marca: se quedan fijos donde están.

import type { Marca } from './datos-entidad.mjs'

/** Lo que aceptan las paletas: la `marca` del fichero de datos, o null. Un color mal escrito cuenta como null. */
export type MarcaDeColores = Partial<Marca> | null | undefined

/** Los colores de la web: pública, CMS y área de hermanos. */
export interface PaletaDeMarca {
  // --- Familia del color principal (el burdeos) ---

  /** #6e1822 · blanco encima ≥ 4,5 y ≥ 4,5 sobre el lienzo del CMS claro. El relleno de la marca:
   *  `MuiButton` contained, `designTokens.colors.burgundy`, `GRANATE` de features/inicio/estilos.ts y
   *  components/estiloDeBoton.ts, `secondary.main` de BandaDeFondo, CMS claro (`accionTexto`, `enlace`,
   *  `GRAFICAS.claro.acento`, pomo y avatar de MarcoCms), EleccionCamino, PerfilPage, PasoFamilia,
   *  cubierta del boletín. (`TIPOS.CULTO.color` de la agenda tiene su mismo hex, pero fijo: es de significado.) `alfa(principal, 0.07)` es el
   *  `accionFondo` del CMS claro y `componentes(principal)` el `velo` de PublicacionesDestacadas. */
  principal: string
  /** #5a131c · un escalón más oscuro que `principal`. `MuiButton` contained `:hover`; `secondary.dark` de BandaDeFondo. */
  principalHover: string
  /** #7a1c27 · un escalón más claro que `principal`, blanco encima. `:hover` de la placa «Hazte hermano» (AccesosRapidos). */
  principalRealce: string
  /** #a03d44 · blanco encima ≥ 4,5. `palette.primary.main`; la pista del interruptor de MarcoCms;
   *  `alfa(principalMedio, 0.22)` es el `accionFondo` del CMS oscuro. */
  principalMedio: string
  /** #81262e · blanco encima. `palette.primary.dark`; Apartado del perfil; `:hover` del botón granate de RecorridoEnMapa. */
  principalOscuro: string
  /** #a3303f · decorativo. El punto del trono en MapaFueraDelRecorrido (y su halo `alfa(principalVivo, .25)`). */
  principalVivo: string
  /** #6e1a20 · con la crema #f3ebdc encima. Las piezas apadrinadas de FotoConPiezas. */
  principalPieza: string
  /** #5a1620 · decorativo. Primer tono del degradado de la placa granate de TarjetaNoticia. */
  principalProfundo: string
  /** #2a0a0f · decorativo. Último tono del degradado de la placa granate de TarjetaNoticia. */
  principalSombra: string
  /** #2a1216 · decorativo. La capa de transición del CajonMovil. */
  principalTostado: string
  /** #1d0a0e · decorativo. El fondo de CabeceraASangre mientras no hay foto. */
  principalNoche: string
  /** #3a1016 · ≥ 4,5 sobre el rosa viejo #ead9d0. Los títulos solemnes de CalendarioDeCultos (`GRANATE_TINTA`). */
  principalTinta: string
  /** #fc858a · ≥ 4,5 sobre #262326 y #121113. `palette.primary.light`; el «granate claro» o `ROSA` para escribir
   *  sobre el fondo oscuro: BloqueAnillos, BloqueCronologia, BloqueDonativo, BloquePuertas, BloqueTarjetas,
   *  RecorridoEnMapa, EditorDeRecorrido, MapaFueraDelRecorrido; sus halos con `alfa(principalClaro, …)`. */
  principalClaro: string
  /** #ffb3b4 · ≥ 4,5 sobre #262326 y #0c0b0d. CMS oscuro (`accionTexto`, `enlace`, `ACCION_OSCURA`, el borde
   *  `alfa(principalPalido, 0.5)` de los botones outlined), `secondaryFixedDim`, PerfilPage. */
  principalPalido: string
  /** #f08a93 · ≥ 3 sobre #0c0b0d. `GRAFICAS.oscuro.acento` del CMS. */
  principalGrafica: string
  /** #e06a78 · ≥ 4,5 sobre el mapa #0b0a0c. `BURDEOS_LEGIBLE` de RecorridoEnMapa. */
  principalLegible: string
  /** #b8283d · ≥ 3 sobre blanco. Sin uso: el punto de «Culto» en el CMS claro (`EN_CLARO.CULTO` de
   *  cms/agenda/tiposEvento.ts) lleva este hex, pero fijo, porque es un color de significado. */
  principalPuntoClaro: string
  /** #ff9fa6 · ≥ 3 sobre #0c0b0d. Sin uso: `TIPOS.CULTO.oscuro` de features/inicio/agenda.ts lleva este hex,
   *  pero fijo, porque es un color de significado. */
  principalPuntoOscuro: string
  /** #fbe9e7 · ≥ 4,5 sobre `principal`. Texto y cifra de la cubierta del boletín (PublicacionesDestacadas). */
  sobrePrincipal: string
  /** #f1d9d6 · ≥ 4,5 sobre `principal` y `principalRealce`. La ceja de la placa «Hazte hermano». */
  sobrePrincipalSuave: string
  /** #f3dedb · ≥ 4,5 sobre `principal` y `principalRealce`. El texto de la placa «Hazte hermano». */
  sobrePrincipalTexto: string

  // --- Familia del color de acento (el oro) ---

  /** #dec72b · ≥ 4,5 sobre #262326 y #121113 (y ≥ 3 como foco). El oro de la marca: `GOLD`/`ORO`/`DORADO`
   *  de features/inicio/estilos.ts, estiloDeBoton.ts, mapa/estilo.ts, galeria/formato.ts y BloqueRelacion;
   *  `tertiaryFixedDim` (foco de MenuEscritorio); los `outline` de foco de los bloques; todos los
   *  `rgba(222, 199, 43, …)` con `alfa(acento, …)` (AvisoSuave, halos, bordes). */
  acento: string
  /** #c1ac00 · ≥ 4,5 sobre #262326. `palette.secondary.main` y `tertiaryContainer` (el `outlineColor` de MarcoPublico). */
  acentoMedio: string
  /** #6b5f00 · sin suelo. `palette.secondary.dark` (`designTokens.colors.tertiary`). */
  acentoOscuro: string
  /** #fce348 · sin suelo. `palette.secondary.light` (`tertiaryFixed`). */
  acentoClaro: string
  /** #c4af79 · ≥ 4,5 sobre #262326. El «oro suave» de las cejas: BloqueAnillos, BloqueCarrusel, BloqueCronologia,
   *  BloquePrograma, BloqueRelacion, BloqueTexto. */
  acentoApagado: string
  /** #cdae72 · ≥ 4,5 sobre #262326. La tienda (BarraDeFiltros, TiendaPage). La papeleta en pantalla
   *  (papeleta-estilo.ts) va con `paletaDeImprenta().oroClaro`, que tiene el mismo valor de partida. */
  acentoArena: string
  /** #c9b25a · ≥ 4,5 sobre #120f11. El `ORO_SUAVE` de CartelDeCulto. */
  acentoCartel: string
  /** #c9ab3c · ≥ 3 sobre #262326. El icono de AvisoSuave. */
  acentoAviso: string
  /** #d9b36c · ≥ 4,5 sobre el velo #141111 y ≥ 3 sobre `principalPieza`. Bordes y números de FotoConPiezas;
   *  su halo `alfa(acentoPieza, 0.6)`. */
  acentoPieza: string
  /** #8a7630 · decorativo. Los edificios destacados de mapa/estilo.ts. */
  acentoRelieve: string
  /** #d9bf7a · ≥ 4,5 sobre #0c0b0d. El oro viejo del Inicio «Retablo» del CMS (`ORO_CLARO` y `ORO` en oscuro). */
  acentoViejo: string
  /** #8a6a1c · ≥ 4,5 sobre blanco y el lienzo del CMS claro. `ORO` del Retablo en claro. */
  acentoViejoSobreClaro: string
  /** #b08f3e · ≥ 3 sobre blanco. `ORO_GRAFICA` del Retablo en claro. */
  acentoGraficaClaro: string
  /** #c8a95a · ≥ 3 sobre #0c0b0d. `ORO_GRAFICA` del Retablo en oscuro. */
  acentoGraficaOscuro: string
}

/** Los colores de los PDF (services/informes/pdf.ts y los que importan de él) y de los correos. */
export interface PaletaDeImprenta {
  /** #5c1622 · ≥ 4,5 sobre blanco y marfil. `BURDEOS` de pdf.ts; el burdeos de la papeleta en pantalla (papeleta-estilo.ts). */
  burdeos: string
  /** #a3303f · ≥ 3 sobre blanco. `BURDEOS_VIVO` de pdf.ts (gráficas, leyendas). */
  burdeosVivo: string
  /** #6e1a20 · ≥ 4,5 sobre blanco. `COLORES.burdeos` de correos/plantilla.ts (filete, cruz, títulos de recuadro). */
  acentoCorreo: string
  /** #b08d52 · sin suelo (filetes y rombos). `ORO` de pdf.ts. */
  oro: string
  /** #cdae72 · ≥ 4,5 sobre el negro #161214. `ORO_CLARO` de pdf.ts (rótulos sobre la banda negra) y `ORO` de papeleta-estilo.ts. */
  oroClaro: string
  /** #ddd0b3 · sin suelo (rellenos). `ORO_PALIDO` de pdf.ts. */
  oroPalido: string
  /** #cbb48a · sin suelo. `ORO_MEDIO` de pdf.ts. */
  oroMedio: string
  /** #8a6a30 · ≥ 4,5 sobre blanco. `ORO_TEXTO` de modelo-182-pdf.ts y ficha-patrimonio-pdf.ts, y el «hoy» de pdf.ts. */
  oroTexto: string
}

export interface Papel {
  familia: 'principal' | 'acento'
  /** El hex de hoy, el que sale con la marca a null. */
  partida: string
  /** [fondo, mínimo]: el fondo es un hex o el nombre de un papel anterior de la misma tabla. */
  suelos?: [string, number][]
  /** Luminosidad relativa al papel base (`principal`) y no la de partida: los hover. */
  relativo?: boolean
}

export declare const PARTIDA: Readonly<{ colorPrincipal: '#6e1822'; colorAcento: '#dec72b' }>
export declare const FONDOS: Readonly<Record<
  'blanco' | 'publico' | 'profundo' | 'tarjetaCms' | 'mapa' | 'cartel' | 'lienzoCms' | 'solemne' | 'crema' | 'velo' | 'negroImprenta' | 'marfil',
  string
>>
export declare const PAPELES_DE_MARCA: Readonly<Record<keyof PaletaDeMarca, Papel>>
export declare const PAPELES_DE_IMPRENTA: Readonly<Record<keyof PaletaDeImprenta, Papel>>

/** Luminancia relativa de WCAG 2, de 0 a 1. */
export declare function luminancia(hex: string): number
/** Contraste de WCAG 2 entre dos hex, de 1 a 21. */
export declare function contraste(a: string, b: string): number
/** «2,1»: truncado a un decimal y con coma. */
export declare function cifraDeContraste(n: number): string
/** `rgba(r, g, b, a)` de un hex. */
export declare function alfa(hex: string, a: number): string
/** «r, g, b» de un hex. */
export declare function componentes(hex: string): string
export declare function aOklch(hex: string): { l: number; c: number; h: number }
/** Fuera de sRGB, baja la saturación hasta que entra. */
export declare function desdeOklch(color: { l: number; c: number; h: number }): string
export declare function paletaDeMarca(marca: MarcaDeColores): Readonly<PaletaDeMarca>
export declare function paletaDeImprenta(marca: MarcaDeColores): Readonly<PaletaDeImprenta>
/** Avisos de contraste y de colores casi iguales; vacío con null o con los de partida. */
export declare function avisosDeMarca(marca: MarcaDeColores): string[]
