import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { actosDelCurso, corta, diaMes, racimoInicial, racimosDelCurso, rangoDe } from './racimos'
import { TIPOS } from '../../inicio/agenda'
import type { TipoEvento } from '../../../lib/api/panel'
import { contar } from './plural'
import { useAnchoMedido } from '../../../components/charts/useAnchoMedido'
import { fondoTarjeta } from '../../../theme/tarjeta'
import { acercar, aparecer, CIFRA, entrada, llenarTrazo, sinMovimiento, useCuenta } from './animaciones'

/** El camino se dibuja en esta caja; los racimos, encima, en porcentajes de ella. */
const ANCHO = 1000
const ALTO = 200
/** Una calle con curvas: la posición en el curso (0 a 1) da el punto del camino. */
const punto = (p: number) => ({ x: 24 + p * (ANCHO - 48), y: 108 + 46 * Math.sin(p * Math.PI * 2.5 + 0.6) })
const CAMINO = Array.from({ length: 81 }, (_, i) => punto(i / 80))
  .map(({ x, y }, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
  .join(' ')

// El camino va siempre sobre fondo oscuro, en los dos temas: es la pieza que
// destaca, y la foto de la Virgen es oscura.
const OSCURO = { fondo: '#1d1b1e', fondoTemaOscuro: '#100e11', texto: '#ffffff', texto2: '#cbc5c8', tenue: '#8f8a8d', andado: '#a03d44', claro: '#ffb3b4' }
/** Cada tipo de acto con su color de la agenda, en la variante para fondo oscuro. */
const COLOR = (tipo: TipoEvento) => TIPOS[tipo].oscuro

/** Retraso de lo que se enciende en el camino: cuando el trazo llega a su sitio (lo que va por delante, al final). */
const alLlegar = (p: number, recorrido: number) => `${300 + Math.min(p / Math.max(recorrido, 0.01), 1) * 1800}ms`

/**
 * La pieza que abre el Inicio: la imagen de Nuestra Señora de los Desamparados
 * con los días que faltan para la estación de penitencia, y al lado el curso
 * como un camino de un Sábado de Pasión al siguiente, lleno hasta hoy.
 *
 * Todos los actos del curso van en el camino, un punto por acto. Los cercanos
 * se agrupan en racimos con su número; el racimo abierto (de entrada, el
 * próximo) se lista debajo, con sus fechas.
 */
export default function CaminoEstacion({ eventos, hoy = new Date() }: { eventos: PanelResponse['curso']['eventos']; hoy?: Date }) {
  const { modo } = useTemaCms()
  const { fecha, anterior, dias, porcentaje } = cuentaAtrasEstacion(hoy)
  const diasContados = Math.round(useCuenta(dias, 1600))
  const recorrido = porcentaje / 100
  const aqui = punto(recorrido)
  const fondo = modo === 'oscuro' ? OSCURO.fondoTemaOscuro : OSCURO.fondo

  const { referencia, ancho } = useAnchoMedido()
  const actos = actosDelCurso(hoy, eventos)
  // El camino ocupa el ancho menos sus márgenes (24 de cada 1000 a cada lado).
  const racimos = racimosDelCurso(actos, hoy, (ancho * (ANCHO - 48)) / ANCHO)
  const [elegido, setElegido] = useState<number | null>(null)
  // Con otro ancho los racimos se rehacen: si el elegido ya no existe, se vuelve al próximo.
  const indiceAbierto = elegido !== null && elegido < racimos.length ? elegido : racimoInicial(racimos)
  const porDelante = actos.filter((a) => !a.pasado).length
  const tipos = (Object.keys(TIPOS) as TipoEvento[]).filter((t) => actos.some((a) => a.tipo === t))

  return (
    <Box
      component="section"
      aria-labelledby="camino-estacion"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        // Imagen y camino lado a lado solo cuando el camino tiene sitio de sobra.
        '@container (min-width: 860px)': { gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 2fr)' },
        // Siempre oscura, con el mismo velo burdeos que el resto de tarjetas.
        ...fondoTarjeta('oscuro', 'burdeos', fondo),
        color: OSCURO.texto,
        borderRadius: 1.75,
        overflow: 'hidden',
        height: '100%',
        ...entrada(0),
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

      {/* El curso como camino, con todos sus actos. */}
      <Box sx={{ p: { xs: 2.25, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2px 16px', flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>El curso</Typography>
          <Typography sx={{ fontSize: 13, color: OSCURO.texto2 }}>
            {porcentaje} % del curso · {porDelante ? `${contar(porDelante, 'acto', 'actos')} por delante` : 'sin actos por delante'}
          </Typography>
        </Box>

        <Box ref={referencia} sx={{ position: 'relative', width: '100%', aspectRatio: `${ANCHO} / ${ALTO}`, mt: 3, mb: 1 }}>
          <Box
            role="progressbar"
            aria-label="Parte del curso recorrida"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            sx={{ position: 'absolute', inset: 0 }}
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
              {/* Las dos estaciones: la que abrió el curso, encendida; la que lo cierra, por llegar. */}
              <circle cx={punto(0).x} cy={punto(0).y} r={7} fill={OSCURO.andado} stroke={OSCURO.claro} strokeWidth={2} />
              <circle cx={punto(1).x} cy={punto(1).y} r={9} fill={fondo} stroke="rgba(255,255,255,.5)" strokeWidth={2} />
              {/* Un punto por acto, del color de su tipo; los pasados, más apagados. */}
              {actos.map((acto, i) => {
                const { x, y } = punto(acto.p)
                return (
                  <Box
                    key={i}
                    component="circle"
                    cx={x}
                    cy={y}
                    r={4}
                    fill={COLOR(acto.tipo)}
                    opacity={acto.pasado ? 0.55 : 1}
                    sx={{
                      transformBox: 'fill-box', transformOrigin: 'center',
                      animation: `${aparecer} .4s ease-out backwards`, animationDelay: alLlegar(acto.p, recorrido),
                      ...sinMovimiento,
                    }}
                  />
                )
              })}
              <Box
                component="g"
                sx={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `${aparecer} .5s ease-out 2.1s backwards`, ...sinMovimiento }}
              >
                <circle cx={aqui.x} cy={aqui.y} r={13} fill="rgba(255,179,180,.18)" />
                <circle cx={aqui.x} cy={aqui.y} r={6} fill={OSCURO.claro} />
              </Box>
            </Box>
          </Box>

          {/* Los racimos, en HTML sobre el dibujo: botones de verdad, del mismo tamaño en cualquier ancho. */}
          {racimos.map((racimo, i) => {
            const { x, y } = punto(racimo.p)
            const n = racimo.actos.length
            const esAbierto = i === indiceAbierto
            return (
              <Box
                key={`${racimo.p}-${n}`}
                component="button"
                type="button"
                onClick={() => setElegido(i)}
                aria-expanded={esAbierto}
                aria-controls="camino-detalle"
                aria-label={`${contar(n, 'acto', 'actos')}, ${rangoDe(racimo)}`}
                sx={{
                  position: 'absolute',
                  left: `${(x / ANCHO) * 100}%`,
                  top: `${(y / ALTO) * 100}%`,
                  // Un banderín por encima del camino, con su palito hasta él: así
                  // el número no tapa los puntos de los actos ni el de hoy.
                  // Con `translate` y no `transform`: la animación de aparecer usa `transform` y lo pisaría.
                  translate: '-50% calc(-100% - 14px)',
                  '&::after': {
                    content: '""', position: 'absolute', left: '50%', top: '100%', width: '1px', height: 13,
                    backgroundColor: racimo.porVenir ? 'rgba(255,255,255,.35)' : 'rgba(255,179,180,.55)',
                  },
                  minWidth: 24, height: 24, px: '7px', m: 0,
                  borderRadius: '12px',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                  cursor: 'pointer',
                  // Lo ya pasado, relleno del color de lo andado; lo que viene, hueco.
                  ...(racimo.porVenir
                    ? { backgroundColor: '#3a3538', color: OSCURO.texto, border: '1px solid rgba(255,255,255,.4)', boxShadow: '0 0 0 4px rgba(255,255,255,.06)' }
                    : { backgroundColor: OSCURO.claro, color: '#1d1b1e', border: '1px solid transparent', boxShadow: '0 0 0 4px rgba(255,179,180,.18)' }),
                  outline: esAbierto ? `2px solid ${OSCURO.claro}` : 'none',
                  outlineOffset: 2,
                  '&:focus-visible': { outline: `2px solid ${OSCURO.texto}` },
                  animation: `${aparecer} .45s cubic-bezier(.2, .9, .3, 1.3) backwards`,
                  animationDelay: alLlegar(racimo.p, recorrido),
                  ...sinMovimiento,
                }}
              >
                {n}
              </Box>
            )
          })}
        </Box>

        {/* Los extremos, debajo del dibujo y no encima: así ningún racimo los tapa. */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 12.5, lineHeight: 1.3, color: OSCURO.texto2 }}>
          <span>Sábado de Pasión<Box component="span" sx={{ display: 'block', color: OSCURO.tenue }}>{corta(anterior)}</Box></span>
          <Box component="span" sx={{ textAlign: 'right' }}>Sábado de Pasión<Box component="span" sx={{ display: 'block', color: OSCURO.tenue }}>{corta(fecha)}</Box></Box>
        </Box>

        {/*
          Todas las listas en la misma celda y solo se ve la del racimo abierto:
          la celda mide lo que la más larga, así que al pulsar otro racimo la
          tarjeta no cambia de alto (y la foto, que la llena, no se recoloca).
        */}
        {racimos.length > 0 && (
          <Box id="camino-detalle" aria-live="polite" sx={{ display: 'grid', borderTop: '1px solid rgba(255,255,255,.1)', pt: 1.5 }}>
            {racimos.map((racimo, r) => {
              const visible = r === indiceAbierto
              return (
                <Box
                  key={`${racimo.p}-${racimo.actos.length}`}
                  aria-hidden={!visible}
                  inert={!visible}
                  sx={{ gridArea: '1 / 1', visibility: visible ? 'visible' : 'hidden', minWidth: 0 }}
                >
                  <Typography component="h3" sx={{ fontSize: 14, fontWeight: 600, color: OSCURO.texto2, mb: 1 }}>
                    {contar(racimo.actos.length, 'acto', 'actos')} · {rangoDe(racimo)}
                  </Typography>
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '6px 18px' }}>
                    {racimo.actos.map((acto, i) => (
                      <Box component="li" key={i} sx={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', gap: 1, alignItems: 'baseline', fontSize: 13.5, opacity: acto.pasado ? 0.7 : 1 }}>
                        <Box component="span" sx={{ fontSize: 12.5, color: OSCURO.texto2, fontVariantNumeric: 'tabular-nums' }}>{diaMes(acto.fecha)}</Box>
                        <Box component="span" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                          <Box component="span" aria-hidden="true" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', mr: 0.75, verticalAlign: '1px', backgroundColor: COLOR(acto.tipo) }} />
                          {acto.titulo}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        {tipos.length > 0 && (
          <Box sx={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap', fontSize: 12.5, color: OSCURO.texto2, mt: 'auto', pt: 0.5 }}>
            {tipos.map((t) => (
              <Box component="span" key={t} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLOR(t) }} />
                {TIPOS[t].nombre}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
