import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { enviosEnMarcha, reintentarEnvio, type EnvioEnMarcha } from '../../lib/api/comunicados'

const ESTADO: Record<EnvioEnMarcha['estado'], { texto: string; color: 'default' | 'info' | 'warning' | 'success' }> = {
  EN_COLA: { texto: 'En cola', color: 'default' },
  ENVIANDO: { texto: 'Enviándose', color: 'info' },
  SIGUE_MANANA: { texto: 'Sigue mañana', color: 'warning' },
  TERMINADO: { texto: 'Terminado', color: 'success' },
}

/**
 * Los envíos a muchos y el tope de correos del día (forma B de las maquetas,
 * traspaso-2026-10-14 §5): el servicio de envío gratis deja unos cientos al
 * día, y un envío a todos los hermanos se reparte en varios. Aquí se ve
 * cuánto salió hoy, qué va al móvil y qué espera a mañana.
 */
export default function EnviosEnMarcha() {
  const { data } = useQuery({
    queryKey: ['envios-en-marcha'],
    queryFn: enviosEnMarcha,
    // Mientras algo sale, se va viendo cómo avanza.
    refetchInterval: (q) => (q.state.data?.envios.some((e) => e.estado === 'ENVIANDO' || e.estado === 'EN_COLA') ? 15_000 : false),
  })
  const cliente = useQueryClient()
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  // Si el servicio de correo se cae a mitad, todo lo pendiente queda fallido:
  // la apertura de papeletas y los recordatorios no tenían otra forma de volver a salir.
  const reintentar = useMutation({
    mutationFn: reintentarEnvio,
    onSuccess: (r) => { setAviso({ tipo: 'success', texto: r.message }); void cliente.invalidateQueries({ queryKey: ['envios-en-marcha'] }) },
    onError: (e) => setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se ha podido reintentar.' }),
  })
  if (!data) return null
  const { hoy, envios } = data
  const lleno = Math.min(100, (hoy.enviados / hoy.tope) * 100)

  return (
    <Box sx={{ display: 'grid', gap: 2, mb: 3 }}>
      <Paper sx={{ p: 2.5, display: 'grid', gap: 1.25 }}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>Correos de hoy</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <LinearProgress variant="determinate" value={lleno} aria-label={`${hoy.enviados} de ${hoy.tope} correos`} sx={{ flex: '1 1 220px', height: 10, borderRadius: 5 }} />
          <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}><strong>{hoy.enviados}</strong> de {hoy.tope}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Los envíos a muchos hermanos se reparten en varios días para no pasar del tope. Los correos sueltos (altas, contraseñas, recibos) salen siempre al momento.
        </Typography>
      </Paper>

      {envios.length > 0 && (
        <Paper sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600, mb: 1 }}>Envíos de esta semana</Typography>
          {aviso && <Alert severity={aviso.tipo} sx={{ mb: 1.5 }} onClose={() => setAviso(null)}>{aviso.texto}</Alert>}
          <TableContainer>
            <Table size="small" aria-label="Envíos de esta semana">
              <TableHead>
                <TableRow>
                  <TableCell>Qué</TableCell>
                  <TableCell align="right">Al móvil</TableCell>
                  <TableCell align="right">Por correo</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {envios.map((e) => {
                  const porCorreo = e.enviados + e.fallidos + e.rebotados + e.pendientes
                  return (
                    <TableRow key={e.clave}>
                      <TableCell sx={{ minWidth: 220 }}>{e.titulo}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{e.alMovil || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {porCorreo ? `${e.enviados + e.rebotados} de ${porCorreo}` : '—'}
                        {e.fallidos > 0 && <Typography component="span" variant="body2" color="error"> · {e.fallidos} fallidos</Typography>}
                        {e.fallidos > 0 && (
                          <Button size="small" sx={{ ml: 1, minHeight: 36 }} disabled={reintentar.isPending} onClick={() => reintentar.mutate(e.clave)}>
                            Reintentar
                          </Button>
                        )}
                        {e.rebotados > 0 && <Typography component="span" variant="body2" color="text.secondary"> · {e.rebotados} rebotados</Typography>}
                      </TableCell>
                      <TableCell><Chip size="small" label={ESTADO[e.estado].texto} color={ESTADO[e.estado].color} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {envios.some((e) => e.estado === 'SIGUE_MANANA') && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Hoy se ha llegado al tope. Lo que falta sale mañana desde las 00:00; no hace falta hacer nada.
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  )
}
