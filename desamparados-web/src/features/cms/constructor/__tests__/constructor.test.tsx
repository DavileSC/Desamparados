import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../../theme/cms'
import PaginaAdminPage from '../../PaginaAdminPage'
import { crearQueryClientDePruebas } from '../../../../test/queryClient'

const contenido = {
  cabecera: { titulo: 'Nuestros fines', subtitulo: 'Caridad y formación.', foto: '', fotoAlt: '' },
  bloques: [
    { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' },
    { tipo: 'tarjetas', titulo: 'Explora', tarjetas: [{ titulo: 'Caridad', descripcion: '', enlace: '' }] },
  ],
}

const version = {
  cabecera: { titulo: 'Nuestros fines de antes', subtitulo: '', foto: '', fotoAlt: '' },
  bloques: [{ tipo: 'cita', titulo: '', texto: 'Lo de antes', autor: '', fuente: '' }],
}

afterEach(() => { vi.unstubAllGlobals() })

type Llamada = { url: string; metodo: string; cuerpo: unknown }

/** El servidor de mentira: cada ruta que toca el constructor, con lo que devolvería. */
function montar() {
  const llamadas: Llamada[] = []
  const json = (datos: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET'
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : null
    llamadas.push({ url, metodo, cuerpo })
    if (url.endsWith('/contenido/nuestros-fines/versiones')) {
      return json([
        { id: 8, fecha: '2026-09-25T10:00:00Z', autor: 'Ana Pérez', actual: true, titulo: 'Nuestros fines', bloques: 2 },
        { id: 7, fecha: '2026-09-20T10:00:00Z', autor: 'Luis Ruiz', actual: false, titulo: 'Nuestros fines de antes', bloques: 1 },
      ])
    }
    if (url.endsWith('/contenido/nuestros-fines/versiones/7')) return json(version)
    if (url.endsWith('/secciones') && metodo === 'GET') {
      return json([{ id: 3, nombre: 'Horario de misas', bloques: [{ tipo: 'cita', titulo: '', texto: 'De la sección', autor: '', fuente: '' }], autor: 'Ana', fecha: '2026-09-01T10:00:00Z' }])
    }
    if (url.endsWith('/secciones') && metodo === 'POST') return json({ id: 4, ...cuerpo, autor: 'Ana', fecha: '2026-09-25T10:00:00Z' }, 201)
    if (url.endsWith('/contenido/cultos')) return metodo === 'PUT' ? json({ message: 'Guardado', data: cuerpo.datos }) : json({ cabecera: { titulo: 'Cultos', subtitulo: '', foto: '', fotoAlt: '' }, bloques: [] })
    return json(metodo === 'PUT' ? { message: 'Guardado', data: cuerpo.datos } : contenido)
  }))
  const router = createMemoryRouter(
    [{ path: '/cms/paginas', element: <h1>Páginas</h1> }, { path: '/cms/paginas/:slug', element: <PaginaAdminPage /> }],
    { initialEntries: ['/cms/paginas/nuestros-fines'] },
  )
  render(
    <HelmetProvider>
      <QueryClientProvider client={crearQueryClientDePruebas()}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  return llamadas
}

const guardar = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
}

const bloquesDelUltimoPut = (llamadas: Llamada[], ruta = '/contenido/nuestros-fines') => {
  const put = llamadas.filter((l) => l.metodo === 'PUT' && l.url.endsWith(ruta)).at(-1)
  if (!put) throw new Error('no se ha mandado ningún PUT')
  return (put.cuerpo as { datos: { bloques: Record<string, unknown>[] } }).datos.bloques
}

const accion = async (user: ReturnType<typeof userEvent.setup>, posicion: number, nombre: RegExp) => {
  await user.click(await screen.findByRole('button', { name: `Más acciones del bloque ${posicion}` }))
  await user.click(await screen.findByRole('menuitem', { name: nombre }))
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
}

