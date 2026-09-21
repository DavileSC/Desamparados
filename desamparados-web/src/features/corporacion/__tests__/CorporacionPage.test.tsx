import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import CorporacionPage from '../CorporacionPage'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

/**
 * Lo que esta página decía ANTES de convertirla, copiado a mano del .tsx
 * original. Si la migración se come un párrafo, este test lo caza.
 */
const ANTES = [
  'El Grupo Parroquial de Nuestra Señora de los Desamparados',
  'Como Grupo Parroquial, desarrollamos una intensa labor espiritual',
  'A continuación puedes conocer más sobre nuestra historia',
  'Explora la sección',
  'Historia', 'Parroquia', 'Nuestros fines', 'Cultos', 'Sábado de Pasión',
]

afterEach(() => { vi.unstubAllGlobals() })

/**
 * Devuelve el propio mock para que quien llame pueda comprobar no solo qué
 * respondió, sino A QUÉ SE LE PREGUNTÓ: esta implementación responde lo mismo
 * sea cual sea la URL, así que por sí sola nunca detectaría un slug mal
 * escrito o una ruta equivocada. Sin la aserción sobre los argumentos de la
 * llamada, ese hueco queda abierto.
 */
function responder(datos: unknown = POR_DEFECTO.corporacion) {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/**
 * A propósito, NADA de esto coincide con `shared/contenido-por-defecto.json`:
 * la prueba que la usa solo puede pasar si la página de verdad pinta lo que
 * responde el servidor, y no el contenido de partida que lleva escrito para
 * cuando el servidor tarda o falla.
 */
const CONTENIDO_DISTINTO_DEL_DE_PARTIDA = {
  cabecera: { titulo: 'Cableado a prueba', subtitulo: '', foto: '', fotoAlt: '' },
  bloques: [
    { tipo: 'texto', titulo: '', html: '<p>Frase exclusiva de esta prueba, ausente del contenido de partida.</p>' },
  ],
}

describe('CorporacionPage', () => {
  it('sigue diciendo lo mismo que antes de convertirla a bloques', async () => {
    responder()
    renderWithProviders(<CorporacionPage />)

    await screen.findByText(/El Grupo Parroquial de Nuestra Señora/)
    const visible = document.body.textContent ?? ''
    for (const fragmento of ANTES) {
      expect(visible, `se ha perdido: «${fragmento}»`).toContain(fragmento)
    }
  })

  it('los enlaces de las tarjetas llevan a donde llevaban', async () => {
    responder()
    renderWithProviders(<CorporacionPage />)

    expect(await screen.findByRole('link', { name: /Historia/ })).toHaveAttribute('href', '/corporacion/historia')
    expect(screen.getByRole('link', { name: /Sábado de Pasión/ })).toHaveAttribute('href', '/corporacion/sabado-de-pasion')
  })

  it('si el servidor no responde, la página no se queda en blanco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    renderWithProviders(<CorporacionPage />)

    // La cabecera es lo mínimo que tiene que quedar en pie.
    expect(await screen.findByRole('heading', { name: 'Corporación' })).toBeInTheDocument()
  })

  it('lo que se ve es lo que sirve el CMS, no el contenido de partida', async () => {
    const fetchMock = responder(CONTENIDO_DISTINTO_DEL_DE_PARTIDA)
    renderWithProviders(<CorporacionPage />)

    await screen.findByText(/Frase exclusiva de esta prueba/)
    // Si la página se hubiera quedado enseñando el contenido de partida sin
    // consultar de verdad al servidor, esta tarjeta —que solo está en el
    // JSON por defecto— seguiría en pantalla.
    expect(screen.queryByText('Explora la sección')).not.toBeInTheDocument()
    // Y no basta con que llegue contenido con pinta de válido: tiene que
    // haberse pedido la ruta de Corporación y no la de otra página, ni una con
    // el slug mal escrito. El mock de arriba respondería igual a cualquier
    // URL, así que sin esta aserción un cableado a la ruta equivocada pasaría
    // inadvertido.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/contenido/corporacion'),
      expect.anything(),
    )
  })
})
