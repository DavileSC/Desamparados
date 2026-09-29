import { Box, Typography } from '@mui/material'
import { cuandoFalta, diaMes, type Acto } from './tandas'
import { entrada } from './animaciones'
import { FILETE, ORO, SERIF, VERSALITAS } from './estiloRetablo'

const DIA_SEMANA = new Intl.DateTimeFormat('es-ES', { weekday: 'long' })
const mayuscula = (texto: string) => `${texto[0].toUpperCase()}${texto.slice(1)}`

/**
 * El próximo acto del curso, en grande: es lo primero que se mira al entrar.
 * La fecha arriba con el día y la hora, el título y el lugar al pie. Si el
 * curso ya no tiene nada por delante, lo dice.
 */
export default function ProximoActo({ acto, hoy = new Date() }: { acto?: Acto; hoy?: Date }) {
  return (
    <Box
      component="section"
      aria-labelledby="proximo-acto"
      sx={{
        minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        px: 2.25, py: 'clamp(10px, 2vh, 18px)', borderRadius: 2.5,
        border: '1px solid', borderColor: acto ? `color-mix(in srgb, ${ORO} 45%, transparent)` : FILETE,
        backgroundImage: acto ? `linear-gradient(160deg, color-mix(in srgb, ${ORO} 12%, transparent), color-mix(in srgb, ${ORO} 2%, transparent) 60%)` : 'none',
        ...entrada(1),
      }}
    >
      <Typography id="proximo-acto" component="h2" sx={{ ...VERSALITAS, fontSize: 11.5, color: acto ? ORO : 'text.secondary' }}>
        Próximo acto{acto && ` · ${cuandoFalta(hoy, acto.fecha)}`}
      </Typography>
      {acto ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1, mt: 1 }}>
            <Typography component="span" sx={{ ...SERIF, fontSize: 'clamp(44px, 8vh, 76px)', lineHeight: 0.85 }}>{acto.fecha.getDate()}</Typography>
            <Typography component="span" sx={{ ...SERIF, fontStyle: 'italic', fontSize: 'clamp(18px, 3vh, 24px)', color: 'text.secondary' }}>
              {diaMes(acto.fecha).split(' ')[1]}
            </Typography>
            <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary', ml: 'auto' }}>
              {mayuscula(DIA_SEMANA.format(acto.fecha))}{acto.hora && ` · ${acto.hora}`}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1, minHeight: 8 }} />
          <Typography sx={{ ...SERIF, fontSize: 'clamp(19px, 3.4vh, 24px)', lineHeight: 1.12 }}>{acto.titulo}</Typography>
          {acto.lugar && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {acto.lugar}
            </Typography>
          )}
        </>
      ) : (
        <Typography sx={{ mt: 1.5, fontSize: 14.5, color: 'text.secondary' }}>
          No queda nada en la Agenda hasta la estación de penitencia.
        </Typography>
      )}
    </Box>
  )
}
