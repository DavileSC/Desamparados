import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import { DATOS } from '../../../test/instalacion'
import AccesosRapidos from '../AccesosRapidos'
import { site } from '../../../config/site'
import { textosDePrueba, responderPortada } from './ayudas'

// Las redes que siembran las pruebas en la caché (test/queryClient.ts) salen de
// este objeto al montar: cambiándolo se simula que Secretaría rellena el canal
// de YouTube en el CMS.
const redes = DATOS.redes
const youtubeOriginal = redes.youtube

describe('AccesosRapidos', () => {
  // Cada prueba parte sin canal de YouTube, y la que lo necesita lo pone: así el
  // número de teselas no depende de lo que diga la configuración del Grupo.
  beforeEach(() => {
    redes.youtube = null
  })

  afterEach(() => {
    redes.youtube = youtubeOriginal
    vi.unstubAllGlobals()
  })

  it('ofrece seis accesos en una lista, cada uno a su página', () => {
    // Se rompe si un acceso apunta a otra ruta, si vuelve el acceso de hermanos
    // (ya está siempre visible en el menú), si vuelven la agenda o el recorrido
    // (tienen bloque propio en la portada) o si el bloque deja de ser una lista.
    renderWithProviders(<AccesosRapidos />)

    const lista = screen.getByRole('list', { name: /accesos directos/i })
    const destinos = within(lista).getAllByRole('link').map((enlace) => enlace.getAttribute('href'))

    expect(destinos).toEqual([
      '/hazte-hermano',
      '/parroquia',
      '/nuestros-fines/caridad',
      '/historia',
      '/publicaciones/boletines',
      '/contacto',
    ])
  })

  it('anuncia en cada enlace qué hay detrás, no solo su título', async () => {
    // Se rompe si la descripción se saca del enlace: un lector de pantalla
    // volvería a oír solo «Boletines», sin contexto.
    responderPortada(textosDePrueba())
    renderWithProviders(<AccesosRapidos />)

    expect(
      await screen.findByRole('link', { name: /boletines.*boletín informativo y anuarios/i }),
    ).toHaveAttribute('href', '/publicaciones/boletines')
  })

  it('destaca «Hazte hermano» como primer acceso, con titular y llamada a la acción', async () => {
    // Se rompe si la captación de hermanos vuelve a ser un acceso más, sin
    // titular ni botón, o si su texto deja de llegar al lector de pantalla.
    responderPortada(textosDePrueba())
    renderWithProviders(<AccesosRapidos />)

    await screen.findByText(textosDePrueba().accesos.placa.titulo)
    const lista = screen.getByRole('list', { name: /accesos directos/i })
    const [primero] = within(lista).getAllByRole('link')

    expect(primero).toHaveAttribute('href', '/hazte-hermano')
    expect(primero).toHaveAccessibleName(/forma parte de nuestra historia.*quiero ser hermano/i)
    expect(primero).toHaveAccessibleDescription(/comunidad de fe/i)
  })

  it('con un número impar de accesos pequeños, Contacto ocupa la fila entera con «Escríbenos»', async () => {
    // Hoy son cinco (sin YouTube): si el último no se estira, queda un hueco en el mosaico.
    responderPortada(textosDePrueba())
    renderWithProviders(<AccesosRapidos />)

    const contacto = await screen.findByRole('link', { name: /contacto/i })
    expect(within(contacto).getByText('Escríbenos')).toBeInTheDocument()
  })

  it('con YouTube configurado, Contacto vuelve a ser un acceso normal', async () => {
    // Con seis accesos pequeños el mosaico cuadra solo: estirar Contacto lo descuadraría.
    redes.youtube = 'https://www.youtube.com/@canal-de-prueba'
    responderPortada(textosDePrueba())
    renderWithProviders(<AccesosRapidos />)

    expect(await screen.findByRole('link', { name: /canal de youtube/i })).toHaveAttribute('href', redes.youtube)
    const contacto = screen.getByRole('link', { name: /contacto/i })
    expect(within(contacto).queryByText('Escríbenos')).not.toBeInTheDocument()
  })

  it('enseña los textos de la placa y de cada tesela', async () => {
    const textos = textosDePrueba()
    textos.accesos.placa.titulo = 'Únete a nosotros'
    textos.accesos.teselas.find((t) => t.clave === 'caridad')!.descripcion = 'Nuestra obra social'
    responderPortada(textos)

    renderWithProviders(<AccesosRapidos />)

    expect(await screen.findByText('Únete a nosotros')).toBeInTheDocument()
    expect(screen.getByText('Nuestra obra social')).toBeInTheDocument()
  })

  it('el destino de cada tesela no depende del documento', async () => {
    // Los destinos siguen en el código: el CMS cambia el rótulo, no adónde lleva.
    const textos = textosDePrueba()
    textos.accesos.teselas.find((t) => t.clave === 'historia')!.titulo = 'Nuestros orígenes'
    responderPortada(textos)

    renderWithProviders(<AccesosRapidos />)

    const enlace = await screen.findByRole('link', { name: /nuestros orígenes/i })
    expect(enlace).toHaveAttribute('href', '/historia')
  })

  it('una tesela que el documento no trae conserva su texto de siempre', async () => {
    const textos = textosDePrueba()
    textos.accesos.teselas = textos.accesos.teselas.filter((t) => t.clave !== 'sede')
    // Ancla para forzar la espera al pintado posterior al fetch. Mientras carga
    // van huesos, pero si la API fallara saldrían los textos de partida, que son
    // justo los que se buscan: cambiar «caridad» a un valor distinto obliga a
    // `findByText` a esperar al pintado real, el que sí lee el documento sin `sede`.
    textos.accesos.teselas.find((t) => t.clave === 'caridad')!.titulo = 'Nuestra caridad'
    responderPortada(textos)

    renderWithProviders(<AccesosRapidos />)

    await screen.findByText('Nuestra caridad')
    const sede = textosDePrueba().accesos.teselas.find((t) => t.clave === 'sede')!
    expect(screen.getByText(sede.titulo)).toBeInTheDocument()
    expect(screen.getByText(sede.descripcion)).toBeInTheDocument()
  })

  it('mientras llegan los textos, cada uno es un hueso con su forma, no los de partida', async () => {
    // Se rompe si vuelven a pintarse los textos de partida mientras carga: en
    // una instalación con su contenido, cada visita empezaría con unos textos
    // que no son los suyos y que cambiarían de golpe al llegar.
    let responder!: () => void
    const textos = textosDePrueba()
    textos.accesos.placa.titulo = 'Únete a nosotros'
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      responder = () => resolve(new Response(JSON.stringify({ imagenes: [], textos }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })))
    const { container } = renderWithProviders(<AccesosRapidos />)

    const partida = textosDePrueba()
    expect(screen.queryByText(partida.accesos.placa.titulo)).not.toBeInTheDocument()
    expect(screen.queryByText(partida.accesos.teselas[0].titulo)).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-esqueleto-portada]').length).toBeGreaterThan(4)
    // Los destinos no esperan: no dependen del documento.
    expect(within(screen.getByRole('list', { name: /accesos directos/i })).getAllByRole('link')[0]).toHaveAttribute('href', '/hazte-hermano')

    responder()
    expect(await screen.findByText('Únete a nosotros')).toBeInTheDocument()
    expect(container.querySelector('[data-esqueleto-portada]')).toBeNull()
  })

  it('la letra velada de la placa es la inicial de la corporación, no una escrita', () => {
    // Era una «D» fija (la de Desamparados): en otra instalación no decía nada.
    renderWithProviders(<AccesosRapidos />)
    const [placa] = within(screen.getByRole('list', { name: /accesos directos/i })).getAllByRole('link')
    expect(within(placa).getByText(site.nombreCorto.charAt(0).toUpperCase(), { exact: true })).toHaveAttribute('aria-hidden', 'true')
  })
})
