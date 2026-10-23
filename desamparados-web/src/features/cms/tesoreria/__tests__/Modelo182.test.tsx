import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import Modelo182 from '../Modelo182'
import { deLaCorporacion } from '../../../../domain/articulos'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const anio = new Date().getFullYear() - 1

const CONFIG = { nif: 'R2900001E', telefono: '644900167', contacto: 'Pérez López Juan', firmanteNombre: 'Juan Pérez', firmanteCargo: 'Secretario', cuotas: true }
const ANA = {
  nif: '12345678Z', nifRepresentante: null, apellidosYNombre: 'RUIZ GIL ANA', nombre: 'Ana Ruiz Gil', email: 'ana@example.com',
  provincia: '29', provinciaSupuesta: false, naturaleza: 'F', centimos: 300_00, porcentaje: 40, recurrente: true, aportaciones: [],
}
const RESUMEN = {
  ejercicio: anio, configuracion: CONFIG, declarados: [ANA], total: 300_00,
  excluidos: [{ nombre: 'Pedro Sin Dni', centimos: 30_00, motivo: 'Sin DNI en la ficha.' }],
  anonimos: { cuantos: 2, centimos: 15_00 }, faltaParaElFichero: [], enviados: null,
  envio: { pendientes: 0, fallidos: 0 },
}

function servidor(resumen: unknown = RESUMEN) {
  const llamadas: { url: string; metodo: string }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    llamadas.push({ url: String(url), metodo: init.method ?? 'GET' })
    if (String(url).includes('/enviar/reintentar')) return Promise.resolve(json({ message: '2 certificados vuelven a la cola de correos.' }))
    if (String(url).includes('/enviar')) return Promise.resolve(json({ enCola: 1, sinCorreo: 0, message: '1 certificado puesto en la cola de correos.' }))
    return Promise.resolve(json(resumen))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('Modelo182', () => {
  it('enseña los donantes con su deducción, lo que no se puede declarar y ofrece el fichero', async () => {
    servidor()
    renderWithProviders(<Modelo182 puedeCambiar />)
    expect(await screen.findByText('Ana Ruiz Gil')).toBeInTheDocument()
    expect(screen.getByText('Recurrente')).toBeInTheDocument()
    expect(screen.getByText(/Pedro Sin Dni/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Número de justificante' })).toHaveValue(`182${anio}000001`)
    expect(screen.getByRole('button', { name: 'Descargar el fichero' })).toBeEnabled()
  })

  it('sin el NIF del Grupo no deja sacar el fichero ni los certificados', async () => {
    servidor({ ...RESUMEN, configuracion: { ...CONFIG, nif: null }, faltaParaElFichero: ['el NIF del Grupo'] })
    renderWithProviders(<Modelo182 puedeCambiar />)
    expect(await screen.findByText(/Para sacar el fichero falta el NIF del Grupo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todos los certificados (PDF)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Certificado' })).toBeDisabled()
  })

  it('manda los certificados por correo tras confirmarlo', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<Modelo182 puedeCambiar />)
    await user.click(await screen.findByRole('button', { name: 'Mandarlos por correo (1)' }))
    await user.click(screen.getByRole('button', { name: 'Mandar' }))
    expect(await screen.findByText('1 certificado puesto en la cola de correos.')).toBeInTheDocument()
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.url.includes(`/modelo-182/enviar?ejercicio=${anio}`))).toBe(true))
  })

  it('mientras quedan certificados en la cola no deja mandarlos otra vez, y dice cuántos faltan', async () => {
    servidor({ ...RESUMEN, enviados: { el: `${anio + 1}-01-20T10:00:00Z`, cuantos: 400 }, envio: { pendientes: 150, fallidos: 0 } })
    renderWithProviders(<Modelo182 puedeCambiar />)
    expect(await screen.findByText(/quedan 150 de 400 por salir/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mandarlos por correo (1)' })).toBeDisabled()
  })

  it('los que fallaron se vuelven a intentar desde aquí', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ ...RESUMEN, enviados: { el: `${anio + 1}-01-20T10:00:00Z`, cuantos: 3 }, envio: { pendientes: 0, fallidos: 2 } })
    renderWithProviders(<Modelo182 puedeCambiar />)
    expect(await screen.findByText(/2 certificados no han podido salir/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a intentarlo' }))
    expect(await screen.findByText('2 certificados vuelven a la cola de correos.')).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'POST' && l.url.includes(`/modelo-182/enviar/reintentar?ejercicio=${anio}`))).toBe(true)
  })

  it('el Hermano Mayor lo ve, pero no manda ni cambia los datos', async () => {
    servidor()
    renderWithProviders(<Modelo182 puedeCambiar={false} />)
    await screen.findByText('Ana Ruiz Gil')
    expect(screen.queryByRole('button', { name: /Mandarlos por correo/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Ver datos ${deLaCorporacion({ corto: true })}` })).toBeInTheDocument()
  })
})
