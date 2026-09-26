import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, ButtonBase, ClickAwayListener, Dialog, Popper, Typography, useMediaQuery } from '@mui/material'
import { keyframes, useTheme } from '@mui/material/styles'
import { useReducedMotion } from 'framer-motion'
import type { ApiEvent } from '../../../lib/api/agenda'
import { GOLD, GRANATE, SERIF } from '../../inicio/estilos'
import { TIPOS, diasDeLaRejilla, inicioDeMes, inicioDelDia, nombreDelMes, sumarMeses } from '../../inicio/agenda'
import { claveDelDia, cuandoEnCartel, fotoDelCartel, primerDiaEnElMes, repartoDeLaSemana, ultimoMes } from './cultos'
import VentanaDelActo from './VentanaDelActo'

const NOCHE = '#161316'
const ORO_BORDE = 'rgba(222,199,43,0.4)'
const FILETE = 'rgba(222,199,43,0.18)'
const ORO_SUAVE = '#c9b25a'
const ROJO = '#e0705c'
/** El burdeos de la casa aclarado para el fondo oscuro, el mismo que usa el CMS. */
const BURDEOS_CLARO = TIPOS.CULTO.oscuro
const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
/** Lo que hay por debajo de la última semana: la leyenda, el margen de la hoja y un poco de aire. */
const PIE = 88
/** La fila con los nombres de los días, que va dentro de lo medido. */
const CABECERA_SEMANA = 28
/** El alto de las semanas en escritorio: lo que quepa en la pantalla, entre estos dos. */
const FILA_MIN = 56
const FILA_MAX = 110

const cae = keyframes`from { opacity: 0; transform: translateY(8px); filter: blur(6px); }`
const letra = keyframes`from { opacity: 0; transform: translateY(-6px); filter: blur(8px); }`
const gira = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
`

/**
 * La luz burdeos que da vueltas por el borde del próximo acto. El anillo es
 * la franja de 2 px que deja la máscara; dentro gira un abanico de color.
 */
function Anillo({ quieto }: { quieto: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute', inset: 0, p: '2px', overflow: 'hidden', pointerEvents: 'none', backgroundColor: GRANATE,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor',
        mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
        '&::before': {
          content: '""', position: 'absolute', left: '50%', top: '50%', width: '260%', aspectRatio: '1',
          transform: 'translate(-50%, -50%)',
          background: `conic-gradient(transparent 0 58%, ${GRANATE} 70%, ${BURDEOS_CLARO} 88%, #fff 90%, transparent 100%)`,
          animation: quieto ? 'none' : `${gira} 3.2s linear infinite`,
        },
      }}
    />
  )
}

/**
 * La Agenda en un calendario de pared: el mes en una hoja oscura con filetes
 * de oro, los días sin nada con el número solo perfilado y los días con acto
 * en oro macizo; los cultos solemnes, con su foto.
 *
 * Un acto que va solo es una tarjeta que ocupa sus días seguidos (un triduo,
 * tres casillas sin rayas por dentro y su nombre una vez). Los que coinciden
 * se quedan cada uno en sus casillas, con una línea por acto en cada día.
 *
 * Al pulsar un acto se abre en una ventana que crece desde su tarjeta:
 * pegada a ella en escritorio y centrada en el móvil. El próximo acto lleva una
 * luz burdeos que recorre su borde, y la leyenda de debajo dice qué significa.
 * Al cambiar de mes, el nombre entra letra a letra y los días caen en cascada.
 *
 * En escritorio el mes entero cabe en la pantalla al entrar: solo salen las
 * semanas que tiene el mes y el alto de las semanas se ajusta a lo que queda
 * de pantalla por debajo.
 */
