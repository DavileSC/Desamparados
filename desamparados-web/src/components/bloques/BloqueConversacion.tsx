import { Box, Typography } from '@mui/material'
import { visuallyHidden } from '@mui/utils'
import { Link } from 'react-router-dom'
import Boton from '../Boton'
import EscudoDelGrupo from '../EscudoDelGrupo'
import { anchoMaximo } from './presentacion'
import { parrafosDe, type BloqueConversacion as Datos, type TurnoDeConversacion } from '../../lib/api/contenido'
import { useEnlaceVivo } from '../../hooks/useEnlaceVivo'
import { MARCA, alfa } from '../../theme/marca'

/**
 * Lo que alguien se pregunta antes de venir, contestado como en un chat
 * (Grupo Joven, 27-11-2026): la pregunta, a la derecha en una burbuja granate;
 * la respuesta, a la izquierda en una oscura con el escudo y el nombre de
 * quien contesta. Se lee de arriba abajo como una conversación de verdad, y
 * la última respuesta suele llevar el botón para dar el paso.
 *
 * Es una lista ordenada de turnos; quien usa lector de pantalla oye
 * «Pregunta» delante de cada una, porque el lado de la burbuja no se oye.
 */
export default function BloqueConversacion({ bloque }: { bloque: Datos }) {
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: anchoMaximo(bloque, '860px'), mx: 'auto', display: 'grid', gap: 1.75 }}>
      {bloque.turnos.map((turno, i) => <Turno key={i} turno={turno} nombre={bloque.nombre} />)}
    </Box>
  )
}

const BURBUJA = { px: { xs: 2, md: 2.5 }, py: { xs: 1.75, md: 2 }, maxWidth: { xs: '88%', md: '70%' }, fontSize: { xs: 15, md: 17 }, lineHeight: 1.5 } as const

function Turno({ turno, nombre }: { turno: TurnoDeConversacion; nombre: string }) {
  const enlaceVivo = useEnlaceVivo()
  const conBoton = turno.boton.trim() !== '' && enlaceVivo(turno.enlace)
  return (
    <Box component="li" sx={{ display: 'grid', gap: 1.75 }}>
      <Typography component="p" sx={{
        ...BURBUJA, m: 0, justifySelf: 'end', color: '#fff',
        backgroundColor: MARCA.principal, borderRadius: '20px 20px 4px 20px',
      }}>
        <Box component="span" sx={visuallyHidden}>Pregunta: </Box>
        {turno.pregunta}
      </Typography>
      <Box sx={{
        ...BURBUJA, justifySelf: 'start', display: 'grid', gridTemplateColumns: { xs: '28px minmax(0, 1fr)', md: '34px minmax(0, 1fr)' }, gap: { xs: 1.5, md: 1.75 },
        backgroundColor: '#161417', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px 20px 20px 4px',
      }}>
        <EscudoDelGrupo alto="auto" sx={{ width: '100%', mt: 0.25 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography component="p" sx={{ m: 0, mb: 0.5, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: MARCA.acento }}>
            {nombre}
          </Typography>
          {parrafosDe(turno.respuesta).map((parrafo, j) => (
            <Typography key={j} sx={{ fontSize: 'inherit', lineHeight: 'inherit', color: 'text.primary', mb: 1, '&:last-of-type': { mb: 0 } }}>{parrafo}</Typography>
          ))}
          {turno.etiquetas.length > 0 && (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1.25, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {turno.etiquetas.map((etiqueta, j) => (
                <Box component="li" key={j} sx={{
                  border: `1px solid ${alfa(MARCA.acento, 0.5)}`, color: MARCA.acento, borderRadius: '999px', px: 1.5, py: 0.5, fontSize: 14, lineHeight: 1.4,
                }}>
                  {etiqueta}
                </Box>
              ))}
            </Box>
          )}
          {conBoton && (
            <Box sx={{ mt: 1.75 }}>
              <Boton component={Link} to={turno.enlace} appVariant="primary">{turno.boton}</Boton>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
