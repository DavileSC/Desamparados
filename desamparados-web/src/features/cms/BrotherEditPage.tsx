import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Divider, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import { getBrother, updateBrother, type AdminBrother } from '../../lib/api/brothers'

/** El servidor manda ISO; los campos de fecha del navegador quieren YYYY-MM-DD. */
const aDia = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

type Formulario = {
  nombre: string; apellidos: string; dni: string; fechaNacimiento: string
  telefono: string; email: string; direccion: string; poblacion: string; codigoPostal: string
  numeroHermano: string; activo: boolean; fechaAlta: string; fechaBaja: string
  tieneTunicaPropia: boolean; tunica: string; alturaHombro: string; puesto: string
}

const desdeFicha = (f: AdminBrother): Formulario => ({
  nombre: f.nombre, apellidos: f.apellidos, dni: f.dni ?? '', fechaNacimiento: aDia(f.fechaNacimiento),
  telefono: f.telefono ?? '', email: f.email ?? '', direccion: f.direccion ?? '',
  poblacion: f.poblacion ?? '', codigoPostal: f.codigoPostal ?? '',
  numeroHermano: f.numeroHermano?.toString() ?? '', activo: f.activo,
  fechaAlta: aDia(f.fechaAlta), fechaBaja: aDia(f.fechaBaja),
  tieneTunicaPropia: f.tieneTunicaPropia, tunica: f.tunica ?? '',
  alturaHombro: f.alturaHombro?.toString() ?? '', puesto: f.puesto ?? '',
})

export default function BrotherEditPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [ficha, setFicha] = useState<AdminBrother | null>(null)
  const [form, setForm] = useState<Formulario | null>(null)
  const [inicial, setInicial] = useState<Formulario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getBrother(Number(id))
      .then((f) => { setFicha(f); setForm(desdeFicha(f)); setInicial(desdeFicha(f)) })
      .catch(() => setError('No se ha podido cargar la ficha del hermano.'))
  }, [id])

  const campo = useCallback(<K extends keyof Formulario>(clave: K, valor: Formulario[K]) => {
    setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))
  }, [])

  const guardar = async () => {
    if (!form) return
    setGuardando(true)
    try {
      await updateBrother(Number(id), {
        nombre: form.nombre,
        apellidos: form.apellidos,
        ...(form.dni ? { dni: form.dni } : {}),
        ...(form.fechaNacimiento ? { fechaNacimiento: form.fechaNacimiento } : {}),
        ...(form.telefono ? { telefono: form.telefono } : {}),
        ...(form.email ? { email: form.email } : {}),
        direccion: form.direccion,
        poblacion: form.poblacion,
        codigoPostal: form.codigoPostal,
        ...(form.numeroHermano ? { numeroHermano: Number(form.numeroHermano) } : {}),
        activo: form.activo,
        ...(form.fechaAlta ? { fechaAlta: form.fechaAlta } : {}),
        fechaBaja: form.fechaBaja || null,
        tieneTunicaPropia: form.tieneTunicaPropia,
        tunica: form.tunica,
        ...(form.alturaHombro ? { alturaHombro: Number(form.alturaHombro) } : {}),
        puesto: form.puesto,
      })
      navegar('/cms/hermanos')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la ficha.')
      setGuardando(false)
    }
  }

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form || !ficha) return <CircularProgress aria-label="Cargando la ficha" />

  const texto = (clave: keyof Formulario, etiqueta: string, tipo = 'text') => (
    <TextField
      label={etiqueta}
      type={tipo}
      value={form[clave] as string}
      onChange={(e) => campo(clave, e.target.value as never)}
      // Sin `shrink`, la etiqueta se solapa con el dd/mm/aaaa del campo de fecha.
      slotProps={tipo === 'date' ? { inputLabel: { shrink: true } } : undefined}
      fullWidth
    />
  )

  return (
    <>
      <Helmet><title>Editar hermano | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo="Editar hermano"
        nombre={`${ficha.nombre} ${ficha.apellidos}`}
        sucio={JSON.stringify(form) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA="/cms/hermanos"
        onGuardar={guardar}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Datos personales</Typography>
            <Stack spacing={2}>
              {texto('nombre', 'Nombre')}
              {texto('apellidos', 'Apellidos')}
              {texto('dni', 'DNI')}
              {texto('fechaNacimiento', 'Fecha de nacimiento', 'date')}
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Contacto</Typography>
            <Stack spacing={2}>
              {texto('telefono', 'Teléfono')}
              {texto('email', 'Correo electrónico')}
              {texto('direccion', 'Dirección')}
              {texto('poblacion', 'Población')}
              {texto('codigoPostal', 'Código postal')}
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Grupo Parroquial</Typography>
            <Stack spacing={2}>
              {texto('numeroHermano', 'Número de hermano', 'number')}
              {texto('fechaAlta', 'Fecha de alta', 'date')}
              {texto('fechaBaja', 'Fecha de baja', 'date')}
              <FormControlLabel
                control={<Switch checked={form.activo} onChange={(e) => campo('activo', e.target.checked)} />}
                label="Hermano activo"
              />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Procesión</Typography>
            <Stack spacing={2}>
              {texto('puesto', 'Puesto en el cortejo')}
              {texto('tunica', 'Talla de túnica')}
              {texto('alturaHombro', 'Altura de hombro (cm)', 'number')}
              <FormControlLabel
                control={<Switch checked={form.tieneTunicaPropia} onChange={(e) => campo('tieneTunicaPropia', e.target.checked)} />}
                label="Tiene túnica propia"
              />
            </Stack>
          </Box>
        </Stack>
      </PantallaEdicion>
    </>
  )
}
