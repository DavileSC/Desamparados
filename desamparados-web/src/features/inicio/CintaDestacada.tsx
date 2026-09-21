import { Box } from '@mui/material'
import { GOLD, GRANATE } from './estilos'

/**
 * La pastilla «Destacada» de la portada.
 *
 * Solo la llevan la noticia y la publicación que se han destacado a mano en el
 * CMS, no la más reciente de turno: si saliera siempre, la palabra no diría
 * nada. Va superpuesta a la tarjeta desde su envoltorio (la propia tarjeta se
 * comparte con el archivo, donde esto no pinta nada), así que no intercepta el
 * clic: el enlace de debajo tiene que seguir siendo toda la tarjeta.
 */
export default function CintaDestacada() {
  return (
    <Box
      component="span"
      sx={{
        position: 'absolute',
        top: { xs: 12, md: 14 },
        left: { xs: 12, md: 14 },
        zIndex: 1,
        pointerEvents: 'none',
        px: 1.25,
        py: 0.5,
        borderRadius: 0.5,
        backgroundColor: GRANATE,
        color: GOLD,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        lineHeight: 1.2,
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
      }}
    >
      Destacada
    </Box>
  )
}
