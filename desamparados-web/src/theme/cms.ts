import { createTheme, type Theme } from '@mui/material/styles'
import theme, { designTokens, ERROR_SOBRE_OSCURO, themeOptions } from './index'

/**
 * Tema del CMS en dos modos, sobre el mismo juego de tokens que la web pública.
 *
 * Se aplica con un ThemeProvider anidado dentro de MarcoCms, así que la web
 * pública no se entera. Los dos modos redefinen la paleta entera, los estados
 * interactivos y el texto deshabilitado en lugar de fusionar parcialmente:
 * heredar sobre el `mode: 'dark'` del tema base deja esos tres grupos en
 * blancos de baja opacidad, invisibles sobre el lienzo claro. Afecta al hover,
 * la selección y el foco de botones, MenuItem, ListItemButton, filas de tabla,
 * y al texto deshabilitado.
 */
export type ModoCms = 'claro' | 'oscuro'

export interface SuperficiesCms {
  /** Lienzo de la pantalla. */
  canvas: string
  /** Fondo de tarjeta. */
  card: string
  /** Borde de tarjeta; en oscuro no hay borde, la tarjeta se separa por tono. */
  hairline: string
  /** Línea que separa filas dentro de una tarjeta. */
  filete: string
  /** Barra lateral: la misma tinta en los dos modos. */
  sidebar: string
  /** Bloque destacado, siempre en el tono contrario al tema. */
  inverso: string
  inversoTexto: string
  inversoTenue: string
  /** Pista de la barra de progreso dentro del bloque destacado. */
  inversoPista: string
  /** Botón secundario de la cabecera. */
  boton2: string
  boton2Borde: string
  /** Botón de acción de «Para hoy». */
  accionFondo: string
  accionTexto: string
  enlace: string
  /** Fondo de las etiquetas de estado de «Para hoy». */
  pillUrgente: string
  pillPendiente: string
  pillNeutro: string
  /** Texto de aviso («Sin foto», «Le falta el extracto»): el ámbar del punto no se lee en letra pequeña. */
  avisoTexto: string
  /** Emergente de detalle de las gráficas. */
  emergente: string
  emergenteBorde: string
  texto: string
  texto2: string
  tenue: string
}

export interface GraficasCms {
  /** Lo que entra: ingresos, altas. */
  entrada: string
  /** Lo que sale: gastos, bajas. */
  salida: string
  /** Años que no son el elegido. */
  contexto: string
  /** El año elegido. */
  enfasis: string
  /** Una serie sin signo (tramos de edad). */
  neutro: string
  rejilla: string
  /** Línea del cero, más marcada que la rejilla. */
  cero: string
  /** Banda del mes señalado al pasar el ratón. */
  banda: string
  estados: { ok: string; aviso: string; error: string }
  /** El color de la casa en las gráficas de una sola serie: burdeos en claro, rosa en oscuro. */
  acento: string
  /** Cuánto brillan líneas y columnas (opacidad del halo): mucho en oscuro, apenas en claro. */
  /** Opacidad del halo, como texto CSS ("0.22" o una variable). */
  brillo: string
}

const SUPERFICIES: Record<ModoCms, SuperficiesCms> = {
  claro: {
    canvas: '#f4f2ee',
    card: '#ffffff',
    hairline: '#e3dfda',
    filete: '#efebe6',
    sidebar: designTokens.colors.primary,
    inverso: designTokens.colors.onPrimaryFixed, // #0c0b0d
    inversoTexto: '#ffffff',
    inversoTenue: 'rgba(255,255,255,0.55)',
    inversoPista: 'rgba(255,255,255,0.12)',
    boton2: '#ffffff',
    boton2Borde: '#e3dfda',
    accionFondo: 'rgba(110,24,34,0.07)',
    accionTexto: designTokens.colors.burgundy, // #6e1822
    enlace: designTokens.colors.burgundy,
    pillUrgente: 'rgba(227,73,72,0.12)',
    pillPendiente: 'rgba(237,161,0,0.16)',
    pillNeutro: '#efeeeb',
    avisoTexto: '#8a5a00',
    emergente: '#ffffff',
    emergenteBorde: '#e3dfda',
    texto: designTokens.colors.onSurface, // #1b1c1a
    texto2: designTokens.colors.onSurfaceVariant, // #4a454a
    tenue: designTokens.colors.outline, // #7b757a
  },
  oscuro: {
    canvas: designTokens.colors.primaryContainer, // #121113
    card: designTokens.colors.onPrimaryFixed, // #0c0b0d
    hairline: 'transparent',
    filete: designTokens.colors.glassBorder, // rgba(204,196,201,0.1)
    sidebar: designTokens.colors.primary,
    inverso: designTokens.colors.surface, // #fbf9f6
    inversoTexto: designTokens.colors.onSurface,
    inversoTenue: designTokens.colors.outline,
    inversoPista: designTokens.colors.surfaceVariant, // #e4e2df
    boton2: 'rgba(255,255,255,0.06)',
    boton2Borde: 'transparent',
    accionFondo: 'rgba(160,61,68,0.22)',
    accionTexto: designTokens.colors.secondaryFixedDim, // #ffb3b4
    enlace: designTokens.colors.secondaryFixedDim,
    pillUrgente: 'rgba(227,73,72,0.18)',
    pillPendiente: 'rgba(237,161,0,0.18)',
    pillNeutro: 'rgba(255,255,255,0.08)',
    avisoTexto: '#f2c264',
    emergente: designTokens.colors.primary, // #070608
    emergenteBorde: 'rgba(204,196,201,0.18)',
    texto: '#ffffff',
    texto2: designTokens.colors.primaryFixedDim, // #cbc5c8
    tenue: designTokens.colors.onPrimaryContainer, // #8f8a8d
  },
}

