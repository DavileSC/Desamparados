import { createTheme, type ThemeOptions } from '@mui/material/styles'

export const designTokens = {
  colors: {
    primary: '#070608',
    surface: '#fbf9f6',
    surfaceVariant: '#e4e2df',
    primaryFixed: '#e8e0e4',
    onSecondaryContainer: '#741d26',
    outlineVariant: 'rgba(204, 196, 201, 0.2)',
    onTertiaryFixed: '#201c00',
    onPrimaryFixed: '#0c0b0d',
    onPrimaryFixedVariant: '#494649',
    surfaceContainerLowest: '#ffffff',
    onSecondary: '#ffffff',
    surfaceContainer: '#efeeeb',
    tertiaryFixedDim: '#dec72b',
    secondaryFixedDim: '#ffb3b4',
    outline: '#7b757a',
    surfaceContainerLow: '#f5f3f0',
    onSurfaceVariant: '#4a454a',
    onPrimaryContainer: '#8f8a8d',
    primaryContainer: '#121113',
    onSurface: '#1b1c1a',
    background: '#fbf9f6',
    onTertiaryContainer: '#494000',
    tertiaryContainer: '#c1ac00',
    onPrimary: '#ffffff',
    onTertiary: '#ffffff',
    onError: '#ffffff',
    onSecondaryFixed: '#40000a',
    onErrorContainer: '#93000a',
    onBackground: '#1b1c1a',
    surfaceBright: '#fbf9f6',
    tertiaryFixed: '#fce348',
    inverseOnSurface: '#f2f0ed',
    inverseSurface: '#30312f',
    secondaryContainer: '#fc858a',
    tertiary: '#6b5f00',
    secondaryFixed: '#ffdad9',
    surfaceContainerHigh: '#eae8e5',
    primaryFixedDim: '#cbc5c8',
    onTertiaryFixedVariant: '#514700',
    onSecondaryFixedVariant: '#81262e',
    surfaceDim: '#dbdad7',
    errorContainer: '#ffdad6',
    surfaceTint: '#615d60',
    error: '#ba1a1a',
    inversePrimary: '#cbc5c8',
    surfaceContainerHighest: '#e4e2df',
    secondary: '#a03d44',
    burgundy: '#6e1822',
    /** Pie de página: un escalón más claro que el fondo, para que no se confunda con él ni con el bloque de encima. */
    footer: '#1a181b',
    glass: 'rgba(18, 17, 19, 0.6)',
    glassBorder: 'rgba(204, 196, 201, 0.1)',
  },
  // Las únicas fuentes del proyecto: ningún componente escribe un nombre de
  // fuente a mano, todos leen de aquí (o del tema, que lee de aquí).
  fonts: {
    /** Web pública y área de hermanos. */
    heading: '"Exo 2 Variable", "Exo 2", sans-serif',
    body: '"Exo 2 Variable", "Exo 2", sans-serif',
    /** El CMS lleva su propia tipografía: la aplica su tema (theme/cms.ts). */
    cms: {
      heading: '"Saira Variable", "Saira", sans-serif',
      body: '"Saira Variable", "Saira", sans-serif',
    },
  },
  spacing: {
    unit: 8,
    mobileMargin: '20px',
    desktopMargin: '64px',
    containerMax: '1280px',
    gutter: 24,
  },
  shadows: {
    card: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    subtle: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
  },
  /**
   * Colores de los gráficos. Validados con el script de la skill dataviz sobre
   * las superficies reales del proyecto (#fbf9f6 y #121113): pasan la banda de
   * luminosidad, el suelo de croma, la separación para daltonismo y el suelo de
   * visión normal. No sustituir a ojo: hay que revalidar.
   *
   * OJO: sobre fondo claro, el verde y el ámbar quedan por debajo de 3:1 de
   * contraste. Todo valor pintado con ellos lleva etiqueta de texto visible.
   */
  dataviz: {
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
    seriesOscuras: ['#3987e5', '#d95926', '#199e70', '#c98500'],
    estados: { ok: '#1baf7a', aviso: '#eda100', error: '#e34948' },
  },
}

export const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    background: {
      default: designTokens.colors.primaryContainer,
      paper: designTokens.colors.primaryContainer,
    },
    primary: {
      main: designTokens.colors.secondary,
      contrastText: designTokens.colors.onSecondary,
      dark: '#81262e',
      light: '#fc858a',
    },
    secondary: {
      main: designTokens.colors.tertiaryContainer,
      contrastText: designTokens.colors.onTertiary,
      dark: designTokens.colors.tertiary,
      light: designTokens.colors.tertiaryFixed,
    },
    error: {
      main: designTokens.colors.error,
      contrastText: designTokens.colors.onError,
    },
    text: {
      primary: designTokens.colors.surfaceContainerLowest,
      secondary: designTokens.colors.surfaceVariant,
    },
    divider: designTokens.colors.outlineVariant,
  },
  typography: {
    fontFamily: designTokens.fonts.body,
    h1: {
      fontFamily: designTokens.fonts.heading,
      fontSize: '64px',
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      fontWeight: 400,
    },
    h2: {
      fontFamily: designTokens.fonts.heading,
      fontSize: '48px',
      lineHeight: 1.2,
      fontWeight: 400,
    },
    h3: {
      fontFamily: designTokens.fonts.heading,
      fontSize: '32px',
      lineHeight: 1.3,
      fontWeight: 400,
    },
    h4: {
      fontFamily: designTokens.fonts.heading,
      fontSize: '24px',
      lineHeight: 1.3,
      fontWeight: 400,
    },
    h5: {
      fontFamily: designTokens.fonts.heading,
      fontSize: '20px',
      lineHeight: 1.3,
      fontWeight: 400,
    },
    h6: {
      fontFamily: designTokens.fonts.heading,
      fontSize: '18px',
      lineHeight: 1.3,
      fontWeight: 400,
    },
    body1: {
      fontFamily: designTokens.fonts.body,
      fontSize: '18px',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    body2: {
      fontFamily: designTokens.fonts.body,
      fontSize: '16px',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    button: {
      fontFamily: designTokens.fonts.body,
      fontSize: '14px',
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
    overline: {
      fontFamily: designTokens.fonts.body,
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    },
    caption: {
      fontFamily: designTokens.fonts.body,
      fontSize: '12px',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: designTokens.colors.primaryContainer,
          color: designTokens.colors.surfaceContainerLowest,
        },
        a: {
          textDecoration: 'none',
          color: 'inherit',
        },
        // El navegador no hereda la fuente en los controles de formulario: sin
        // esto, un botón que no es de MUI (los contadores de Tesorería, el
        // interruptor de modo del CMS) salía en Arial.
        'button, input, select, textarea': {
          fontFamily: 'inherit',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          padding: '14px 32px',
          transition: 'all 0.3s ease',
        },
        contained: {
          backgroundColor: designTokens.colors.burgundy,
          color: designTokens.colors.onSecondary,
          '&:hover': {
            backgroundColor: '#5a131c',
            opacity: 0.9,
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          maxWidth: designTokens.spacing.containerMax,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
}

export const theme = createTheme(themeOptions)

export default theme
