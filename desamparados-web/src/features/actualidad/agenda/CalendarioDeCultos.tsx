import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, ButtonBase, ClickAwayListener, Dialog, Popper, Typography, useMediaQuery } from '@mui/material'
import { keyframes, useTheme } from '@mui/material/styles'
import { useReducedMotion } from 'framer-motion'
import type { ApiEvent } from '../../../lib/api/agenda'
import { GOLD, GRANATE, SERIF } from '../../inicio/estilos'
import { TIPOS, diasDeLaRejilla, inicioDeMes, inicioDelDia, nombreDelMes, sumarMeses } from '../../inicio/agenda'
import { caeEnElDia, claveDelDia, cuandoEnCartel, fotoDelCartel, primerDiaEnElMes, ultimoMes } from './cultos'
import VentanaDelActo from './VentanaDelActo'

const NOCHE = '#161316'
const ORO_BORDE = 'rgba(222,199,43,0.4)'
const FILETE = 'rgba(222,199,43,0.18)'
const ORO_SUAVE = '#c9b25a'
const ROJO = '#e0705c'
/** El burdeos de la casa aclarado para el fondo oscuro, el mismo que usa el CMS. */
const BURDEOS_CLARO = TIPOS.CULTO.oscuro
const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

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
 * en oro macizo; los cultos solemnes en granate, y el primero con su foto.
 *
 * Al pulsar un día se abre el acto en una ventana que crece desde la casilla:
 * pegada a ella en escritorio y centrada en el móvil. El próximo acto lleva una
 * luz burdeos que recorre su borde, y la leyenda de debajo dice qué significa.
 * Al cambiar de mes, el nombre entra letra a letra y los días caen en cascada.
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

  // La ventana se ancla a la casilla del acto, que puede estar en un mes recién pintado.
  useLayoutEffect(() => {
    const dia = evento && primerDiaEnElMes(evento, mes)
    setAncla(dia ? rejilla.current?.querySelector<HTMLElement>(`[data-dia="${claveDelDia(dia)}"]`) ?? null : null)
  }, [evento, mes])

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
    <Box sx={{ bgcolor: NOCHE, border: `1px solid ${ORO_BORDE}`, p: { xs: '16px 12px', md: '28px 32px' }, color: '#f4f1ee' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 2 }}>
        <Typography
          component="h3"
          aria-live="polite"
          aria-label={`${nombre} ${mes.getFullYear()}`}
          sx={{ flex: 1, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 200, fontSize: { xs: 30, md: 40 }, lineHeight: 1, color: GOLD }}
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

      <Box
        key={claveDelDia(mes)}
        ref={rejilla}
        sx={{
          display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          borderTop: `1px solid ${ORO_BORDE}`, borderLeft: `1px solid ${FILETE}`,
          '& > *': {
            borderRight: `1px solid ${FILETE}`, borderBottom: `1px solid ${FILETE}`,
            ...(animar && !quieto && { animation: `${cae} .6s cubic-bezier(.2,.8,.2,1) both` }),
          },
        }}
      >
        {SEMANA.map((d, i) => (
          <Box key={d} aria-hidden sx={{ textAlign: 'center', py: 0.75, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORO_SUAVE, animationDelay: `${i * 28}ms` }}>{d}</Box>
        ))}
        {diasDeLaRejilla(mes).map((dia, i) => {
          const clave = claveDelDia(dia)
          const retraso = { animationDelay: `${((i % 7) + Math.floor(i / 7) + 1) * 28}ms` }
          if (dia.getMonth() !== mes.getMonth()) return <Box key={clave} sx={retraso} />

          const actos = eventos.filter((e) => caeEnElDia(e, dia))
          const empiezan = actos.filter((e) => claveDelDia(primerDia(e)!) === clave)
          const principal = empiezan[0] ?? null
          const domingo = dia.getDay() === 0
          const numero = {
            display: 'block', fontSize: { xs: 20, md: 40 }, fontWeight: { xs: 700, md: 800 }, lineHeight: 1.1,
            color: 'transparent', WebkitTextStroke: `0.8px ${domingo ? ROJO : 'rgba(222,199,43,0.35)'}`,
          } as const
          const casilla = {
            position: 'relative', display: 'block', minWidth: 0, minHeight: { xs: 50, md: 110 }, p: { xs: '4px 6px', md: '8px 10px' },
            textAlign: 'left', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', ...retraso,
            // Al seguir a la ventana de un día, que la barra fija de la web no lo tape.
            scrollMarginBlock: '96px 240px',
          } as const

          if (!actos.length) {
            return <Box key={clave} sx={casilla}><Box component="span" sx={numero}>{dia.getDate()}</Box></Box>
          }

          const solemne = actos.some((e) => e.cartel)
          const conFoto = principal?.cartel ? fotoDelCartel(principal).src : null
          const esProximo = !!proximo && primerDia(proximo) !== null && claveDelDia(primerDia(proximo)!) === clave
          return (
            <ButtonBase
              key={clave}
              data-dia={clave}
              data-abre-acto
              onClick={() => { const e = principal ?? actos[0]; if (abierto === e.id) cerrar(); else setAbierto(e.id) }}
              aria-haspopup="dialog"
              aria-label={`${dia.getDate()} de ${nombre.toLowerCase()}: ${actos.map((e) => e.title).join(', ')}${esProximo ? '. Próximo acto' : ''}`}
              sx={{
                ...casilla, fontFamily: 'inherit', alignItems: 'flex-start', justifyContent: 'flex-start',
                bgcolor: solemne ? 'rgba(110,24,34,0.55)' : 'transparent',
                ...(conFoto && {
                  backgroundImage: `linear-gradient(rgba(110,24,34,0.5), rgba(18,15,17,0.88)), url("${conFoto}")`,
                  backgroundSize: 'cover', backgroundPosition: 'center 25%',
                }),
                boxShadow: actos.some((e) => e.id === abierto) ? `inset 0 0 0 1px ${GOLD}` : 'none',
                '&:hover': { bgcolor: solemne ? 'rgba(110,24,34,0.8)' : 'rgba(222,199,43,0.08)' },
                '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: -2 },
              }}
            >
              <Box component="span" sx={{ ...numero, color: solemne ? '#fff' : GOLD, WebkitTextStroke: 0 }}>{dia.getDate()}</Box>
              {principal && (
                <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, mt: 0.75, fontSize: 12.5, fontWeight: 500, lineHeight: 1.25, color: '#f4f1ee' }}>
                  {principal.title}
                  {empiezan.length > 1 && <Box component="span" sx={{ color: GOLD }}> y {empiezan.length - 1} más</Box>}
                </Box>
              )}
              {esProximo && (
                <>
                  <Anillo quieto={quieto} />
                  <Box component="span" aria-hidden sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 10, right: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: BURDEOS_CLARO }}>
                    Próximo
                  </Box>
                </>
              )}
            </ButtonBase>
          )
        })}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px 24px', mt: 1.75 }}>
        <Typography sx={{ fontSize: 13, color: 'rgba(244,241,238,0.62)' }}>Pulsa un día en oro para ver el acto.</Typography>
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
