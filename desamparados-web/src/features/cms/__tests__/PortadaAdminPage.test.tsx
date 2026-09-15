import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import { usePortada } from '../../home/useContenidoPortada'
import PortadaAdminPage, { MAX_FOTOS_PORTADA } from '../PortadaAdminPage'

interface Peticion { url: string; metodo: string; cuerpo?: unknown }

const FOTOS = [
  { id: 1, url: '/storage/public/primera.webp', descripcion: 'Primera', orden: 0 },
  { id: 2, url: '/storage/public/segunda.webp', descripcion: 'Segunda', orden: 1 },
]

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** Usa la consulta de la portada pública, para comparar su clave con la que invalida el CMS. */
function SondaPortadaPublica() {
  usePortada()
  return null
}

type Textos = typeof POR_DEFECTO.portada

interface Opciones {
  /** Ruta cuyo PUT responde 500, para probar el guardado a medias. */
  fallaEn?: string
  /** Fotos que devuelve la lectura inicial. */
  imagenes?: typeof FOTOS
  /** Textos que devuelve la lectura inicial, para no depender siempre del documento por defecto. */
  textos?: Textos
  /** La lectura inicial responde 500. */
  cargaRota?: boolean
  /** Monta además un componente que usa la consulta de la portada pública. */
  conPortadaPublica?: boolean
}

/**
 * Registra cada petición para poder afirmar **a qué rutas** fue el guardado,
 * que es lo que distingue «guardó las dos cosas» de «guardó una».
 */
