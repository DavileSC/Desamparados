import { Alert, Box, Grid, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import Boton from '../../../components/Boton'
import { PARENTESCOS } from '../../../lib/api/auth'
import { FILETE_TARJETA } from './temaTarjeta'
import { MAXIMO_MENORES, menorVacio, type MembershipFormData } from './schema'
import AvisoSuave from '../../../components/AvisoSuave'

interface Props {
  menores: MembershipFormData['menores']
  errores: FieldErrors<MembershipFormData>
  register: UseFormRegister<MembershipFormData>
  setValue: UseFormSetValue<MembershipFormData>
  watch: UseFormWatch<MembershipFormData>
  /** Los del adulto: se proponen como respaldo, solo cuando es hijo o hija. */
  primerApellidoDelTitular: string
  hoy: string
}

/**
 * El paso donde se apunta a quienes van a cargo de quien abre la cuenta.
 *
 * Dice «menor», nunca «hijo»: quien apunta puede ser un tío, un abuelo o un
 * padrino que ejerce de tutor a efectos de la cofradía, y sus apellidos no
 * tienen por qué ser los del niño. Por eso los apellidos solo se proponen
 * cuando el parentesco es hijo o hija, y por eso se pregunta el parentesco:
 * con cualquier otro, Secretaría pedirá la autorización de los padres.
 */
export default function PasoMenores({ menores, errores, register, setValue, watch, primerApellidoDelTitular, hoy }: Props) {
  const anadir = () => setValue('menores', [...menores, { ...menorVacio }], { shouldValidate: false })

  const quitar = (indice: number) =>
    setValue('menores', menores.filter((_, i) => i !== indice), { shouldValidate: false })

  // Al pasar a hijo/a se propone el primer apellido del adulto, si aún no ha
  // escrito otro; al dejar de serlo se retira, que es justo el error que se
  // colaba con un sobrino.
  const cambiarParentesco = (indice: number, valor: string) => {
    const actual = watch(`menores.${indice}.primerApellido`)
    if (valor === 'HIJO' && !actual) {
      setValue(`menores.${indice}.primerApellido`, primerApellidoDelTitular)
    } else if (valor !== 'HIJO' && actual === primerApellidoDelTitular) {
      setValue(`menores.${indice}.primerApellido`, '')
    }
  }

  const hayAjeno = menores.some((menor) => menor.parentesco !== 'HIJO')
  const fallosDeMenores = errores.menores

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: 'text.secondary', maxWidth: '60ch' }}>
        Los datos de cada menor. Si aún no tiene DNI ni correo, déjalos en blanco: son suyos, no tuyos.
      </Typography>

      {menores.map((menor, indice) => {
        const fallo = Array.isArray(fallosDeMenores) ? fallosDeMenores[indice] : undefined
        const campo = (nombre: 'nombre' | 'primerApellido' | 'segundoApellido' | 'fechaNacimiento' | 'dni' | 'email', ayuda?: string) => ({
          fullWidth: true,
          error: !!fallo?.[nombre],
          helperText: fallo?.[nombre]?.message ?? ayuda,
          ...register(`menores.${indice}.${nombre}`),
        })

        return (
          <Box
            key={indice}
            component="fieldset"
            sx={{ border: '1px solid', borderColor: FILETE_TARJETA, borderRadius: '3px', p: { xs: 1.5, md: 2 }, m: 0, minWidth: 0 }}
          >
            <Box component="legend" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.75, fontSize: 13, color: 'text.secondary' }}>
              Menor {indice + 1}
              {menores.length > 1 && (
                <IconButton size="small" aria-label={`Quitar al menor ${indice + 1}`} onClick={() => quitar(indice)} sx={{ color: 'text.secondary' }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            <Grid container spacing={{ xs: 1.5, md: 2 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Es mi…"
                  fullWidth
                  value={menor.parentesco}
                  error={!!fallo?.parentesco}
                  helperText={fallo?.parentesco?.message}
                  {...register(`menores.${indice}.parentesco`, {
                    onChange: (e: { target: { value: string } }) => cambiarParentesco(indice, e.target.value),
                  })}
                >
                  {PARENTESCOS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Fecha de nacimiento"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
                  {...campo('fechaNacimiento')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Nombre" {...campo('nombre')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Primer apellido" {...campo('primerApellido')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Segundo apellido" {...campo('segundoApellido')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="DNI/NIE (si ya tiene)"
                  slotProps={{ htmlInput: { autoCapitalize: 'characters', spellCheck: false } }}
                  {...campo('dni', 'Desde los 14 años suelen tenerlo.')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Su email (si tiene)" type="email" {...campo('email', 'Si no, se usa el tuyo.')} />
              </Grid>
            </Grid>
          </Box>
        )
      })}

      {hayAjeno && (
        <AvisoSuave sx={{ fontSize: 14 }}>
          Para un menor que no es hijo o hija tuya, Secretaría te pedirá la autorización firmada de sus padres o tutores
          legales cuando pases a formalizar el alta.
        </AvisoSuave>
      )}

      {typeof fallosDeMenores?.message === 'string' && (
        <Alert severity="error" role="alert" sx={{ fontSize: 14 }}>{fallosDeMenores.message}</Alert>
      )}

      {menores.length < MAXIMO_MENORES && (
        <Box>
          <Boton type="button" appVariant="outline" onClick={anadir} sx={{ borderRadius: '3px', height: 44 }}>
            <AddIcon fontSize="small" style={{ marginRight: 8 }} />
            Añadir otro menor
          </Boton>
        </Box>
      )}
    </Box>
  )
}