describe('el constructor: presentación', () => {
  it('se elige un fondo y se guarda; volver al de siempre lo quita del documento', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')

    await user.click(screen.getByRole('button', { name: /^Texto/ }))
    await user.click(screen.getByRole('tab', { name: 'Presentación' }))
    await user.click(screen.getByRole('button', { name: 'Papel' }))
    await user.click(screen.getByRole('button', { name: 'Entradilla' }))
    // La pestaña cuenta las opciones cambiadas.
    expect(screen.getByRole('tab', { name: 'Presentación (2)' })).toBeInTheDocument()
    await guardar(user)
    await waitFor(() => expect(bloquesDelUltimoPut(llamadas)[0].presentacion).toEqual({ fondo: 'papel', estilo: 'entradilla' }))

    await user.click(await screen.findByRole('button', { name: 'Ninguno' }))
    await user.click(screen.getByRole('button', { name: 'Normal', pressed: false }))
    expect(screen.getByRole('tab', { name: 'Presentación' })).toBeInTheDocument()
    await guardar(user)
    await waitFor(() => expect(bloquesDelUltimoPut(llamadas)[0]).not.toHaveProperty('presentacion'))
  })

  it('el fondo de foto pide la foto antes de guardar', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await user.click(screen.getByRole('button', { name: /^Texto/ }))
    await user.click(screen.getByRole('tab', { name: 'Presentación' }))
    await user.click(screen.getByRole('button', { name: 'Foto' }))
    await guardar(user)
    expect(await screen.findByText(/el bloque 1 \(texto\) tiene el fondo de foto sin foto/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  // Teclea dos anclas letra a letra y duplica un bloque: sola tarda unos 6 s,
  // y con la suite entera en paralelo pasa de los 20. Margen propio.
  it('el ancla se escribe como un slug, enseña su enlace y no puede repetirse', { timeout: 60_000 }, async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await user.click(screen.getByRole('button', { name: /^Texto/ }))
    await user.click(screen.getByRole('tab', { name: 'Presentación' }))
    await user.type(screen.getByRole('textbox', { name: 'Ancla' }), 'Horario de Misas')
    expect(screen.getByRole('textbox', { name: 'Ancla' })).toHaveValue('horario-de-misas')
    expect(screen.getByText(/\/nuestros-fines#horario-de-misas/)).toBeInTheDocument()

    await accion(user, 1, /duplicar/i)
    // El bloque 1 se pliega al abrirse la copia, pero sigue montado mientras
    // dura la transición del Collapse: hasta que se desmonta hay dos «Ancla».
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Ancla' })).toBeNull())
    // La copia no se lleva el ancla: se repetiría. Se le pone la misma a mano.
    await user.click(await screen.findByRole('tab', { name: 'Presentación' }))
    await user.type(screen.getByRole('textbox', { name: 'Ancla' }), 'horario-de-misas')
    await guardar(user)
    expect(await screen.findByText(/el bloque 2 repite el ancla «horario-de-misas» del bloque 1/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })
})

describe('el constructor: acciones sobre los bloques', () => {
  it('duplicar pone una copia justo debajo, abierta', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await accion(user, 1, /duplicar/i)
    expect(screen.getByText('Bloques (3)')).toBeInTheDocument()
    await guardar(user)
    await waitFor(() => expect(bloquesDelUltimoPut(llamadas).map((b) => b.tipo)).toEqual(['texto', 'texto', 'tarjetas']))
  })

  it('ocultar lo marca en la lista y lo guarda oculto; mostrar lo devuelve', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await accion(user, 2, /ocultar en la web/i)
    expect(screen.getByRole('button', { name: /^Tarjetas.*Oculto/ })).toBeInTheDocument()
    await guardar(user)
    await waitFor(() => expect(bloquesDelUltimoPut(llamadas)[1].presentacion).toEqual({ oculto: true }))

    await accion(user, 2, /mostrar en la web/i)
    expect(screen.queryByText('Oculto')).not.toBeInTheDocument()
  })

  it('el «+» entre dos bloques añade justo ahí', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await user.click(screen.getByRole('button', { name: 'Añadir un bloque en la posición 2' }))
    const galeria = await screen.findByRole('dialog', { name: /añadir un bloque/i })
    expect(within(galeria).getByText('Irá en la posición 2.')).toBeInTheDocument()
    await user.click(within(galeria).getByRole('button', { name: /^Cita:/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.type(screen.getByRole('textbox', { name: 'La cita' }), 'Madre de los desamparados')
    await guardar(user)
    await waitFor(() => expect(bloquesDelUltimoPut(llamadas).map((b) => b.tipo)).toEqual(['texto', 'cita', 'tarjetas']))
  })

  it('deshacer y rehacer, con los botones y con el teclado', async () => {
    const user = userEvent.setup()
    montar()
    const subtitulo = await screen.findByRole('textbox', { name: 'Subtítulo' })
    await user.type(subtitulo, ' Y más')
    expect(subtitulo).toHaveValue('Caridad y formación. Y más')

    // Lo tecleado seguido es un solo paso.
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(subtitulo).toHaveValue('Caridad y formación.')
    await user.click(screen.getByRole('button', { name: 'Rehacer' }))
    expect(subtitulo).toHaveValue('Caridad y formación. Y más')

    await user.keyboard('{Control>}z{/Control}')
    expect(subtitulo).toHaveValue('Caridad y formación.')
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(subtitulo).toHaveValue('Caridad y formación. Y más')
  })

  it('guardar como sección manda los bloques marcados con su nombre', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await accion(user, 2, /guardar como sección/i)
    const dialogo = await screen.findByRole('dialog', { name: 'Guardar como sección' })
    // Sale marcado el bloque desde el que se abrió.
    expect(within(dialogo).getByRole('checkbox', { name: /2\. Tarjetas · Explora/ })).toBeChecked()
    expect(within(dialogo).getByRole('checkbox', { name: /1\. Texto/ })).not.toBeChecked()
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nombre de la sección' }), 'Tarjetas de fines')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar sección' }))
    expect(await within(dialogo).findByText(/guardada/i)).toBeInTheDocument()
    const post = llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/secciones'))
    expect(post?.cuerpo).toEqual({ nombre: 'Tarjetas de fines', bloques: [contenido.bloques[1]] })
  })

  it('una sección guardada se añade entera desde la galería', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Nuestros fines')
    await user.click(screen.getByRole('button', { name: /añadir bloque al final/i }))
    const galeria = await screen.findByRole('dialog', { name: /añadir un bloque/i })
    await user.click(within(galeria).getByRole('tab', { name: 'Secciones guardadas' }))
    expect(await within(galeria).findByText('Horario de misas')).toBeInTheDocument()
    await user.click(within(galeria).getByRole('button', { name: 'Añadir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Bloques (3)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('De la sección')).toBeInTheDocument()
  })

  it('copiar a otra página añade el bloque al final de esa y la guarda', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await accion(user, 1, /copiar a otra página/i)
    const dialogo = await screen.findByRole('dialog', { name: /copiar el bloque a otra página/i })
    await user.click(within(dialogo).getByRole('combobox', { name: 'Página' }))
    await user.click(await screen.findByRole('option', { name: /· Cultos$/ }))
    await user.click(within(dialogo).getByRole('button', { name: 'Copiar' }))
    expect(await within(dialogo).findByText(/copiado al final de «cultos»/i)).toBeInTheDocument()
    expect(bloquesDelUltimoPut(llamadas, '/contenido/cultos')).toEqual([contenido.bloques[0]])
    // La página que se edita no se toca.
    expect(llamadas.some((l) => l.metodo === 'PUT' && l.url.endsWith('/contenido/nuestros-fines'))).toBe(false)
  })
})

describe('el constructor: historial', () => {
  it('una versión anterior se carga en el editor sin publicarla, y se puede deshacer', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Nuestros fines')
    await user.click(screen.getByRole('button', { name: 'Historial' }))
    expect(await screen.findByText('Luis Ruiz · 1 bloque')).toBeInTheDocument()
    expect(screen.getByText('Publicada')).toBeInTheDocument()
    // La publicada no se carga: ya es la que hay.
    expect(screen.getAllByRole('button', { name: 'Cargar en el editor' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Cargar en el editor' }))
    expect(await screen.findByDisplayValue('Nuestros fines de antes')).toBeInTheDocument()
    expect(screen.getByText('Bloques (1)')).toBeInTheDocument()
    expect(screen.getByText(/hay cambios sin guardar/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    expect(await screen.findByDisplayValue('Nuestros fines')).toBeInTheDocument()
    expect(screen.getByText('Bloques (2)')).toBeInTheDocument()
  })
})

describe('el constructor: vista en vivo', () => {
  it('manda el documento a la vista cuando está lista, y abre el bloque que se pulsa allí', async () => {
    // Sin ancho de escritorio (jsdom no tiene media queries), la vista va en
    // su ventana, que se abre con su botón.
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Nuestros fines')
    await user.click(screen.getByRole('button', { name: 'Vista en vivo' }))
    const marco = await screen.findByTitle('Vista en vivo de la página') as HTMLIFrameElement
    expect(marco.getAttribute('src')).toBe('/cms/vista-previa/nuestros-fines')

    const ventana = marco.contentWindow!
    const enviar = vi.spyOn(ventana, 'postMessage')
    fireEvent(window, new MessageEvent('message', { data: { tipo: 'desamparados:lista' }, origin: window.location.origin, source: ventana }))
    await waitFor(() => expect(enviar).toHaveBeenCalled())
    const mensaje = enviar.mock.calls.at(-1)![0] as { tipo: string; documento: { cabecera: { titulo: string } } }
    expect(mensaje.tipo).toBe('desamparados:borrador')
    expect(mensaje.documento.cabecera.titulo).toBe('Nuestros fines')

    // Un mensaje de otra ventana no hace nada; el de la vista abre el bloque.
    fireEvent(window, new MessageEvent('message', { data: { tipo: 'desamparados:pulsado', indice: 1 }, origin: 'https://otro.test', source: ventana }))
    fireEvent(window, new MessageEvent('message', { data: { tipo: 'desamparados:pulsado', indice: 1 }, origin: window.location.origin, source: ventana }))
    await user.click(screen.getByRole('button', { name: 'Cerrar la vista en vivo' }))
    expect(await screen.findByRole('button', { name: /^Tarjetas/, expanded: true })).toBeInTheDocument()
  })
})
