import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { site } from '../../../config/site'
import { GOLD, SERIF, ceja } from '../../home/estilos'

/**
 * Los tres pasos del alta, en el orden en que ocurren. Es lo que hace el
 * servidor al recibir la solicitud (`AuthService.registerUser`): guarda la
 * ficha inactiva, manda el acuse de recibo por correo y deja el alta en manos
 * de Secretaría, que la formaliza en persona.
 */
const PASOS_ALTA = [
  {
    titulo: 'Envías la solicitud',
    texto: 'Rellena el formulario con tus datos. Te llevará unos minutos.',
  },
  {
    titulo: 'Recibes el acuse de recibo',
    texto: 'Te llega un correo confirmando que la solicitud está en Secretaría, con lo que necesitas para el siguiente paso.',
  },
  {
    titulo: 'Formalizas el alta en Secretaría',
    texto: 'Pásate por la casa parroquial con tu DNI y el certificado de bautismo. Al formalizar el alta se activa tu acceso al área de hermanos.',
  },
] as const

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

/** Columna lateral de «Hazte hermano»: cómo va el alta y a dónde acudir. */
export default function ProcesoAlta() {
  return (
    <Box component="aside" aria-labelledby="proceso-alta-titulo">
      <Typography component="span" sx={ceja}>Cómo funciona</Typography>
      <Typography
        id="proceso-alta-titulo"
        component="h2"
        sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, lineHeight: 1.2, letterSpacing: '-0.01em', mb: 3.5 }}
      >
        El alta, en tres pasos
      </Typography>

      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: { xs: 2.5, md: 3 } }}>
        {PASOS_ALTA.map((paso, indice) => (
          <Box
            key={paso.titulo}
            component="li"
            sx={{ display: 'grid', gridTemplateColumns: '40px 1fr', columnGap: 2, alignItems: 'start' }}
          >
            <Typography
              component="span"
              aria-hidden="true"
              sx={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1, color: '#e3d8bf', mt: '-2px' }}
            >
              {indice + 1}
            </Typography>
            <Box>
              <Typography component="h3" sx={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, mb: 0.5 }}>
                {paso.titulo}
              </Typography>
              <Typography sx={{ fontSize: 15, lineHeight: 1.65, color: 'text.secondary' }}>
                {paso.texto}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          mt: { xs: 4, md: 5 },
          pt: 3,
          borderTop: '1px solid rgba(204, 196, 201, 0.2)',
          display: 'grid',
          gap: 2.5,
        }}
      >
        <Box>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600, mb: 0.5 }}>
            Secretaría
          </Typography>
          <Typography sx={{ fontSize: 15, lineHeight: 1.65, color: 'text.secondary' }}>
            Casa parroquial. {site.contacto.horario}.
          </Typography>
          <Typography
            component="a"
            href={`mailto:${site.contacto.email}`}
            sx={{ fontSize: 15, color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3, '&:hover': { color: GOLD } }}
          >
            {site.contacto.email}
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 14, lineHeight: 1.65, color: 'text.secondary' }}>
          Si el alta es para un menor, escríbenos y te decimos cómo hacerlo.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5 }}>
          <Box component={Link} to="/hermanos/acceso" sx={enlaceLateral}>
            Ya soy hermano
            <ArrowForwardIcon />
          </Box>
          <Box component={Link} to="/contacto" sx={enlaceLateral}>
            Tengo una duda
            <ArrowForwardIcon />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
