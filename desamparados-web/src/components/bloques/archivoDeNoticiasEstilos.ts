import { MARCA, alfa } from '../../theme/marca'

/*
 * Las medidas del archivo de noticias que comparten las piezas de verdad
 * (ArchivoDeNoticias) y su esqueleto (esqueletosDeListado): las dos miden igual
 * y la página no salta al llegar. Aparte de las dos porque el esqueleto va en el
 * trozo de todas las páginas y el archivo no.
 */

/** El alto de la principal: la foto con el texto encima. */
export const principalAlto = { xs: 440, sm: 480, md: 560 } as const

const raya = `1px solid ${alfa(MARCA.acento, 0.12)}`

/** Las dos columnas de filas (una en el móvil y la tableta). */
export const columnasDeFilas = {
  listStyle: 'none', m: 0, p: 0, mt: { xs: 3, md: 6 }, display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 5,
  borderTop: raya,
} as const

/** Una fila: la foto cuadrada a un lado y la fecha, el título y el extracto al otro. */
export const filaSx = {
  display: 'grid', gridTemplateColumns: { xs: '104px minmax(0, 1fr)', sm: '160px minmax(0, 1fr)', lg: '200px minmax(0, 1fr)' },
  gap: { xs: 2, md: 3 }, alignItems: 'center', py: { xs: 2, md: 3 },
  borderBottom: raya,
} as const

/** El marco cuadrado de la foto de cada fila. */
export const marcoCuadradoSx = { position: 'relative', aspectRatio: '1', overflow: 'hidden', backgroundColor: '#18161a' } as const
