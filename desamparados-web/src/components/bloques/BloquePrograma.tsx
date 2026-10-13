import { Link } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { eventosDelCalendario } from '../../lib/api/agenda'
import { useEnlaceVivo } from '../../hooks/useEnlaceVivo'
import { enlaceConFlecha } from '../estiloDeBoton'
import { useModulos } from '../../hooks/useModulos'
import { anchoMaximo } from './presentacion'
import { anioDe, fechaDelActo, proximaFila } from './programa'
import type { BloquePrograma as Datos, FilaDePrograma } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

/** Cuántos actos futuros se piden a la Agenda: sobran para encontrar el próximo culto de cualquier mes. */
const ACTOS = 60

/**
 * El programa del año: un culto por fila, con cuándo es en letra fina a la
 * izquierda —como el programa de una temporada—, qué es en el centro y, a la
 * derecha, su enlace si lo tiene.
 *
 * El próximo culto se marca solo con la etiqueta «Próximo» y su fecha, que sale
 * del primer culto o salida de la Agenda en ese mes (ver `proximaFila`). Sin
 * Agenda, o mientras llega, el programa se lee igual, sin marca.
 *
 * Pinta su propio título, con el año en que estamos al otro lado.
 */
export default function BloquePrograma({ bloque }: { bloque: Datos }) {
  const { activo } = useModulos()
  const { data: actos } = useQuery({
    queryKey: ['programa', 'agenda'],
    queryFn: () => eventosDelCalendario({ cuantos: ACTOS }),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: activo('agenda'),
  })
  const proximo = actos ? proximaFila(bloque.filas, actos) : null

  return (
    // Al ancho de la página, alineado con el texto de una foto fundida encima.
    <Box sx={{ maxWidth: anchoMaximo(bloque, 'none'), mx: 'auto' }}>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2,
        pb: 2.5, borderBottom: '1px solid', borderColor: 'divider',
      }}>
        {bloque.titulo
          ? <Typography component="h2" sx={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: MARCA.acentoApagado, m: 0 }}>{bloque.titulo}</Typography>
          : <span />}
        <Typography component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>{anioDe()}</Typography>
      </Box>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {bloque.filas.map((fila, i) => (
          <Fila key={i} fila={fila} proximo={proximo?.indice === i} fecha={proximo?.indice === i && proximo.acto ? fechaDelActo(proximo.acto) : ''} />
        ))}
      </Box>
    </Box>
  )
}

function Fila({ fila, proximo, fecha }: { fila: FilaDePrograma; proximo: boolean; fecha: string }) {
  const enlaceVivo = useEnlaceVivo()
  const conBoton = fila.boton.trim() !== '' && enlaceVivo(fila.enlace)
  return (
    <Box component="li" aria-current={proximo ? 'date' : undefined} sx={{
      display: 'grid', alignItems: 'baseline',
      gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr) 240px' }, gap: { xs: 1, md: 5 },
      py: { xs: 3, md: 4.25 }, borderBottom: '1px solid', borderColor: 'divider',
      '&:last-of-type': { borderBottom: 0 },
    }}>
      <Typography component="span" sx={{
        fontSize: { xs: 13, md: 38 }, fontWeight: { xs: 500, md: 200 }, lineHeight: 1.1,
        letterSpacing: { xs: '0.22em', md: 0 }, textTransform: { xs: 'uppercase', md: 'none' },
        color: proximo ? 'text.primary' : 'text.secondary',
      }}>
        {fila.cuando}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h3" sx={{ fontSize: { xs: 22, md: 24 }, fontWeight: 400, lineHeight: 1.25, color: 'text.primary', m: 0 }}>{fila.titulo}</Typography>
        {fila.texto && <Typography sx={{ mt: 1, fontSize: 15.5, lineHeight: 1.7, color: 'text.secondary' }}>{fila.texto}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: { xs: 'flex-start', md: 'flex-end' }, textAlign: { md: 'right' }, mt: { xs: 1, md: 0 } }}>
        {proximo && (
          <>
            {/* Un rótulo con filete, no un bloque relleno: el amarillo macizo era lo único así en la web. */}
            <Typography component="span" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'secondary.main', border: '1px solid', borderColor: alfa(MARCA.acento, 0.5), px: 1, py: 0.5, lineHeight: 1.4 }}>
              PRÓXIMO
            </Typography>
            {fecha && <Typography component="span" sx={{ fontSize: 15.5, color: 'text.primary' }}>{fecha}</Typography>}
          </>
        )}
        {conBoton && (
          <Box component={Link} to={fila.enlace} sx={enlaceConFlecha}>
            {fila.boton} <ArrowForwardIcon aria-hidden />
          </Box>
        )}
      </Box>
    </Box>
  )
}
