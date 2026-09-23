import { Box, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { corta, paradasDelCurso } from './paradas'
import { MECER, fondoResplandor } from '../../../theme/resplandor'
import { acercar, aparecer, CIFRA, entrada, llenarTrazo, sinMovimiento, useCuenta } from './animaciones'

/** El camino se dibuja en esta caja; las etiquetas, encima, en porcentajes de ella. */
const ANCHO = 1000
const ALTO = 240
/** Una calle con curvas: la posición en el curso (0 a 1) da el punto del camino. */
const punto = (p: number) => ({ x: 24 + p * (ANCHO - 48), y: 120 + 46 * Math.sin(p * Math.PI * 2.5 + 0.6) })
const CAMINO = Array.from({ length: 81 }, (_, i) => punto(i / 80))
  .map(({ x, y }, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
  .join(' ')

// El camino va siempre sobre fondo oscuro, en los dos temas: es la pieza que
// destaca, y la foto de la Virgen es oscura.
const OSCURO = { fondo: '#1d1b1e', fondoTemaOscuro: '#100e11', texto: '#ffffff', texto2: '#cbc5c8', tenue: '#8f8a8d', andado: '#a03d44', claro: '#ffb3b4' }

/**
 * La pieza que abre el Inicio: la imagen de Nuestra Señora de los Desamparados
 * con los días que faltan para la estación de penitencia, y al lado el curso
 * como un camino de un Sábado de Pasión al siguiente, lleno hasta hoy.
 */
export default function CaminoEstacion({ eventos, hoy = new Date() }: { eventos: PanelResponse['actividad']['proximosEventos']; hoy?: Date }) {
  const { modo } = useTemaCms()
  const { fecha, anterior, dias, porcentaje } = cuentaAtrasEstacion(hoy)
  const diasContados = Math.round(useCuenta(dias, 1600))
  const paradas = paradasDelCurso(hoy, eventos)
  const recorrido = porcentaje / 100
  const aqui = punto(recorrido)
  const proximas = paradas.filter((p) => p.p > recorrido && p.p < 1)

  return (
    <Box
      component="section"
      aria-labelledby="camino-estacion"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        // Imagen y camino lado a lado solo cuando el camino tiene sitio para sus etiquetas.
        '@container (min-width: 860px)': { gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 2fr)' },
        // Siempre oscura, con el mismo resplandor que el resto de tarjetas.
        ...fondoResplandor('oscuro', 'burdeos', modo === 'oscuro' ? OSCURO.fondoTemaOscuro : OSCURO.fondo),
        color: OSCURO.texto,
        borderRadius: 1.75,
        overflow: 'hidden',
        height: '100%',
        ...entrada(0, MECER),
      }}
    >
      {/* La imagen, con la cuenta atrás encima. Se acerca muy despacio. */}
      <Box sx={{ position: 'relative', minHeight: { xs: 280, md: 300 }, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
        <Box
          component="img"
          src="/images/hero-960.webp"
          alt="Nuestra Señora de los Desamparados"
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '40% 28%',
            animation: `${acercar} 22s ease-out both`, ...sinMovimiento,
          }}
        />
        <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,14,17,0) 25%, rgba(16,14,17,.55) 55%, rgba(16,14,17,.95) 92%)' }} />
        <Box sx={{ position: 'relative', p: 2.75, textShadow: '0 1px 12px rgba(0,0,0,.55)' }}>
          <Typography id="camino-estacion" sx={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e6dfe2' }}>
            Sábado de Pasión · {corta(fecha)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
            <Typography component="span" sx={{ ...CIFRA, fontSize: 84, lineHeight: 0.95 }}>
              {diasContados}
            </Typography>
            <Typography component="span" sx={{ fontSize: 20, color: OSCURO.texto2 }}>{dias === 1 ? 'día' : 'días'}</Typography>
          </Box>
          <Typography sx={{ fontSize: 14, color: OSCURO.texto2 }}>para la estación de penitencia</Typography>
        </Box>
      </Box>

      {/* El curso como camino. */}
      <Box sx={{ p: { xs: 2.25, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, containerType: 'inline-size', containerName: 'camino' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>El curso</Typography>
          <Typography sx={{ fontSize: 13, color: OSCURO.texto2 }}>{porcentaje} % del curso</Typography>
        </Box>

        <Box
          role="progressbar"
          aria-label="Parte del curso recorrida"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          sx={{ position: 'relative', width: '100%', aspectRatio: `${ANCHO} / ${ALTO}`, my: { xs: 2, md: 3 } }}
        >
          <Box component="svg" viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden="true" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            <path d={CAMINO} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={3} strokeDasharray="2 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <Box
              component="path"
              d={CAMINO}
              fill="none"
              stroke={OSCURO.andado}
              strokeWidth={4}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - recorrido}
              style={{ ['--hasta' as string]: 1 - recorrido }}
              sx={{ animation: `${llenarTrazo} 1.8s cubic-bezier(.3, .7, .2, 1) .3s backwards`, ...sinMovimiento }}
            />
            <Box
              component="g"
              sx={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `${aparecer} .5s ease-out 2.1s backwards`, ...sinMovimiento }}
            >
              <circle cx={aqui.x} cy={aqui.y} r={13} fill="rgba(255,179,180,.18)" />
              <circle cx={aqui.x} cy={aqui.y} r={6} fill={OSCURO.claro} />
            </Box>
            {paradas.map((parada, i) => {
              const { x, y } = punto(parada.p)
              const pasada = parada.p <= recorrido
              return (
                <Box
                  key={`${parada.p}-${i}`}
                  component="circle"
                  cx={x}
                  cy={y}
                  r={i === paradas.length - 1 ? 9 : 6.5}
                  fill={pasada ? OSCURO.andado : modo === 'oscuro' ? OSCURO.fondoTemaOscuro : OSCURO.fondo}
                  stroke={pasada ? OSCURO.claro : 'rgba(255,255,255,.4)'}
                  strokeWidth={2}
                  sx={{
                    transformBox: 'fill-box', transformOrigin: 'center',
                    // Cada parada ya recorrida se enciende cuando el trazo llega a ella.
                    animation: `${aparecer} .45s cubic-bezier(.2, .9, .3, 1.3) backwards`,
                    animationDelay: `${300 + (pasada ? parada.p / Math.max(recorrido, 0.01) : 1) * 1800}ms`,
                    ...sinMovimiento,
                  }}
                />
              )
            })}
          </Box>

          {/* Etiquetas en HTML, no dentro del SVG: así no encogen con él y se leen en cualquier ancho. */}
          {paradas.map((parada, i) => {
            const { x, y } = punto(parada.p)
            const arriba = i % 2 === 1
            const extremo = i === 0 ? 'inicio' : i === paradas.length - 1 ? 'fin' : null
            return (
              <Box
                key={`etiqueta-${i}`}
                sx={{
                  position: 'absolute',
                  left: `${(x / ANCHO) * 100}%`,
                  top: `${(y / ALTO) * 100}%`,
                  transform: `translate(${extremo === 'inicio' ? '-12px' : extremo === 'fin' ? 'calc(-100% + 12px)' : '-50%'}, ${arriba ? 'calc(-100% - 14px)' : '14px'})`,
                  textAlign: extremo === 'inicio' ? 'left' : extremo === 'fin' ? 'right' : 'center',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  // En un móvil solo caben los extremos; las paradas van en la lista de debajo.
                  display: extremo ? 'block' : 'none',
                  '@container camino (min-width: 520px)': { display: 'block' },
                  maxWidth: 170,
                }}
              >
                <Typography component="span" sx={{ display: 'block', fontSize: 13, color: OSCURO.texto2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{parada.titulo}</Typography>
                <Typography component="span" sx={{ display: 'block', fontSize: 12, color: OSCURO.tenue }}>{parada.fecha}</Typography>
              </Box>
            )
          })}
        </Box>

        {proximas.length > 0 && (
          <Typography sx={{ fontSize: 13, color: OSCURO.texto2, mt: 2, '@container camino (min-width: 520px)': { display: 'none' } }}>
            Próximas paradas: {proximas.map((p) => `${p.titulo}, ${p.fecha}`).join(' · ')}
          </Typography>
        )}
        <Typography sx={{ fontSize: 12.5, color: OSCURO.texto2, mt: 'auto' }}>
          Desde el {corta(anterior)} hasta el {corta(fecha)}
        </Typography>
      </Box>
    </Box>
  )
}
