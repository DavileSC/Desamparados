import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from '../CabeceraSeccion'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { borrarPlantilla, catalogoDeEmails, usarPlantilla, type CampoDeUso, type CatalogoDeEmails, type ResumenDePlantilla, type UsoDeCorreo } from '../../../lib/api/emails'
import { site } from '../../../config/site'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/** Un texto con sus campos cambiados por el ejemplo: el asunto como lo leerá quien lo recibe. */
function conEjemplos(texto: string, campos: CampoDeUso[]) {
  const ejemplos = new Map(campos.map((c) => [c.clave, c.ejemplo ?? c.etiqueta]))
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, clave: string) => ejemplos.get(clave) ?? '')
}

/**
 * Emails: los correos que manda la web, uno por fila, con cuándo sale y qué
 * asunto lleva. «Editar» abre el que sale hoy: la plantilla en uso o, sin
 * ninguna, el texto de la web (y al guardarlo, ese pasa a ser el que sale).
 * Las demás plantillas de un correo, y volver al texto de la web, debajo.
 * Las libres son para empezar un aviso en «Boletín y avisos».
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
      setAviso(`«${uso.nombre}» sale ahora con ${p ? `la plantilla «${p.nombre}»` : 'el texto de la web'}.`)
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
    <CabeceraSeccion titulo="Emails" subtitulo="Los correos que la web manda sola a los hermanos y donantes. Pulsa «Editar» para cambiar lo que dicen." />

    {errorCarga && !data && <Alert severity="error">{mensaje(errorCarga, 'No se han podido cargar las plantillas.')}</Alert>}
    {!data && !errorCarga && <CircularProgress aria-label="Cargando las plantillas" />}
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

    <Stack spacing={4}>
      {grupos.map((grupo) => (
        <Box key={grupo} component="section" aria-labelledby={`grupo-${grupo}`}>
          <Typography id={`grupo-${grupo}`} component="h2" sx={{ fontSize: 18, fontWeight: 600, mb: 1.5 }}>{grupo}</Typography>
          <Paper sx={{ overflow: 'hidden' }}>
            {data!.usos.filter((u) => u.grupo === grupo).map((u, i) => (
              <FilaDeCorreo key={u.clave} uso={u} comunes={data!.comunes} primera={i === 0} ocupado={ocupado} onUsar={(p) => void usar(u, p)} onBorrar={setABorrar} />
            ))}
          </Paper>
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

interface PropsFila {
  uso: UsoDeCorreo
  comunes: CampoDeUso[]
  primera: boolean
  ocupado: boolean
  onUsar: (p: ResumenDePlantilla | null) => void
  onBorrar: (p: ResumenDePlantilla) => void
}

function FilaDeCorreo({ uso, comunes, primera, ocupado, onUsar, onBorrar }: PropsFila) {
  const enUso = uso.plantillas.find((p) => p.enUso)
  const otras = uso.plantillas.filter((p) => !p.enUso)
  const asunto = conEjemplos(enUso?.asunto ?? uso.original.asunto, [...comunes, ...uso.campos])
  const nueva = `/cms/emails/nueva?uso=${uso.clave}`
  const rotulo = { fontSize: 12, color: 'text.secondary' } as const

  return (
    <Box aria-label={uso.nombre} role="group" sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderTop: primera ? 0 : 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'grid', gap: { xs: 1.5, md: 3 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.1fr) minmax(0, 1fr) auto' }, alignItems: 'center' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" sx={{ fontWeight: 600 }}>{uso.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">{uso.descripcion}</Typography>
        </Box>

        {uso.libre ? (
          <Typography variant="body2" color="text.secondary">
            {uso.plantillas.length ? `${uso.plantillas.length} para empezar un aviso en «Boletín y avisos»` : 'Ninguna todavía: sirven para empezar un aviso en «Boletín y avisos»'}
          </Typography>
        ) : (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={rotulo}>Asunto</Typography>
            <Typography sx={{ fontSize: 14.5, fontWeight: 500, overflowWrap: 'anywhere' }}>{asunto}</Typography>
            <Typography sx={{ ...rotulo, mt: 0.25 }}>{enUso ? `Plantilla «${enUso.nombre}»` : 'Texto de la web, sin cambiar'}</Typography>
          </Box>
        )}

        <Box sx={{ justifySelf: { md: 'end' } }}>
          {uso.libre
            ? <Button variant="outlined" component={Link} to={nueva}>Crear una</Button>
            : <Button variant="outlined" component={Link} to={enUso ? `/cms/emails/${enUso.id}` : nueva}>Editar</Button>}
        </Box>
      </Box>

      {/* Lo de más, solo si lo hay: otras plantillas guardadas y volver al texto de la web. */}
      {(uso.libre ? uso.plantillas.length > 0 : otras.length > 0 || enUso) && (
        <Stack spacing={0.5} sx={{ mt: 1.5, pl: { md: 2 }, borderLeft: { md: 2 }, borderColor: { md: 'divider' } }}>
          {(uso.libre ? uso.plantillas : otras).map((p) => (
            <Stack key={p.id} direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 0.5 }}>
              <Typography variant="body2" sx={{ minWidth: 0 }}>
                <strong>{p.nombre}</strong>
                <Box component="span" sx={{ color: 'text.secondary' }}> · {fecha(p.updatedAt)}{p.autorNombre ? `, ${p.autorNombre}` : ''}</Box>
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {!uso.libre && <Button size="small" disabled={ocupado} onClick={() => onUsar(p)}>Usar esta</Button>}
                {/* Con su nombre: el «Editar» de la fila es el del correo que sale hoy. */}
                <Button size="small" component={Link} to={`/cms/emails/${p.id}`} aria-label={`Editar «${p.nombre}»`}>Editar</Button>
                <Button size="small" color="error" disabled={ocupado} onClick={() => onBorrar(p)}>Borrar</Button>
              </Stack>
            </Stack>
          ))}
          <Stack direction="row" spacing={1} sx={{ pt: 0.5, flexWrap: 'wrap' }}>
            {enUso && <Button size="small" disabled={ocupado} onClick={() => onUsar(null)}>Volver al texto de la web</Button>}
            {!uso.libre && <Button size="small" component={Link} to={nueva}>Preparar otra plantilla</Button>}
          </Stack>
        </Stack>
      )}
    </Box>
  )
}
