import { Box, Typography } from '@mui/material'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning'
import { GOLD, SERIF } from '../../home/estilos'
import { FILETE_TARJETA } from './temaTarjeta'
import type { Camino } from './schema'

/**
 * Lo primero que pregunta el alta: quién se apunta.
 *
 * Antes el formulario entraba directo en «Datos personales» y solo servía para
 * un adulto con DNI; a quien venía a apuntar a un niño se le mandaba a escribir
 * un correo. Los tres caminos son los que el servidor sabe atender, y la
 * elección decide qué se pregunta después.
 */
const OPCIONES: { camino: Camino; titulo: string; descripcion: string; icono: typeof PersonOutlineIcon }[] = [
  {
    camino: 'HERMANO',
    titulo: 'Quiero ser hermano',
    descripcion: 'Tu alta, con tu DNI y correo electrónico',
    icono: PersonOutlineIcon,
  },
  {
    camino: 'HERMANO_Y_MENORES',
    titulo: 'Queremos ser hermanos',
    descripcion: 'Tu alta y la de quienes tengas a tu cargo, en la misma solicitud.',
    icono: FamilyRestroomIcon,
  },
  {
    camino: 'SOLO_MENORES',
    titulo: 'Apunto a un familiar',
    descripcion: 'Quieres dar de alta a un menor de edad en el Grupo Parroquial',
    icono: EscalatorWarningIcon,
  },
]

export default function EleccionCamino({ valor, onElegir }: { valor: Camino | null; onElegir: (camino: Camino) => void }) {
  return (
    <Box role="radiogroup" aria-labelledby="paso-titulo" sx={{ display: 'grid', gap: 1.5 }}>
      {OPCIONES.map(({ camino, titulo, descripcion, icono: Icono }) => {
        const elegido = valor === camino
        return (
          <Box
            key={camino}
            component="button"
            type="button"
            role="radio"
            // La descripción va dentro del botón, así que sin esto el nombre
            // que oye un lector es el título y el párrafo seguidos.
            aria-label={titulo}
            aria-describedby={`${camino}-explicacion`}
            aria-checked={elegido}
            onClick={() => onElegir(camino)}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              alignItems: 'center',
              gap: 2,
              width: '100%',
              textAlign: 'left',
              p: { xs: 2, md: 2.25 },
              borderRadius: '3px',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
              border: '1px solid',
              borderColor: elegido ? GOLD : FILETE_TARJETA,
              backgroundColor: elegido ? 'rgba(222, 199, 43, 0.08)' : 'transparent',
              transition: 'border-color .2s ease, background-color .2s ease',
              '&:hover': { borderColor: elegido ? GOLD : '#6e1822' },
              '& svg': { fontSize: 26, color: elegido ? GOLD : 'text.secondary' },
            }}
          >
            <Icono aria-hidden="true" />
            <Box>
              <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 17, md: 18 }, lineHeight: 1.3 }}>{titulo}</Typography>
              <Typography id={`${camino}-explicacion`} sx={{ fontSize: 13.5, lineHeight: 1.5, color: 'text.secondary', mt: 0.25 }}>{descripcion}</Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
