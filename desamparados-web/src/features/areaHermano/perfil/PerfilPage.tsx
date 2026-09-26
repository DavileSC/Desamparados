import { useEffect, useState } from 'react'
import { Alert, Box, Chip, CircularProgress, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import { misFichas, type ApiProfile } from '../../../lib/api/perfil'
import { aniosCumplidos } from '../../altas/public/schema'
import { Contacto, CuotaYPago, DatosPersonales, VidaCofrade } from './apartados'
import { PARENTESCO, aDia, diaLegible } from './etiquetas'

/** La del titular primero; luego las de quienes tiene a su cargo, de mayor a menor. */
const ordenar = (fichas: ApiProfile[]) =>
  [...fichas].sort((a, b) => Number(b.esTitular) - Number(a.esTitular) || a.fechaNacimiento.localeCompare(b.fechaNacimiento))

/** «Tú · n.º 42», «Sobrino o sobrina · 12 años», «Hija o hijo · pendiente». */
function subtitulo(ficha: ApiProfile) {
  const quien = ficha.esTitular ? 'Tú' : ficha.parentesco ? PARENTESCO[ficha.parentesco] : 'A tu cargo'
  if (!ficha.activo) return `${quien} · pendiente`
  if (ficha.esTitular) return ficha.numeroHermano ? `${quien} · n.º ${ficha.numeroHermano}` : quien
  return `${quien} · ${aniosCumplidos(aDia(ficha.fechaNacimiento))} años`
}

/**
 * «Mi perfil»: la ficha propia y las de quienes tiene a su cargo, una a una.
 * Cada apartado se edita por su cuenta. Lo que lleva Secretaría (número, alta,
 * jura, padrinos) se ve y no se toca.
 *
 * La ficha elegida va en la URL (?ficha=), para volver a ella al recargar.
 */
export default function PerfilPage() {
  const [params, setParams] = useSearchParams()
  const [fichas, setFichas] = useState<ApiProfile[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    // Sin argumentos, misFichas pide la familia entera en una sola página:
    // esta pantalla elige una ficha, y un selector paginado escondería alguna.
    misFichas()
      .then((respuesta) => {
        if (cancelado) return
        setFichas(ordenar(respuesta.data))
        if (respuesta.data.length === 0) setError('No se ha encontrado ningún perfil asociado a tu cuenta.')
      })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar tu perfil.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  const pedida = Number(params.get('ficha'))
  const ficha = fichas.find((f) => f.id === pedida) ?? fichas[0] ?? null
  const sinFichaPropia = fichas.length > 0 && !fichas.some((f) => f.esTitular)
  const guardada = (nueva: ApiProfile) => setFichas((actuales) => actuales.map((f) => (f.id === nueva.id ? nueva : f)))
  const elegir = (id: number) => setParams((anteriores) => {
    const siguientes = new URLSearchParams(anteriores)
    siguientes.set('ficha', String(id))
    return siguientes
  }, { replace: true })

  return (
    <>
      <Helmet><title>Mi perfil | Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="h2" component="h1">Mi perfil</Typography>
              <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
                {fichas.length > 1 ? 'Tu ficha y las de quienes tienes a tu cargo.' : 'Tus datos en el Grupo Parroquial.'}
              </Typography>
            </Box>
            <Box component={Link} to="/area-hermano/familia" sx={{ color: 'primary.light', fontWeight: 600, fontSize: 15 }}>Apuntar a un menor</Box>
          </Box>

          {cargando && <CircularProgress aria-label="Cargando perfil" />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

          {/* Su cuenta existe para gestionar a quienes tiene a su cargo: sus fichas
              están aquí, y desde «Mi familia» puede hacerse hermano también. */}
          {sinFichaPropia && (
            <TarjetaCristal sx={{ p: 3, mb: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Typography sx={{ color: 'text.secondary', maxWidth: '62ch' }}>
                Tú no tienes ficha de hermano: esta cuenta la abriste para quienes tienes a tu cargo. Si quieres, puedes hacerte hermano sin abrir otra cuenta.
              </Typography>
              <Boton appVariant="outline" component={Link} to="/area-hermano/familia">Hacerme hermano</Boton>
            </TarjetaCristal>
          )}

          {fichas.length > 1 && (
            <Box role="group" aria-label="Fichas de tu cuenta" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
              {fichas.map((f) => {
                const abierta = f.id === ficha?.id
                return (
                  <Box
                    key={f.id}
                    component="button"
                    type="button"
                    onClick={() => elegir(f.id)}
                    aria-current={abierta ? 'true' : undefined}
                    sx={{
                      appearance: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'text.primary',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.25, minWidth: 150, minHeight: 56, px: 2.25, py: 1,
                      borderRadius: '8px', border: '1px solid',
                      borderColor: abierta ? 'rgba(255,179,180,0.45)' : 'rgba(204,196,201,0.12)',
                      backgroundColor: abierta ? 'rgba(160,61,68,0.22)' : 'rgba(18,17,19,0.6)',
                      '&:hover': { borderColor: 'rgba(255,179,180,0.45)' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
                    }}
                  >
                    <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>{f.nombre}</Box>
                    <Box component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>{subtitulo(f)}</Box>
                  </Box>
                )
              })}
            </Box>
          )}

          {ficha && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Typography component="p" sx={{ fontSize: 22, fontWeight: 600 }}>{ficha.nombre} {ficha.apellidos}</Typography>
                {ficha.activo
                  ? <Chip size="small" label="Activo" color="success" variant="outlined" />
                  : <Chip size="small" label="Pendiente de Secretaría" color="warning" />}
                {ficha.activo && (
                  <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                    {ficha.numeroHermano ? `Hermano n.º ${ficha.numeroHermano}` : 'Número pendiente de asignar'} · desde el {diaLegible(ficha.fechaAlta)}
                  </Typography>
                )}
              </Box>

              {/* `key`: al cambiar de ficha, cada apartado empieza de cero, sin arrastrar una edición a medias. */}
              <Box key={ficha.id} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5, alignItems: 'start' }}>
                <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
                  <DatosPersonales ficha={ficha} onGuardada={guardada} />
                  <VidaCofrade ficha={ficha} onGuardada={guardada} />
                </Box>
                <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
                  <Contacto ficha={ficha} onGuardada={guardada} />
                  <CuotaYPago ficha={ficha} onGuardada={guardada} />
                </Box>
              </Box>
            </>
          )}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
