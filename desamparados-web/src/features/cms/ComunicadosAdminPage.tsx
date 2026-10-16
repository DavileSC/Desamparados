import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { comunicados, crearComunicado, type ComunicadoEnLista, type TipoComunicado } from '../../lib/api/comunicados'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import EnviosEnMarcha from './EnviosEnMarcha'
import { fechaCorta } from './contabilidad/formato'
import { site } from '../../config/site'
import { deLaCorporacion } from '../../domain/articulos'

const TIPOS: Record<TipoComunicado, { nombre: string; explicacion: string }> = {
  BOLETIN: { nombre: 'Boletín', explicacion: `Noticias y vida ${deLaCorporacion({ corto: true })}. Solo lo reciben los hermanos que se han suscrito, y lleva el enlace para darse de baja.` },
  AVISO: { nombre: 'Aviso', explicacion: 'Algo que los hermanos tienen que saber (cuotas, cabildos, reparto de papeletas). Lo reciben todos los activos del segmento que elijas.' },
}

const ESTADO: Record<ComunicadoEnLista['estado'], { texto: string; color: 'default' | 'info' | 'success' }> = {
  BORRADOR: { texto: 'Borrador', color: 'default' },
  ENVIANDO: { texto: 'Enviándose', color: 'info' },
  ENVIADO: { texto: 'Enviado', color: 'success' },
}

/**
 * El boletín y los avisos por correo: el historial al entrar y «Nuevo» en
 * una ventana, que crea el borrador y lleva a su pantalla para escribirlo.
 */
export default function ComunicadosAdminPage() {
  const navegar = useNavigate()
  const [lista, setLista] = useState<ComunicadoEnLista[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [nuevo, setNuevo] = useState<{ tipo: TipoComunicado; asunto: string }>({ tipo: 'BOLETIN', asunto: '' })
  const [creando, setCreando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    comunicados()
      .then((l) => { if (!cancelado) setLista(l) })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los comunicados.') })
    return () => { cancelado = true }
  }, [])

  const crear = async () => {
    setCreando(true); setErrorNuevo(null)
    try {
      const c = await crearComunicado({ tipo: nuevo.tipo, asunto: nuevo.asunto.trim(), cuerpo: '<p></p>', segmento: {} })
      navegar(`/cms/comunicados/${c.id}`)
    } catch (err: unknown) {
      setErrorNuevo(err instanceof Error ? err.message : 'No se ha podido crear el comunicado.')
    } finally { setCreando(false) }
  }

  return <>
    <Helmet><title>{`Boletín y avisos | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Boletín y avisos" subtitulo="Correos a los hermanos: el boletín a los suscritos y los avisos a quien toque.">
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setNuevo({ tipo: 'BOLETIN', asunto: '' }); setErrorNuevo(null); setAbierta(true) }}>Nuevo</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    <EnviosEnMarcha />

    {!lista && !error && <CircularProgress aria-label="Cargando los comunicados" />}
    {lista?.length === 0 && <Alert severity="info">Todavía no se ha escrito ninguno.</Alert>}
    {lista && lista.length > 0 && (
      <Paper component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {lista.map((c, i) => {
          const total = c.envios.enviados + c.envios.fallidos + c.envios.rebotados + c.envios.pendientes + c.envios.alMovil
          return (
            <Box component="li" key={c.id} sx={{ borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
              <Box component={Link} to={`/cms/comunicados/${c.id}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', px: 2.5, py: 2, color: 'inherit', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover' } }}>
                <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{c.asunto}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {TIPOS[c.tipo].nombre} · {c.para}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
                  {c.enviadoEl ? `Enviado el ${fechaCorta(c.enviadoEl)}` : `Escrito el ${fechaCorta(c.updatedAt)}`}
                  {total > 0 && <><br />{c.envios.enviados + c.envios.alMovil} de {total} enviados{c.envios.alMovil ? ` (${c.envios.alMovil} al móvil)` : ''}{c.envios.fallidos ? ` · ${c.envios.fallidos} fallidos` : ''}{c.envios.rebotados ? ` · ${c.envios.rebotados} rebotados` : ''}</>}
                </Typography>
                <Chip size="small" label={ESTADO[c.estado].texto} color={ESTADO[c.estado].color} variant={c.estado === 'BORRADOR' ? 'outlined' : 'filled'} />
              </Box>
            </Box>
          )
        })}
      </Paper>
    )}

    <VentanaFormulario
      abierto={abierta}
      titulo="Nuevo comunicado"
      textoGuardar="Crear y escribir"
      sucio={nuevo.asunto.trim() !== ''}
      guardando={creando}
      puedeGuardar={nuevo.asunto.trim() !== ''}
      error={errorNuevo}
      onGuardar={crear}
      onCerrar={() => setAbierta(false)}
    >
      <TextField select label="Qué es" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as TipoComunicado })} helperText={TIPOS[nuevo.tipo].explicacion} fullWidth>
        {(Object.keys(TIPOS) as TipoComunicado[]).map((t) => <MenuItem key={t} value={t}>{TIPOS[t].nombre}</MenuItem>)}
      </TextField>
      <TextField label="Asunto" value={nuevo.asunto} onChange={(e) => setNuevo({ ...nuevo, asunto: e.target.value })} slotProps={{ htmlInput: { maxLength: 150 } }} fullWidth />
    </VentanaFormulario>
  </>
}
