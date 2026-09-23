import { Box, Button, FormControlLabel, Switch, Typography } from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import AddIcon from '@mui/icons-material/Add'
import { Link } from 'react-router-dom'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { contar } from './plural'
import { useTemaCms } from '../../../app/useTemaCms'

interface Props {
  /** Cuántos asuntos esperan hoy a este cargo. */
  asuntosPropios: number
  asuntosDeLaJunta: number
  role?: string
  hoy?: Date
}

/** Los botones de la cabecera: solo los de las secciones de cada cargo. */
const ATAJOS = [
  { texto: 'Nuevo acto', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { texto: 'Nuevo apunte', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { texto: 'Nueva noticia', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], principal: true },
]

export default function Cabecera({ asuntosPropios, asuntosDeLaJunta, role, hoy = new Date() }: Props) {
  const { modo, cambiarModo } = useTemaCms()
  const cargo = role ? NOMBRE_CARGO[role] ?? '' : ''
  const visibles = ATAJOS.filter((a) => role && a.roles.includes(role))

  const frase = asuntosPropios > 0
    ? `Tienes ${contar(asuntosPropios, 'asunto', 'asuntos')} esperando.`
    : 'No tienes nada pendiente.'
  const resto = asuntosDeLaJunta > 0
    ? ` El resto de la junta lleva ${contar(asuntosDeLaJunta, 'asunto más', 'asuntos más')}.`
    : ''

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap', mb: 3.25 }}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
          {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Typography>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 30, md: 40 }, lineHeight: 1.15, my: 1 }}>
          Buenos días{cargo && `, ${cargo}`}
        </Typography>
        <Typography variant="body1" color="text.secondary">{frase}{resto}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* El mismo tema que el interruptor del menú: los dos cambian a la vez. */}
        <FormControlLabel
          control={<Switch size="small" checked={modo === 'oscuro'} onChange={(e) => cambiarModo(e.target.checked ? 'oscuro' : 'claro')} />}
          label={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 14 }}><DarkModeOutlinedIcon sx={{ fontSize: 17 }} />Modo oscuro</Box>}
          sx={{ mr: 0.5, ml: 0 }}
        />
        {visibles.map((atajo) => (
          <Button
            key={atajo.href}
            component={Link}
            to={atajo.href}
            startIcon={<AddIcon />}
            variant={atajo.principal ? 'contained' : 'outlined'}
            color={atajo.principal ? 'primary' : 'inherit'}
            sx={{ borderRadius: 1.25 }}
          >
            {atajo.texto}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