const GRAFICAS: Record<ModoCms, GraficasCms> = {
  claro: {
    entrada: designTokens.dataviz.series[0], // #2a78d6
    salida: '#b0414a',
    contexto: '#d6d0cb',
    enfasis: designTokens.colors.onSurface,
    neutro: designTokens.colors.outline,
    rejilla: '#efebe6',
    cero: '#b9b3b0',
    banda: 'rgba(27,28,26,0.045)',
    estados: designTokens.dataviz.estados,
    acento: designTokens.colors.burgundy,
    brillo: '0.22',
  },
  oscuro: {
    entrada: designTokens.dataviz.seriesOscuras[0], // #3987e5
    salida: '#b0414a',
    contexto: designTokens.colors.onSurfaceVariant, // #4a454a
    enfasis: '#ffffff',
    neutro: designTokens.colors.onPrimaryContainer,
    rejilla: 'rgba(204,196,201,0.12)',
    cero: 'rgba(204,196,201,0.4)',
    banda: 'rgba(255,255,255,0.05)',
    estados: designTokens.dataviz.estados,
    acento: '#f08a93',
    brillo: '0.75',
  },
}

export const superficiesCms = (modo: ModoCms): SuperficiesCms => SUPERFICIES[modo]
export const graficasCms = (modo: ModoCms): GraficasCms => GRAFICAS[modo]

// ---------------------------------------------------------------------------
// Los dos modos a la vez, con variables CSS
// ---------------------------------------------------------------------------
//
// En el CMS, claro y oscuro no son dos temas: son dos juegos de variables CSS
// que cuelgan de un atributo de <html> (`data-cms-modo`). Cambiar de modo es
// cambiar ese atributo, sin volver a pintar React: antes se rehacía el tema
// entero y la pantalla se congelaba entre 100 ms (publicado) y 1 s (en
// desarrollo) antes de cambiar.
//
// Por eso los componentes no deciden colores con `modo`: usan estas variables
// o `segunModo(claro, oscuro)`. Cada variable lleva de respaldo su valor en
// claro, que es como se ve fuera del CMS (la pantalla de acceso, las pruebas).

/** El atributo de <html> que lleva el modo del CMS: `light` o `dark`. */
export const ATRIBUTO_MODO = 'data-cms-modo'

const kebab = (clave: string) => clave.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)
const nombreVariable = (grupo: 's' | 'g', clave: string) => `--cms-${grupo}-${kebab(clave)}`

/** Un color distinto en cada modo, que resuelve el navegador (`light-dark`, según el `color-scheme` del CMS). */
export const segunModo = (claro: string, oscuro: string) => `light-dark(${claro}, ${oscuro})`

/** Las superficies del CMS, válidas en los dos modos. */
export const SUPERFICIES_CMS = Object.fromEntries(
  Object.entries(SUPERFICIES.claro).map(([clave, valor]) => [clave, `var(${nombreVariable('s', clave)}, ${valor})`]),
) as unknown as SuperficiesCms

/** Los colores de las gráficas, válidos en los dos modos. Los de estado son iguales en los dos. */
export const GRAFICAS_CMS: GraficasCms = {
  ...(Object.fromEntries(
    Object.entries(GRAFICAS.claro)
      .filter(([clave]) => clave !== 'estados')
      .map(([clave, valor]) => [clave, `var(${nombreVariable('g', clave)}, ${valor})`]),
  ) as unknown as Omit<GraficasCms, 'estados'>),
  estados: GRAFICAS.claro.estados,
}

