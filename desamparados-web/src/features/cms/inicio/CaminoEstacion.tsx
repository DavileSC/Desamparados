import { Fragment, useState } from 'react'
import { Box, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { actosDelCurso, calmaCorta, corta, cuandoFalta, diaMes, diasEntre, momentoDelCurso, rangoDe, tandaInicial, tandasDelCurso } from './tandas'
import type { Momento } from './tandas'
import { TIPOS } from '../../inicio/agenda'
import type { TipoEvento } from '../../../lib/api/panel'
import { contar } from './plural'
import { fondoTarjeta } from '../../../theme/tarjeta'
import { segunModo } from '../../../theme/cms'
import { acercar, aparecer, CIFRA, entrada, sinMovimiento, useCuenta } from './animaciones'

// El curso va siempre sobre fondo oscuro, en los dos temas: es la pieza que
// destaca, y la foto de la Virgen es oscura.
const OSCURO = { fondo: '#1d1b1e', fondoTemaOscuro: '#100e11', texto: '#ffffff', texto2: '#cbc5c8', tenue: '#8f8a8d', claro: '#ffb3b4' }
/** Cada tipo de acto con su color de la agenda, en la variante para fondo oscuro. */
const COLOR = (tipo: TipoEvento) => TIPOS[tipo].oscuro
/** Solo para lectores de pantalla. */
const OCULTO = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/** La frase de arriba: en plena tanda, esperando la próxima o sin nada por delante. */
function Ahora({ momento, hoy }: { momento: Momento; hoy: Date }) {
  const pastilla = (texto: string, plena: boolean) => (
    <Box
      component="span"
      sx={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', px: 1, py: '3px', borderRadius: 999,
        ...(plena ? { backgroundColor: OSCURO.claro, color: '#1d1b1e' } : { backgroundColor: 'rgba(255,255,255,.12)', color: OSCURO.texto2 }),
      }}
    >
      {texto}
    </Box>
  )

  let frase
  if (momento.tipo === 'plena') {
    const { tanda, quedan, siguiente } = momento
    frase = (
      <>
        {pastilla('En plena tanda', true)}
        <span>
          <b>{tanda.nombre}</b>: {quedan === 1 ? 'queda 1 acto' : `quedan ${quedan} actos`} hasta el {diaMes(tanda.fin)}.
          {' '}Lo siguiente, «{siguiente.titulo}», {cuandoFalta(hoy, siguiente.fecha)}.
        </span>
      </>
    )
  } else if (momento.tipo === 'calma') {
    const { tanda } = momento
    const n = tanda.actos.length
    frase = (
      <>
        {pastilla('Calma', false)}
        <span>
          {n === 1
            ? <>Lo próximo, <b>«{tanda.actos[0].titulo}»</b>, {cuandoFalta(hoy, tanda.inicio)} ({diaMes(tanda.inicio)}).</>
            : <>La próxima tanda, <b>{tanda.nombre}</b>, empieza {cuandoFalta(hoy, tanda.inicio)} ({diaMes(tanda.inicio)}): {n} actos hasta el {diaMes(tanda.fin)}.</>}
        </span>
      </>
    )
  } else {
    frase = <>{pastilla('Calma', false)}<span>No quedan actos en la Agenda hasta la estación.</span></>
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', fontSize: 14, lineHeight: 1.4, px: 1.5, py: 1.25, borderRadius: 1.25, backgroundColor: 'rgba(255,255,255,.05)', '& b': { fontWeight: 600 } }}>
      {frase}
    </Box>
  )
}

/**
 * La pieza que abre el Inicio: la imagen de Nuestra Señora de los Desamparados
 * con los días que faltan para la estación de penitencia, y al lado el curso,
 * de un Sábado de Pasión al siguiente.
 *
 * El curso no se dibuja a escala de tiempo: la Hermandad hace muchos actos en
 * pocas semanas y luego pasa meses sin nada, y una escala recta gastaría el
 * sitio en la calma. Va por tandas, cada una con un cuadradito por acto, y la
 * calma entre ellas en corto. Arriba, una frase dice en qué punto estamos; la
 * tanda abierta (de entrada, la de ahora o la próxima) se lista debajo.
 */
