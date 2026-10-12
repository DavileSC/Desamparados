import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useContacto } from '../../../hooks/useContacto'
import { GOLD, SERIF } from '../../inicio/estilos'
import { enlaceConFlecha } from '../../../components/estiloDeBoton'
import PedirReactivacion from './PedirReactivacion'
import { secretariaEnLaSede } from './secretariaEnLaSede'

/** Enlaces del lateral: el enlace con flecha, en blanco con la flecha dorada. */
const enlaceLateral = { ...enlaceConFlecha, color: '#fff', fontSize: 14, '& svg': { ...enlaceConFlecha['& svg'], fontSize: 16, color: GOLD }, '&:hover': { color: GOLD } } as const

/**
 * Qué pasa cuando la solicitud ya ha entrado. Es lo que hace el servidor
 * (`AuthService.registerUser`): guarda la ficha inactiva, manda el acuse de
 * recibo y deja el alta en manos de Secretaría, que la formaliza en persona.
 * Sin numerar a propósito: los números son de los pasos del formulario.
 */
export default function ProcesoAlta() {
  const contacto = useContacto()
  const secretaria = contacto?.secretaria
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
          Para formalizar el alta, pásate por {secretariaEnLaSede(contacto?.sede)} con tu DNI y el certificado de
          bautismo{secretaria?.horario ? ` (${secretaria.horario.toLowerCase()})` : ''}. Entonces se activa tu acceso al área
          de hermanos.
        </Typography>
      </Box>

      <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 3, rowGap: 0.5 }}>
        <Box component={Link} to="/acceso" sx={enlaceLateral}>
          Ya soy hermano
          <ArrowForwardIcon />
        </Box>
        <Box component={Link} to="/contacto" sx={enlaceLateral}>
          Tengo una duda
          <ArrowForwardIcon />
        </Box>
        <PedirReactivacion sx={enlaceLateral} />
      </Box>
      <Typography sx={{ mt: 1.5, fontSize: 13, lineHeight: 1.6, color: 'text.secondary' }}>
        El alta de un menor se hace aquí mismo: elige arriba la opción que te toque.
        {secretaria?.email && <>
        {' '}Si tienes cualquier duda, escríbenos a{' '}
        <Box
          component="a"
          href={`mailto:${secretaria.email}`}
          // Alto para el dedo en el móvil, sin mover la línea.
          sx={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3, '&:hover': { color: GOLD }, display: 'inline-block', py: { xs: '12px', md: 0 }, my: { xs: '-12px', md: 0 } }}
        >
          {secretaria.email}
        </Box>
        .
        </>}
      </Typography>
    </Box>
  )
}
