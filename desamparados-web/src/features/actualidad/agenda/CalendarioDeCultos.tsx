import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, ButtonBase, ClickAwayListener, Dialog, Popper, Typography, useMediaQuery } from '@mui/material'
import { keyframes, useTheme } from '@mui/material/styles'
import { useReducedMotion } from 'framer-motion'
import type { ApiEvent } from '../../../lib/api/agenda'
import { GRANATE } from '../../inicio/estilos'
import { TIPOS, diasDeLaRejilla, inicioDeMes, inicioDelDia, nombreDelMes, sumarMeses } from '../../inicio/agenda'
import { claveDelDia, cuandoEnCartel, hora, primerDiaEnElMes, repartoDeLaSemana, ultimoMes } from './cultos'
import VentanaDelActo from './VentanaDelActo'
import Hueso from '../../../components/esqueleto/Hueso'
import { CORMORANT } from './letraAlmanaque'

export const PAPEL = '#f3eee5'
/** Los días de otro mes, un poco más apagados que la hoja. */
const PAPEL_FUERA = '#ece5d9'
/** Los días de culto solemne: un rosa viejo que se nota sin teñir la hoja. */
const SOLEMNE = '#ead9d0'
const RAYA = '#d9cfc1'
export const TINTA = '#231d20'
const TINTA_SUAVE = '#5b4f53'
const GRIS = '#7a6c70'
/** El granate oscuro de los títulos solemnes, sobre el rosa. */
const GRANATE_TINTA = '#3a1016'
const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const SEMANA_LARGA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
/** El aire que se deja entre el pie de la hoja y el borde de la pantalla. */
const AIRE = 16
/** La fila con los nombres de los días, que va dentro de lo medido. */
const CABECERA_SEMANA = 32
/** El alto de las semanas: lo que quepa en la pantalla, entre estos dos (móvil y escritorio). */
const FILA = { movil: { min: 40, max: 64 }, escritorio: { min: 44, max: 112 } }

/** Al cambiar de mes, los días aparecen en una cascada corta y sin desenfoque. */
const cae = keyframes`from { opacity: 0; transform: translateY(4px); }`

/** El color de un acto sobre el papel: el granate, si es solemne; si no, el de su clase. */
const colorDelActo = (e: ApiEvent) => (e.cartel ? GRANATE : TIPOS[e.type].color)

