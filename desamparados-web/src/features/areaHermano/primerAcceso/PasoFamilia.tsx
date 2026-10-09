import { useState } from 'react'
import { Alert, Box, Button, Collapse, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import Boton from '../../../components/Boton'
import TarjetaCristal from '../../../components/TarjetaCristal'
import { actualizarFicha, type ApiProfile } from '../../../lib/api/perfil'
import { PARENTESCOS, type Parentesco } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { aniosCumplidos } from '../../altas/public/schema'
import { Contacto, CuotaYPago, DatosPersonales } from '../perfil/apartados'
import { aDia, diaLegible } from '../perfil/etiquetas'
import { enUnaFrase, faltanDelFamiliar } from './obligatorios'

const nombreCompleto = (f: ApiProfile) => `${f.nombre} ${f.apellidos}`.trim()

/**
 * Lo que dice del contacto de un familiar frente al del titular: casi siempre
 * comparten correo y casa (por eso cuelga de su cuenta), y repetir los once
 * campos de cada uno solo alargaba la revisión.
 */
function contactoFrenteA(f: ApiProfile, titular: ApiProfile | null): string {
  const mismaCasa = !!titular && !!f.direccion && f.direccion.trim().toLowerCase() === titular.direccion?.trim().toLowerCase() && f.codigoPostal === titular.codigoPostal
  const mismoCorreo = !!titular && !!f.email && f.email.toLowerCase() === titular.email?.toLowerCase()
  if (mismaCasa && mismoCorreo) return 'Correo y domicilio: los mismos que los tuyos'
  const correo = mismoCorreo ? 'Tu correo' : f.email ? `Correo ${f.email}` : 'Sin correo'
  const casa = mismaCasa ? 'tu domicilio' : f.direccion ? `vive en ${[f.direccion, [f.codigoPostal, f.poblacion].filter(Boolean).join(' ')].filter(Boolean).join(', ')}` : 'sin domicilio'
  return `${correo} · ${casa}`
}

/**
 * Todos los que cuelgan de la cuenta en una sola pantalla. Lo único que no
 * traía el censo es qué es cada uno para el titular: se elige de un toque y se
 * guarda en el acto. Lo demás se lee en una línea y, si algo no está bien, se
 * abre su ficha entera. «Están bien, seguir» espera a que no falte nada.
 */
export default function PasoFamilia({ familia, titular, conCuotas, onGuardada, onDevolver, onSeguir }: {
  familia: ApiProfile[]
  titular: ApiProfile | null
  conCuotas: boolean
  onGuardada: (ficha: ApiProfile) => void
  onDevolver: (ficha: ApiProfile) => void
  onSeguir: () => void
}) {
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set())
  const [guardando, setGuardando] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const listos = familia.filter((f) => faltanDelFamiliar(f).length === 0).length
  const todosHijos = familia.every((f) => f.parentesco === 'HIJO')

  const ponerParentesco = async (fichas: ApiProfile[], parentesco: Parentesco) => {
    const ids = fichas.map((f) => f.id)
    setGuardando((g) => new Set([...g, ...ids])); setError(null)
    try {
      for (const f of fichas) {
        const { data } = await actualizarFicha(f.id, { parentesco })
        onGuardada(data)
      }
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e.message : 'No se ha podido guardar. Inténtalo otra vez.')
    } finally {
      setGuardando((g) => new Set([...g].filter((id) => !ids.includes(id))))
    }
  }

  const alternar = (id: number) => setAbiertas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography role="status" sx={{ fontSize: 15, color: 'text.secondary' }}>
          {listos === familia.length ? (familia.length === 1 ? 'Lista.' : 'Todos, listos.') : `${listos} de ${familia.length} listos`}
        </Typography>
        {familia.length > 1 && !todosHijos && (
          <Boton appVariant="claro" onClick={() => void ponerParentesco(familia.filter((f) => f.parentesco !== 'HIJO'), 'HIJO')} disabled={guardando.size > 0} sx={{ minHeight: 44, px: 2.25, fontSize: 15 }}>
            Son todos mis hijos
          </Boton>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}

      {familia.map((f) => {
        const otros = faltanDelFamiliar(f).filter((c) => c.campo !== 'parentesco')
        const abierta = abiertas.has(f.id) || otros.length > 0
        const edad = f.fechaNacimiento ? aniosCumplidos(aDia(f.fechaNacimiento)) : null
        const detalle = [
          edad !== null ? `${edad} años` : null,
          f.fechaNacimiento ? `nació el ${diaLegible(f.fechaNacimiento)}` : null,
          f.dni ? `DNI ${f.dni}` : 'sin DNI',
        ].filter(Boolean).join(' · ')
        return (
          <TarjetaCristal key={f.id} component="article" aria-label={nombreCompleto(f)} sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h2" sx={{ fontSize: { xs: 19, md: 21 }, fontWeight: 600 }}>
                  {nombreCompleto(f)}
                  {f.numeroHermano && <Box component="span" sx={{ fontSize: 14, fontWeight: 500, color: 'text.secondary', ml: 1 }}>n.º {f.numeroHermano}</Box>}
                </Typography>
                <Typography sx={{ fontSize: { xs: 14, md: 15 }, color: 'text.secondary', mt: 0.5 }}>{detalle}</Typography>
              </Box>
              {f.parentesco && otros.length === 0
                ? <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 14, fontWeight: 600, color: 'success.light', '& svg': { fontSize: 18 } }}><CheckIcon aria-hidden="true" />Listo</Typography>
                : <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'warning.light' }}>{f.parentesco ? `Falta: ${enUnaFrase(otros)}` : 'Falta decir qué es para ti'}</Typography>}
            </Box>

            <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
              <Typography component="legend" sx={{ p: 0, mb: 1, fontSize: 14, color: 'text.secondary' }}>¿Qué es {f.nombre} para ti?</Typography>
              {/* En el móvil, dos por fila para tocarlos bien; en pantalla ancha, a su medida y en una sola fila. */}
              <Box sx={{ display: { xs: 'grid', sm: 'flex' }, flexWrap: 'wrap', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                {PARENTESCOS.map((p) => {
                  const elegido = f.parentesco === p.value
                  return (
                    <Button
                      key={p.value}
                      aria-pressed={elegido}
                      disabled={guardando.has(f.id)}
                      onClick={() => { if (!elegido) void ponerParentesco([f], p.value) }}
                      startIcon={elegido ? <CheckIcon /> : undefined}
                      sx={{
                        minHeight: 48, borderRadius: 0, textTransform: 'none', letterSpacing: 0, fontSize: 15, px: { xs: 1.25, sm: 2 },
                        fontWeight: elegido ? 600 : 500, color: 'text.primary',
                        border: '1px solid', borderColor: elegido ? '#6e1822' : 'rgba(255,255,255,0.22)',
                        backgroundColor: elegido ? '#6e1822' : 'transparent',
                        '&:hover': { backgroundColor: elegido ? '#6e1822' : 'rgba(255,255,255,0.06)' },
                        '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: 2 },
                      }}
                    >
                      {p.label}
                    </Button>
                  )
                })}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, pt: 1.5, borderTop: 1, borderColor: 'divider', fontSize: { xs: 14, md: 15 }, color: 'text.secondary' }}>
              <HomeOutlinedIcon aria-hidden="true" sx={{ fontSize: 20, mt: '1px' }} />
              <span>{contactoFrenteA(f, titular)}</span>
            </Box>

            <Collapse in={abierta} unmountOnExit>
              <Box sx={{ display: 'grid', gap: 2.5, pt: 1 }}>
                <DatosPersonales ficha={f} onGuardada={onGuardada} revision={{ editando: otros.length > 0 }} />
                <Contacto ficha={f} onGuardada={onGuardada} />
                {conCuotas && <CuotaYPago ficha={f} onGuardada={onGuardada} />}
              </Box>
            </Collapse>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '8px 24px', flexWrap: 'wrap' }}>
              {otros.length === 0 && (
                <Button onClick={() => alternar(f.id)} aria-expanded={abierta} sx={{ minHeight: 44, px: 0.5, color: 'secondary.light', textTransform: 'none', letterSpacing: 0, fontSize: 15, fontWeight: 600 }}>
                  {abierta ? 'Cerrar sus datos' : 'Ver o cambiar sus datos'}
                </Button>
              )}
              <Button onClick={() => onDevolver(f)} sx={{ minHeight: 44, px: 0.5, color: 'text.secondary', textTransform: 'none', letterSpacing: 0, fontSize: 15 }}>
                No es de mi familia
              </Button>
            </Box>
          </TarjetaCristal>
        )
      })}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Boton onClick={onSeguir} disabled={listos < familia.length} sx={{ alignSelf: { sm: 'flex-start' }, py: 1.75, px: 4, fontSize: 16 }}>Están bien, seguir</Boton>
        {listos < familia.length && <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>Elige qué es cada uno para ti y podrás seguir.</Typography>}
      </Box>
    </>
  )
}
