import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { site } from '../../../config/site'
import { GOLD, SERIF } from '../../home/estilos'

const enlaceLateral = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  minHeight: 44,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  borderBottom: `1px solid ${GOLD}`,
  pb: '2px',
  '& svg': { fontSize: 16, transition: 'transform .25s ease' },
  '&:hover': { color: GOLD },
  '&:hover svg': { transform: 'translateX(4px)' },
} as const

/**
 * Qué pasa cuando la solicitud ya ha entrado. Es lo que hace el servidor
 * (`AuthService.registerUser`): guarda la ficha inactiva, manda el acuse de
 * recibo y deja el alta en manos de Secretaría, que la formaliza en persona.
 * Sin numerar a propósito: los números son de los pasos del formulario.
 */
export default function ProcesoAlta() {
  return (
    <Box component="aside" aria-labelledby="despues-titulo">
      <Typography
        id="despues-titulo"
        component="h2"
        sx={{ fontFamily: SERIF, fontSize: { xs: 22, md: 24 }, lineHeight: 1.2, mb: 1.5 }}
      >
        Después de enviar
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.25, maxWidth: '46ch' }}>
        <Typography sx={{ fontSize: 15, lineHeight: 1.65, color: 'text.secondary' }}>
          Te llega el acuse de recibo por correo y la solicitud queda en Secretaría.
        </Typography>
        <Typography sx={{ fontSize: 15, lineHeight: 1.65, color: 'text.secondary' }}>
          Para formalizar el alta, pásate por la casa parroquial con tu DNI y el certificado de
          bautismo ({site.contacto.horario.toLowerCase()}). Entonces se activa tu acceso al área
          de hermanos.
        </Typography>
      </Box>

      <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 3, rowGap: 0.5 }}>
        <Box component={Link} to="/hermanos/acceso" sx={enlaceLateral}>
          Ya soy hermano
          <ArrowForwardIcon />
        </Box>
        <Box component={Link} to="/contacto" sx={enlaceLateral}>
          Tengo una duda
          <ArrowForwardIcon />
        </Box>
      </Box>
      <Typography sx={{ mt: 1.5, fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
        Si el alta es para un menor, escríbenos a{' '}
        <Box
          component="a"
          href={`mailto:${site.contacto.email}`}
          sx={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3, '&:hover': { color: GOLD } }}
        >
          {site.contacto.email}
        </Box>
        .
      </Typography>
    </Box>
  )
}
