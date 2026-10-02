import { describe, it, expect } from 'vitest'
import { useEffect, useState } from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../test-utils'
import { useModulos } from '../../hooks/useModulos'

/**
 * El hook solo se llama (y por tanto solo se suscribe `useQuery`) dentro de
 * este hijo, que no se monta hasta que el padre lo decide. Si `useModulos()`
 * se llamara ya en el padre, se suscribiría en el primer render y la
 * suscripción por sí sola mantendría viva la consulta: no reproduciría el
 * fallo (la caché se pierde precisamente cuando nadie está suscrito todavía).
 */
function Lectura() {
  const { activo } = useModulos()
  return <p>{activo('tienda') ? 'sí' : 'no'}</p>
}

/**
 * Monta `Lectura` después de un `await`, como hará un menú, un bloque o una
 * pantalla que primero espera algo propio (un `fetch` simulado, un `lazy`, la
 * sesión). Si la siembra de módulos no sobreviviera en el `QueryClient` de
 * pruebas hasta ese momento (sin ningún observador suscrito entretanto), se
 * vería aquí: `useModulos` volvería a pedir `/modulos` (que nadie simula en
 * este test) y `activo()` daría siempre `false`.
 */
function TrasUnAwait() {
  const [listo, setListo] = useState(false)
  useEffect(() => {
    let vivo = true
    void new Promise<void>((resolver) => setTimeout(resolver, 20)).then(() => {
      if (vivo) setListo(true)
    })
    return () => { vivo = false }
  }, [])
  return listo ? <Lectura /> : null
}

describe('AllTheProviders: la siembra de módulos', () => {
  it('sigue en caché aunque se lea después de un await', async () => {
    renderWithProviders(<TrasUnAwait />)
    expect(await screen.findByText('sí')).toBeInTheDocument()
  })

  it('con modulos: [] no da ninguno por activo', async () => {
    renderWithProviders(<TrasUnAwait />, { modulos: [] })
    expect(await screen.findByText('no')).toBeInTheDocument()
  })
})
