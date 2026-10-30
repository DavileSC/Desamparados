import { useId, useState, type MouseEvent } from 'react'
import { Box, ButtonBase, Drawer, Popover, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CheckIcon from '@mui/icons-material/Check'
import { useReducedMotion } from 'framer-motion'
import type { ApiProfile } from '../../../lib/api/perfil'
import { MARCA, alfa } from '../../../theme/marca'
import { nombreDeFicha } from './fichasDeLaCuenta'
import { PARENTESCO } from './etiquetas'

interface Props {
  fichas: ApiProfile[]
  elegida: number | null
  onElegir: (id: number) => void
  /** «cajon»: en el menú lateral, encima de la contraseña. «barra»: en la barra del móvil, donde el menú no se ve. */
  variante: 'cajon' | 'barra'
}

const ORO = MARCA.acento
const RAYA = 'rgba(204, 196, 201, 0.2)'
const HOJA = '#1c1a1d'

/** «AP»: la inicial del nombre y la del primer apellido, para reconocer cada ficha de un vistazo. */
const inicialesDe = (f: ApiProfile) => {
  const apellido = (f.primerApellido ?? f.apellidos).trim()
  return `${f.nombre.trim().charAt(0)}${apellido.charAt(0)}`.toUpperCase()
}

/** Quién es en la cuenta: el titular, o su parentesco con él. Sin parentesco guardado, nada. */
const quienEs = (f: ApiProfile) => (f.esTitular ? 'Titular de la cuenta' : f.parentesco ? PARENTESCO[f.parentesco] : '')

function Inicial({ ficha, elegida = false, tamano = 36 }: { ficha: ApiProfile; elegida?: boolean; tamano?: number }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        flex: 'none', width: tamano, height: tamano, borderRadius: '50%', display: 'grid', placeItems: 'center',
        fontSize: tamano * 0.38, fontWeight: 600, letterSpacing: '0.02em',
        ...(elegida ? { border: `1.5px solid ${ORO}`, color: ORO } : { backgroundColor: '#2c282d', color: 'text.primary' }),
      }}
    >
      {inicialesDe(ficha)}
    </Box>
  )
}

/**
 * La ficha que estás viendo, en el menú del área (16-10-2026): así se sabe con
 * quién está uno en «Mi perfil» desde cualquier pantalla. Procesión y Recibos
 * siguen siendo de toda la familia: elegir aquí lleva a «Mi perfil» con esa ficha.
 * Con una sola ficha no hay nada que elegir, pero se dice igual de quién es.
 *
 * Desde el 30-10-2026, una tarjeta que abre la familia entera en un panel al
 * lado del menú (en el móvil, una hoja desde abajo): con el desplegable de
 * antes, seis fichas tapaban medio menú, los nombres largos se cortaban y no se
 * sabía quién era quién.
 */
