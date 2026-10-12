import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import Hueso from '../../components/esqueleto/Hueso'
import { useTrasUnMomento } from '../../components/esqueleto/EnCarga'
import { usePortadaEnCarga } from './useContenidoPortada'

interface Props {
  children: ReactNode
  /**
   * Una línea de hueso por elemento, cada una de ese ancho. En `em` o `ch` y
   * no en %: muchos de estos textos van en cajas que se ajustan a lo que
   * llevan dentro (un botón, una columna alineada a la derecha), y ahí un
   * porcentaje no mide nada. Se acota con `min(…, 85vw)` para el móvil.
   */
  anchos?: string[]
}

/**
 * Un texto de la portada, o su hueso mientras el documento no ha llegado.
 *
 * El hueso va dentro del mismo `Typography` que pintará el texto, así que
 * hereda su tamaño de letra y su alto de línea: la forma es la del bloque de
 * verdad y al llegar los textos no se mueve nada. Como `EnCarga`, los primeros
 * 300 ms reserva el hueco sin enseñarlo, para que una API rápida no parpadee.
 *
 * Antes se pintaban los textos de partida mientras cargaba. Desde que son
 * neutros (Fase 8), eso era enseñar en cada visita unos textos que no son los
 * de esta corporación y que cambiaban de golpe al llegar los suyos.
 */
export default function TextoDePortada({ children, anchos = ['8em'] }: Props) {
  const enCarga = usePortadaEnCarga()
  const visible = useTrasUnMomento(enCarga)
  if (!enCarga) return <>{children}</>
  return (
    <Box component="span" aria-hidden="true" data-esqueleto-portada="" sx={{ display: 'block', visibility: visible ? 'visible' : 'hidden' }}>
      {anchos.map((ancho, i) => (
        // `1lh` es el alto de línea del texto que vendrá; `minHeight`, por si el navegador no lo conoce.
        <Box key={i} component="span" sx={{ display: 'flex', alignItems: 'center', height: '1lh', minHeight: '1.2em' }}>
          <Hueso sx={{ width: `min(${ancho}, 85vw)`, height: '0.6em' }} />
        </Box>
      ))}
    </Box>
  )
}
