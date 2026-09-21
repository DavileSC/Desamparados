import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Chip, CircularProgress, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import { fichaPropia, fichasACargo, misFichas, type ApiProfile } from '../../../lib/api/perfil'
import { PARENTESCOS } from '../../../lib/api/auth'
import { MAYORIA_DE_EDAD, aniosCumplidos } from '../../altas/public/schema'
import DialogoAnadirFicha from './DialogoAnadirFicha'
import DialogoEmancipar from './DialogoEmancipar'

const nombreParentesco = (valor: string | null) =>
  PARENTESCOS.find((p) => p.value === valor)?.label ?? 'A tu cargo'

/**
 * Las personas que dependen de esta cuenta.
 *
 * Existe porque el alta solo servía el día que se hacía: el backend sabía
 * apuntar a un menor y emanciparlo al cumplir los 18, pero no había ninguna
 * pantalla que lo usara, así que un hermano con un hijo nuevo no tenía por
 * dónde apuntarlo.
 *
 * Habla de «menores a tu cargo», no de hijos: quien los apunta puede ser un
 * tío, un abuelo o un padrino que ejerce de tutor a efectos de la cofradía.
 */
export default function FamiliaPage() {
  const [fichas, setFichas] = useState<ApiProfile[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [anadiendo, setAnadiendo] = useState<'menor' | 'yo' | null>(null)
  const [emancipando, setEmancipando] = useState<ApiProfile | null>(null)

  const cargar = useCallback(
    () => misFichas().then((respuesta) => setFichas(respuesta.data)),
    [],
  )

  useEffect(() => {
    let cancelado = false
    cargar()
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar las fichas de tu cuenta.')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [cargar])

  const propia = fichaPropia(fichas)
  const aCargo = fichasACargo(fichas)

  const tras = async (mensaje: string) => {
    setAviso(mensaje)
    setError(null)
    await cargar()
  }

  return (
    <>
      <Helmet><title>Mi familia | Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <SeccionAnimada>
        <ContenedorDePagina>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="h1" sx={{ fontSize: { xs: 30, md: 38 }, m: 0 }}>Mi familia</Typography>
              <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
                Las personas a tu cargo en el Grupo Parroquial.
              </Typography>
            </Box>
            <Boton onClick={() => setAnadiendo('menor')}>
              <AddIcon fontSize="small" style={{ marginRight: 8 }} />
              Apuntar a un menor
            </Boton>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
          {aviso && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

          {cargando ? <CircularProgress aria-label="Cargando las fichas" /> : (
            <Box sx={{ display: 'grid', gap: 2 }}>
              {/* Quien solo apuntó a un menor no tiene ficha propia. Puede hacerse
                  hermano cuando quiera: basta con apuntarse con su DNI. */}
              {propia ? (
                <Ficha ficha={propia} etiqueta="Tu ficha" />
              ) : (
                <TarjetaCristal sx={{ p: 3 }}>
                  <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Tú no eres hermano</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 15, mb: 2 }}>
                    Tu cuenta existe para gestionar las fichas de quienes tienes a tu cargo. Si quieres, puedes
                    hacerte hermano tú también sin abrir otra cuenta.
                  </Typography>
                  <Boton appVariant="outline" onClick={() => setAnadiendo('yo')}>Hacerme hermano</Boton>
                </TarjetaCristal>
              )}

              {aCargo.map((ficha) => (
                <Ficha
                  key={ficha.id}
                  ficha={ficha}
                  etiqueta={nombreParentesco(ficha.parentesco)}
                  onEmancipar={() => setEmancipando(ficha)}
                />
              ))}

              {aCargo.length === 0 && (
                <Typography sx={{ color: 'text.secondary' }}>
                  No tienes a nadie a tu cargo. Con «Apuntar a un menor» se abre su alta, que Secretaría revisa como
                  cualquier otra.
                </Typography>
              )}
            </Box>
          )}
        </ContenedorDePagina>
      </SeccionAnimada>

      <DialogoAnadirFicha
        modo={anadiendo}
        apellidosDelTitular={propia?.apellidos ?? ''}
        onCerrar={() => setAnadiendo(null)}
        onHecho={(mensaje) => { setAnadiendo(null); void tras(mensaje) }}
      />
      <DialogoEmancipar
        ficha={emancipando}
        onCerrar={() => setEmancipando(null)}
        onHecho={(mensaje) => { setEmancipando(null); void tras(mensaje) }}
      />
    </>
  )
}

/**
 * Una ficha de la cuenta. El estado importa más que los datos: lo que quien
 * mira necesita saber es si ya está en el censo o sigue esperando a Secretaría.
 */
function Ficha({ ficha, etiqueta, onEmancipar }: { ficha: ApiProfile; etiqueta: string; onEmancipar?: () => void }) {
  const edad = ficha.fechaNacimiento ? aniosCumplidos(ficha.fechaNacimiento.slice(0, 10)) : null
  const puedeEmanciparse = onEmancipar && edad !== null && edad >= MAYORIA_DE_EDAD

  return (
    <TarjetaCristal sx={{ p: { xs: 2.5, md: 3 }, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontSize: 19, fontWeight: 600 }}>{ficha.nombre} {ficha.apellidos}</Typography>
        <Chip label={etiqueta} size="small" />
        <Chip
          label={ficha.activo ? `Nº ${ficha.numeroHermano ?? '—'}` : 'Pendiente de Secretaría'}
          size="small"
          color={ficha.activo ? 'default' : 'warning'}
          variant={ficha.activo ? 'outlined' : 'filled'}
        />
      </Box>

      <Typography sx={{ color: 'text.secondary', fontSize: 15 }}>
        {edad !== null && `${edad} años`}
        {ficha.dni && ` · ${ficha.dni}`}
        {!ficha.activo && ' · Se activa cuando Secretaría apruebe el alta'}
      </Typography>

      {puedeEmanciparse && (
        <Box>
          <Alert severity="info" sx={{ mb: 1.5, fontSize: 14 }}>
            Ya tiene {MAYORIA_DE_EDAD} años cumplidos: puede tener cuenta propia y gestionar sus datos.
          </Alert>
          <Boton appVariant="outline" onClick={onEmancipar}>Darle cuenta propia</Boton>
        </Box>
      )}
    </TarjetaCristal>
  )
}
