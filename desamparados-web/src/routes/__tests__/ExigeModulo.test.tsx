import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/test-utils'
import ExigeModulo from '../ExigeModulo'
import { useAuthStore } from '../../features/altas/auth/store'
import { TODOS_CON_PAGINAS_PROPIAS } from '../../test/queryClient'

const Dentro = () => <p>La tienda</p>

function montar(ruta: string, modulos?: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path={ruta} element={<ExigeModulo modulo="tienda-web"><Dentro /></ExigeModulo>} />
    </Routes>,
    { ruta, modulos },
  )
}

describe('ExigeModulo', () => {
  it('con el módulo encendido pinta la página', () => {
    montar('/tienda')
    expect(screen.getByText('La tienda')).toBeInTheDocument()
  })

  it('en la web pública, apagado es la página de «no encontrado»', async () => {
    montar('/tienda', ['noticias'])
    expect(await screen.findByRole('heading', { name: 'Esta calle no está en el recorrido' })).toBeInTheDocument()
    expect(screen.queryByText('La tienda')).not.toBeInTheDocument()
  })

  it('en el CMS, apagado dice que el módulo no está activado y a Administración le enlaza Sistema → Módulos', async () => {
    useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'a@b.es', role: 'ADMIN', perfiles: [], origen: 'cms' }, hermano: null })
    montar('/cms/tienda', ['noticias'])
    expect(await screen.findByRole('heading', { name: /no está activado/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /módulos/i })).toHaveAttribute('href', '/cms/modulos')
  })

  it('en el CMS, a quien no es Administración no le enlaza nada', async () => {
    useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'a@b.es', role: 'REDES', perfiles: [], origen: 'cms' }, hermano: null })
    montar('/cms/tienda', ['noticias'])
    expect(await screen.findByRole('heading', { name: /no está activado/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /módulos/i })).not.toBeInTheDocument()
  })

  it('una página propia: con los módulos del ejemplo no existe; con su módulo encendido, sí', async () => {
    const Rosario = () => <p>El rosario</p>
    const propia = (modulos?: readonly string[]) => renderWithProviders(
      <Routes><Route path="/rosario" element={<ExigeModulo modulo="paginas-propias"><Rosario /></ExigeModulo>} /></Routes>,
      { ruta: '/rosario', modulos },
    )
    const { unmount } = propia()
    expect(await screen.findByRole('heading', { name: 'Esta calle no está en el recorrido' })).toBeInTheDocument()
    expect(screen.queryByText('El rosario')).not.toBeInTheDocument()
    unmount()
    propia(TODOS_CON_PAGINAS_PROPIAS)
    expect(screen.getByText('El rosario')).toBeInTheDocument()
  })

  it('nucleo pasa sin esperar a la lista', () => {
    renderWithProviders(<ExigeModulo modulo="nucleo"><Dentro /></ExigeModulo>, { modulos: [] })
    expect(screen.getByText('La tienda')).toBeInTheDocument()
  })
})
