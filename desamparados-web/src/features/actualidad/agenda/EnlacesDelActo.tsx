import { Box } from '@mui/material'
import { urlDelActoEnCalendario, type ApiEvent } from '../../../lib/api/agenda'
import { GOLD, GRANATE } from '../../inicio/estilos'
import { useContacto } from '../../../hooks/useContacto'
import { urlDelMapa } from './cultos'

/**
 * «Añadir a mi calendario» (el .ics del acto) y, si tiene lugar, «Cómo llegar».
 * La ventana de la Agenda va `sinMapa`: el lugar ya se lee en ella.
 */
export default function EnlacesDelActo({ evento, sobreOscuro = false, sinMapa = false }: { evento: ApiEvent; sobreOscuro?: boolean; sinMapa?: boolean }) {
  const localidad = useContacto()?.sede.localidad
  const mapa = sinMapa ? null : urlDelMapa(evento.location, localidad)
  const estilo = {
    color: sobreOscuro ? GOLD : GRANATE, fontWeight: 600, fontSize: 13.5, minHeight: { xs: 40, md: 30 },
    display: 'inline-flex', alignItems: 'center', textUnderlineOffset: '3px', textDecorationThickness: '1px',
    '&:hover': { textDecorationThickness: '2px' },
  } as const
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0 18px' }}>
      <Box component="a" href={urlDelActoEnCalendario(evento.id)} download aria-label={`Añadir a mi calendario: ${evento.title}`} sx={estilo}>
        Añadir a mi calendario
      </Box>
      {mapa && (
        <Box component="a" href={mapa} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar: ${evento.location}`} sx={estilo}>
          Cómo llegar
        </Box>
      )}
    </Box>
  )
}

