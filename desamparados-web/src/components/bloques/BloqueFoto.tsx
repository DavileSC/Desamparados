import { Box, Typography } from '@mui/material'
import FotoAmpliable from './FotoAmpliable'
import { GOLD } from '../../features/inicio/estilos'
import { anchoMaximo, siDe, valorDe } from './presentacion'
import type { BloqueFoto as Datos } from '../../lib/api/contenido'
import { propsDeFoto } from '../../lib/fotoSubida'
import { useFotoQueFalla } from '../../hooks/useFotoQueFalla'
import { MARCA, alfa } from '../../theme/marca'

/** Ancho de la foto según su tamaño. `grande` es el de siempre. */
const TAMANOS = { pequena: '480px', mediana: '720px', grande: '1000px', completa: 'none' } as const

/**
 * Los marcos: ninguno (el de siempre), un filete fino o un paspartú dorado.
 * «Entre filetes» no enmarca: pone la foto (un escudo, un emblema) entre dos líneas
 * doradas que van de lado a lado; ver `EntreFiletes`.
 */
const MARCOS = {
  ninguno: {},
  fino: { p: 1, border: '1px solid rgba(204, 196, 201, 0.25)', borderRadius: '10px' },
  dorado: { p: { xs: 1.25, md: 2 }, border: `1px solid ${GOLD}`, borderRadius: '4px', backgroundColor: alfa(MARCA.acento, 0.05) },
} as const

/**
 * Una foto con su pie opcional, del tamaño, recorte y marco que diga su
 * presentación. A tamaño `completa` sale de la columna de la página y va de
 * lado a lado de la ventana, sin redondear.
 *
 * El `alt` es obligatorio en el servidor (`bloques.schema.ts`): aquí nunca
 * llega vacío.
 */
/**
 * Un emblema entre dos filetes dorados, como el escudo de la portadilla de un
 * libro. Va a su alto (más bajo en el móvil) y no al ancho de la columna: un
 * escudo a todo el ancho sería un cartel. Con transparencia, se ve el fondo
 * del bloque alrededor.
 */
function EntreFiletes({ bloque, alFallar }: { bloque: Datos; alFallar: () => void }) {
  // Blancos, como el escudo pasionista para el que se hizo: en oro, al lado
  // del blanco y negro del escudo, sobraba un color.
  const filete = { content: '""', flex: '0 1 220px', height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.45)' }
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 3, md: 4.5 }, '&::before': filete, '&::after': filete }}>
        <Box component="img" {...propsDeFoto(bloque.url, '240px', alFallar)} alt={bloque.alt} loading="lazy" decoding="async"
          sx={{ display: 'block', height: { xs: 150, md: 220 }, width: 'auto', maxWidth: '60%', objectFit: 'contain' }} />
      </Box>
      {bloque.pie && (
        <Typography component="figcaption" variant="body2" sx={{ color: 'text.secondary', mt: 2, textAlign: 'center' }}>{bloque.pie}</Typography>
      )}
    </Box>
  )
}

export default function BloqueFoto({ bloque }: { bloque: Datos }) {
  // Sin foto todavía (un bloque recién añadido, en la vista previa del CMS),
  // nada: un <img src=""> vuelve a pedir la página entera. Una que no carga
  // (borrada, o de /images/ y que falta en la instalación) tampoco deja el
  // icono roto: el bloque se quita.
  const { visible, alFallar } = useFotoQueFalla(bloque.url)
  if (!visible) return null
  if (valorDe(bloque, 'marco') === 'entreFiletes') return <EntreFiletes bloque={bloque} alFallar={alFallar} />
  const tamano = valorDe(bloque, 'tamano') as keyof typeof TAMANOS
  const completa = tamano === 'completa'
  const proporcion = valorDe(bloque, 'proporcion')
  const marco = MARCOS[valorDe(bloque, 'marco') as keyof typeof MARCOS] ?? MARCOS.ninguno

  const imagen = (
    <Box component="img" {...propsDeFoto(bloque.url, completa ? '100vw' : '(min-width: 1000px) 1000px, 100vw', alFallar)} alt={bloque.alt} loading="lazy" decoding="async"
      sx={{
        width: '100%', height: 'auto', display: 'block', borderRadius: completa ? 0 : 2,
        ...(proporcion !== 'original' && { aspectRatio: proporcion.replace(':', ' / '), objectFit: 'cover' }),
      }} />
  )

  return (
    <Box sx={{ maxWidth: completa ? 'none' : anchoMaximo(bloque, TAMANOS[tamano] ?? TAMANOS.grande), mx: completa ? 'calc(50% - 50vw)' : 'auto' }}>
      <Box sx={completa ? undefined : marco}>
        {siDe(bloque, 'ampliable')
          ? <FotoAmpliable url={bloque.url} alt={bloque.alt} pie={bloque.pie}>{imagen}</FotoAmpliable>
          : imagen}
      </Box>
      {bloque.pie && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center', px: completa ? 2 : 0 }}>
          {bloque.pie}
        </Typography>
      )}
    </Box>
  )
}