/**
 * La Agenda en una hoja de almanaque: el mes en papel crema con una rejilla
 * fina, los números en letra romana y el granate del Grupo en los domingos y
 * en los cultos solemnes, que tiñen su día de rosa viejo. Cada acto lleva su
 * hora en el color de su clase.
 *
 * Un acto que va solo es una tarjeta que ocupa sus días seguidos (un triduo,
 * tres casillas sin rayas por dentro y su nombre una vez). Los que coinciden
 * se quedan cada uno en sus casillas, con una línea por acto en cada día.
 *
 * Al pulsar un acto se abre en una ventana que crece desde su tarjeta:
 * pegada a ella en escritorio y centrada en el móvil. El próximo acto lleva
 * una etiqueta granate. Para pasar de mes, el nombre del mes de al lado.
 *
 * En cualquier pantalla, del móvil al escritorio, el mes entero cabe al
 * entrar, con su leyenda: solo salen las semanas que tiene el mes y el alto de
 * las semanas se ajusta a lo que queda de pantalla por debajo.
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
  const pie = useRef<HTMLDivElement>(null)
  const [altoFila, setAltoFila] = useState<number | null>(null)

  const proximo = eventos[0] ?? null
  const evento = eventos.find((e) => e.id === abierto) ?? null
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

  // El alto de las semanas, en todas las pantallas: lo que queda desde donde
  // empieza la rejilla hasta el borde de abajo, menos lo que ocupa el pie de la
  // hoja (la leyenda, que en el móvil baja a varias líneas) y su margen. Se
  // mide en la página (no en la vista) para que no cambie al bajar.
  const limites = estrecho ? FILA.movil : FILA.escritorio
  useEffect(() => {
    const medir = () => {
      const el = marco.current
      const hoja = el?.closest<HTMLElement>('[data-hoja]')
      if (!el || !hoja) return
      const arriba = el.getBoundingClientRect().top + window.scrollY
      const margenDeAbajo = parseFloat(getComputedStyle(hoja).paddingBottom) || 0
      const resto = CABECERA_SEMANA + (pie.current?.offsetHeight ?? 0) + margenDeAbajo + AIRE
      // Lo mejor: que quepa nada más entrar, sin bajar.
      const alEntrar = Math.floor((window.innerHeight - arriba - resto) / semanas)
      // Si no hay sitio (un móvil bajo), que al menos quepa la hoja entera
      // debajo de la barra de la web, al bajar hasta ella.
      const barra = Math.max(0, ...[...document.querySelectorAll('.MuiAppBar-root')].map((b) => b.getBoundingClientRect().height))
      const cabeceraDeLaHoja = el.getBoundingClientRect().top - hoja.getBoundingClientRect().top
      const conLaHoja = Math.floor((window.innerHeight - barra - AIRE - cabeceraDeLaHoja - resto) / semanas)
      const alto = alEntrar >= limites.min ? alEntrar : conLaHoja
      setAltoFila(Math.max(limites.min, Math.min(limites.max, alto)))
    }
    const primera = requestAnimationFrame(medir)
    document.fonts?.ready.then(medir)
    window.addEventListener('resize', medir)
    // La leyenda cambia de alto al pasar de mes o al estrecharse la pantalla.
    const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null
    if (pie.current) observador?.observe(pie.current)
    return () => { cancelAnimationFrame(primera); window.removeEventListener('resize', medir); observador?.disconnect() }
  }, [limites, semanas])
  const fila = altoFila ?? limites.max
  const grande = fila >= 96
  const mediano = fila >= 76
  const numero = {
    display: 'block', fontFamily: CORMORANT, fontSize: { xs: 20, md: grande ? 30 : mediano ? 26 : 22 }, fontWeight: 500, lineHeight: 1,
    fontVariantNumeric: 'lining-nums', color: TINTA,
  } as const
  const casilla = {
    position: 'relative', minWidth: 0, minHeight: 0, p: { xs: '4px 6px', md: mediano ? '8px 12px' : '5px 10px' },
    textAlign: 'left', overflow: 'hidden', color: TINTA,
    // Al seguir a la ventana de un acto, que la barra fija de la web no lo tape.
    scrollMarginBlock: '96px 240px',
  } as const
  const foco = { '&.Mui-focusVisible': { outline: `2px solid ${GRANATE}`, outlineOffset: -2 } } as const

  const ventana = evento && (
    <VentanaDelActo
      evento={evento}
      origen={ancla}
      quieto={quieto}
      esDialogo={estrecho}
      onCerrar={() => cerrar()}
    />
  )

  const nombre = nombreDelMes(mes, false)
  const pasar = {
    fontFamily: 'inherit', gap: 0.75, minHeight: 44, px: { xs: 0.75, md: 1.25 }, fontSize: { xs: 12.5, md: 13.5 }, fontWeight: 600,
    letterSpacing: '0.16em', textTransform: 'uppercase', color: GRANATE, whiteSpace: 'nowrap',
    '&:hover .mes': { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationThickness: '1px' },
    '&.Mui-disabled': { color: GRANATE, opacity: 0.3 },
    '&.Mui-focusVisible': { outline: `2px solid ${GRANATE}`, outlineOffset: 2 },
  } as const
  const anterior = nombreDelMes(sumarMeses(mes, -1), false)
  const siguiente = nombreDelMes(sumarMeses(mes, 1), false)

  // Qué quiere decir cada color: las clases de acto que hay en la agenda.
  const clases = [...new Set(eventos.filter((e) => !e.cartel).map((e) => e.type))]

  return (
    <Box data-hoja sx={{ bgcolor: PAPEL, color: TINTA, borderRadius: '3px', p: { xs: '14px 12px 10px', md: '32px 44px 20px' } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0 24px', mb: { xs: 0.5, md: 2 } }}>
        <Typography
          component="h3"
          aria-live="polite"
          aria-label={`${nombre} ${mes.getFullYear()}`}
          sx={{ fontFamily: CORMORANT, fontWeight: 500, fontSize: { xs: 34, sm: 44, md: 68 }, lineHeight: 0.95, color: GRANATE, whiteSpace: 'nowrap' }}
        >
          <span aria-hidden>{nombre}</span>
          <Box component="span" aria-hidden sx={{ display: { xs: 'none', sm: 'inline' }, fontStyle: 'italic', fontWeight: 400, fontSize: { xs: 20, md: 26 }, color: GRIS, ml: 1.5 }}>de {mes.getFullYear()}</Box>
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: { xs: -1.25, md: 0 } }}>
          <ButtonBase aria-label={`Mes anterior: ${anterior}`} disabled={mes <= primero} onClick={() => { cerrar(false); cambiarMes(sumarMeses(mes, -1)) }} sx={pasar}>
            <span aria-hidden>‹</span><MesDeAlLado nombre={anterior} />
          </ButtonBase>
          <Box component="span" aria-hidden sx={{ display: { xs: 'none', md: 'block' }, width: '1px', height: 16, bgcolor: RAYA }} />
          <ButtonBase aria-label={`Mes siguiente: ${siguiente}`} disabled={mes >= ultimo} onClick={() => { cerrar(false); cambiarMes(sumarMeses(mes, 1)) }} sx={pasar}>
            <MesDeAlLado nombre={siguiente} /><span aria-hidden>›</span>
          </ButtonBase>
        </Box>
      </Box>

      <Box ref={marco}>
        <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', height: CABECERA_SEMANA, alignItems: 'center' }}>
          {SEMANA.map((d, i) => (
            <Box
              key={d}
              sx={{
                px: { xs: '6px', md: '12px' }, color: i === 6 ? GRANATE : GRIS,
                fontFamily: { xs: 'inherit', md: CORMORANT }, fontStyle: { md: 'italic' }, fontSize: { xs: 11, md: 17 },
                letterSpacing: { xs: '0.12em', md: 0 }, textTransform: { xs: 'uppercase', md: 'none' },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>{d}</Box>
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{SEMANA_LARGA[i]}</Box>
            </Box>
          ))}
        </Box>
        <Box
          key={claveDelDia(mes)}
          ref={rejilla}
          sx={{
            display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            borderTop: `1px solid ${RAYA}`, borderLeft: `1px solid ${RAYA}`,
            '& .pieza': {
              borderRight: `1px solid ${RAYA}`, borderBottom: `1px solid ${RAYA}`,
              ...(animar && !quieto && { animation: `${cae} .45s cubic-bezier(.2,.8,.2,1) both` }),
            },
          }}
        >
          {Array.from({ length: semanas }, (_, s) => {
            const semana = dias.slice(s * 7, s * 7 + 7)
            const { tarjetas, porDia } = repartoDeLaSemana(eventos, semana, mes)
            const retraso = (columna: number) => ({ animationDelay: `${(columna + s) * 18}ms` })
            const empiezaProximo = (dia: Date) => !!proximo && primerDia(proximo) !== null && claveDelDia(primerDia(proximo)!) === claveDelDia(dia)
            const elegido = (e: ApiEvent) => abierto === e.id
            const pulsar = (e: ApiEvent) => { if (abierto === e.id) cerrar(); else setAbierto(e.id) }
            // En escritorio, una etiqueta; en el móvil, donde no cabe, un filete granate.
            const marcaProximo = (
              <Box
                component="span"
                aria-hidden
                sx={{
                  position: 'absolute', pointerEvents: 'none',
                  inset: { xs: 0, md: 'auto' }, top: { md: mediano ? 9 : 6 }, right: { md: 8 },
                  boxShadow: { xs: `inset 0 0 0 2px ${GRANATE}`, md: 'none' },
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, bgcolor: GRANATE, color: PAPEL, borderRadius: '2px', p: '3px 6px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                  Próximo
                </Box>
              </Box>
            )
            return (
              <Box key={s} sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', height: fila }}>
                {semana.map((dia, i) => {
                  if (tarjetas.some((t) => i >= t.desde && i <= t.hasta)) return null
                  const delMes = dia.getMonth() === mes.getMonth()
                  const actos = porDia.get(i) ?? []
                  const sx = { ...casilla, gridColumn: i + 1, ...retraso(i) }
                  if (!delMes) return <Box key={i} className="pieza" sx={{ ...sx, bgcolor: PAPEL_FUERA }} />
                  const domingo = dia.getDay() === 0
                  if (!actos.length) {
                    return (
                      <Box key={i} className="pieza" sx={sx}>
                        <Box component="span" sx={{ ...numero, ...(domingo && { color: GRANATE }) }}>{dia.getDate()}</Box>
                      </Box>
                    )
                  }
                  const solemne = actos.some((e) => e.cartel)
                  // Varios actos que coinciden: la casilla del día, con una línea por acto.
                  return (
                    <Box key={i} className="pieza" sx={{ ...sx, display: 'flex', flexDirection: 'column', gap: { xs: 0.5, md: 0.75 }, bgcolor: solemne ? SOLEMNE : PAPEL }}>
                      <Box component="span" sx={{ ...numero, fontWeight: 600, color: solemne || domingo ? GRANATE : TINTA }}>{dia.getDate()}</Box>
                      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {actos.map((e) => (
                          <ButtonBase
                            key={e.id}
                            data-acto={e.id}
                            data-abre-acto
                            onClick={() => pulsar(e)}
                            aria-haspopup="dialog"
                            aria-label={`${dia.getDate()} de ${nombre.toLowerCase()}: ${e.title}${empiezaProximo(dia) && e.id === proximo?.id ? '. Próximo acto' : ''}`}
                            sx={{
                              fontFamily: 'inherit', justifyContent: 'flex-start', alignItems: 'baseline', gap: 0.75, minWidth: 0, textAlign: 'left',
                              // En el móvil no cabe el nombre: cada acto es una franja de su color que se pulsa.
                              flex: { xs: 1, md: 'none' }, minHeight: { xs: 6, md: 0 }, borderRadius: '2px',
                              px: { md: 0.5 }, mx: { md: -0.5 }, py: { md: '1px' },
                              bgcolor: { xs: colorDelActo(e), md: 'transparent' },
                              outline: elegido(e) ? `1px solid ${GRANATE}` : 'none',
                              '&:hover': { bgcolor: { md: 'rgba(35,29,32,0.06)' } },
                              '&.Mui-focusVisible': { outline: `2px solid ${GRANATE}`, outlineOffset: 1 },
                            }}
                          >
                            <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, flex: 'none', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', color: colorDelActo(e), fontVariantNumeric: 'tabular-nums' }}>{hora(e)}</Box>
                            <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: e.cartel ? GRANATE_TINTA : TINTA }}>{e.title}</Box>
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
                        bgcolor: e.cartel ? SOLEMNE : PAPEL,
                        outline: elegido(e) ? `1px solid ${GRANATE}` : 'none', outlineOffset: -1,
                        '&:hover': { bgcolor: e.cartel ? '#e4cfc4' : '#eee8dd' },
                        ...foco,
                      }}
                    >
                      {/* Los números de sus días, cada uno sobre su columna. */}
                      <Box component="span" sx={{ display: 'grid', gridTemplateColumns: `repeat(${t.hasta - t.desde + 1}, minmax(0, 1fr))` }}>
                        {semana.slice(t.desde, t.hasta + 1).map((dia) => (
                          <Box component="span" key={dia.getDate()} sx={{ ...numero, fontWeight: 600, color: e.cartel || dia.getDay() === 0 ? GRANATE : TINTA }}>{dia.getDate()}</Box>
                        ))}
                      </Box>
                      <Box component="span" sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: '2px', textAlign: 'left', minWidth: 0 }}>
                        {grande && (
                          <Box component="span" sx={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', color: colorDelActo(e), fontVariantNumeric: 'tabular-nums' }}>{hora(e)}</Box>
                        )}
                        <Box
                          component="span"
                          sx={{
                            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: grande ? 2 : 1, overflow: 'hidden',
                            ...(e.cartel
                              ? { fontFamily: CORMORANT, fontStyle: 'italic', fontWeight: 500, fontSize: grande ? 20 : 17, lineHeight: 1.05, color: GRANATE_TINTA }
                              : { fontSize: 12.5, fontWeight: 500, lineHeight: 1.25, color: TINTA }),
                          }}
                        >
                          {e.title}
                        </Box>
                      </Box>
                      {/* En el móvil no cabe el nombre: una franja de su color, como los que coinciden. */}
                      <Box component="span" aria-hidden sx={{ display: { xs: 'block', md: 'none' }, mt: 'auto', height: 6, borderRadius: '2px', bgcolor: colorDelActo(e) }} />
                      {esProximo && marcaProximo}
                    </ButtonBase>
                  )
                })}
              </Box>
            )
          })}
        </Box>
      </Box>

      <Box ref={pie} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '2px 24px', pt: 1.25 }}>
        <Box component="ul" aria-label="Leyenda" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: '2px 14px', md: '4px 18px' }, fontSize: { xs: 12, md: 13 }, color: TINTA_SUAVE }}>
          <Box component="li" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" aria-hidden sx={{ width: 14, height: 14, bgcolor: SOLEMNE, border: '1px solid #d9c2b8' }} />
            Culto solemne
          </Box>
          {clases.map((c) => (
            <Box component="li" key={c} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" aria-hidden sx={{ width: 14, height: 2, bgcolor: TIPOS[c].color }} />
              {TIPOS[c].nombre}
            </Box>
          ))}
          <Box component="li" sx={{ display: { xs: 'none', md: 'list-item' }, color: GRIS }}>Pulsa un acto para verlo.</Box>
        </Box>
        {proximo && (
          <ButtonBase
            data-abre-acto
            onClick={() => abrir(proximo)}
            sx={{ fontFamily: 'inherit', fontSize: { xs: 12.5, md: 13.5 }, gap: 1.25, textAlign: 'left', minHeight: 40, color: TINTA, '&:hover .titulo': { textDecoration: 'underline' }, '&.Mui-focusVisible': { outline: `2px solid ${GRANATE}`, outlineOffset: 2 } }}
          >
            <Box component="span" aria-hidden sx={{ flex: 'none', width: 8, height: 8, bgcolor: GRANATE }} />
            <span>
              <Box component="span" sx={{ color: GRANATE, fontWeight: 600 }}>Próximo acto:</Box>{' '}
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

/**
 * El mes al que lleva un botón: entero en pantallas anchas y en tres letras en
 * el móvil, donde va en la misma línea que el mes que se ve.
 */
function MesDeAlLado({ nombre }: { nombre: string }) {
  return (
    <>
      <Box component="span" className="mes" sx={{ display: { xs: 'none', sm: 'inline' } }}>{nombre}</Box>
      <Box component="span" className="mes" sx={{ display: { xs: 'inline', sm: 'none' } }}>{nombre.slice(0, 3)}</Box>
    </>
  )
}

/**
 * La hoja mientras llegan los actos: el mismo papel, los días de la semana y
 * cinco semanas de casillas vacías, con el mes y los números en huesos. Las
 * semanas tienen el alto de siempre en el móvil y uno medio en escritorio (la
 * hoja de verdad lo ajusta a la pantalla).
 */
export function CalendarioDeCultosEsqueleto() {
  return (
    <Box sx={{ bgcolor: PAPEL, borderRadius: '3px', p: { xs: '14px 12px 10px', md: '32px 44px 20px' } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0 24px', mb: { xs: 0.5, md: 2 } }}>
        <Box sx={{ height: { xs: 36, md: 65 }, display: 'flex', alignItems: 'center' }}>
          <Hueso papel sx={{ width: { xs: 150, md: 280 }, height: { xs: 26, md: 46 } }} />
        </Box>
        <Box sx={{ height: 44, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Hueso papel sx={{ width: { xs: 36, sm: 90 }, height: 12 }} />
          <Hueso papel sx={{ width: { xs: 36, sm: 100 }, height: 12 }} />
        </Box>
      </Box>
      <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', height: CABECERA_SEMANA, alignItems: 'center' }}>
        {SEMANA.map((d, i) => (
          <Box key={d} sx={{ px: { xs: '6px', md: '12px' }, color: i === 6 ? GRANATE : GRIS, fontFamily: { xs: 'inherit', md: CORMORANT }, fontStyle: { md: 'italic' }, fontSize: { xs: 11, md: 17 }, letterSpacing: { xs: '0.12em', md: 0 }, textTransform: { xs: 'uppercase', md: 'none' } }}>
            <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>{d}</Box>
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{SEMANA_LARGA[i]}</Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: `1px solid ${RAYA}`, borderLeft: `1px solid ${RAYA}`, '& > *': { borderRight: `1px solid ${RAYA}`, borderBottom: `1px solid ${RAYA}` } }}>
        {Array.from({ length: 35 }, (_, i) => (
          <Box key={i} sx={{ height: { xs: 48, md: 88 }, p: { xs: '4px 6px', md: '8px 12px' } }}>
            <Hueso papel sx={{ width: { xs: 14, md: 22 }, height: { xs: 14, md: 22 } }} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