export default function CalendarioDeCultos({ eventos }: { eventos: ApiEvent[] }) {
  const tema = useTheme()
  const estrecho = useMediaQuery(tema.breakpoints.down('md'))
  const quieto = useReducedMotion() ?? false
  const primero = useMemo(() => inicioDeMes(new Date()), [])
  const ultimo = useMemo(() => ultimoMes(eventos, primero), [eventos, primero])

  // Se abre en el mes del próximo acto: lo que viene, lo primero.
  const [mesElegido, setMes] = useState(() => {
    const suyo = eventos[0] ? inicioDeMes(new Date(eventos[0].startDate)) : primero
    return suyo > primero ? suyo : primero
  })
  // Si un filtro deja el mes elegido fuera de la agenda, se ve el último que queda.
  const mes = mesElegido > ultimo ? ultimo : mesElegido
  const [animar, setAnimar] = useState(false)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [ancla, setAncla] = useState<HTMLElement | null>(null)
  const rejilla = useRef<HTMLDivElement>(null)
  const marco = useRef<HTMLDivElement>(null)
  const [altoFila, setAltoFila] = useState<number | null>(null)

  const proximo = eventos[0] ?? null
  const evento = eventos.find((e) => e.id === abierto) ?? null
  const indice = evento ? eventos.indexOf(evento) : -1
  const primerDia = (e: ApiEvent) => primerDiaEnElMes(e, mes)

  const cambiarMes = (nuevo: Date) => {
    const limitado = nuevo < primero ? primero : nuevo > ultimo ? ultimo : nuevo
    if (limitado.getTime() === mes.getTime()) return
    setAnimar(true)
    setMes(limitado)
  }

  const abrir = (e: ApiEvent) => {
    cambiarMes(primerDiaEnElMes(e, mes) ? mes : inicioDeMes(inicioDelDia(new Date(e.startDate))))
    setAbierto(e.id)
  }

  const cerrar = (devolverFoco = true) => {
    if (devolverFoco) ancla?.focus()
    setAbierto(null)
  }

  // La ventana se ancla a la tarjeta del acto (a su primer tramo, si cruza de
  // semana), que puede estar en un mes recién pintado.
  useLayoutEffect(() => {
    setAncla(evento ? rejilla.current?.querySelector<HTMLElement>(`[data-acto="${evento.id}"]`) ?? null : null)
  }, [evento, mes])

  // Solo las semanas del mes: cinco casi siempre, seis si empieza tarde y es largo.
  const dias = diasDeLaRejilla(mes)
  const semanas = Math.ceil((dias.findIndex((d) => d.getDate() === 1) + new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()) / 7)

  // El alto de las semanas: lo que queda de pantalla desde donde empieza la
  // rejilla, medido en la página (no en la vista) para que no cambie al bajar.
  useEffect(() => {
    if (estrecho) return
    const medir = () => {
      const el = marco.current
      if (!el) return
      const arriba = el.getBoundingClientRect().top + window.scrollY
      const sitio = window.innerHeight - arriba - CABECERA_SEMANA - PIE
      setAltoFila(Math.max(FILA_MIN, Math.min(FILA_MAX, Math.floor(sitio / semanas))))
    }
    const primera = requestAnimationFrame(medir)
    document.fonts?.ready.then(medir)
    window.addEventListener('resize', medir)
    return () => { cancelAnimationFrame(primera); window.removeEventListener('resize', medir) }
  }, [estrecho, semanas])
  const fila = estrecho ? 50 : altoFila ?? FILA_MAX
  const grande = fila >= 96
  const mediano = fila >= 76
  const numero = {
    display: 'block', fontSize: { xs: 20, md: grande ? 40 : mediano ? 32 : 26 }, fontWeight: { xs: 700, md: 800 }, lineHeight: 1.1,
    color: 'transparent', WebkitTextStroke: '0.8px rgba(222,199,43,0.35)',
  } as const
  const casilla = {
    position: 'relative', minWidth: 0, minHeight: 0, p: { xs: '4px 6px', md: mediano ? '8px 10px' : '5px 8px' },
    textAlign: 'left', fontVariantNumeric: 'tabular-nums', overflow: 'hidden',
    // Al seguir a la ventana de un acto, que la barra fija de la web no lo tape.
    scrollMarginBlock: '96px 240px',
  } as const

  const ventana = evento && (
    <VentanaDelActo
      evento={evento}
      origen={ancla}
      quieto={quieto}
      esDialogo={estrecho}
      onCerrar={() => cerrar()}
      onAnterior={indice > 0 ? () => abrir(eventos[indice - 1]) : undefined}
      onSiguiente={indice < eventos.length - 1 ? () => abrir(eventos[indice + 1]) : undefined}
    />
  )

  const nombre = nombreDelMes(mes, false)
  const flecha = {
    width: 40, height: 40, fontSize: 18, border: `1px solid ${ORO_BORDE}`, color: GOLD,
    '&:hover': { borderColor: GOLD }, '&.Mui-disabled': { opacity: 0.3 },
    '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
  } as const

  return (
    <Box sx={{ bgcolor: NOCHE, border: `1px solid ${ORO_BORDE}`, p: { xs: '16px 12px', md: '20px 28px 16px' }, color: '#f4f1ee' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '10px 14px', mb: 1.5 }}>
        <Typography
          component="h3"
          aria-live="polite"
          aria-label={`${nombre} ${mes.getFullYear()}`}
          sx={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 200, fontSize: { xs: 30, md: 36 }, lineHeight: 1, color: GOLD, whiteSpace: 'nowrap' }}
        >
          <Box component="span" key={claveDelDia(mes)} aria-hidden>
            {animar && !quieto
              ? [...nombre].map((l, i) => (
                <Box component="span" key={i} sx={{ display: 'inline-block', whiteSpace: 'pre', animation: `${letra} .7s cubic-bezier(.2,.8,.2,1) both`, animationDelay: `${i * 40}ms` }}>{l}</Box>
              ))
              : nombre}
          </Box>
          <Box component="span" aria-hidden sx={{ fontStyle: 'normal', fontWeight: 500, fontSize: 13, letterSpacing: '0.2em', color: ORO_SUAVE, ml: 1.25 }}>{mes.getFullYear()}</Box>
        </Typography>
        <ButtonBase aria-label="Mes anterior" disabled={mes <= primero} onClick={() => { cerrar(false); cambiarMes(sumarMeses(mes, -1)) }} sx={flecha}>‹</ButtonBase>
        <ButtonBase aria-label="Mes siguiente" disabled={mes >= ultimo} onClick={() => { cerrar(false); cambiarMes(sumarMeses(mes, 1)) }} sx={flecha}>›</ButtonBase>
      </Box>

      <Box ref={marco}>
      <Box
        key={claveDelDia(mes)}
        ref={rejilla}
        sx={{
          display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          borderTop: `1px solid ${ORO_BORDE}`, borderLeft: `1px solid ${FILETE}`,
          '& .pieza': {
            borderRight: `1px solid ${FILETE}`, borderBottom: `1px solid ${FILETE}`,
            ...(animar && !quieto && { animation: `${cae} .6s cubic-bezier(.2,.8,.2,1) both` }),
          },
        }}
      >
        {SEMANA.map((d, i) => (
          <Box key={d} className="pieza" aria-hidden sx={{ textAlign: 'center', py: 0.75, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORO_SUAVE, animationDelay: `${i * 28}ms` }}>{d}</Box>
        ))}
        {Array.from({ length: semanas }, (_, s) => {
          const semana = dias.slice(s * 7, s * 7 + 7)
          const { tarjetas, porDia } = repartoDeLaSemana(eventos, semana, mes)
          const retraso = (columna: number) => ({ animationDelay: `${(columna + s + 1) * 28}ms` })
          const empiezaProximo = (dia: Date) => !!proximo && primerDia(proximo) !== null && claveDelDia(primerDia(proximo)!) === claveDelDia(dia)
          const elegido = (e: ApiEvent) => abierto === e.id
          const pulsar = (e: ApiEvent) => { if (abierto === e.id) cerrar(); else setAbierto(e.id) }
          const marcaProximo = (
            <>
              <Anillo quieto={quieto} />
              <Box component="span" aria-hidden sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: mediano ? 10 : 7, right: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: BURDEOS_CLARO }}>
                Próximo
              </Box>
            </>
          )
          return (
            <Box key={s} sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', height: fila }}>
              {semana.map((dia, i) => {
                if (tarjetas.some((t) => i >= t.desde && i <= t.hasta)) return null
                const delMes = dia.getMonth() === mes.getMonth()
                const actos = porDia.get(i) ?? []
                const sx = { ...casilla, gridColumn: i + 1, ...retraso(i) }
                if (!delMes) return <Box key={i} className="pieza" sx={sx} />
                if (!actos.length) {
                  return (
                    <Box key={i} className="pieza" sx={sx}>
                      <Box component="span" sx={{ ...numero, ...(dia.getDay() === 0 && { WebkitTextStroke: `0.8px ${ROJO}` }) }}>{dia.getDate()}</Box>
                    </Box>
                  )
                }
                // Varios actos que coinciden: la casilla del día, con una línea por acto.
                return (
                  <Box key={i} className="pieza" sx={{ ...sx, display: 'flex', flexDirection: 'column', gap: 0.25, bgcolor: actos.some((e) => e.cartel) ? 'rgba(110,24,34,0.55)' : 'rgba(222,199,43,0.07)' }}>
                    <Box component="span" sx={{ ...numero, color: actos.some((e) => e.cartel) ? '#fff' : GOLD, WebkitTextStroke: 0 }}>{dia.getDate()}</Box>
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {actos.map((e) => (
                        <ButtonBase
                          key={e.id}
                          data-acto={e.id}
                          data-abre-acto
                          onClick={() => pulsar(e)}
                          aria-haspopup="dialog"
                          aria-label={`${dia.getDate()} de ${nombre.toLowerCase()}: ${e.title}${empiezaProximo(dia) && e.id === proximo?.id ? '. Próximo acto' : ''}`}
                          sx={{
                            fontFamily: 'inherit', justifyContent: 'flex-start', minWidth: 0, textAlign: 'left',
                            // En el móvil no cabe el nombre: cada acto es una franja de color que se pulsa.
                            flex: { xs: 1, md: 'none' }, minHeight: { xs: 6, md: 0 },
                            pl: { xs: 0, md: 0.75 }, fontSize: 11.5, fontWeight: 500, lineHeight: 1.3, color: '#f4f1ee',
                            borderLeft: { md: `2px solid ${e.cartel ? BURDEOS_CLARO : GOLD}` },
                            bgcolor: { xs: e.cartel ? BURDEOS_CLARO : GOLD, md: 'transparent' },
                            boxShadow: elegido(e) ? `inset 0 0 0 1px ${GOLD}` : 'none',
                            '&:hover': { bgcolor: { md: 'rgba(255,255,255,0.08)' } },
                            '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 1 },
                          }}
                        >
                          <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</Box>
                        </ButtonBase>
                      ))}
                    </Box>
                    {actos.some((e) => e.id === proximo?.id) && empiezaProximo(dia) && marcaProximo}
                  </Box>
                )
              })}
              {/* Un acto que va solo: una tarjeta de sus días seguidos. */}
              {tarjetas.map((t) => {
                const e = t.evento
                const foto = e.cartel ? fotoDelCartel(e).src : null
                const [d1, d2] = [semana[t.desde].getDate(), semana[t.hasta].getDate()]
                const esProximo = e.id === proximo?.id && empiezaProximo(semana[t.desde])
                return (
                  <ButtonBase
                    key={e.id}
                    className="pieza"
                    data-acto={e.id}
                    data-abre-acto
                    onClick={() => pulsar(e)}
                    aria-haspopup="dialog"
                    aria-label={`${d1 === d2 ? d1 : `${d1} al ${d2}`} de ${nombre.toLowerCase()}: ${e.title}${esProximo ? '. Próximo acto' : ''}`}
                    sx={{
                      ...casilla, ...retraso(t.desde), gridColumn: `${t.desde + 1} / ${t.hasta + 2}`, gridRow: 1,
                      fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: grande ? 0.75 : 0.25,
                      bgcolor: e.cartel ? GRANATE : 'rgba(222,199,43,0.07)',
                      ...(foto && {
                        backgroundImage: `linear-gradient(${t.hasta > t.desde ? '90deg' : '180deg'}, rgba(110,24,34,0.5), rgba(18,15,17,0.88)), url("${foto}")`,
                        backgroundSize: 'cover', backgroundPosition: 'center 25%',
                      }),
                      boxShadow: elegido(e) ? `inset 0 0 0 1px ${GOLD}` : 'none',
                      '&:hover': { bgcolor: e.cartel ? 'rgba(110,24,34,0.8)' : 'rgba(222,199,43,0.13)' },
                      '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: -2 },
                    }}
                  >
                    {/* Los números de sus días, cada uno sobre su columna. */}
                    <Box component="span" sx={{ display: 'grid', gridTemplateColumns: `repeat(${t.hasta - t.desde + 1}, minmax(0, 1fr))` }}>
                      {semana.slice(t.desde, t.hasta + 1).map((dia) => (
                        <Box component="span" key={dia.getDate()} sx={{ ...numero, color: e.cartel ? '#fff' : GOLD, WebkitTextStroke: 0 }}>{dia.getDate()}</Box>
                      ))}
                    </Box>
                    <Box component="span" sx={{
                      display: { xs: 'none', md: '-webkit-box' }, WebkitBoxOrient: 'vertical', WebkitLineClamp: grande ? 2 : 1, overflow: 'hidden',
                      fontSize: 12.5, fontWeight: 500, lineHeight: 1.25, color: '#f4f1ee', textAlign: 'left',
                    }}>
                      {e.title}
                    </Box>
                    {esProximo && marcaProximo}
                  </ButtonBase>
                )
              })}
            </Box>
          )
        })}
      </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px 24px', mt: 1 }}>
        {/* Qué quiere decir cada color: en las tarjetas y en la rayita de cada acto cuando coinciden varios. */}
        <Box component="ul" aria-label="Leyenda" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 18px', fontSize: 13, color: 'rgba(244,241,238,0.72)' }}>
          {[
            { color: GRANATE, raya: BURDEOS_CLARO, texto: 'Culto solemne' },
            { color: 'rgba(222,199,43,0.14)', raya: GOLD, texto: 'Otros actos' },
          ].map((l) => (
            <Box component="li" key={l.texto} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" aria-hidden sx={{ width: 16, height: 16, bgcolor: l.color, borderLeft: `3px solid ${l.raya}` }} />
              {l.texto}
            </Box>
          ))}
          <Box component="li" sx={{ color: 'rgba(244,241,238,0.55)' }}>Pulsa un acto para verlo.</Box>
        </Box>
        {proximo && (
          <ButtonBase
            data-abre-acto
            onClick={() => abrir(proximo)}
            sx={{ fontFamily: 'inherit', fontSize: 13.5, gap: 1.25, textAlign: 'left', minHeight: 40, color: '#f4f1ee', '&:hover .titulo': { textDecoration: 'underline' }, '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 } }}
          >
            <Box component="span" aria-hidden sx={{ position: 'relative', flex: 'none', width: 18, height: 18 }}><Anillo quieto={quieto} /></Box>
            <span>
              <Box component="span" sx={{ color: BURDEOS_CLARO, fontWeight: 600 }}>Próximo acto:</Box>{' '}
              <span className="titulo">{proximo.title}</span>, {cuandoEnCartel(proximo).toLowerCase()}
            </span>
          </ButtonBase>
        )}
      </Box>

      {!estrecho && (
        <Popper
          open={!!ventana && !!ancla}
          anchorEl={ancla}
          placement="right-start"
          modifiers={[
            { name: 'offset', options: { offset: [0, 12] } },
            { name: 'flip', options: { fallbackPlacements: ['left-start', 'bottom'] } },
            { name: 'preventOverflow', options: { padding: 8 } },
          ]}
          sx={{ zIndex: tema.zIndex.modal }}
        >
          <ClickAwayListener onClickAway={(e) => { if (!(e.target as Element).closest?.('[data-abre-acto]')) cerrar(false) }}>
            <div>{ventana}</div>
          </ClickAwayListener>
        </Popper>
      )}
      {estrecho && (
        <Dialog
          open={!!ventana}
          onClose={() => cerrar()}
          aria-labelledby={evento ? `acto-${evento.id}` : undefined}
          slotProps={{
            paper: { sx: { bgcolor: 'transparent', boxShadow: 'none', m: 2, overflow: 'visible', borderRadius: 0 } },
            backdrop: { sx: { bgcolor: 'rgba(10,8,10,0.6)' } },
          }}
        >
          {ventana}
        </Dialog>
      )}
    </Box>
  )
}