function montar({
  fallaEn,
  imagenes = FOTOS,
  textos = structuredClone(POR_DEFECTO.portada),
  cargaRota = false,
  conPortadaPublica = false,
}: Opciones = {}) {
  const registradas: Peticion[] = []

  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: unknown, opciones?: RequestInit) => {
    const ruta = String(url)
    const metodo = opciones?.method ?? 'GET'
    const cuerpo = typeof opciones?.body === 'string' ? JSON.parse(opciones.body) : undefined
    registradas.push({ url: ruta, metodo, cuerpo })

    if (metodo === 'PUT' && fallaEn && ruta.includes(fallaEn)) {
      return Promise.resolve(respuesta({ error: 'Fallo del servidor' }, 500))
    }
    if (metodo === 'POST') {
      return Promise.resolve(respuesta({ data: { url: 'http://localhost:3001/storage/public/nueva.webp', filename: 'nueva.webp' } }, 201))
    }
    if (metodo !== 'GET') return Promise.resolve(respuesta({ message: 'ok', data: {} }))
    return Promise.resolve(cargaRota ? respuesta({ error: 'caído' }, 500) : respuesta({ imagenes, textos }))
  }))

  // PantallaEdicion usa useBlocker, que exige un data router.
  const router = createMemoryRouter(
    [{ path: '/cms/portada', element: <PortadaAdminPage /> }, { path: '/cms', element: <h1>Panel</h1> }],
    { initialEntries: ['/cms/portada'] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')

  render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={crearTemaCms('claro')}>
          {conPortadaPublica && <SondaPortadaPublica />}
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )

  return { peticiones: () => registradas, usuario: userEvent.setup({ delay: null }), queryClient, invalidar }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Usuario = ReturnType<typeof userEvent.setup>

const foto = (numero: number) => screen.getByRole('group', { name: `Foto ${numero}` })

/** MUI pinta un segundo `textarea` en la sombra para medir el alto: ese no es el del formulario. */
const campoMultilinea = (valor: string) =>
  screen.getAllByDisplayValue(valor).find((el) => !el.hasAttribute('aria-hidden')) as HTMLTextAreaElement

/**
 * Un retoque de un solo carácter. Cada tecla repinta la pantalla entera (seis
 * secciones y una treintena de campos), así que escribir una frase se come el
 * tope de 5 s del test en cuanto la máquina va justa.
 */
const retocar = (usuario: Usuario, campo: HTMLElement) => usuario.type(campo, '!')

const guardar = async (usuario: Usuario) => {
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
  await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
}

const putsA = (peticiones: () => Peticion[]) =>
  peticiones().filter((p) => p.metodo === 'PUT').map((p) => p.url)

const descripcionesDeFoto = () => screen.getAllByLabelText(/descripción para lectores de pantalla/i)

/**
 * Las fotos de la cabecera en el orden en que se ven. De una sola consulta: en
 * esta pantalla cada búsqueda por rol recorre las seis secciones enteras, y
 * repetirlas por cada foto acerca el test al tope de 5 s. La del bloque del
 * Sábado de Pasión no sale aquí porque su sección está plegada.
 */
const fotosEnPantalla = () =>
  screen.getAllByRole('img', { name: /foto actual/i }).map((img) => img.getAttribute('src'))

/**
 * El tope por defecto de vitest son 5 s, y esta pantalla no cabe en ellos: monta
 * las seis secciones a la vez (más de treinta campos, porque el acordeón de MUI
 * no desmonta lo plegado) y cada tecla y cada búsqueda por rol las recorren
 * enteras. Con la máquina ocupada, los tests que guardan rozaban los 5 s y
 * caían de forma intermitente. El `delay: null` de `userEvent` ya está puesto;
 * esto es lo que queda.
 */
describe('PortadaAdminPage', { timeout: 15_000 }, () => {
  it('carga las fotos en su orden y deja reordenar y quitar', async () => {
    const { usuario } = montar()
    await screen.findByRole('group', { name: 'Foto 1' })
    expect(fotosEnPantalla()).toEqual(['/storage/public/primera.webp', '/storage/public/segunda.webp'])
    expect(screen.getByRole('button', { name: /subir la foto 1/i })).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: /bajar la foto 1/i }))
    expect(fotosEnPantalla()).toEqual(['/storage/public/segunda.webp', '/storage/public/primera.webp'])

    await usuario.click(screen.getAllByRole('button', { name: /quitar foto/i })[1])
    expect(fotosEnPantalla()).toEqual(['/storage/public/segunda.webp'])
  })

  it('guarda la lista de fotos tal y como queda, sin reescribir el documento de textos', async () => {
    const { peticiones, usuario } = montar()
    await screen.findByDisplayValue('Segunda')

    await retocar(usuario, descripcionesDeFoto()[1])
    await guardar(usuario)

    await waitFor(() => expect(putsA(peticiones)).toEqual(['/api/portada/imagenes']))
    expect(peticiones().at(-1)?.cuerpo).toEqual({
      imagenes: [
        { url: '/storage/public/primera.webp', descripcion: 'Primera' },
        { url: '/storage/public/segunda.webp', descripcion: 'Segunda!' },
      ],
    })
    // Afinado: un «guardad…» a secas también casaría con el aviso del guardado a medias.
    expect(await screen.findByRole('alert')).toHaveTextContent(/cambios guardados/i)
  })

  it('sin cambios, guardar no manda nada ni dice que se haya guardado', async () => {
    const { peticiones, usuario } = montar()
    await screen.findByDisplayValue('Desamparados Málaga')

    await guardar(usuario)

    // Hasta que el diálogo no se va, MUI deja el resto de la página en
    // `aria-hidden` y cualquier `queryByRole` de aquí daría vacío sin mirar nada.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(putsA(peticiones)).toEqual([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si solo cambian los textos, no reescribe la lista de fotos', async () => {
    const { peticiones, usuario } = montar()

    await retocar(usuario, await screen.findByDisplayValue('Desamparados Málaga'))
    await guardar(usuario)

    await waitFor(() => expect(putsA(peticiones)).toEqual(['/api/contenido/portada']))
  })

  it('la foto que se sube se añade al final de la lista', async () => {
    const { usuario } = montar()
    await screen.findByRole('group', { name: 'Foto 1' })

    const anadir = screen.getByRole('group', { name: /añadir una foto/i })
    await usuario.upload(within(anadir).getByLabelText(/subir foto/i), new File(['x'], 'nueva.webp', { type: 'image/webp' }))

    expect(await screen.findByRole('group', { name: 'Foto 3' })).toBeInTheDocument()
    expect(within(foto(3)).getByRole('img')).toHaveAttribute('src', '/storage/public/nueva.webp')
    // Y el control de añadir queda libre para la siguiente.
    expect(within(anadir).queryByRole('img')).not.toBeInTheDocument()
  })

  it('con el máximo de fotos ya no ofrece añadir más', async () => {
    montar({ imagenes: Array.from({ length: MAX_FOTOS_PORTADA }, (_, i) => ({ id: i, url: `/storage/public/${i}.webp`, descripcion: '', orden: i })) })
    await screen.findByRole('group', { name: `Foto ${MAX_FOTOS_PORTADA}` })
    expect(screen.queryByRole('group', { name: /añadir una foto/i })).not.toBeInTheDocument()
    expect(screen.getByText(/el máximo/i)).toBeInTheDocument()
  })

  it('sin fotos explica que se usa la de siempre y ofrece añadir', async () => {
    montar({ imagenes: [] })
    expect(await screen.findByRole('group', { name: /añadir una foto/i })).toBeInTheDocument()
    expect(screen.getByText(/la foto de siempre/i)).toBeInTheDocument()
  })

  it('explica el fallo si la portada no se puede cargar', async () => {
    montar({ cargaRota: true })
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })

  it('carga los textos de cada bloque en su sección', async () => {
    montar()
    await screen.findByRole('button', { name: /cabecera/i })

    expect(screen.getByRole('button', { name: /actualidad/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agenda y cultos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accesos directos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sábado de pasión/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /publicaciones/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Desamparados Málaga')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Últimas noticias')).toBeInTheDocument()
    expect(screen.getByDisplayValue('DESAMPARADOS')).toBeInTheDocument()
  })

  it('cada campo dice dónde sale en la web pública', async () => {
    montar()
    await screen.findByDisplayValue('Desamparados Málaga')

    expect(screen.getByText(/el texto pequeño en versalitas, sobre el título grande/i)).toBeInTheDocument()
    const fotoDelSabado = screen.getByText(/ocupa el fondo del bloque a todo lo ancho/i)
    // El servidor borra la foto anterior al guardar (contenido.service.ts), igual
    // que con las de la cabecera: si no se avisa, se pierde sin saber por qué.
    expect(fotoDelSabado).toHaveTextContent(/la anterior se borra del servidor/i)
  })

  it('guarda las fotos y los textos, cada uno a su sitio', async () => {
    const { peticiones, usuario } = montar()

    await retocar(usuario, await screen.findByDisplayValue('Desamparados Málaga'))
    await retocar(usuario, descripcionesDeFoto()[0])
    await guardar(usuario)

    await waitFor(() => {
      expect(peticiones()).toContainEqual(expect.objectContaining({ url: '/api/portada/imagenes', metodo: 'PUT' }))
      expect(peticiones()).toContainEqual(expect.objectContaining({ url: '/api/contenido/portada', metodo: 'PUT' }))
    })
    const enviados = peticiones().find((p) => p.url === '/api/contenido/portada')?.cuerpo as { datos: { hero: { titulo: string } } }
    expect(enviados.datos.hero.titulo).toBe('Desamparados Málaga!')
  })

  it('si fallan los textos después de guardar las fotos, lo dice', async () => {
    // Son dos almacenes y dos peticiones: el botón no puede decir «guardado» si
    // la segunda ha fallado. Es la mentira más fácil de escribir aquí.
    const { usuario, invalidar } = montar({ fallaEn: '/contenido/portada' })

    // Se tocan las DOS cosas: una foto y un texto. Con solo el texto, el mensaje
    // correcto sería otro (no se guardó nada), y el test no probaría este caso.
    await retocar(usuario, await screen.findByDisplayValue('Desamparados Málaga'))
    await retocar(usuario, descripcionesDeFoto()[0])
    await guardar(usuario)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(/fotos se han guardado/i)
    expect(aviso).toHaveTextContent(/textos no/i)
    // Las fotos SÍ llegaron al servidor: la portada pública tiene que enterarse
    // aunque el guardado se haya quedado a medias.
    await waitFor(() => expect(invalidar).toHaveBeenCalled())
  })

  it('si fallan las fotos no dice que se hayan guardado, ni escribe los textos', async () => {
    // El mismo mensaje al revés también sería mentira: aquí no se ha guardado nada.
    const { peticiones, usuario } = montar({ fallaEn: '/portada/imagenes' })

    await retocar(usuario, await screen.findByDisplayValue('Desamparados Málaga'))
    await retocar(usuario, descripcionesDeFoto()[0])
    await guardar(usuario)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(/fallo del servidor/i)
    expect(aviso).not.toHaveTextContent(/fotos se han guardado/i)
    expect(putsA(peticiones)).toEqual(['/api/portada/imagenes'])
  })

  it('al guardar invalida exactamente la clave con la que la portada pública guarda su caché', async () => {
    // Si esta pantalla y features/home/useContenidoPortada.ts dejan de compartir
    // clave, guardar deja de refrescar el inicio y nadie se entera.
    const { usuario, queryClient, invalidar } = montar({ conPortadaPublica: true })
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(1))
    const clavePublica = queryClient.getQueryCache().getAll()[0].queryKey
    expect(clavePublica).toEqual(['home', 'portada'])

    await retocar(usuario, await screen.findByDisplayValue('Desamparados Málaga'))
    await guardar(usuario)

    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: clavePublica }))
  })

  it('no invalida nada si el guardado ha fallado entero', async () => {
    const { usuario, invalidar } = montar({ fallaEn: '/contenido/portada' })

    await retocar(usuario, await screen.findByDisplayValue('Desamparados Málaga'))
    await guardar(usuario)

    await screen.findByRole('alert')
    expect(invalidar).not.toHaveBeenCalled()
  })

  it('pinta los accesos en el orden en que llegan, no en uno escrito a mano', async () => {
    // Barajados a propósito: con el documento por defecto, una implementación que
    // se inventara el orden en el código pasaría igual y el test no valdría nada.
    const textos = structuredClone(POR_DEFECTO.portada)
    textos.accesos.teselas = [...textos.accesos.teselas].reverse()
    const { usuario } = montar({ textos })
    await screen.findByDisplayValue('Desamparados Málaga')
    await usuario.click(screen.getByRole('button', { name: /accesos directos/i }))

    const mosaico = screen.getByRole('group', { name: /textos de los accesos/i })
    expect(within(mosaico).getAllByLabelText('Título').map((campo) => (campo as HTMLInputElement).value)).toEqual([
      'Contacto', 'Canal de YouTube', 'Boletines', 'Historia', 'Caridad', 'Nuestra sede',
    ])
    // El destino y el icono los pone el código: aquí no hay nada que pulsar.
    expect(within(mosaico).queryByRole('button')).not.toBeInTheDocument()
  })

  it('el acceso se edita bajo su nombre actual, que cambia al escribirlo', async () => {
    const { usuario } = montar()
    await screen.findByDisplayValue('Desamparados Málaga')
    await usuario.click(screen.getByRole('button', { name: /accesos directos/i }))

    await retocar(usuario, within(screen.getByRole('group', { name: 'Caridad' })).getByLabelText('Título'))

    expect(screen.getByRole('group', { name: 'Caridad!' })).toBeInTheDocument()
  })

  it('el título del Sábado de Pasión se escribe en varias líneas, porque el salto es parte del bloque', async () => {
    const { usuario } = montar()
    await screen.findByDisplayValue('Desamparados Málaga')
    await usuario.click(screen.getByRole('button', { name: /sábado de pasión/i }))

    // El texto llega con un salto de línea real; las consultas de Testing Library
    // normalizan los espacios, así que aquí se busca ya normalizado.
    expect(campoMultilinea('Una devoción que camina con nosotros.').tagName).toBe('TEXTAREA')
  })

  it('la foto del Sábado de Pasión se puede cambiar pero no quitar', async () => {
    // El backend valida ese campo con `rutaImagenPublica` (contenido.schema.ts) y
    // no admite cadena vacía: un botón de quitar dejaría el documento entero
    // inguardable, también los textos de los otros cinco bloques.
    const { usuario } = montar()
    await screen.findByDisplayValue('Desamparados Málaga')
    await usuario.click(screen.getByRole('button', { name: /sábado de pasión/i }))

    const campo = within(screen.getByRole('group', { name: 'Foto del bloque' }))
    expect(campo.getByRole('button', { name: /cambiar foto/i })).toBeInTheDocument()
    expect(campo.queryByRole('button', { name: /quitar foto/i })).not.toBeInTheDocument()
  })
})