/** Una fracción del brillo del modo, como opacidad: `brillo(paleta.brillo, 0.6)`. */
export const brillo = (base: string, fraccion = 1) => (fraccion === 1 ? base : `calc(${base} * ${fraccion})`)

/** Las variables de un modo, para colgarlas de su selector. */
function variablesDe(modo: ModoCms) {
  return {
    colorScheme: modo === 'claro' ? 'light' : 'dark',
    ...Object.fromEntries(Object.entries(SUPERFICIES[modo]).map(([clave, valor]) => [nombreVariable('s', clave), valor])),
    ...Object.fromEntries(
      Object.entries(GRAFICAS[modo]).filter(([clave]) => clave !== 'estados').map(([clave, valor]) => [nombreVariable('g', clave), String(valor)]),
    ),
  }
}

const ACCIONES: Record<ModoCms, Record<string, string>> = {
  claro: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    focus: 'rgba(0, 0, 0, 0.12)',
  },
  oscuro: {
    active: 'rgba(255, 255, 255, 0.62)',
    hover: 'rgba(255, 255, 255, 0.06)',
    selected: 'rgba(255, 255, 255, 0.12)',
    disabled: 'rgba(255, 255, 255, 0.34)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
    focus: 'rgba(255, 255, 255, 0.14)',
  },
}

/** En claro, el rojo de serie: sobre la tarjeta blanca sí se lee. */
const ERROR_CLARO = { main: designTokens.colors.error, contrastText: designTokens.colors.onError }

/** La paleta de un modo: la de la web pública (marca, error) con las superficies y los textos del CMS. */
function paletaCms(modo: ModoCms) {
  const s = SUPERFICIES[modo]
  return {
    primary: themeOptions.palette?.primary,
    secondary: themeOptions.palette?.secondary,
    // El rojo de serie (#ba1a1a) sobre la tarjeta oscura se queda en 3:1 y la
    // letra pequeña de los avisos de un campo no se lee: en oscuro, el mismo
    // rojo claro que la web pública.
    error: modo === 'claro' ? ERROR_CLARO : ERROR_SOBRE_OSCURO,
    background: { default: s.canvas, paper: s.card },
    text: {
      primary: s.texto,
      secondary: s.texto2,
      disabled: modo === 'claro' ? 'rgba(0, 0, 0, 0.38)' : 'rgba(255, 255, 255, 0.42)',
    },
    action: ACCIONES[modo],
    divider: modo === 'claro' ? s.hairline : s.filete,
  }
}

const fuentes = designTokens.fonts.cms
const titulo = { fontFamily: fuentes.heading }
const texto = { fontFamily: fuentes.body }
// Todas las variantes, porque el tema base fija la fuente en cada una.
const TIPOGRAFIA_CMS = {
  fontFamily: fuentes.body,
  h1: titulo, h2: titulo, h3: titulo, h4: titulo, h5: titulo, h6: titulo,
  subtitle1: texto, subtitle2: texto, body1: texto, body2: texto, button: texto, caption: texto, overline: texto,
}

/** Lo que comparten los dos temas del CMS y no depende del modo. */
const COMPONENTES_COMUNES = {
  // Con más pestañas de las que caben (en el móvil, casi siempre), las que
  // sobraban quedaban fuera sin nada que avisara de que existían: Difuntos,
  // Venta en mano, Modelo 182… Con flechas, también en el móvil.
  MuiTabs: { defaultProps: { variant: 'scrollable', scrollButtons: 'auto', allowScrollButtonsMobile: true } },
  // En el móvil, 32px de margen a cada lado de una ventana se comían una
  // sexta parte del ancho: con 16 caben los campos.
  MuiDialog: {
    styleOverrides: {
      paper: {
        '@media (max-width:599.95px)': {
          '&:not(.MuiDialog-paperFullScreen)': { margin: 16, maxWidth: 'calc(100% - 32px)', maxHeight: 'calc(100% - 32px)' },
          '&.MuiDialog-paperFullWidth': { width: 'calc(100% - 32px)' },
        },
      },
    },
  },
} as const

