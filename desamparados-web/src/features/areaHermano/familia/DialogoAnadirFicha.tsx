import { useEffect, useState } from 'react'
import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField } from '@mui/material'
import Boton from '../../../components/Boton'
import { PARENTESCOS, type Parentesco } from '../../../lib/api/auth'
import { anadirFicha } from '../../../lib/api/perfil'
import { ApiError } from '../../../lib/api/client'
import { esDniValido } from '../../../lib/validacion/identidad'
import { MAYORIA_DE_EDAD, aniosCumplidos } from '../../altas/public/schema'

type Modo = 'menor' | 'yo' | null

interface Props {
  /** `menor`: alguien a su cargo. `yo`: su propia ficha, si aún no la tiene. */
  modo: Modo
  apellidosDelTitular: string
  onCerrar: () => void
  onHecho: (mensaje: string) => void
}

const VACIO = { nombre: '', apellidos: '', fechaNacimiento: '', parentesco: 'HIJO' as Parentesco, dni: '', email: '' }

/**
 * Apuntar a alguien desde el área de hermanos.
 *
 * Sirve para las dos cosas que se pueden añadir a una cuenta: un menor a cargo
 * y la ficha del propio titular, para quien abrió la cuenta solo para gestionar
 * a otros y luego se anima. Lo segundo se reconoce por el DNI, que es el mismo
 * de la cuenta: el servidor la crea entonces como ficha de titular.
 */
export default function DialogoAnadirFicha({ modo, apellidosDelTitular, onCerrar, onHecho }: Props) {
  const [datos, setDatos] = useState(VACIO)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const esPropia = modo === 'yo'

  useEffect(() => {
    if (modo) {
      // Los apellidos del adulto solo se proponen para un hijo o para él mismo:
      // un sobrino o un ahijado llevan los suyos y no hay que sugerir otros.
      setDatos({ ...VACIO, apellidos: apellidosDelTitular })
      setError(null)
    }
  }, [modo, apellidosDelTitular])

  const cambiar = (campo: keyof typeof VACIO) => (e: { target: { value: string } }) => {
    const valor = e.target.value
    setDatos((previos) => {
      if (campo !== 'parentesco') return { ...previos, [campo]: valor }
      // Al dejar de ser hijo/a, los apellidos heredados estorban.
      const apellidos = valor === 'HIJO' ? (previos.apellidos || apellidosDelTitular)
        : previos.apellidos === apellidosDelTitular ? '' : previos.apellidos
      return { ...previos, parentesco: valor as Parentesco, apellidos }
    })
  }

  const guardar = async () => {
    setError(null)
    const edad = datos.fechaNacimiento ? aniosCumplidos(datos.fechaNacimiento) : null

    if (!datos.nombre.trim() || !datos.apellidos.trim() || !datos.fechaNacimiento) {
      setError('Faltan el nombre, los apellidos o la fecha de nacimiento.')
      return
    }
    if (esPropia && (edad === null || edad < MAYORIA_DE_EDAD)) {
      setError(`Para tener ficha propia hacen falta ${MAYORIA_DE_EDAD} años cumplidos.`)
      return
    }
    if (!esPropia && edad !== null && edad >= MAYORIA_DE_EDAD) {
      setError(`Ya tiene ${MAYORIA_DE_EDAD} años cumplidos: con esa edad el alta la hace la propia persona, con su DNI.`)
      return
    }
    if (esPropia && !esDniValido(datos.dni)) {
      setError('Para tu propia ficha hace falta tu DNI, el mismo de la cuenta.')
      return
    }
    if (datos.dni && !esDniValido(datos.dni)) {
      setError('Revisa el DNI o NIE: la letra no corresponde con el número.')
      return
    }

    setGuardando(true)
    try {
      await anadirFicha({
        nombre: datos.nombre.trim(),
        apellidos: datos.apellidos.trim(),
        fechaNacimiento: datos.fechaNacimiento,
        ...(esPropia ? {} : { parentesco: datos.parentesco }),
        ...(datos.dni ? { dni: datos.dni } : {}),
        ...(datos.email ? { email: datos.email } : {}),
      })
      onHecho(esPropia
        ? 'Tu ficha queda pendiente de Secretaría. En cuanto la aprueben serás hermano.'
        : `${datos.nombre.trim()} queda apuntado. Secretaría revisará el alta como cualquier otra.`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se ha podido guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <Dialog open={modo !== null} onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>{esPropia ? 'Hacerme hermano' : 'Apuntar a un menor'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {!esPropia && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label="Es mi…" value={datos.parentesco} onChange={cambiar('parentesco')}>
                {PARENTESCOS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: esPropia ? 12 : 6 }}>
            <TextField
              fullWidth label="Fecha de nacimiento" type="date" value={datos.fechaNacimiento}
              onChange={cambiar('fechaNacimiento')}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Nombre" value={datos.nombre} onChange={cambiar('nombre')} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Apellidos" value={datos.apellidos} onChange={cambiar('apellidos')} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label={esPropia ? 'Tu DNI/NIE' : 'DNI/NIE (si ya tiene)'}
              value={datos.dni}
              onChange={cambiar('dni')}
              helperText={esPropia ? 'El mismo de tu cuenta.' : 'Desde los 14 años suelen tenerlo.'}
              slotProps={{ htmlInput: { autoCapitalize: 'characters', spellCheck: false } }}
            />
          </Grid>
          {!esPropia && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Su email (si tiene)" type="email" value={datos.email}
                onChange={cambiar('email')} helperText="Si no, se usa el tuyo."
              />
            </Grid>
          )}

          {!esPropia && datos.parentesco !== 'HIJO' && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info" sx={{ fontSize: 14 }}>
                Al no ser hijo o hija tuya, Secretaría te pedirá la autorización firmada de sus padres o tutores legales.
              </Alert>
            </Grid>
          )}
          {error && <Grid size={{ xs: 12 }}><Alert severity="error" role="alert">{error}</Alert></Grid>}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Boton appVariant="outline" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </DialogActions>
    </Dialog>
  )
}
