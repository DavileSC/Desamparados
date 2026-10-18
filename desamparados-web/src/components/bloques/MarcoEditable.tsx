import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { useModoEdicion } from './modoEdicion'
import { fechaCorta, libreDe, visibilidadDe } from './presentacion'
import type { Bloque } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

/** Lo que dice la etiqueta de un bloque que hoy no se ve. */
function avisoDe(bloque: Bloque): string | null {
  switch (visibilidadDe(bloque)) {
    case 'oculto': return 'Oculto'
    case 'antes': return `Se verá desde el ${fechaCorta(libreDe(bloque, 'desde'))}`
    case 'despues': return `Dejó de verse el ${fechaCorta(libreDe(bloque, 'hasta'))}`
    default: return null
  }
}

/**
 * Lo que rodea a cada bloque de una página: decide si hoy se ve y, dentro del
 * constructor del CMS, lo hace pulsable.
 *
 * - En la web, un bloque oculto o fuera de sus fechas no se pinta.
 * - En la vista en vivo del CMS sí se pinta, atenuado y con una etiqueta que
 *   dice por qué no lo ve nadie; el bloque abierto en el editor lleva un marco
 *   dorado, y pulsar cualquiera lo abre en el editor.
 *
 * La posición (`indice`) es la del bloque en el documento, no en lo que se
 * pinta: es con lo que el editor lo encuentra.
 *
 * También se llega con el teclado: el tabulador pasa por cada bloque y con
 * Intro o espacio se abre, igual que pulsándolo.
 */
export default function MarcoEditable({ bloque, indice, children }: { bloque: Bloque; indice: number; children: ReactNode }) {
  const modo = useModoEdicion()
  const aviso = avisoDe(bloque)

  if (!modo) return aviso ? null : <>{children}</>

  const seleccionado = modo.seleccionado === indice
  return (
    <Box
      data-bloque={indice}
      role="button"
      tabIndex={0}
      aria-label={`Bloque ${indice + 1}${aviso ? ` (${aviso.toLowerCase()})` : ''}: abrirlo en el editor`}
      aria-pressed={seleccionado}
      onClick={() => modo.alPulsar(indice)}
      onKeyDown={(e) => {
        // Solo sobre el marco: Intro en un enlace o un botón de dentro es suyo.
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        modo.alPulsar(indice)
      }}
      sx={{
        position: 'relative',
        cursor: 'pointer',
        scrollMarginTop: 80,
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: -8,
          borderRadius: '10px',
          border: '2px solid',
          borderColor: seleccionado ? MARCA.acento : 'transparent',
          boxShadow: seleccionado ? `0 0 0 4px ${alfa(MARCA.acento, 0.18)}` : 'none',
          pointerEvents: 'none',
          transition: 'border-color .15s ease',
          zIndex: 5,
        },
        '&:hover::after': { borderColor: seleccionado ? MARCA.acento : alfa(MARCA.acento, 0.45) },
        outline: 'none',
        '&:focus-visible::after': { borderColor: MARCA.acento, boxShadow: `0 0 0 4px ${alfa(MARCA.acento, 0.35)}` },
      }}
    >
      <Box sx={{ opacity: aviso ? 0.45 : 1 }}>{children}</Box>
      {aviso && (
        <Box
          component="span"
          sx={{
            position: 'absolute', top: -4, left: -4, zIndex: 6,
            px: 1.25, py: 0.5, borderRadius: '6px',
            backgroundColor: '#0c0b0d', color: '#e3d8bf', border: `1px solid ${alfa(MARCA.acento, 0.5)}`,
            fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
          }}
        >
          {aviso}
        </Box>
      )}
    </Box>
  )
}
