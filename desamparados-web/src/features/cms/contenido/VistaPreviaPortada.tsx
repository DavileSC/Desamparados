import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import MarcoVistaPrevia from './MarcoVistaPrevia'
import { BorradorPortadaContext } from '../../inicio/useContenidoPortada'
import type { Portada } from '../../../lib/api/portada'
import '../../inicio/home.css'

/**
 * Cómo queda un bloque de la portada con lo que se está escribiendo, antes de
 * guardar: el bloque REAL de la página de inicio, dentro del marco común de
 * las vistas previas, con el borrador en lugar de lo guardado.
 */
export default function VistaPreviaPortada({ portada, children }: { portada: Portada; children: ReactNode }) {
  return (
    <MarcoVistaPrevia testId="vista-previa-portada">
      <BorradorPortadaContext.Provider value={portada}>
        <Box className="home-refined">{children}</Box>
      </BorradorPortadaContext.Provider>
    </MarcoVistaPrevia>
  )
}