export default function CaminoEstacion({ eventos, hoy = new Date() }: { eventos: PanelResponse['curso']['eventos']; hoy?: Date }) {
  const { fecha, dias, porcentaje } = cuentaAtrasEstacion(hoy)
  const diasContados = Math.round(useCuenta(dias, 1600))
  const fondo = segunModo(OSCURO.fondo, OSCURO.fondoTemaOscuro)

  const actos = actosDelCurso(hoy, eventos)
  const tandas = tandasDelCurso(actos, hoy)
  const momento = momentoDelCurso(tandas)
  const [elegida, setElegida] = useState<number | null>(null)
  const indiceAbierta = elegida !== null && elegida < tandas.length ? elegida : tandaInicial(tandas)
  const siguiente = actos.find((a) => !a.pasado)
  const porDelante = actos.filter((a) => !a.pasado).length
  const tipos = (Object.keys(TIPOS) as TipoEvento[]).filter((t) => actos.some((a) => a.tipo === t))

  return (
    <Box
      component="section"
      aria-labelledby="camino-estacion"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        // Imagen y curso lado a lado solo cuando el curso tiene sitio de sobra.
        '@container (min-width: 860px)': { gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 2fr)' },
        // Siempre oscura, con el mismo velo burdeos que el resto de tarjetas.
        ...fondoTarjeta('burdeos', fondo, 'oscuro'),
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

      {/* El curso por tandas, con todos sus actos. */}
      <Box sx={{ p: { xs: 2.25, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1.75, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2px 16px', flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>El curso</Typography>
          <Typography sx={{ fontSize: 13, color: OSCURO.texto2 }}>
            {porcentaje} % del curso · {porDelante ? `${contar(porDelante, 'acto', 'actos')} por delante` : 'sin actos por delante'}
          </Typography>
        </Box>

        <Ahora momento={momento} hoy={hoy} />

        {tandas.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', rowGap: 1 }}>
            {tandas.map((tanda, i) => {
              const n = tanda.actos.length
              const anterior = tandas[i - 1]
              // La calma en la que estamos, si estamos en una, va en rosa.
              const calmaDeHoy = anterior?.estado === 'pasada' && tanda.estado === 'porVenir'
              return (
                <Fragment key={`${tanda.inicio.getTime()}-${n}`}>
                  {anterior && (
                    <Box
                      sx={{
                        position: 'relative', display: 'grid', placeItems: 'center', alignContent: 'center', gap: '2px', minWidth: 46, px: 0.75,
                        fontSize: 11, lineHeight: 1.15, textAlign: 'center',
                        color: calmaDeHoy ? OSCURO.claro : OSCURO.tenue, fontWeight: calmaDeHoy ? 600 : 400,
                        '&::before': { content: '""', width: '100%', minWidth: 24, borderTop: `2px dotted ${calmaDeHoy ? OSCURO.claro : 'rgba(255,255,255,.2)'}` },
                      }}
                    >
                      <span>{calmaCorta(diasEntre(anterior.fin, tanda.inicio))}<Box component="span" sx={OCULTO}> sin actos</Box></span>
                      {calmaDeHoy && <span>hoy</span>}
                    </Box>
                  )}
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setElegida(i)}
                    aria-expanded={i === indiceAbierta}
                    aria-controls="curso-detalle"
                    aria-label={`${tanda.nombre}, ${contar(n, 'acto', 'actos')}, ${rangoDe(tanda)}`}
                    style={{ ['--hecho' as string]: `${Math.round(tanda.hecho * 100)}%` }}
                    sx={{
                      // Cada tanda ocupa lo que pesa, no lo que dura.
                      flex: `${Math.max(n, 2)} 1 0`, minWidth: 64,
                      display: 'grid', gap: 0.75, alignContent: 'start', p: 1.25, m: 0, position: 'relative', overflow: 'hidden',
                      textAlign: 'left', fontFamily: 'inherit', color: OSCURO.texto, cursor: 'pointer',
                      borderRadius: 1.25,
                      border: `1px solid ${i === indiceAbierta ? 'rgba(255,179,180,.6)' : 'transparent'}`,
                      backgroundColor: tanda.estado === 'viva' ? 'rgba(160,61,68,.2)' : 'rgba(255,255,255,.04)',
                      opacity: tanda.estado === 'pasada' ? 0.55 : 1,
                      '&:hover': { backgroundColor: tanda.estado === 'viva' ? 'rgba(160,61,68,.28)' : 'rgba(255,255,255,.07)' },
                      '&:focus-visible': { outline: `2px solid ${OSCURO.texto}`, outlineOffset: 2 },
                      // En la tanda de ahora, lo ya andado de ella, un poco más lleno.
                      ...(tanda.estado === 'viva' && {
                        '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 'var(--hecho)', backgroundColor: 'rgba(160,61,68,.25)' },
                      }),
                      '& > *': { position: 'relative' },
                      animation: `${aparecer} .45s cubic-bezier(.2, .9, .3, 1.2) backwards`,
                      animationDelay: `${200 + i * 70}ms`,
                      ...sinMovimiento,
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{tanda.nombre}</Box>
                    <Box component="span" sx={{ fontSize: 11.5, color: OSCURO.texto2, whiteSpace: 'nowrap' }}>{contar(n, 'acto', 'actos')}</Box>
                    <Box component="span" aria-hidden="true" sx={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {tanda.actos.map((acto, j) => (
                        <Box
                          key={j}
                          component="span"
                          title={`${diaMes(acto.fecha)} · ${acto.titulo}`}
                          sx={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: COLOR(acto.tipo), opacity: acto.pasado ? 0.45 : 1 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Fragment>
              )
            })}
          </Box>
        )}

        {/*
          Todas las listas en la misma celda y solo se ve la de la tanda abierta:
          la celda mide lo que la más larga (con su tope), así que al pulsar otra
          tanda la tarjeta no cambia de alto y la foto, que la llena, no se recoloca.
        */}
        {tandas.length > 0 && (
          <Box id="curso-detalle" aria-live="polite" sx={{ display: 'grid', borderTop: '1px solid rgba(255,255,255,.1)', pt: 1.5 }}>
            {tandas.map((tanda, t) => {
              const visible = t === indiceAbierta
              return (
                <Box
                  key={`${tanda.inicio.getTime()}-${tanda.actos.length}`}
                  aria-hidden={!visible}
                  inert={!visible}
                  sx={{ gridArea: '1 / 1', visibility: visible ? 'visible' : 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}
                >
                  <Typography component="h3" sx={{ fontSize: 13, fontWeight: 600, color: OSCURO.texto2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {tanda.nombre} · {rangoDe(tanda)} · {contar(tanda.actos.length, 'acto', 'actos')}
                  </Typography>
                  <Box
                    component="ul"
                    sx={{
                      listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '0 16px', alignContent: 'start',
                      // La Cuaresma trae veinte actos: se desplazan dentro en lugar de estirar la tarjeta.
                      maxHeight: 236, overflowY: 'auto', scrollbarWidth: 'thin',
                    }}
                  >
                    {tanda.actos.map((acto, i) => {
                      const esSiguiente = acto === siguiente
                      return (
                        <Box
                          component="li"
                          key={i}
                          sx={{
                            display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)', gap: 1, alignItems: 'baseline',
                            py: '5px', px: '6px', borderRadius: 0.75, fontSize: 13.5,
                            opacity: acto.pasado ? 0.5 : 1,
                            backgroundColor: esSiguiente ? 'rgba(255,179,180,.1)' : 'transparent',
                          }}
                        >
                          <Box component="span" sx={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: esSiguiente ? OSCURO.claro : OSCURO.texto2, fontWeight: esSiguiente ? 600 : 400 }}>
                            {diaMes(acto.fecha)}
                          </Box>
                          <Box component="span" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                            <Box component="span" aria-hidden="true" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', mr: 0.875, verticalAlign: '1px', backgroundColor: COLOR(acto.tipo) }} />
                            {acto.titulo}
                          </Box>
                        </Box>
                      )
                    })}
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
