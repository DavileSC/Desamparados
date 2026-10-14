import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useModulos } from '../../../hooks/useModulos'
import { activarAvisos, misMovilesDeAvisos, quitarMovilDeAvisos } from '../../../lib/api/avisos'
import { admiteAvisos, darDeBajaEsteNavegador, enPantallaDeInicio, esIphone, nombreDelDispositivo, suscribirEsteNavegador } from '../../../lib/avisosDelNavegador'

/**
 * El estado de los avisos al móvil del área y cómo activarlos o quitarlos. Lo
 * comparten la tarjeta de «Cuenta» y la pregunta al entrar en «Mi perfil».
 */

const CLAVE = ['moviles-de-avisos']
/** El número de este móvil en la lista: el servidor no sabe qué navegador pregunta. */
const ESTE_MOVIL = 'avisos-area:este-movil'
/** Ya se preguntó en este navegador al entrar en «Mi perfil»: no se vuelve a preguntar. */
export const PREGUNTADO = 'avisos-area:preguntado'

export function leer(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
export function escribir(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento (ventana privada) se vuelve a preguntar: no pasa nada.
  }
}

/** Qué se puede hacer en este navegador. */
export type Posible = 'si' | 'pantalla-de-inicio' | 'no'
function queSePuede(): Posible {
  if (esIphone() && !enPantallaDeInicio()) return 'pantalla-de-inicio'
  return admiteAvisos() ? 'si' : 'no'
}

export function useAvisosDelArea() {
  const { activo: moduloActivo } = useModulos()
  const encendido = moduloActivo('avisos-a-los-hermanos')
  const queryClient = useQueryClient()
  const consulta = useQuery({ queryKey: CLAVE, queryFn: misMovilesDeAvisos, enabled: encendido })
  const [esteId, setEsteId] = useState(() => Number(leer(ESTE_MOVIL)) || null)

  const moviles = consulta.data?.moviles ?? []
  const esteMovil = moviles.find((m) => m.id === esteId) ?? null

  const activar = useMutation({
    mutationFn: async () => {
      const clave = consulta.data?.clavePublica
      if (!clave) throw new Error('Los avisos no están disponibles ahora mismo.')
      const suscripcion = await suscribirEsteNavegador(clave, '/area-hermano/')
      return activarAvisos(nombreDelDispositivo(), suscripcion.toJSON())
    },
    onSuccess: (movil) => {
      escribir(ESTE_MOVIL, String(movil.id))
      escribir(PREGUNTADO, 'si')
      setEsteId(movil.id)
      void queryClient.invalidateQueries({ queryKey: CLAVE })
    },
  })

  const quitar = useMutation({
    mutationFn: async (id: number) => {
      await quitarMovilDeAvisos(id)
      if (id === esteId) await darDeBajaEsteNavegador('/area-hermano/')
    },
    onSuccess: (_r, id) => {
      if (id === esteId) {
        escribir(ESTE_MOVIL, null)
        setEsteId(null)
      }
      void queryClient.invalidateQueries({ queryKey: CLAVE })
    },
  })

  return {
    disponible: encendido && consulta.data?.disponible === true,
    cargado: consulta.isSuccess,
    esteMovil,
    otros: moviles.filter((m) => m.id !== esteId),
    posible: queSePuede(),
    activar,
    quitar,
  }
}
