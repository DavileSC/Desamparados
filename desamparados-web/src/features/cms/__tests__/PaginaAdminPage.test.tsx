import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import PaginaAdminPage from '../PaginaAdminPage'

const contenido = {
  cabecera: { titulo: 'Corporación', subtitulo: 'Grupo Parroquial.', foto: '', fotoAlt: '' },
  bloques: [
    { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' },
    { tipo: 'tarjetas', titulo: 'Explora la sección', tarjetas: [{ titulo: 'Historia', descripcion: 'Orígenes.', enlace: '/corporacion/historia' }] },
  ],
}

afterEach(() => { vi.unstubAllGlobals() })

/**
 * PantallaEdicion usa useBlocker, que exige un data router.
 *
 * `respuestaPut` deja simular un 400 del servidor (Crítico 2 del fix round 1):
 * algo que el cliente no comprobó, pero que el servidor sí rechaza.
 */
function montar(respuestaPut?: { status: number; cuerpo: unknown }, datos: unknown = contenido) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET'
    // Las subidas llevan un FormData, no JSON: responden con el nombre del fichero.
    if (init?.body instanceof FormData) {
      const archivo = init.body.get('file') as File
      llamadas.push({ url, metodo, cuerpo: archivo.name })
      return Promise.resolve(new Response(
        JSON.stringify({ message: 'Subido', data: { filename: archivo.name, url: '', type: archivo.type, size: '' } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ))
    }
    llamadas.push({ url, metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
    if (metodo === 'PUT' && respuestaPut) {
      return Promise.resolve(new Response(
        JSON.stringify(respuestaPut.cuerpo),
        { status: respuestaPut.status, headers: { 'Content-Type': 'application/json' } },
      ))
    }
    return Promise.resolve(new Response(
      JSON.stringify(metodo === 'PUT' ? { message: 'Guardado', data: datos } : datos),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
  }))
  const router = createMemoryRouter(
    [{ path: '/cms', element: <h1>Panel</h1> }, { path: '/cms/paginas/:slug', element: <PaginaAdminPage /> }],
    { initialEntries: ['/cms/paginas/nuestros-fines'] },
  )
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
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

describe('PaginaAdminPage', () => {
  it('carga la cabecera y los bloques que ya hay', async () => {
    montar()
    expect(await screen.findByDisplayValue('Corporación')).toBeInTheDocument()
    expect(screen.getByText(/Texto/)).toBeInTheDocument()
    expect(screen.getByText(/Tarjetas/)).toBeInTheDocument()
  })

  it('la cabecera no se puede quitar', async () => {
    montar()
    await screen.findByDisplayValue('Corporación')
    const cabecera = screen.getByDisplayValue('Corporación').closest('.MuiPaper-root') as HTMLElement
    expect(within(cabecera).queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument()
  })

  it('se añade un bloque eligiendo su tipo', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    await user.click(await screen.findByRole('menuitem', { name: /foto/i }))

    expect(await screen.findByText(/Posición 3 de 3/)).toBeInTheDocument()
  })

  it('se quita un bloque', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')
    expect(screen.getByText('Bloques (2)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /quitar el bloque 1/i }))

    // El contador y la desaparición del bloque: comprobar que no existe un
    // texto que tampoco existía antes no prueba nada.
    expect(screen.getByText('Bloques (1)')).toBeInTheDocument()
    expect(screen.queryByText('Texto')).not.toBeInTheDocument()
    expect(screen.getByText('Tarjetas')).toBeInTheDocument()
  })

  it('los controles del bloque no cuelgan del botón que lo pliega', async () => {
    montar()
    await screen.findByDisplayValue('Corporación')

    // Con el Accordion de MUI los tres controles vivían DENTRO del
    // AccordionSummary, que es un <button>: HTML inválido, un error de
    // hidratación en cada carga y, sobre todo, un árbol de accesibilidad en el
    // que Subir, Bajar y Quitar no existían como controles —el navegador los
    // absorbía en el nombre del botón de plegar—. Nada de esto lo veían los
    // tests de arriba, que encuentran los botones en el DOM y siguen pasando.
    expect(document.body.querySelectorAll('button button')).toHaveLength(0)

    // El botón que pliega se llama solo por su bloque: si algún control vuelve
    // a colarse dentro, su etiqueta acabaría pegada a este nombre.
    const plegar = screen.getByRole('button', { name: /^Texto/ })
    expect(plegar).toHaveAttribute('aria-expanded', 'false')
    expect(plegar.getAttribute('aria-label') ?? plegar.textContent).not.toMatch(/quitar|subir|bajar/i)
  })

  it('se reordena y se guarda en el orden nuevo', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /bajar el bloque 1/i }))
    await guardar(user)

    await waitFor(() => {
      const envio = llamadas.find((l) => l.metodo === 'PUT')
      expect(envio!.url).toContain('/contenido/nuestros-fines')
      const bloques = (envio!.cuerpo as { datos: { bloques: { tipo: string }[] } }).datos.bloques
      expect(bloques.map((b) => b.tipo)).toEqual(['tarjetas', 'texto'])
    })
  })

  it('se añaden y se quitan tarjetas dentro de un bloque', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    // El bloque de tarjetas nace plegado; hay que abrirlo para llegar a su
    // formulario. El fixture trae UNA tarjeta, así que quitar tiene que estar
    // deshabilitado: el esquema del servidor exige al menos una.
    await user.click(screen.getByRole('button', { name: /^Tarjetas/ }))
    expect(screen.getByRole('button', { name: /quitar la tarjeta 1/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /añadir tarjeta/i }))
    // Nace sin enlace: antes apuntaba a la portada sin que nadie lo decidiera.
    expect(screen.getByRole('combobox', { name: /enlace de la tarjeta 2/i })).toHaveValue('')
    expect(screen.getByRole('button', { name: /quitar la tarjeta 1/i })).toBeEnabled()

    await user.type(screen.getByRole('textbox', { name: /título de la tarjeta 2/i }), 'Cultos')

    // Quitar de verdad, antes de guardar: al guardar, la pantalla recarga las
    // filas con claves nuevas y vuelve a plegarlas todas.
    await user.click(screen.getByRole('button', { name: /quitar la tarjeta 2/i }))
    expect(screen.queryByDisplayValue('Cultos')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /añadir tarjeta/i }))
    await user.type(screen.getByRole('textbox', { name: /título de la tarjeta 2/i }), 'Cultos')
    await guardar(user)

    await waitFor(() => {
      const envio = llamadas.find((l) => l.metodo === 'PUT')
      const bloques = (envio!.cuerpo as { datos: { bloques: { tipo: string; tarjetas?: { titulo: string }[] }[] } }).datos.bloques
      const tarjetas = bloques.find((b) => b.tipo === 'tarjetas')!.tarjetas!
      expect(tarjetas.map((t) => t.titulo)).toEqual(['Historia', 'Cultos'])
    })
  })

  it('avisa si la cabecera se queda sin título, y no manda nada', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await user.clear(await screen.findByDisplayValue('Corporación'))
    await guardar(user)

    expect(await screen.findByText(/se ha quedado sin título/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  it('avisa de qué bloque falla si se guarda con una foto recién añadida (vacía), y no manda nada; y lo despliega', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    await user.click(await screen.findByRole('menuitem', { name: /foto/i }))
    await guardar(user)

    // Nombra el bloque por su posición y su tipo: plegado, es la única forma
    // de saber cuál de todos es.
    expect(await screen.findByText(/el bloque 3 \(foto\) no tiene foto/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)

    // Y lo despliega: el campo culpable tiene que quedar a la vista, no solo
    // nombrado en el aviso. Antes de guardar los tres bloques están plegados
    // (unmountOnExit), así que si aparece exactamente uno es el que falló.
    expect(screen.getAllByLabelText(/título de sección/i)).toHaveLength(1)
  })

  it('si el servidor rechaza algo que el cliente no vio, enseña el bloque y el motivo en vez del aviso genérico', async () => {
    const user = userEvent.setup()
    const llamadas = montar({
      status: 400,
      cuerpo: {
        status: 'error',
        message: 'Error de validación',
        errors: [{ field: 'bloques.1', message: 'Debe ser una ruta interna, sin salir del sitio' }],
      },
    })
    await screen.findByDisplayValue('Corporación')

    // Sin tocar nada, guardar no manda ningún PUT (documento igual al
    // cargado): un cambio inocuo en la cabecera lo deja «sucio» sin tocar el
    // orden ni la validez de ningún bloque. El bloque 2 (tarjetas) sigue
    // siendo válido para el cliente: la comprobación local no mira el patrón
    // del enlace, así que esto sí llega a mandarse.
    await user.type(screen.getByRole('textbox', { name: 'Subtítulo' }), ' extra')
    await guardar(user)

    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true))
    expect(await screen.findByText(/el bloque 2 \(tarjetas\)/i)).toBeInTheDocument()
    expect(screen.getByText(/sin salir del sitio/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Error de validación$/)).not.toBeInTheDocument()
  })

  it('«Abrir la publicada» abre la página pública en otra pestaña', async () => {
    montar()
    await screen.findByDisplayValue('Corporación')

    const previa = screen.getByRole('link', { name: /abrir la publicada/i })
    expect(previa).toHaveAttribute('href', '/corporacion/nuestros-fines')
    expect(previa).toHaveAttribute('target', '_blank')
    expect(previa).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})

describe('PaginaAdminPage: los bloques de la segunda fase', () => {
  const anadirBloque = async (user: ReturnType<typeof userEvent.setup>, nombre: RegExp) => {
    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    await user.click(await screen.findByRole('menuitem', { name: nombre }))
    // El menú se cierra con transición, y mientras dura MUI deja el resto del
    // árbol en aria-hidden. `getByRole` no ve lo oculto, así que sin esperar
    // aquí una máquina lenta no encuentra los botones del bloque recién
    // añadido. (`getByLabelText` sí los encontraba, y por eso el fallo salía
    // en una línea y no en la anterior.)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  }

  it('el menú ofrece todos los tipos de bloque del catálogo', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    const opciones = (await screen.findAllByRole('menuitem')).map((o) => o.textContent)
    expect(opciones).toEqual([
      'Texto', 'Foto', 'Galería', 'Tarjetas', 'Llamada', 'Datos', 'Itinerario',
      'Cronología', 'Listado', 'Formulario de contacto',
    ])
  })

  it('una galería recién añadida avisa de que está vacía, y no se manda', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /galería/i)
    await guardar(user)

    expect(await screen.findByText(/el bloque 3 \(galería\) está vacío/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  // Teclea dos direcciones de vídeo enteras, letra a letra, con la vista previa
  // de la galería repintándose en cada una: solo tarda unos 5 a 7 s, y con la
  // suite completa en paralelo pasaba de los 20. Margen propio, como los tests
  // que rellenan la ventana de apunte en Contabilidad.
  it('se añade un vídeo a la galería y avisa hasta que tiene dirección y portada', { timeout: 45_000 }, async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /galería/i)
    await user.click(screen.getByRole('button', { name: /^Galería/ }))
    await user.click(screen.getByRole('button', { name: /añadir vídeo/i }))

    // Los vídeos no se suben: se pega su dirección. Lo que sí se sube es la
    // portada, para no pedirle la miniatura a YouTube al abrir la página.
    expect(screen.getByRole('textbox', { name: /dirección del vídeo 1/i })).toBeInTheDocument()
    await guardar(user)
    expect(await screen.findByText(/el bloque 3 \(galería\) tiene un vídeo sin dirección/i)).toBeInTheDocument()

    // `findByRole` y no `getByRole`: el diálogo de confirmación sigue montado
    // hasta que termina su transición de salida, y mientras tanto su
    // `ModalManager` deja el resto de la página en `aria-hidden`, invisible
    // para las consultas por rol (`docs/notas-del-proyecto.md` §6).
    await user.type(
      await screen.findByRole('textbox', { name: /dirección del vídeo 1/i }),
      'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    )
    await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Salida procesional')
    await guardar(user)
    expect(await screen.findByText(/tiene un vídeo sin foto de portada/i)).toBeInTheDocument()
  })

  it('se reordena la galería y el orden nuevo es el que se guarda', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /galería/i)
    await user.click(screen.getByRole('button', { name: /^Galería/ }))
    await user.upload(screen.getByLabelText(/subir fotos/i), new File(['x'], 'uno.jpg', { type: 'image/jpeg' }))
    await screen.findByText(/1 foto añadida/i)
    await user.click(screen.getByRole('button', { name: /añadir vídeo/i }))

    // La foto es el medio 1 y el vídeo el 2; al subir el vídeo, se cambian.
    await user.click(screen.getByRole('button', { name: /subir el medio 2/i }))
    expect(screen.getByRole('textbox', { name: /dirección del vídeo 1/i })).toBeInTheDocument()

    // Y se quita el vídeo, que ahora es el primero: queda solo la foto.
    await user.click(screen.getByRole('button', { name: /quitar el medio 1/i }))
    expect(screen.queryByRole('textbox', { name: /dirección del vídeo/i })).not.toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  it('una llamada sin texto en el botón no se puede guardar', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /llamada/i)
    await guardar(user)

    expect(await screen.findByText(/el bloque 3 \(llamada\) no tiene texto en el botón/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  it('se añaden y se quitan líneas de un bloque de datos, y se guardan', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /datos/i)
    await user.click(screen.getByRole('button', { name: /^Datos/ }))

    // Nace con una línea, y el esquema del servidor exige al menos una: quitar
    // tiene que estar deshabilitado hasta que haya una segunda.
    expect(screen.getByRole('button', { name: /quitar la línea 1/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /añadir línea/i }))
    expect(screen.getByRole('button', { name: /quitar la línea 1/i })).toBeEnabled()

    await user.type(screen.getByRole('textbox', { name: /concepto 1/i }), 'Misa de hermandad')
    await user.type(screen.getByRole('textbox', { name: /concepto 2/i }), 'Rosario')
    await user.click(screen.getByRole('button', { name: /quitar la línea 2/i }))
    await guardar(user)

    await waitFor(() => {
      const envio = llamadas.find((l) => l.metodo === 'PUT')
      const bloques = (envio!.cuerpo as { datos: { bloques: { tipo: string; lineas?: { etiqueta: string }[] }[] } }).datos.bloques
      const datos = bloques.find((b) => b.tipo === 'datos')!.lineas!
      expect(datos.map((l) => l.etiqueta)).toEqual(['Misa de hermandad'])
    })
  })
})

describe('PaginaAdminPage: cronología, listado y contacto', () => {
  const anadirBloque = async (user: ReturnType<typeof userEvent.setup>, nombre: RegExp) => {
    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    await user.click(await screen.findByRole('menuitem', { name: nombre }))
    // El menú se cierra con transición, y mientras dura MUI deja el resto del
    // árbol en aria-hidden. `getByRole` no ve lo oculto, así que sin esperar
    // aquí una máquina lenta no encuentra los botones del bloque recién
    // añadido. (`getByLabelText` sí los encontraba, y por eso el fallo salía
    // en una línea y no en la anterior.)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  }
  const ultimoPut = (llamadas: { metodo: string; cuerpo: unknown }[]) => {
    // Si no hubo ningún PUT, el fallo se decía solo como «no se puede leer
    // 'datos' de undefined», que no cuenta nada de lo que ha pasado.
    const ultima = llamadas.filter((l) => l.metodo === 'PUT').at(-1)
    if (!ultima) throw new Error('no se ha mandado ningún PUT: la pantalla no llegó a guardar')
    return (ultima.cuerpo as { datos: { bloques: Record<string, unknown>[] } }).datos
  }

  it('una cronología recién añadida avisa del hito sin periodo, y no se manda', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /cronología/i)
    await guardar(user)

    expect(await screen.findByText(/el bloque 3 \(cronología\) tiene el hito 1 sin periodo/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
    // Se despliega solo, para que se vea qué hito es.
    await user.type(screen.getByLabelText('Periodo del hito 1'), '1954')
    await user.click(screen.getByRole('button', { name: /añadir hito/i }))
    expect(screen.getByLabelText('Periodo del hito 2')).toBeInTheDocument()
  })

  it('un listado se guarda con la fuente elegida', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /^listado$/i)
    await user.click(screen.getByRole('button', { name: /listado/i, expanded: false }))
    await user.selectOptions(screen.getByLabelText('Qué se enseña'), 'boletines')
    expect(screen.getByText(/solo los boletines/i)).toBeInTheDocument()
    await guardar(user)

    await vi.waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true))
    expect(ultimoPut(llamadas).bloques.at(-1)).toEqual({ tipo: 'listado', titulo: '', fuente: 'boletines' })
  })

  it('el formulario de contacto se guarda sin líneas: la tarjeta es opcional', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await anadirBloque(user, /formulario de contacto/i)
    await guardar(user)

    await vi.waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true))
    expect(ultimoPut(llamadas).bloques.at(-1)).toEqual({ tipo: 'contacto', titulo: '', tituloDatos: 'Datos de contacto', lineas: [] })
  })

  it('el enlace de una tarjeta se elige de las páginas que existen', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')
    await user.click(screen.getByRole('button', { name: /^Tarjetas/ }))

    const campo = screen.getByRole('combobox', { name: /enlace de la tarjeta 1/i })
    expect(campo).toHaveValue('Historia · /corporacion/historia')
    await user.clear(campo)
    await user.type(campo, 'cultos')
    await user.click(await screen.findByRole('option', { name: /cultos · \/corporacion\/cultos/i }))
    await guardar(user)

    await waitFor(() => {
      const envio = llamadas.find((l) => l.metodo === 'PUT')
      const bloques = (envio!.cuerpo as { datos: { bloques: { tipo: string; tarjetas?: { enlace: string }[] }[] } }).datos.bloques
      expect(bloques.find((b) => b.tipo === 'tarjetas')!.tarjetas![0].enlace).toBe('/corporacion/cultos')
    })
  })

  it('un enlace guardado a una página que no existe se señala y no deja guardar', async () => {
    const user = userEvent.setup()
    const roto = { ...contenido, bloques: [{ tipo: 'tarjetas', titulo: '', tarjetas: [{ titulo: 'Hola', descripcion: '', enlace: '/corporacion/hola' }] }] }
    const llamadas = montar(undefined, roto)
    await screen.findByDisplayValue('Corporación')

    // Se cambia algo para que haya qué guardar; la tarjeta rota sigue igual.
    await user.type(screen.getByRole('textbox', { name: /^subtítulo/i }), ' Más.')
    await guardar(user)

    expect(await screen.findByText(/el bloque 1 \(tarjetas\) tiene la tarjeta 1 enlazada a una página que no existe \(\/corporacion\/hola\)/i)).toBeInTheDocument()
    expect(screen.getByText(/«\/corporacion\/hola» no es ninguna página de la web/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })

  it('la cabecera y el bloque abierto se ven como en la web, con lo que se está escribiendo', async () => {
    const user = userEvent.setup()
    montar()
    const titulo = await screen.findByDisplayValue('Corporación')

    await user.clear(titulo)
    await user.type(titulo, 'Nuestra corporación')
    expect(screen.getByTestId('vista-previa-cabecera')).toHaveTextContent('Nuestra corporación')

    // Solo el bloque abierto monta su vista previa.
    expect(screen.queryByTestId('vista-previa-bloque')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Tarjetas/ }))
    await user.clear(screen.getByRole('textbox', { name: /título de la tarjeta 1/i }))
    await user.type(screen.getByRole('textbox', { name: /título de la tarjeta 1/i }), 'Nuestra historia')
    expect(screen.getByTestId('vista-previa-bloque')).toHaveTextContent('Nuestra historia')
    expect(screen.getByTestId('vista-previa-bloque')).toHaveTextContent('Explora la sección')
  })

  it('«Ver la página entera» enseña la página con lo escrito, sin publicarlo', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    const titulo = await screen.findByDisplayValue('Corporación')
    await user.type(titulo, ' y sus fines')

    await user.click(screen.getByRole('button', { name: /ver la página entera/i }))
    const ventana = await screen.findByRole('dialog', { name: /vista previa de «corporación y sus fines»/i })
    const pagina = within(ventana).getByTestId('vista-previa-pagina')
    expect(pagina).toHaveTextContent('Corporación y sus fines')
    expect(pagina).toHaveTextContent('Historia')
    // La página del borrador no pide lo guardado al servidor.
    expect(llamadas.filter((l) => l.metodo === 'GET' && l.url.includes('/contenido/nuestros-fines'))).toHaveLength(1)
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)

    await user.click(within(ventana).getByRole('button', { name: /cerrar la vista previa/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('«Descartar cambios» vuelve a lo guardado sin salir de la pantalla', async () => {
    const user = userEvent.setup()
    montar()
    const titulo = await screen.findByDisplayValue('Corporación')
    await user.type(titulo, ' cambiada')
    expect(screen.getByText(/hay cambios sin guardar/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /descartar cambios/i }))
    await user.click(await screen.findByRole('button', { name: /^descartar cambios$/i }))
    expect(await screen.findByDisplayValue('Corporación')).toBeInTheDocument()
    expect(screen.getByText(/sin cambios pendientes/i)).toBeInTheDocument()
  })

  it('la galería sube varias fotos de una vez, en el orden elegido, y dice cuáles no valen', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')
    await anadirBloque(user, /galería/i)
    await user.click(screen.getByRole('button', { name: /^Galería/ }))

    await user.upload(screen.getByLabelText(/subir fotos/i), [
      new File(['1'], 'procesion.jpg', { type: 'image/jpeg' }),
      new File(['2'], 'altar.png', { type: 'image/png' }),
      new File(['3'], 'movil.heic', { type: 'image/heic' }),
      new File(['4'], 'trono.webp', { type: 'image/webp' }),
    ])

    expect(await screen.findByText(/3 fotos añadidas al final de la galería/i)).toBeInTheDocument()
    expect(screen.getByText(/movil\.heic: tiene que ser jpg, png o webp/i)).toBeInTheDocument()
    expect(llamadas.filter((l) => l.url.includes('/upload/public')).map((l) => l.cuerpo).sort()).toEqual(['altar.png', 'procesion.jpg', 'trono.webp'])
    // Tres medios, en el orden elegido; los tres sin descripción todavía.
    const miniaturas = screen.getAllByRole('img', { name: /foto actual/i }).map((i) => i.getAttribute('src'))
    expect(miniaturas).toEqual(['/storage/public/procesion.jpg', '/storage/public/altar.png', '/storage/public/trono.webp'])

    await guardar(user)
    expect(await screen.findByText(/tiene un medio sin descripción/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })
})