/** Un tema del CMS con un modo fijo: la pantalla de acceso (siempre clara) y las pruebas. */
export function crearTemaCms(modo: ModoCms): Theme {
  const s = superficiesCms(modo)
  return createTheme(theme, {
    typography: TIPOGRAFIA_CMS,
    palette: { mode: modo === 'claro' ? 'light' : 'dark', ...paletaCms(modo) },
    components: {
      ...COMPONENTES_COMUNES,
      // La caja de scroll de una tabla hace de referencia a lo que va con
      // posición absoluta dentro (los rótulos solo para lectores de pantalla,
      // como «Acciones»): si no, se escapaban de ella y ensanchaban la página
      // entera en el móvil.
      MuiTableContainer: { styleOverrides: { root: { position: 'relative' } } },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            // En oscuro la tarjeta se separa del lienzo por tono, como en la web
            // pública: un borde encima la ensuciaría.
            border: modo === 'claro' ? `1px solid ${s.hairline}` : 0,
          },
        },
      },
      // El granate de la marca sobre el fondo oscuro se queda en 2,6:1: los
      // botones que lo usan como texto («Subir foto») toman el rosado del modo oscuro.
      ...(modo === 'oscuro' && {
        MuiButton: {
          styleOverrides: {
            root: {
              variants: [
                { props: { variant: 'text', color: 'primary' }, style: { color: s.accionTexto } },
                { props: { variant: 'outlined', color: 'primary' }, style: { color: s.accionTexto, borderColor: 'rgba(255, 179, 180, 0.5)', '&:hover': { borderColor: s.accionTexto } } },
              ],
            },
          },
        },
      }),
    },
  })
}

/**
 * El tema del CMS, con los dos modos dentro (variables CSS de MUI): es el
 * mismo objeto en claro y en oscuro, así que cambiar de modo no rehace los
 * estilos de ningún componente. Lo que cambia con el modo va en
 * `applyStyles('dark')`, igual que en `crearTemaCms`.
 */
const { palette: _paletaPublica, ...opcionesPublicas } = themeOptions
const ACCION_OSCURA = SUPERFICIES.oscuro.accionTexto
export const temaCms: Theme = createTheme(
  {
    ...opcionesPublicas,
    cssVariables: { colorSchemeSelector: ATRIBUTO_MODO, cssVarPrefix: 'cms' },
    colorSchemes: { light: { palette: paletaCms('claro') }, dark: { palette: paletaCms('oscuro') } },
    defaultColorScheme: 'dark',
  },
  {
    typography: TIPOGRAFIA_CMS,
    components: {
      ...COMPONENTES_COMUNES,
      // La caja de scroll de una tabla hace de referencia a lo que va con
      // posición absoluta dentro (los rótulos solo para lectores de pantalla,
      // como «Acciones»): si no, se escapaban de ella y ensanchaban la página
      // entera en el móvil.
      MuiTableContainer: { styleOverrides: { root: { position: 'relative' } } },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme: t }: { theme: Theme }) => ({
            backgroundImage: 'none',
            border: `1px solid ${SUPERFICIES.claro.hairline}`,
            ...t.applyStyles('dark', { border: 0 }),
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: ({ theme: t }: { theme: Theme }) => ({
            variants: [
              { props: { variant: 'text', color: 'primary' }, style: t.applyStyles('dark', { color: ACCION_OSCURA }) },
              { props: { variant: 'outlined', color: 'primary' }, style: t.applyStyles('dark', { color: ACCION_OSCURA, borderColor: 'rgba(255, 179, 180, 0.5)', '&:hover': { borderColor: ACCION_OSCURA } }) },
            ],
          }),
        },
      },
    },
  },
)

/**
 * La fuente del CMS en el `body` mientras el CMS está en pantalla. El tema ya
 * la pone en sus componentes, pero lo que no es un componente de MUI (la barra
 * lateral, las cabeceras de tabla) hereda del `body`, y las ventanas y menús
 * cuelgan directamente de él: sin esto, salían con la fuente de la web pública.
 * Emotion la retira al desmontarse, al volver a la web pública.
 *
 * Aquí cuelgan también las variables de cada modo y el fundido del cambio.
 */
export const ESTILOS_GLOBALES_CMS = {
  body: { fontFamily: designTokens.fonts.cms.body },
  [`[${ATRIBUTO_MODO}="light"]`]: variablesDe('claro'),
  [`[${ATRIBUTO_MODO}="dark"]`]: variablesDe('oscuro'),
  // El cambio de modo (ver temaCms): la pantalla nueva aparece sobre la vieja,
  // que se queda quieta. Si se desvanecieran las dos a la vez, a mitad de
  // camino se vería un velo gris.
  '::view-transition-old(root)': { animation: 'none' },
  '::view-transition-new(root)': { animation: 'cms-aparecer 240ms cubic-bezier(.2, 0, 0, 1) both' },
  '@keyframes cms-aparecer': { from: { opacity: 0 } },
} as const
