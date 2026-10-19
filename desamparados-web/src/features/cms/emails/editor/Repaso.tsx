import { Box, Stack, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { BloqueDeUso, VistaPrevia } from '../../../../lib/api/emails'

/** Hasta aquí se lee el asunto entero en la bandeja del móvil (backend `ASUNTO_CORTO`). */
const ASUNTO_CORTO = 60

interface Props {
  previa: VistaPrevia | null
  asunto: string
  bloques: BloqueDeUso[]
  /** En la hoja, el repaso va recogido; al revisar, con más aire. */
  amplio?: boolean
}

type Punto = { tipo: 'mal' | 'ojo' | 'bien'; texto: string }

/**
 * Lo que impide guardar, lo que conviene mirar y lo que ya está bien, en una
 * sola lista. Lo dice el servidor (la misma revisión que al guardar); lo que
 * está bien se deduce de que no haya avisado de ello.
 */
export default function Repaso({ previa, asunto, bloques, amplio = false }: Props) {
  if (!previa) return <Typography variant="body2" color="text.secondary">Repasando el correo…</Typography>

  const puntos: Punto[] = [
    ...previa.problemas.map((texto): Punto => ({ tipo: 'mal', texto })),
    ...previa.avisos.map((texto): Punto => ({ tipo: 'ojo', texto })),
  ]
  const hay = (re: RegExp) => previa.problemas.some((p) => re.test(p))
  if (bloques.some((b) => b.obligatorio) && !hay(/no puede faltar/)) puntos.push({ tipo: 'bien', texto: 'Lleva lo que no puede faltar' })
  if (!hay(/no tiene el dato/)) puntos.push({ tipo: 'bien', texto: 'Todos los datos existen en este correo' })
  const letras = asunto.trim().length
  if (letras > 0 && letras <= ASUNTO_CORTO) puntos.push({ tipo: 'bien', texto: `Asunto de ${letras} letras: se lee entero en el móvil` })

  const icono = { mal: <ErrorOutlineIcon fontSize="small" color="error" />, ojo: <WarningAmberIcon fontSize="small" sx={{ color: '#8a5a00' }} />, bien: <CheckIcon fontSize="small" color="success" /> }
  const titulo = previa.problemas.length ? 'Falta algo para poder guardar' : previa.avisos.length ? 'Se puede guardar, pero mira esto' : 'Todo en orden'

  return (
    <Box role="status" aria-live="polite">
      <Typography sx={{ fontWeight: 600, fontSize: amplio ? 16 : 14, mb: 1 }}>{titulo}</Typography>
      <Stack component="ul" spacing={amplio ? 1.25 : 0.75} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {puntos.map((p) => (
          <Box component="li" key={p.texto} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', fontSize: amplio ? 15 : 13.5, lineHeight: 1.45 }}>
            <Box component="span" sx={{ display: 'flex', pt: '1px' }} aria-label={p.tipo === 'mal' ? 'Falta' : p.tipo === 'ojo' ? 'Aviso' : 'Bien'}>{icono[p.tipo]}</Box>
            <span>{p.texto}</span>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
