import { useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from '../CabeceraSeccion'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { borrarPlantilla, catalogoDeEmails, usarPlantilla, type CatalogoDeEmails, type ResumenDePlantilla, type UsoDeCorreo } from '../../../lib/api/emails'
import { site } from '../../../config/site'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Emails: las plantillas de los correos que manda la web. Cada correo (la
 * bienvenida, la papeleta, el pésame…) puede tener varias plantillas y una en
 * uso; sin ninguna, sale el texto original. Las libres son para empezar un
 * aviso en «Boletín y avisos».
 */
export default function EmailsPage() {
  const cliente = useQueryClient()
  const { data, error: errorCarga } = useQuery({ queryKey: ['emails'], queryFn: catalogoDeEmails })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<ResumenDePlantilla | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const poner = (c: CatalogoDeEmails) => cliente.setQueryData(['emails'], c)

  const usar = async (uso: UsoDeCorreo, p: ResumenDePlantilla | null) => {
    setOcupado(true); setError(null); setAviso(null)
    try {
      poner(await usarPlantilla(uso.clave, p?.id ?? null))
      setAviso(`«${uso.nombre}» sale ahora con ${p ? `la plantilla «${p.nombre}»` : 'el texto original'}.`)
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido cambiar la plantilla en uso.')) }
    finally { setOcupado(false) }
  }

  const borrar = async () => {
    if (!aBorrar) return
    setOcupado(true); setError(null)
    try {
      const r = await borrarPlantilla(aBorrar.id)
      setAviso(r.message)
      setABorrar(null)
      await cliente.invalidateQueries({ queryKey: ['emails'] })
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido borrar la plantilla.')); setABorrar(null) }
    finally { setOcupado(false) }
  }

  const grupos = data ? [...new Set(data.usos.map((u) => u.grupo))] : []

  return <>
    <Helmet><title>{`Emails | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Emails" subtitulo="Las plantillas de los correos que manda la web. Cada correo sale con la plantilla en uso; sin ninguna, con su texto original." />

    {errorCarga && !data && <Alert severity="error">{mensaje(errorCarga, 'No se han podido cargar las plantillas.')}</Alert>}
    {!data && !errorCarga && <CircularProgress aria-label="Cargando las plantillas" />}
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

    <Stack spacing={4}>
      {grupos.map((grupo) => (
        <Box key={grupo} component="section" aria-labelledby={`grupo-${grupo}`}>
          <Typography id={`grupo-${grupo}`} component="h2" sx={{ fontSize: 18, fontWeight: 600, mb: 1.5 }}>{grupo}</Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
            {data!.usos.filter((u) => u.grupo === grupo).map((u) => (
              <TarjetaDeUso key={u.clave} uso={u} ocupado={ocupado} onUsar={(p) => void usar(u, p)} onBorrar={setABorrar} />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>

    <DialogoConfirmacion
      abierto={aBorrar !== null}
      titulo="Borrar la plantilla"
      mensaje={aBorrar ? `Se borra «${aBorrar.nombre}». No se puede deshacer.` : ''}
      textoConfirmar="Borrar"
      peligro
      onConfirmar={() => void borrar()}
      onCancelar={() => setABorrar(null)}
    />
  </>
}

function TarjetaDeUso({ uso, ocupado, onUsar, onBorrar }: { uso: UsoDeCorreo; ocupado: boolean; onUsar: (p: ResumenDePlantilla | null) => void; onBorrar: (p: ResumenDePlantilla) => void }) {
  const enUso = uso.plantillas.find((p) => p.enUso)
  return (
    <Paper sx={{ p: 2 }} aria-label={uso.nombre}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" sx={{ fontWeight: 600 }}>{uso.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">{uso.descripcion}</Typography>
        </Box>
        <Button size="small" variant="outlined" component={Link} to={`/cms/emails/nueva?uso=${uso.clave}`} sx={{ flexShrink: 0 }}>Nueva</Button>
      </Stack>
      {!uso.libre && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Sale con: <strong>{enUso ? enUso.nombre : 'el texto original'}</strong>
        </Typography>
      )}
      <List dense disablePadding sx={{ mt: 1 }}>
        {!uso.libre && (
          <ListItem disableGutters divider secondaryAction={enUso ? <Button size="small" disabled={ocupado} onClick={() => onUsar(null)}>Usar</Button> : <Chip size="small" color="success" label="En uso" />} sx={{ pr: 10 }}>
            <ListItemText primary="Texto original" secondary="El que trae la web" />
          </ListItem>
        )}
        {uso.plantillas.map((p) => (
          <ListItem key={p.id} disableGutters divider sx={{ pr: 0, flexWrap: 'wrap' }}>
            <ListItemText primary={p.nombre} secondary={`${p.asunto} · ${fecha(p.updatedAt)}${p.autorNombre ? `, ${p.autorNombre}` : ''}`} sx={{ minWidth: 180 }} />
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {!uso.libre && (p.enUso ? <Chip size="small" color="success" label="En uso" /> : <Button size="small" disabled={ocupado} onClick={() => onUsar(p)}>Usar</Button>)}
              <Button size="small" component={Link} to={`/cms/emails/${p.id}`}>Editar</Button>
              <Button size="small" color="error" disabled={ocupado || p.enUso} onClick={() => onBorrar(p)}
                title={p.enUso ? 'Es la plantilla en uso: pon antes otra para borrarla' : undefined}>Borrar</Button>
            </Stack>
          </ListItem>
        ))}
      </List>
    </Paper>
  )
}
