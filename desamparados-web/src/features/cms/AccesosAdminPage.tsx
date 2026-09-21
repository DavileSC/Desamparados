import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import { NOMBRE_CARGO } from '../../app/cmsNavegacion'
import { useAuthStore } from '../members/auth/store'
import {
  buscarCandidatos, CARGOS_CMS, darAcceso, cuentasDeStaff, quitarAcceso,
  type CandidatoACargo, type CargoCms, type MiembroDelStaff,
} from '../../lib/api/admin'

const CARGO_POR_DEFECTO: CargoCms = 'REDES'

/**
 * Quién puede entrar al CMS.
 *
 * El backend ya tenía las cuatro operaciones (listar, buscar, ascender y
 * degradar) desde hace tiempo, con su auditoría y su corte de sesiones; lo que
 * no había era ninguna pantalla, así que repartir cargos solo se podía hacer
 * a mano contra la base de datos.
 *
 * Los dos avisos del servidor que más se van a ver («un administrador no puede
 * modificar su propio rol» y «no puedes degradar al último Administrador») se
 * enseñan tal cual: explican el porqué mejor que cualquier texto de aquí.
 */
export default function AccesosAdminPage() {
  const miId = useAuthStore((state) => state.cms?.id)
  const [staff, setStaff] = useState<MiembroDelStaff[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Ventana de alta
  const [abierta, setAbierta] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [candidatos, setCandidatos] = useState<CandidatoACargo[]>([])
  const [elegido, setElegido] = useState<CandidatoACargo | null>(null)
  const [cargoNuevo, setCargoNuevo] = useState<CargoCms>(CARGO_POR_DEFECTO)
  const [guardando, setGuardando] = useState(false)
  const [errorVentana, setErrorVentana] = useState<string | null>(null)

  const [porQuitar, setPorQuitar] = useState<MiembroDelStaff | null>(null)
  // Guarda síncrona del doble clic, igual que en HermanosAdminPage: el diálogo
  // de confirmación tarda en cerrarse y un segundo clic llegaría antes que el
  // nuevo estado.
  const enMarcha = useRef(false)

  const cargar = useCallback(async () => {
    const lista = await cuentasDeStaff()
    setStaff(lista)
  }, [])

  useEffect(() => {
    let cancelado = false
    void (async () => {
      try {
        await cargar()
      } catch (err: unknown) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar quién tiene acceso.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => { cancelado = true }
  }, [cargar])

  // Buscador de la ventana, con rebote: escribe el nombre y salen los hermanos
  // rasos que encajan (el backend solo devuelve USER activos).
  useEffect(() => {
    if (!abierta) return
    let cancelado = false
    const timer = window.setTimeout(() => {
      buscarCandidatos(busqueda)
        .then((lista) => { if (!cancelado) setCandidatos(lista) })
        .catch(() => { if (!cancelado) setCandidatos([]) })
    }, busqueda ? 300 : 0)
    return () => { cancelado = true; window.clearTimeout(timer) }
  }, [abierta, busqueda])

  const cerrarVentana = () => {
    setAbierta(false)
    setBusqueda(''); setCandidatos([]); setElegido(null)
    setCargoNuevo(CARGO_POR_DEFECTO); setErrorVentana(null)
  }

  const confirmarAlta = async () => {
    if (!elegido) return
    setGuardando(true); setErrorVentana(null)
    try {
      const { message } = await darAcceso(elegido.id, cargoNuevo)
      await cargar()
      setAviso(message)
      setError(null)
      cerrarVentana()
    } catch (err: unknown) {
      setErrorVentana(err instanceof Error ? err.message : 'No se ha podido dar el acceso.')
    } finally {
      setGuardando(false)
    }
  }

  const cambiarCargo = async (miembro: MiembroDelStaff, cargo: CargoCms) => {
    if (enMarcha.current || cargo === miembro.role) return
    enMarcha.current = true
    setError(null); setAviso(null)
    try {
      const { message } = await darAcceso(miembro.id, cargo)
      await cargar()
      setAviso(message)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se ha podido cambiar el cargo.')
    } finally { enMarcha.current = false }
  }

  const confirmarQuitar = async (miembro: MiembroDelStaff) => {
    if (enMarcha.current) return
    enMarcha.current = true
    setError(null); setAviso(null)
    try {
      const { message } = await quitarAcceso(miembro.id)
      await cargar()
      setAviso(message)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se ha podido quitar el acceso.')
    } finally { enMarcha.current = false }
  }

  const nombreDe = (m: MiembroDelStaff) => `${m.nombre} ${m.apellidos}`.trim()

  return <>
    <Helmet><title>Accesos al CMS | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>

    <CabeceraSeccion titulo="Accesos al CMS">
      <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => setAbierta(true)}>
        Dar acceso
      </Button>
    </CabeceraSeccion>

    <Typography color="text.secondary" sx={{ mb: 3, maxWidth: '60ch' }}>
      Quien aparezca aquí puede entrar al CMS con el cargo que tenga asignado. Al quitar un
      acceso o cambiar un cargo, esa persona sale de sus sesiones abiertas al momento.
    </Typography>

    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

    <DialogoConfirmacion
      abierto={porQuitar !== null}
      titulo="¿Quitar el acceso al CMS?"
      mensaje={porQuitar
        ? `${nombreDe(porQuitar)} dejará de ser ${NOMBRE_CARGO[porQuitar.role] ?? porQuitar.role} y saldrá del CMS al momento. Su cuenta y su ficha de hermano no se tocan.`
        : ''}
      textoConfirmar="Quitar acceso"
      peligro
      onConfirmar={() => { const m = porQuitar; setPorQuitar(null); if (m) void confirmarQuitar(m) }}
      onCancelar={() => setPorQuitar(null)}
    />

    <VentanaFormulario
      abierto={abierta}
      titulo="Dar acceso al CMS"
      sucio={elegido !== null || busqueda !== ''}
      guardando={guardando}
      puedeGuardar={elegido !== null}
      textoGuardar="Dar acceso"
      error={errorVentana}
      onGuardar={confirmarAlta}
      onCerrar={cerrarVentana}
    >
      <TextField
        label="Buscar por nombre, DNI o correo"
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setElegido(null) }}
        fullWidth
        autoFocus
      />

      {elegido ? (
        <Alert severity="info" onClose={() => setElegido(null)}>
          {elegido.nombre} {elegido.apellidos} · {elegido.email}
        </Alert>
      ) : (
        <Stack spacing={0.5} sx={{ maxHeight: 220, overflowY: 'auto' }}>
          {candidatos.map((c) => (
            <Box
              key={c.id}
              component="button"
              type="button"
              onClick={() => setElegido(c)}
              sx={{
                textAlign: 'left', border: 0, background: 'none', cursor: 'pointer',
                // Un <button> no hereda el color del texto: sin esto el
                // navegador lo pinta en negro sobre el fondo oscuro.
                p: 1, borderRadius: 1, font: 'inherit', color: 'text.primary',
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <Typography component="span" sx={{ display: 'block' }}>{c.nombre} {c.apellidos}</Typography>
              <Typography component="span" variant="body2" color="text.secondary">{c.email} · {c.dni}</Typography>
            </Box>
          ))}
          {candidatos.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {busqueda ? 'Ningún hermano encaja con esa búsqueda.' : 'Escribe para buscar a quien quieras dar acceso.'}
            </Typography>
          )}
        </Stack>
      )}

      <TextField
        select
        label="Cargo"
        value={cargoNuevo}
        onChange={(e) => setCargoNuevo(e.target.value as CargoCms)}
        fullWidth
      >
        {CARGOS_CMS.map((cargo) => (
          <MenuItem key={cargo} value={cargo}>{NOMBRE_CARGO[cargo] ?? cargo}</MenuItem>
        ))}
      </TextField>
    </VentanaFormulario>

    {cargando ? <CircularProgress aria-label="Cargando los accesos" /> : <Stack spacing={2}>
      {staff.map((miembro) => {
        const soyYo = miembro.id === miId
        return (
          <Paper key={miembro.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              {/* `div` y no `p`: el Chip de MUI es un <div>, y un <div> dentro
                  de un <p> es marcado inválido (el navegador cierra el párrafo
                  por su cuenta y la línea se parte). */}
              <Typography variant="h6" component="div">
                {nombreDe(miembro)}
                {soyYo && <Chip label="Tú" size="small" sx={{ ml: 1 }} />}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {NOMBRE_CARGO[miembro.role] ?? miembro.role} · {miembro.email}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              {/* Sobre la propia cuenta no se opera: el backend rechaza que un
                  administrador se cambie el rol o se degrade, y enseñar aquí
                  unos controles que siempre van a dar error es peor que no
                  ponerlos. */}
              <TextField
                select
                size="small"
                label="Cargo"
                value={miembro.role}
                disabled={soyYo}
                onChange={(e) => void cambiarCargo(miembro, e.target.value as CargoCms)}
                sx={{ minWidth: 180 }}
                slotProps={{ htmlInput: { 'aria-label': `Cargo de ${nombreDe(miembro)}` } }}
              >
                {CARGOS_CMS.map((cargo) => (
                  <MenuItem key={cargo} value={cargo}>{NOMBRE_CARGO[cargo] ?? cargo}</MenuItem>
                ))}
              </TextField>
              <Button
                color="error"
                disabled={soyYo}
                aria-label={`Quitar el acceso a ${nombreDe(miembro)}`}
                onClick={() => setPorQuitar(miembro)}
              >
                Quitar acceso
              </Button>
            </Stack>
          </Paper>
        )
      })}
      {staff.length === 0 && <Alert severity="info">Nadie tiene acceso al CMS todavía.</Alert>}
    </Stack>}
  </>
}
