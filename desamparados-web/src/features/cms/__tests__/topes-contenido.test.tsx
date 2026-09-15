import type { ReactNode } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import TOPES from '../../../../../shared/topes-contenido.json'
import PortadaAdminPage from '../PortadaAdminPage'
import RecorridoAdminPage from '../RecorridoAdminPage'

/**
 * Los topes de longitud del servidor (`schemas/contenido.schema.ts`, que los lee
 * de `shared/topes-contenido.json`) están copiados a mano en una treintena de
 * `maxLength` repartidos por las dos pantallas del CMS. Son lo único que avisa
 * mientras se escribe: si el servidor baja un tope y las pantallas no se
 * enteran, el editor escribe tan tranquilo hasta que le sale un 400 al guardar.
 *
 * Esto no empareja campo por campo —eso exigiría repetir el mapa entero y sería
 * la misma copia a mano con otro nombre—: comprueba que **ningún** `maxlength`
 * pintado es un número que el servidor ya no reconozca. El día que `parrafo`
 * baje a 400, los `maxlength` de 600 dejarán de pertenecer al conjunto y esto se
 * pondrá rojo.
 */

const respuesta = (cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

function montarLasDosPantallas() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: unknown) => Promise.resolve(
    String(url).includes('/contenido/recorrido')
      ? respuesta(POR_DEFECTO.recorrido)
      : respuesta({ imagenes: [{ id: 1, url: '/storage/public/una.webp', descripcion: 'Una', orden: 0 }], textos: POR_DEFECTO.portada }),
  )))

  // PantallaEdicion usa useBlocker, que exige un data router: uno por pantalla.
  const rutaDe = (elemento: ReactNode, ruta: string) =>
    createMemoryRouter([{ path: ruta, element: elemento }], { initialEntries: [ruta] })

  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={crearTemaCms('claro')}>
          <RouterProvider router={rutaDe(<PortadaAdminPage />, '/cms/portada')} />
          <RouterProvider router={rutaDe(<RecorridoAdminPage />, '/cms/recorrido')} />
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('topes de longitud del CMS', () => {
  it('todo maxlength que pintan las pantallas es un tope que el servidor conoce', async () => {
    montarLasDosPantallas()
    // Las dos pantallas cargadas: las secciones plegadas siguen montadas (el
    // acordeón de MUI no desmonta lo que oculta), así que se cuentan todas.
    await screen.findByDisplayValue('Desamparados Málaga')
    await screen.findByDisplayValue('Plaza de la Marina')

    const pintados = [...document.querySelectorAll('[maxlength]')]
      .map((campo) => Number(campo.getAttribute('maxlength')))

    // Si un cambio de estructura dejara las pantallas sin campos, la aserción de
    // abajo se cumpliría sola sin comprobar nada.
    expect(pintados.length).toBeGreaterThan(30)

    const delServidor = new Set<number>(Object.values(TOPES))
    expect([...new Set(pintados)].filter((tope) => !delServidor.has(tope)).sort((a, b) => a - b)).toEqual([])
  })
})
