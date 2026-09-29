import { Box, Typography } from '@mui/material'
import { cuandoFalta, diaMes, type Acto } from './tandas'
import { entrada } from './animaciones'
import { FILETE, ORO, SERIF, VERSALITAS } from './estiloRetablo'

const DIA_SEMANA = new Intl.DateTimeFormat('es-ES', { weekday: 'long' })
const mayuscula = (texto: string) => `${texto[0].toUpperCase()}${texto.slice(1)}`

/**
 * El próximo acto del curso, en una franja a lo ancho: la fecha, el título con
 * su lugar y la hora. Mide lo que lleva, así que nunca deja hueco. En estrecho
 * se parte en dos filas: la fecha y la hora arriba, el título debajo. Si el
 * curso ya no tiene nada por delante, lo dice.
 */
export default function ProximoActo({ acto, hoy = new Date() }: { acto?: Acto; hoy?: Date }) {
  const etiqueta = (
    <Typography id="proximo-acto" component="h2" className="etiqueta" sx={{ ...VERSALITAS, fontSize: 10.5, color: acto ? ORO : 'text.secondary' }}>
      Próximo acto{acto && ` · ${cuandoFalta(hoy, acto.fecha)}`}
    </Typography>
  )

  return (
    <Box
      component="section"
      aria-labelledby="proximo-acto"
      sx={{
        minWidth: 0, borderRadius: 2.5, containerType: 'inline-size', containerName: 'proximo',
        border: '1px solid', borderColor: acto ? `color-mix(in srgb, ${ORO} 45%, transparent)` : FILETE,
        backgroundImage: acto ? `linear-gradient(160deg, color-mix(in srgb, ${ORO} 12%, transparent), color-mix(in srgb, ${ORO} 2%, transparent) 60%)` : 'none',
        ...entrada(1),
      }}
    >
      {acto ? (
        <Box
          sx={{
            display: 'grid', alignItems: 'center', columnGap: 'clamp(14px, 2.4vw, 22px)', rowGap: 0.75,
            px: 'clamp(14px, 2vw, 22px)', py: 'clamp(8px, 1.6vh, 12px)',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto', gridTemplateAreas: '"fecha texto hora"',
            // En estrecho, dos filas: fecha y hora arriba, el título a todo lo ancho debajo.
            '@container proximo (max-width: 459px)': {
              gridTemplateColumns: 'auto minmax(0, 1fr)', gridTemplateAreas: '"fecha hora" "texto texto"',
              '& .fecha': { borderRight: 0, pr: 0 },
              '& .hora': { textAlign: 'right' },
            },
          }}
        >
          <Box className="fecha" sx={{ gridArea: 'fecha', display: 'flex', alignItems: 'baseline', gap: 0.75, pr: 'clamp(14px, 2.4vw, 22px)', borderRight: `1px solid color-mix(in srgb, ${ORO} 30%, transparent)` }}>
            <Typography component="span" sx={{ ...SERIF, fontSize: 'clamp(38px, 7vh, 52px)', lineHeight: 0.85 }}>{acto.fecha.getDate()}</Typography>
            <Typography component="span" sx={{ ...SERIF, fontStyle: 'italic', fontSize: 'clamp(17px, 2.8vh, 20px)', color: 'text.secondary' }}>
              {diaMes(acto.fecha).split(' ')[1]}
            </Typography>
          </Box>
          <Box sx={{ gridArea: 'texto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {etiqueta}
            <Typography title={acto.titulo} sx={{ ...SERIF, fontSize: 'clamp(19px, 3.2vh, 23px)', lineHeight: 1.12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {acto.titulo}
            </Typography>
            {acto.lugar && (
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acto.lugar}</Typography>
            )}
          </Box>
          <Box className="hora" sx={{ gridArea: 'hora', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
            {acto.hora && <Typography component="span" sx={{ ...SERIF, fontSize: 'clamp(22px, 3.6vh, 26px)', lineHeight: 1 }}>{acto.hora}</Typography>}
            <Typography component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>{mayuscula(DIA_SEMANA.format(acto.fecha))}</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {etiqueta}
          <Typography sx={{ fontSize: 14.5, color: 'text.secondary' }}>No queda nada en la Agenda hasta la estación de penitencia.</Typography>
        </Box>
      )}
    </Box>
  )
}
