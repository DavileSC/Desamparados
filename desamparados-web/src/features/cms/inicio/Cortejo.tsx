import { Box, Paper, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { fondoTarjeta } from '../../../theme/tarjeta'
import { numero } from '../contabilidad/formato'
import { CIFRA, entrada, sinMovimiento, useCuenta } from './animaciones'

/**
 * Un tono por puesto, de la familia burdeos, y el oro para el último: se
 * distinguen sin salir de los colores del Grupo. En oscuro, la misma familia
 * aclarada para que se lea sobre el fondo.
 */
const TONOS = {
  claro: ['#6e1822', '#9a3440', '#bf5a64', '#d98c92', '#ecbcbf', '#b39a00'],
  oscuro: ['#ffb3b4', '#f08f95', '#d8707a', '#b85762', '#8f4450', '#e3c65a'],
}

/** El anillo: radio y grosor en unidades del dibujo (100 × 100). */
const RADIO = 40
const GROSOR = 13
const CIRCUNFERENCIA = 2 * Math.PI * RADIO
/** Hueco entre trozos, para que se lean como piezas distintas. */
const HUECO = 1.1

// Cada trozo se dibuja desde cero hasta su largo, uno detrás de otro.
const dibujar = keyframes`from { stroke-dasharray: 0 ${CIRCUNFERENCIA} }`

/**
 * Las papeletas del año como el cortejo repartido: un anillo con lo que pesa
 * cada puesto y el total dentro, la leyenda como tabla (número y parte del
 * cortejo) y, al pie, los últimos años.
 */
export default function Cortejo({ procesion, orden = 0 }: { procesion: PanelResponse['procesion']; orden?: number }) {
  const { modo, superficies } = useTemaCms()
  const tonos = TONOS[modo === 'oscuro' ? 'oscuro' : 'claro']
  const puestos = procesion.porPuesto.filter((p) => p.total > 0)
  const total = puestos.reduce((s, p) => s + p.total, 0)
  const totalContado = Math.round(useCuenta(total, 1400))
  const anterior = procesion.porAnio.find((a) => a.anio === procesion.anio - 1)
  const diferencia = anterior ? procesion.papeletas - anterior.total : null
  const tono = (i: number) => (i === puestos.length - 1 && puestos.length > 1 ? tonos[tonos.length - 1] : tonos[i % (tonos.length - 1)])

  // Cada trozo empieza donde acaba la suma de los anteriores.
  const largos = puestos.map((p) => (p.total / total) * CIRCUNFERENCIA)
  const trozos = puestos.map((p, i) => ({
    ...p,
    color: tono(i),
    largo: Math.max(0.01, largos[i] - (puestos.length > 1 ? HUECO : 0)),
    desde: largos.slice(0, i).reduce((s, l) => s + l, 0),
  }))

  return (
    <Paper
      component="section"
      aria-labelledby="cortejo"
      sx={{ ...fondoTarjeta(modo, 'burdeos', superficies.card), borderRadius: 1.75, p: { xs: 2, md: 2.75 }, height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, containerType: 'inline-size', containerName: 'cortejo', ...entrada(orden) }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 16px', flexWrap: 'wrap' }}>
        <Typography id="cortejo" variant="h5" component="h2">El cortejo de {procesion.anio}</Typography>
        {diferencia !== null && diferencia !== 0 && (
          <Typography variant="body2" sx={{ fontWeight: 600, color: diferencia > 0 ? (modo === 'oscuro' ? '#7fd19b' : '#23703f') : 'text.secondary' }}>
            {diferencia > 0 ? '+' : '−'}{numero(Math.abs(diferencia))} que en {procesion.anio - 1}
          </Typography>
        )}
      </Box>

      {puestos.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ my: 'auto' }}>
          Todavía no hay papeletas de sitio de {procesion.anio}.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px 32px', alignItems: 'center', my: 'auto',
            // El anillo al lado de la leyenda solo cuando cabe; si no, encima.
            '@container cortejo (min-width: 540px)': { gridTemplateColumns: '200px minmax(0, 1fr)' },
          }}
        >
          <Box sx={{ position: 'relative', width: '100%', maxWidth: 200, aspectRatio: '1', mx: 'auto' }}>
            <Box
              component="svg"
              viewBox="0 0 100 100"
              role="img"
              aria-label={`Papeletas por puesto: ${puestos.map((p) => `${p.etiqueta}, ${p.total}`).join('; ')}`}
              sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', display: 'block' }}
            >
              <circle cx="50" cy="50" r={RADIO} fill="none" stroke={modo === 'oscuro' ? 'rgba(255,255,255,0.07)' : '#efe9e5'} strokeWidth={GROSOR} />
              {trozos.map((t, i) => (
                <Box
                  key={t.etiqueta}
                  component="circle"
                  cx="50"
                  cy="50"
                  r={RADIO}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={GROSOR}
                  strokeDasharray={`${t.largo} ${CIRCUNFERENCIA}`}
                  strokeDashoffset={-t.desde}
                  sx={{ animation: `${dibujar} .7s cubic-bezier(.3, .7, .2, 1) backwards`, animationDelay: `${300 + i * 140}ms`, ...sinMovimiento }}
                />
              ))}
            </Box>
            <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
              <Typography sx={{ ...CIFRA, fontSize: 44, lineHeight: 1 }}>{numero(totalContado)}</Typography>
              <Typography variant="body2" color="text.secondary">{total === 1 ? 'papeleta' : 'papeletas'}</Typography>
            </Box>
          </Box>

          {/* La leyenda hace de tabla: del color de su trozo, con número y parte del cortejo. */}
          <Box
            component="ul"
            sx={{
              listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px 24px',
              '@container cortejo (min-width: 400px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            {trozos.map((t) => (
              <Box component="li" key={t.etiqueta} sx={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto', columnGap: 1, rowGap: '2px', alignItems: 'baseline' }}>
                <Box component="span" aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: '3px', backgroundColor: t.color, alignSelf: 'center' }} />
                <Typography component="span" sx={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }}>{t.etiqueta}</Typography>
                <Typography component="span" sx={{ ...CIFRA, fontSize: 19, lineHeight: 1 }}>{numero(t.total)}</Typography>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ gridColumn: '2 / -1' }}>
                  {Math.round((t.total / total) * 100)} % del cortejo
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {procesion.porAnio.length > 1 && (
        <Box sx={{ display: 'flex', gap: '4px 18px', flexWrap: 'wrap', borderTop: 1, borderColor: 'divider', pt: 1.5, fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {procesion.porAnio.map((a) => (
            <span key={a.anio}>{a.anio}: <Box component="b" sx={{ color: a.anio === procesion.anio ? 'text.primary' : 'inherit' }}>{numero(a.total)}</Box></span>
          ))}
        </Box>
      )}
    </Paper>
  )
}
