import { useEffect, useState, type ReactNode } from 'react'
import { Box, Link as EnlaceMui, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { SERIF } from '../../features/inicio/estilos'
import { anchoMaximo } from './presentacion'
import {
  aHora, cuando, cuantoFalta, diaDelAnio, diasEnPalabras, esVerano, estadoDelDespacho, horaLegible, horasDeFranja,
  momentoEnMadrid, proximaMisa, type EstadoDespacho, type MisaProxima,
} from './horario'
import type { BloqueHorario as Datos } from '../../lib/api/contenido'

/** En el móvil, el teléfono y el correo con 40 px de alto para el dedo; el relleno no mueve la línea. */
const AL_DEDO = { display: 'inline-block', py: { xs: '10px', md: 0 }, my: { xs: '-10px', md: 0 } } as const

/** Cada cuánto se rehace la cuenta: a la vista basta con que el minuto no se quede atrás. */
const CADA = 20_000

const latido = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(222, 199, 43, .55); }
  70% { box-shadow: 0 0 0 10px rgba(222, 199, 43, 0); }
  100% { box-shadow: 0 0 0 0 rgba(222, 199, 43, 0); }
`

/** Versalitas pequeñas: la etiqueta de cada dato. Toma el color del texto, para leerse también sobre papel. */
const versalitas = { display: 'block', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'text.secondary' } as const

/**
 * Horario vivo: arriba, lo que importa ahora mismo —a qué hora es la próxima
 * misa y cuánto falta, y si el despacho está abierto—; debajo, el horario
 * entero como un tablón de avisos de parroquia, con las filas de hoy marcadas y
 * las horas de la temporada que rige.
 *
 * La cuenta es siempre en hora de Málaga, se mire desde donde se mire. Los
 * festivos no se saben: un festivo entre semana cuenta como día de diario.
 */
export default function BloqueHorario({ bloque }: { bloque: Datos }) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(new Date()), CADA)
    return () => window.clearInterval(reloj)
  }, [])

  const hoy = momentoEnMadrid(ahora)
  const verano = esVerano(bloque.verano, hoy.mesDia)
  const misa = proximaMisa(bloque, ahora)
  const despacho = estadoDelDespacho(bloque.despacho, ahora)
  const hayVerano = bloque.verano.desde !== '' && bloque.verano.hasta !== ''

  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, '1000px'), mx: 'auto' }}>
      <Box
        // Se anuncia al cambiar, sin interrumpir: quien usa un lector de pantalla oye la nueva cuenta cuando la busca.
        aria-live="polite"
        sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr', md: despacho ? 'minmax(0, 1.4fr) minmax(0, 1fr)' : '1fr' },
          borderRadius: '4px', overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(222, 199, 43, .07), rgba(222, 199, 43, 0) 55%)',
        }}
      >
        <PanelMisa misa={misa} />
        {despacho && <PanelDespacho estado={despacho} />}
      </Box>

      <Box component="dl" aria-label="Horario completo" sx={{ m: 0, mt: { xs: 4, md: 5 } }}>
        {bloque.misas.map((franja, i) => {
          const horas = horasDeFranja(franja, verano)
          const otras = horasDeFranja(franja, !verano)
          const cambian = hayVerano && otras.join() !== horas.join()
          return (
            <Fila key={`misa-${i}`} etiqueta={franja.etiqueta} hoy={franja.dias.includes(hoy.dia)}>
              {horas.map(horaLegible).join(' · ')}
              {cambian && (
                <Typography component="span" sx={{ display: 'block', fontSize: 13, color: 'text.secondary', fontFamily: 'inherit', mt: 0.25 }}>
                  {verano ? 'Fuera del verano' : 'En verano'}: {otras.map(horaLegible).join(' · ')}
                </Typography>
              )}
            </Fila>
          )
        })}
        {bloque.despacho.map((turno, i) => (
          <Fila key={`despacho-${i}`} etiqueta={i === 0 ? 'Despacho parroquial' : ''} hoy={turno.dias.includes(hoy.dia)}>
            {primeraMayuscula(diasEnPalabras(turno.dias))}, de {horaLegible(turno.desde)} a {horaLegible(turno.hasta)}
          </Fila>
        ))}
        {bloque.lineas.map((linea, i) => (
          <Fila key={`linea-${i}`} etiqueta={linea.etiqueta}><Valor texto={linea.valor} /></Fila>
        ))}
      </Box>

      {hayVerano && (
        <Typography sx={{ mt: 2.5, fontSize: 13.5, color: 'text.secondary' }}>
          {verano ? 'Rige el horario de verano' : 'Horario de verano'}: del {diaDelAnio(bloque.verano.desde)} al {diaDelAnio(bloque.verano.hasta)}.
        </Typography>
      )}
    </Box>
  )
}

function PanelMisa({ misa }: { misa: MisaProxima | null }) {
  return (
    <Box sx={{ p: { xs: 3, md: 4.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
        <Box aria-hidden sx={{
          width: 9, height: 9, borderRadius: '50%', backgroundColor: 'secondary.main', flexShrink: 0,
          animation: misa?.enCurso ? `${latido} 1.8s ease-out infinite` : 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }} />
        <Typography component="span" sx={versalitas}>{misa?.enCurso ? 'Misa ahora mismo' : 'Próxima misa'}</Typography>
      </Box>
      {misa ? (
        <>
          <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 40, md: 56 }, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'text.primary' }}>
            {misa.enCurso
              ? <>Desde las {aHora(misa.minutos)}</>
              : <>{primeraMayuscula(cuando(misa.enDias, misa.dia))}, {aHora(misa.minutos)}</>}
          </Typography>
          <Typography sx={{ mt: 1.25, color: 'secondary.main', fontSize: 15, fontWeight: 600, minHeight: '1.5em' }}>
            {misa.enCurso ? 'Se está celebrando: aún llegas' : cuantoFalta(misa.faltan)}
          </Typography>
        </>
      ) : (
        <Typography sx={{ color: 'text.secondary' }}>Consulta el horario de abajo.</Typography>
      )}
    </Box>
  )
}

function PanelDespacho({ estado }: { estado: EstadoDespacho }) {
  return (
    <Box sx={{
      // Anchos por pantalla y color aparte: con `borderLeft: { md: '1px solid' }` el
      // color de la regla de pantalla ganaba al de `borderColor` y la línea salía blanca.
      p: { xs: 3, md: 4.5 }, borderStyle: 'solid', borderColor: 'divider', borderWidth: 0,
      borderTopWidth: { xs: 1, md: 0 }, borderLeftWidth: { xs: 0, md: 1 },
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <Typography component="span" sx={{ ...versalitas, mb: 1.5 }}>Despacho parroquial</Typography>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, lineHeight: 1.2, color: 'text.primary' }}>
        {estado.abierto ? 'Abierto ahora' : 'Cerrado ahora'}
      </Typography>
      <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 15 }}>
        {estado.abierto
          ? `Hasta las ${aHora(estado.hasta)}`
          : `Abre ${cuando(estado.enDias, estado.dia)} a las ${aHora(estado.desde)}`}
      </Typography>
    </Box>
  )
}

/**
 * Una fila del tablón: la etiqueta, una línea de puntos que lleva la vista y
 * el valor. Las filas que tocan hoy llevan la marca «hoy».
 */
function Fila({ etiqueta, hoy = false, children }: { etiqueta: string; hoy?: boolean; children: ReactNode }) {
  return (
    <Box sx={{
      display: 'grid', alignItems: 'baseline',
      gridTemplateColumns: { xs: '1fr', sm: 'auto minmax(24px, 1fr) auto' }, columnGap: 1.5,
      py: 1.75, borderTop: '1px solid', borderColor: 'divider',
    }}>
      <Typography component="dt" sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: hoy ? 'text.primary' : 'text.secondary' }}>
        {etiqueta}
        {hoy && (
          <Box component="span" sx={{
            display: 'inline-block', ml: 1.25, px: 0.9, borderRadius: 999, border: '1px solid', borderColor: 'secondary.main',
            color: 'secondary.main', fontSize: 11, lineHeight: '18px', letterSpacing: '0.18em', verticalAlign: 'middle',
          }}>
            hoy
          </Box>
        )}
      </Typography>
      <Box aria-hidden sx={{ display: { xs: 'none', sm: 'block' }, borderBottom: '1px dotted', borderColor: 'text.disabled', transform: 'translateY(-4px)' }} />
      <Typography component="dd" sx={{ m: 0, fontFamily: SERIF, fontSize: { xs: 19, md: 21 }, color: 'text.primary', textAlign: { sm: 'right' } }}>
        {children}
      </Typography>
    </Box>
  )
}

/** Un teléfono se puede pulsar para llamar, y un correo para escribir. */
function Valor({ texto }: { texto: string }) {
  const limpio = texto.trim()
  if (/^\+?[\d\s]{9,}$/.test(limpio)) {
    return <EnlaceMui href={`tel:${limpio.replace(/\s/g, '')}`} color="inherit" underline="hover" sx={AL_DEDO}>{limpio}</EnlaceMui>
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
    return <EnlaceMui href={`mailto:${limpio}`} color="inherit" underline="hover" sx={{ ...AL_DEDO, wordBreak: 'break-all' }}>{limpio}</EnlaceMui>
  }
  return <>{limpio}</>
}

const primeraMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)
