import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import { site } from '../../../config/site'
import AccesosRapidos from '../AccesosRapidos'
import { textosDePrueba, responderPortada } from './ayudas'

// `site` es de solo lectura en los tipos, pero en tiempo de ejecución es un objeto
// normal: así se simula que alguien rellena el canal de YouTube en la configuración.
const redes = site.redes as { youtube: string | null }
const youtubeOriginal = redes.youtube

describe('AccesosRapidos', () => {
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
      '/parroquia-pasionistas',
      '/nuestros-fines/caridad',
      '/historia',
      '/publicaciones/boletines',
      '/contacto',
    ])
  })

  it('anuncia en cada enlace qué hay detrás, no solo su título', () => {
    // Se rompe si la descripción se saca del enlace: un lector de pantalla
    // volvería a oír solo «Boletines», sin contexto.
    renderWithProviders(<AccesosRapidos />)

    expect(
      screen.getByRole('link', { name: /boletines.*boletín informativo y anuarios/i }),
    ).toHaveAttribute('href', '/publicaciones/boletines')
  })

  it('destaca «Hazte hermano» como primer acceso, con titular y llamada a la acción', () => {
    // Se rompe si la captación de hermanos vuelve a ser un acceso más, sin
    // titular ni botón, o si su texto deja de llegar al lector de pantalla.
    renderWithProviders(<AccesosRapidos />)

    const lista = screen.getByRole('list', { name: /accesos directos/i })
    const [primero] = within(lista).getAllByRole('link')

    expect(primero).toHaveAttribute('href', '/hazte-hermano')
    expect(primero).toHaveAccessibleName(/hazte hermano.*forma parte de nuestra historia.*quiero ser hermano/i)
    expect(primero).toHaveAccessibleDescription(/comunidad de fe/i)
  })

  it('con un número impar de accesos pequeños, Contacto ocupa la fila entera con «Escríbenos»', () => {
    // Hoy son cinco (sin YouTube): si el último no se estira, queda un hueco en el mosaico.
    renderWithProviders(<AccesosRapidos />)

    const contacto = screen.getByRole('link', { name: /contacto/i })
    expect(within(contacto).getByText('Escríbenos')).toBeInTheDocument()
  })

  it('con YouTube configurado, Contacto vuelve a ser un acceso normal', () => {
    // Con seis accesos pequeños el mosaico cuadra solo: estirar Contacto lo descuadraría.
    redes.youtube = 'https://www.youtube.com/@desamparadosmalaga'
    renderWithProviders(<AccesosRapidos />)

    expect(screen.getByRole('link', { name: /canal de youtube/i })).toHaveAttribute('href', redes.youtube)
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
    // Ancla para forzar la espera al pintado posterior al fetch: «Nuestra sede» y
    // «Parroquia de los Pasionistas» son iguales al valor por defecto, así que por sí
    // solos ya estarían en el primer pintado (el de respaldo, antes de resolver el
    // fetch simulado) y no probarían nada. Cambiar «caridad» a un valor distinto del
    // por defecto obliga a `findByText` a esperar al pintado real, el que sí lee el
    // documento sin `sede`.
    textos.accesos.teselas.find((t) => t.clave === 'caridad')!.titulo = 'Nuestra caridad'
    responderPortada(textos)

    renderWithProviders(<AccesosRapidos />)

    await screen.findByText('Nuestra caridad')
    expect(screen.getByText('Nuestra sede')).toBeInTheDocument()
    expect(screen.getByText('Parroquia de los Pasionistas')).toBeInTheDocument()
  })
})
