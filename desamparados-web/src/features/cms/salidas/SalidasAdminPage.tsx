import { useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../altas/auth/store'
import { useSalidas } from '../../procesion/useSalidas'
import { CLAVE_SALIDAS, type Salida } from '../../../lib/api/salidas'
import CabeceraSeccion from '../CabeceraSeccion'
import VentanaNuevaSalida from './VentanaNuevaSalida'
import { resumenCobro, resumenFecha } from './formato'
import { site } from '../../../config/site'
import { deLaCorporacion } from '../../../domain/articulos'

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

/**
 * Las salidas procesionales del Grupo: su listado, y el alta de una nueva en
 * una ventana (lo imprescindible; el resto se rellena en su pantalla propia).
 * El Hermano Mayor las ve, pero no da de alta: el backend de
 * `/api/cms/salidas` solo guarda para ADMIN y SECRETARIA.
 */
export default function SalidasAdminPage() {
  const role = useAuthStore((state) => state.cms?.role ?? 'USER')
  const puedeGuardar = role === 'ADMIN' || role === 'SECRETARIA'
  const navegar = useNavigate()
  const cliente = useQueryClient()
  const { data: salidas = [], isLoading, error } = useSalidas({ delCms: true })
  const [creando, setCreando] = useState(false)

  const alCrear = (salida: Salida) => {
    setCreando(false)
    void cliente.invalidateQueries({ queryKey: CLAVE_SALIDAS })
    navegar(`/cms/procesion/salidas/${salida.id}/editar`)
  }

  return <>
    <Helmet><title>{`Salidas | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Salidas" subtitulo={`Las salidas procesionales ${deLaCorporacion({ corto: true })}: su fecha, su cobro, su ropa y sus puestos.`}>
      {puedeGuardar && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreando(true)}>Nueva salida</Button>}
    </CabeceraSeccion>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{mensaje(error, 'No se han podido cargar las salidas.')}</Alert>}
    {isLoading && <CircularProgress aria-label="Cargando las salidas" />}
    {!isLoading && salidas.length === 0 && !error && <Alert severity="info">Todavía no hay ninguna salida.</Alert>}

    {salidas.length > 0 && (
      <Paper component="ul" sx={{ m: 0, p: 0, listStyle: 'none', maxWidth: 820 }}>
        {salidas.map((s, i) => (
          <Box component="li" key={s.id} sx={{ borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
            <Box
              component={Link}
              to={`/cms/procesion/salidas/${s.id}/editar`}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', px: 2.5, py: 2, color: 'inherit', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 600 }}>{s.nombre}</Typography>
                  {!s.activa && <Chip size="small" label="Desactivada" />}
                </Stack>
                <Typography variant="body2" color="text.secondary">{resumenFecha(s)}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>{resumenCobro(s)}</Typography>
              {s.conRopa && <Chip size="small" label="Con túnica" variant="outlined" />}
              <Chip size="small" label={s.plazoAbierto ? 'Solicitud abierta' : 'Solicitud cerrada'} color={s.plazoAbierto ? 'success' : 'default'} />
            </Box>
          </Box>
        ))}
      </Paper>
    )}

    <VentanaNuevaSalida abierta={creando} salidas={salidas} onCreada={alCrear} onCerrar={() => setCreando(false)} />
  </>
}
