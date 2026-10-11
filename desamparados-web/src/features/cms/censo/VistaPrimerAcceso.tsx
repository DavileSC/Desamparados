import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { invitarPrimerAcceso, listarPrimerAcceso, type CifrasPrimerAcceso, type CuentaPrimerAcceso, type EstadoPrimerAcceso } from '../../../lib/api/primerAcceso'
import { usePaginacion } from '../../../hooks/usePaginacion'
import Paginador from '../../../components/Paginador'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import CampoBusqueda from '../listados/CampoBusqueda'
import type { MetaPaginacion } from '../../../lib/api/tipos'

/** Mientras salen invitaciones, la lista se pone al día sola cada tanto. */
const REFRESCO_MS = 5000

const dia = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * En qué está la cuenta. Lo que importa a Secretaría es si el enlace del
 * correo aún le sirve: si caducó o lo pisó una recuperación, hay que
 * reenviarlo, y el botón se destaca (`reenviar`). La situación la calcula el
 * servidor; aquí solo se dice.
 */
function situacion(c: CuentaPrimerAcceso): { texto: string; color: string; reenviar: boolean } {
  if (c.fichaConfirmadaEn || !c.invitacion) {
    return { texto: c.fichaConfirmadaEn ? `Confirmó el ${dia(c.fichaConfirmadaEn)}` : 'Confirmó', color: 'success.main', reenviar: false }
  }
  if (c.enCola) return { texto: 'Invitación saliendo', color: 'text.secondary', reenviar: false }
  const { estado, caducaEn } = c.invitacion
  switch (estado) {
    case 'vigente':
      return { texto: `Invitado · el enlace vale hasta el ${caducaEn ? dia(caducaEn) : '—'}`, color: 'warning.main', reenviar: false }
    case 'caducada':
      return { texto: `El enlace caducó el ${caducaEn ? dia(caducaEn) : '—'}`, color: 'error.main', reenviar: true }
    case 'sustituida':
      return { texto: 'El enlace ya no vale: pidió otro para recuperar la contraseña', color: 'error.main', reenviar: true }
    case 'estrenada':
      return { texto: 'Ya entró; falta que confirme la ficha', color: 'text.primary', reenviar: false }
    default:
      return { texto: 'Sin invitar', color: 'text.secondary', reenviar: false }
  }
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Las cuentas que trajo el censo importado: a quién falta invitar, quién está
 * invitado y aún no ha entrado, y quién ya confirmó su ficha. Desde aquí se
 * mandan las invitaciones (a todos los que faltan, o una a una para reenviar).
 */
export default function VistaPrimerAcceso() {
  const [estado, setEstado] = useState<EstadoPrimerAcceso | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [filas, setFilas] = useState<CuentaPrimerAcceso[]>([])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [cifras, setCifras] = useState<CifrasPrimerAcceso | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Cuántas se acaban de mandar: el aviso dice «en camino» mientras salen y
  // «enviadas» cuando ya no queda ninguna en cola (antes se quedaba puesto
  // «tardarán unos minutos» con todas ya fuera).
  const [mandadas, setMandadas] = useState<number | null>(null)
  const [preguntar, setPreguntar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  // Guarda síncrona: un doble clic llegaría antes que el estado.
  const enMarcha = useRef(false)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion('PrimerAcceso')

  const cargar = useCallback(() =>
    listarPrimerAcceso({ estado: estado || undefined, q: busqueda }, { pagina, porPagina }).then((r) => {
      setFilas(r.data)
      setMeta(r.meta)
      setCifras(r.cifras)
    }), [estado, busqueda, pagina, porPagina])

  useEffect(() => {
    let cancelado = false
    cargar().catch((e: unknown) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se ha podido cargar el primer acceso.') })
    return () => { cancelado = true }
  }, [cargar])

  const saliendo = (cifras?.enCola ?? 0) > 0
  useEffect(() => {
    if (!saliendo) return
    const reloj = window.setInterval(() => { void cargar().catch(() => undefined) }, REFRESCO_MS)
    return () => window.clearInterval(reloj)
  }, [saliendo, cargar])

  const invitar = async (ids?: number[]) => {
    if (enMarcha.current) return
    enMarcha.current = true
    setTrabajando(true); setError(null); setMandadas(null)
    try {
      const { encoladas } = await invitarPrimerAcceso(ids)
      await cargar()
      setMandadas(encoladas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido mandar las invitaciones.')
    } finally {
      enMarcha.current = false
      setTrabajando(false)
    }
  }

  const aviso = mandadas === null ? null : saliendo
    ? `${plural(mandadas, 'invitación', 'invitaciones')} en camino. Salen de una en una: ${mandadas > 1 ? 'tardarán unos minutos' : 'llegará enseguida'}.`
    : `${plural(mandadas, 'invitación enviada', 'invitaciones enviadas')}.`

  const filtro = (valor: EstadoPrimerAcceso | '', etiqueta: string) => (
    <Chip
      label={etiqueta}
      clickable
      color={estado === valor ? 'primary' : 'default'}
      variant={estado === valor ? 'filled' : 'outlined'}
      onClick={() => { setEstado(valor); irAPagina(1) }}
    />
  )

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Typography sx={{ color: 'text.secondary', mb: 2, maxWidth: '72ch' }}>
        Los hermanos que entraron con el censo importado y tienen correo. La invitación les lleva a poner su contraseña y
        revisar su ficha y las de los familiares que figuran con su correo. El enlace vale dos semanas.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} role="group" aria-label="Mostrar">
          {filtro('', 'Todos')}
          {filtro('sin-invitar', `Sin invitar (${cifras?.sinInvitar ?? 0})`)}
          {filtro('invitado', `Invitados (${cifras?.invitados ?? 0})`)}
          {filtro('confirmado', `Confirmados (${cifras?.confirmados ?? 0})`)}
        </Box>
        <Button variant="contained" disabled={trabajando || !cifras?.sinInvitar} onClick={() => setPreguntar(true)} sx={{ flexShrink: 0 }}>
          Invitar a los que faltan{cifras?.sinInvitar ? ` (${cifras.sinInvitar})` : ''}
        </Button>
      </Stack>

      {/* Con espera, como las demás búsquedas del CMS: una petición por letra saturaba el limitador. */}
      <Box sx={{ mb: 2, display: 'flex', width: { xs: '100%', sm: 320 } }}>
        <CampoBusqueda etiqueta="Buscar por nombre o correo" valor={busqueda} onCambiar={(q) => { setBusqueda(q); irAPagina(1) }} />
      </Box>

      {saliendo && <Alert severity="info" sx={{ mb: 2 }}>Saliendo: {plural(cifras!.enCola, 'invitación pendiente', 'invitaciones pendientes')} de enviar.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {aviso && <Alert severity="success" sx={{ mb: 2 }}>{aviso}</Alert>}

      {!meta ? <CircularProgress aria-label="Cargando el primer acceso" /> : filas.length === 0 ? (
        <Typography sx={{ py: 3 }}>
          {estado || busqueda ? 'Nadie con estos filtros.' : 'Aún no hay cuentas del censo importado. Aparecen al importar el censo desde «Importar».'}
        </Typography>
      ) : (
        <Box component="ul" aria-label="Cuentas del censo importado" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {filas.map((c) => {
            const { texto, color, reenviar } = situacion(c)
            return (
              <Box component="li" key={c.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.75, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {c.apellidos}, {c.nombre}
                    {c.numeroHermano !== null && <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', whiteSpace: 'nowrap' }}> · n.º{'\u00a0'}{c.numeroHermano}</Box>}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                    {c.email}{c.aCargo > 0 && ` · ${plural(c.aCargo, 'ficha', 'fichas')} a su cargo`}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ color, fontWeight: 600 }}>{texto}</Typography>
                  {!c.fichaConfirmadaEn && !c.enCola && (
                    <Button
                      variant={reenviar ? 'contained' : 'outlined'}
                      size="small"
                      disabled={trabajando}
                      onClick={() => void invitar([c.id])}
                      aria-label={`${c.invitadoEn ? 'Reenviar la invitación a' : 'Invitar a'} ${c.nombre} ${c.apellidos}`}
                    >
                      {c.invitadoEn ? 'Reenviar' : 'Invitar'}
                    </Button>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
      {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="cuentas" />}

      <DialogoConfirmacion
        abierto={preguntar}
        titulo="¿Mandar las invitaciones?"
        mensaje={`Se mandará la invitación por correo a ${plural(cifras?.sinInvitar ?? 0, 'hermano que falta', 'hermanos que faltan')}. Salen de una en una para no pasar del cupo del correo: con muchos, tardan unos minutos.`}
        textoConfirmar="Mandar invitaciones"
        onConfirmar={() => { setPreguntar(false); void invitar() }}
        onCancelar={() => setPreguntar(false)}
      />
    </Paper>
  )
}
