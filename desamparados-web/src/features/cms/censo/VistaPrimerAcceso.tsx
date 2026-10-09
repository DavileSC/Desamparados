import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { invitarPrimerAcceso, listarPrimerAcceso, type CifrasPrimerAcceso, type CuentaPrimerAcceso, type EstadoPrimerAcceso } from '../../../lib/api/primerAcceso'
import { usePaginacion } from '../../../hooks/usePaginacion'
import Paginador from '../../../components/Paginador'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import type { MetaPaginacion } from '../../../lib/api/tipos'

/** Mientras salen invitaciones, la lista se pone al día sola cada tanto. */
const REFRESCO_MS = 5000

const dia = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

function situacion(c: CuentaPrimerAcceso): { texto: string; color: string } {
  if (c.fichaConfirmadaEn) return { texto: `Confirmó el ${dia(c.fichaConfirmadaEn)}`, color: 'success.main' }
  if (c.enCola) return { texto: 'Invitación saliendo', color: 'text.secondary' }
  if (c.invitadoEn) return { texto: `Invitado el ${dia(c.invitadoEn)}`, color: 'warning.main' }
  return { texto: 'Sin invitar', color: 'text.secondary' }
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
  const [aviso, setAviso] = useState<string | null>(null)
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
    setTrabajando(true); setError(null); setAviso(null)
    try {
      const { encoladas } = await invitarPrimerAcceso(ids)
      setAviso(`${plural(encoladas, 'invitación', 'invitaciones')} en camino. Salen de una en una: ${encoladas > 1 ? 'tardarán unos minutos' : 'llegará enseguida'}.`)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido mandar las invitaciones.')
    } finally {
      enMarcha.current = false
      setTrabajando(false)
    }
  }

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

      <TextField
        size="small"
        label="Buscar por nombre o correo"
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); irAPagina(1) }}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
      />

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
            const { texto, color } = situacion(c)
            return (
              <Box component="li" key={c.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.75, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {c.apellidos}, {c.nombre}
                    {c.numeroHermano !== null && <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}> · n.º {c.numeroHermano}</Box>}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                    {c.email}{c.aCargo > 0 && ` · ${plural(c.aCargo, 'ficha', 'fichas')} a su cargo`}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ color, fontWeight: 600 }}>{texto}</Typography>
                  {!c.fichaConfirmadaEn && !c.enCola && (
                    <Button
                      variant="outlined"
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
