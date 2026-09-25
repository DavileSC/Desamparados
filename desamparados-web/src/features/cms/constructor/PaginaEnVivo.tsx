import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'
import { BorradorPaginaContext } from '../../../components/bloques/borrador'
import { ModoEdicionContext } from '../../../components/bloques/modoEdicion'
import { esMensaje, type Mensaje } from './mensajes'
import type { PaginaDeBloques, SlugContenido } from '../../../lib/api/contenido'

// Historia tiene maquetación propia; se carga solo si es la que se edita.
const HistoriaPage = lazy(() => import('../../corporacion/historia/HistoriaPage'))

/**
 * La página que se pinta DENTRO de la vista en vivo del constructor (en su
 * iframe). Es la página pública de verdad, con el documento que se está
 * escribiendo en vez de lo guardado, y en modo edición: los bloques ocultos se
 * ven con su aviso, el abierto va marcado y pulsar uno lo abre en el editor.
 *
 * Ningún enlace lleva a ninguna parte ni se envía ningún formulario: esto es
 * para mirar y elegir, y un clic que navegara sacaría la vista de la página.
 */
export default function PaginaEnVivo() {
  const { slug = '' } = useParams()
  const [documento, setDocumento] = useState<PaginaDeBloques | null>(null)
  const [seleccionado, setSeleccionado] = useState<number | null>(null)

  useEffect(() => {
    const padre = window.parent
    if (padre === window) return
    const oir = (evento: MessageEvent) => {
      if (evento.origin !== window.location.origin || evento.source !== padre || !esMensaje(evento.data)) return
      if (evento.data.tipo === 'desamparados:borrador') {
        setDocumento(evento.data.documento)
        setSeleccionado(evento.data.seleccionado)
      }
    }
    window.addEventListener('message', oir)
    const lista: Mensaje = { tipo: 'desamparados:lista' }
    padre.postMessage(lista, window.location.origin)
    return () => window.removeEventListener('message', oir)
  }, [])

  // Nada navega ni se envía dentro de la vista.
  useEffect(() => {
    const frenarEnlace = (evento: MouseEvent) => {
      if ((evento.target as Element | null)?.closest?.('a[href]')) evento.preventDefault()
    }
    const frenarEnvio = (evento: Event) => evento.preventDefault()
    document.addEventListener('click', frenarEnlace, true)
    document.addEventListener('submit', frenarEnvio, true)
    return () => {
      document.removeEventListener('click', frenarEnlace, true)
      document.removeEventListener('submit', frenarEnvio, true)
    }
  }, [])

  // Al abrir un bloque en el editor, la vista baja hasta él.
  useEffect(() => {
    if (seleccionado === null) return
    // Con `scrollTo` de esta ventana y no con `scrollIntoView`: ese desplaza
    // también la página de fuera (el constructor), y el editor saltaba.
    const marco = requestAnimationFrame(() => {
      const bloque = document.querySelector(`[data-bloque="${seleccionado}"]`)
      if (!bloque) return
      const caja = bloque.getBoundingClientRect()
      const destino = window.scrollY + caja.top - Math.max(80, (window.innerHeight - caja.height) / 2)
      window.scrollTo?.({ top: Math.max(0, destino), behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(marco)
  }, [seleccionado])

  const modo = useMemo(() => ({
    seleccionado,
    alPulsar: (indice: number) => {
      const pulsado: Mensaje = { tipo: 'desamparados:pulsado', indice }
      window.parent.postMessage(pulsado, window.location.origin)
    },
  }), [seleccionado])

  if (!documento) return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><CircularProgress aria-label="Cargando la vista" /></Box>

  return (
    <>
      <Helmet><meta name="robots" content="noindex" /></Helmet>
      <ModoEdicionContext.Provider value={modo}>
        <BorradorPaginaContext.Provider value={documento}>
          <Suspense fallback={<CircularProgress sx={{ m: 4 }} aria-label="Cargando la vista" />}>
            {slug === 'historia' ? <HistoriaPage /> : <PaginaDeBloquesPublica slug={slug as SlugContenido} />}
          </Suspense>
        </BorradorPaginaContext.Provider>
      </ModoEdicionContext.Provider>
    </>
  )
}
