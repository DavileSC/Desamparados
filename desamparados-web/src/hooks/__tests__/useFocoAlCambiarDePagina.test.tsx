// Fija que, al navegar dentro de la web, el foco pasa al título de la página
// nueva (o al <main> si no tiene), y que en la primera carga no se toca.
import { describe, it, expect } from 'vitest'
import { StrictMode, useEffect, useRef, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { useFocoAlCambiarDePagina } from '../useFocoAlCambiarDePagina'

function Marco() {
  const principal = useRef<HTMLElement>(null)
  useFocoAlCambiarDePagina(principal)
  return (
    <>
      <nav><Link to="/a">A</Link> <Link to="/sin-titulo">Sin título</Link> <Link to="/tarda">Tarda</Link></nav>
      <main ref={principal} tabIndex={-1}><Outlet /></main>
    </>
  )
}

function Tarda() {
  // Como una página que espera a la API: el título llega después.
  const [lista, setLista] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLista(true), 50)
    return () => clearTimeout(t)
  }, [])
  return lista ? <h1>Llegó</h1> : <p>Cargando…</p>
}

function montar() {
  // Con StrictMode, como main.tsx: en desarrollo cada efecto corre dos veces.
  render(
    <StrictMode>
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Marco />}>
          <Route path="/" element={<h1>Inicio</h1>} />
          <Route path="/a" element={<h1>Página A</h1>} />
          <Route path="/sin-titulo" element={<p>Nada</p>} />
          <Route path="/tarda" element={<Tarda />} />
        </Route>
      </Routes>
    </MemoryRouter>
    </StrictMode>,
  )
}

describe('useFocoAlCambiarDePagina', () => {
  it('en la primera carga no mueve el foco', () => {
    montar()
    expect(document.activeElement).toBe(document.body)
  })

  it('al navegar, el foco va al h1 de la página nueva', async () => {
    montar()
    await userEvent.click(screen.getByRole('link', { name: 'A' }))
    const titulo = screen.getByRole('heading', { name: 'Página A' })
    await waitFor(() => expect(document.activeElement).toBe(titulo))
    expect(titulo).toHaveAttribute('tabindex', '-1')
  })

  it('espera al título que llega tarde', async () => {
    montar()
    await userEvent.click(screen.getByRole('link', { name: 'Tarda' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Llegó' })))
  })

  it('sin h1, al cabo del tope el foco va al <main>', async () => {
    montar()
    await userEvent.click(screen.getByRole('link', { name: 'Sin título' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')), { timeout: 6000 })
  })
})