export default function SelectorDeFicha({ fichas, elegida, onElegir, variante }: Props) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null)
  const reducir = useReducedMotion()
  // En el móvil el menú lateral es un cajón de 260 px: un panel a su lado no cabe, y la lista sube en una hoja, como desde la barra.
  const enHoja = useMediaQuery(useTheme().breakpoints.down('md'))
  const idPanel = useId()
  const idTitulo = useId()
  const actual = fichas.find((f) => f.id === elegida) ?? fichas[0]
  if (!actual) return null
  const varias = fichas.length > 1
  const abierto = ancla !== null
  const elegir = (id: number) => { setAncla(null); onElegir(id) }
  const duracion = reducir ? 0 : undefined

  const boton = {
    'aria-label': `Ficha que estás viendo: ${nombreDeFicha(actual)}. Cambiar de ficha, ${fichas.indexOf(actual) + 1} de ${fichas.length}`,
    'aria-haspopup': 'dialog',
    'aria-expanded': abierto,
    'aria-controls': abierto ? idPanel : undefined,
    onClick: (e: MouseEvent<HTMLElement>) => setAncla(e.currentTarget),
  } as const

  const lista = (
    <>
      <Typography id={idTitulo} component="h2" sx={{ mx: 1, mb: 1.25, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: 'text.secondary' }}>
        Fichas de la cuenta
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.25 }}>
        {fichas.map((f) => {
          const esta = f.id === actual.id
          const quien = quienEs(f)
          return (
            <li key={f.id}>
              <ButtonBase
                onClick={() => elegir(f.id)}
                aria-current={esta ? 'true' : undefined}
                sx={{
                  width: '100%', justifyContent: 'flex-start', textAlign: 'left', gap: 1.5, px: 1, py: { xs: 1.25, md: 1 }, borderRadius: 2,
                  backgroundColor: esta ? alfa(ORO, 0.08) : 'transparent',
                  '&:hover': { backgroundColor: esta ? alfa(ORO, 0.12) : 'rgba(255,255,255,0.05)' },
                  '&.Mui-focusVisible': { outline: `2px solid ${ORO}`, outlineOffset: -2 },
                }}
              >
                <Inicial ficha={f} elegida={esta} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* El nombre entero, sin cortar: aquí hay sitio, y es lo que distingue a dos hermanos. */}
                  <Typography sx={{ fontSize: 15, fontWeight: 500, lineHeight: 1.25 }}>
                    {[f.nombre, f.apellidos].map((t) => t.trim()).join(' ')}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>
                    {[f.numeroHermano ? `n.º ${f.numeroHermano}` : 'sin número', quien].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                {esta && <CheckIcon aria-hidden sx={{ fontSize: 18, color: ORO }} />}
              </ButtonBase>
            </li>
          )
        })}
      </Box>
    </>
  )

  const hoja = (
    <Drawer
      id={idPanel}
      anchor="bottom"
      open={abierto}
      onClose={() => setAncla(null)}
      transitionDuration={duracion}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-labelledby': idTitulo,
          sx: { maxHeight: '80svh', borderRadius: '18px 18px 0 0', bgcolor: HOJA, backgroundImage: 'none', px: 1.5, pt: 1.25, pb: 2.5 },
        },
      }}
    >
      <Box aria-hidden="true" sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,.25)', mx: 'auto', mb: 1.75 }} />
      {lista}
    </Drawer>
  )

  if (variante === 'cajon') {
    const contenido = (
      <>
        <Inicial ficha={actual} elegida />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nombreDeFicha(actual)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            {varias ? `${fichas.indexOf(actual) + 1} de ${fichas.length} · Cambiar de ficha` : 'Ficha que estás viendo'}
          </Typography>
        </Box>
      </>
    )
    const tarjeta = { display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', px: 1.5, py: 1.25, border: `1px solid ${RAYA}`, borderRadius: 2.5, textAlign: 'left' } as const
    if (!varias) return <Box sx={tarjeta}>{contenido}</Box>
    return (
      <>
        <ButtonBase
          {...boton}
          sx={{
            ...tarjeta, justifyContent: 'flex-start',
            borderColor: abierto ? ORO : RAYA, transition: reducir ? 'none' : 'border-color .2s',
            '&:hover': { borderColor: alfa(ORO, 0.6) },
            '&.Mui-focusVisible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
          }}
        >
          {contenido}
          <ChevronRightIcon aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
        </ButtonBase>
        {/* Al lado del menú y apoyado en su pie: sube hacia arriba, no tapa la tarjeta. */}
        {enHoja ? hoja : (
          <Popover
            id={idPanel}
            open={abierto}
            anchorEl={ancla}
            onClose={() => setAncla(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transitionDuration={duracion}
            slotProps={{
              paper: {
                role: 'dialog',
                'aria-labelledby': idTitulo,
                sx: { ml: 2, width: 320, maxHeight: 'calc(100vh - 32px)', p: '14px 10px 10px', bgcolor: HOJA, backgroundImage: 'none', border: '1px solid #3a363b', borderRadius: 3, boxShadow: '0 16px 40px rgba(0,0,0,.6)' },
              },
            }}
          >
            {lista}
          </Popover>
        )}
      </>
    )
  }

  // En la barra ocupa el sitio del título: tiene que caber en un móvil de 360 junto al botón del menú.
  const texto = { fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } as const
  if (!varias) return <Typography sx={texto}>{nombreDeFicha(actual)}</Typography>
  return (
    <>
      <ButtonBase
        {...boton}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, pl: 0.5, pr: 0.75, py: 0.5, ml: -1,
          border: `1px solid ${RAYA}`, borderRadius: 999, color: 'inherit',
          '&.Mui-focusVisible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
        }}
      >
        <Inicial ficha={actual} elegida tamano={28} />
        <Box component="span" sx={texto}>{nombreDeFicha(actual)}</Box>
        <ArrowDropDownIcon aria-hidden sx={{ flex: 'none' }} />
      </ButtonBase>
      {hoja}
    </>
  )
}
