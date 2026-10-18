import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { LazyMotion, domAnimation } from 'framer-motion'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import theme from '../../theme'
import MarcoPublico, { siempreAbierta } from '../MarcoPublico'
import { crearQueryClientDePruebas, sembrarEstadoDeLaWeb } from '../../test/queryClient'
import { useAuthStore, type AuthUser } from '../../features/altas/auth/store'
import type { EstadoDeLaWeb } from '../../lib/api/web'

const CERRADA: EstadoDeLaWeb = { abierta: false, mensaje: 'Nos vemos el Sábado de Pasión', fecha: '2027-03-20' }
const cargo = (role: string): AuthUser => ({ id: 1, email: 'junta@ejemplo.es', role, perfiles: [], origen: 'cms' })

function montar(ruta: string, estado: EstadoDeLaWeb = CERRADA) {
  const cliente = crearQueryClientDePruebas()
  sembrarEstadoDeLaWeb(cliente, estado)
  return render(
    <QueryClientProvider client={cliente}>
      <ThemeProvider theme={theme}>
        <LazyMotion features={domAnimation} strict>
          <MemoryRouter initialEntries={[ruta]}>
            <Routes>
              <Route path="/" element={<MarcoPublico />}>
                <Route path="*" element={<p>La página de verdad</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </LazyMotion>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('la web cerrada', () => {
  beforeEach(() => { useAuthStore.setState({ status: 'listo', cms: null, hermano: null }) })

  it('sin sesión del CMS se ve «Próximamente», con el texto y el día, y no la página', () => {
    montar('/historia')
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
    expect(screen.getByText('Nos vemos el Sábado de Pasión')).toBeInTheDocument()
    expect(screen.getByText('Sábado, 20 de marzo de 2027')).toBeInTheDocument()
    expect(screen.queryByText('La página de verdad')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aviso legal' })).toHaveAttribute('href', '/aviso-legal')
  })

  it('los textos legales y la vuelta de un pago siguen abiertos', () => {
    montar('/politica-privacidad')
    expect(screen.getByText('La página de verdad')).toBeInTheDocument()
    expect(siempreAbierta('/tienda/pedido/abc123')).toBe(true)
    expect(siempreAbierta('/boletin/baja')).toBe(true)
    expect(siempreAbierta('/tienda')).toBe(false)
    expect(siempreAbierta('/')).toBe(false)
  })

  it('mientras no se sabe si hay sesión del CMS, no enseña nada', () => {
    useAuthStore.setState({ status: 'cargando' })
    montar('/historia')
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(screen.queryByText('La página de verdad')).not.toBeInTheDocument()
  })

  it('el Hermano Mayor con sesión ve la web entera, con el aviso y el enlace para abrirla', () => {
    useAuthStore.setState({ cms: cargo('HERMANO_MAYOR') })
    montar('/historia')
    expect(screen.getByText('La página de verdad')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('La web está cerrada')
    expect(screen.getByRole('link', { name: 'Abrirla' })).toHaveAttribute('href', '/cms/web')
  })

  it('otro cargo la ve igual, pero sin el enlace, que no podría usar', () => {
    useAuthStore.setState({ cms: cargo('TESORERIA') })
    montar('/historia')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrirla' })).not.toBeInTheDocument()
  })

  it('abierta, nadie ve el aviso', () => {
    useAuthStore.setState({ cms: cargo('ADMIN') })
    montar('/historia', { abierta: true, mensaje: null, fecha: null })
    expect(screen.getByText('La página de verdad')).toBeInTheDocument()
    expect(screen.queryByText(/La web está cerrada/)).not.toBeInTheDocument()
  })
})
