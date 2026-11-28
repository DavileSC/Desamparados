import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useAhora } from '../../hooks/useAhora'
import { diaEnMadrid, fechaEnMadrid, instanteEnMadrid } from '../../lib/horaDeMadrid'
import { estimarEnvio, type Ritmo } from './estimarEnvio'

type Modo = 'ahora' | 'programado'

interface Props {
  abierto: boolean
  /** «Felicitación de Navidad · aviso». */
  descripcion: string
  correos: number
  ritmo: Ritmo
  /** Con qué se abre: «Enviar» pregunta con «Ahora» marcado; «Cambiar la hora», con la que tenía. */
  modoInicial: Modo
  programadoPara?: string | null
  onEnviarAhora: () => void
  /** El instante elegido, en ISO. */
  onProgramar: (cuando: string) => void
  onCerrar: () => void
}

/** Lo mismo que exige la API: a menos de cinco minutos, mejor «Ahora». */
const ANTELACION_MINIMA_MS = 5 * 60 * 1000
const HORA_PROPUESTA = '08:00'

const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)
const reloj = (instante: number) => fechaEnMadrid(new Date(instante), { hour: 'numeric', minute: '2-digit' })
const diaCorto = (instante: number) => fechaEnMadrid(new Date(instante), { day: 'numeric', month: 'short' }).replace('.', '')

/**
 * La pregunta de «Enviar»: ahora o a un día y una hora. Se calcula delante
 * cuándo lo tendrán todos, porque con el tope por hora de la cuenta un envío a
 * cientos tarda horas y es justo lo que decide a qué hora programarlo.
 */
export default function VentanaDeEnvio({ abierto, onCerrar, ...resto }: Props) {
  // Sin montar mientras está cerrada: cada vez que se abre, la hora y los campos de nuevo.
  return (
    <Dialog open={abierto} onClose={onCerrar} aria-labelledby="ventana-envio-titulo" fullWidth maxWidth="sm">
      {abierto && <Contenido {...resto} onCerrar={onCerrar} />}
    </Dialog>
  )
}

function Contenido({ descripcion, correos, ritmo, modoInicial, programadoPara, onEnviarAhora, onProgramar, onCerrar }: Omit<Props, 'abierto'>) {
  const ahora = useAhora()
  const [modo, setModo] = useState<Modo>(modoInicial)
  const [dia, setDia] = useState(() => programadoPara ? diaEnMadrid(programadoPara) : diaEnMadrid(new Date(ahora.getTime() + 24 * 3600 * 1000)))
  const [hora, setHora] = useState(() => programadoPara ? fechaEnMadrid(programadoPara, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : HORA_PROPUESTA)

  const elegido = modo === 'programado' ? instanteEnMadrid(`${dia}T${hora}`) : ahora.getTime()
  const fallo = modo !== 'programado' ? null
    : elegido === null ? 'Pon el día y la hora.'
      : elegido < ahora.getTime() + ANTELACION_MINIMA_MS ? 'Como pronto, dentro de cinco minutos. Para mandarlo ya, «Ahora».'
        : null
  const estimacion = elegido !== null && !fallo ? estimarEnvio(elegido, correos, ritmo) : null

  const opcion = (valor: Modo, titulo: string, texto: string) => {
    const marcada = modo === valor
    return (
      <Box component="label" sx={{
        display: 'flex', gap: 1.25, alignItems: 'flex-start', p: 1.75, borderRadius: 1.5, cursor: 'pointer',
        border: '2px solid', borderColor: marcada ? 'primary.main' : 'divider', bgcolor: marcada ? 'action.hover' : 'transparent',
      }}>
        <input type="radio" name="cuando" value={valor} checked={marcada} onChange={() => setModo(valor)} style={{ marginTop: 5 }} />
        <Box>
          <Typography sx={{ fontWeight: 600 }}>{titulo}</Typography>
          <Typography variant="body2" color="text.secondary">{texto}</Typography>
        </Box>
      </Box>
    )
  }

  const textoBoton = modo === 'ahora' ? 'Enviar ahora'
    : elegido !== null && !fallo ? `Programar para el ${diaCorto(elegido)}, ${reloj(elegido)}` : 'Programar'

  return <>
    <DialogTitle id="ventana-envio-titulo">¿Cuándo lo enviamos?</DialogTitle>
    <DialogContent>
      <Stack spacing={2.5}>
        <Typography color="text.secondary">{descripcion} a {plural(correos, 'dirección', 'direcciones')}. Una vez enviado ya no se puede cambiar ni retirar.</Typography>
        <Box role="radiogroup" aria-label="Cuándo sale" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
          {opcion('ahora', 'Ahora', 'Empieza a salir en cuanto confirmes.')}
          {opcion('programado', 'Programado', 'Sale solo el día y a la hora que digas.')}
        </Box>
        {modo === 'programado' && (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}>
            <TextField label="Día" type="date" value={dia} onChange={(e) => setDia(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            {(fallo || elegido !== null) && (
              <Typography variant="body2" color={fallo ? 'error' : 'text.secondary'} sx={{ gridColumn: '1 / -1', mt: -0.5 }}>
                {fallo ?? `${fechaEnMadrid(new Date(elegido!), { weekday: 'long', day: 'numeric', month: 'long' })}, hora de Madrid.`}
              </Typography>
            )}
          </Box>
        )}
        {estimacion && (
          <Box sx={{ bgcolor: 'background.default', borderRadius: 1.5, p: 2, display: 'grid', gap: 1.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Cómo irá saliendo</Typography>
            {/* Una tanda por hora; con muchas no caben, y doce ya dicen «todo el día». */}
            <Box aria-hidden sx={{ display: 'grid', gap: 0.5, gridTemplateColumns: `repeat(${Math.min(estimacion.tandas, 12)}, minmax(0, 1fr))` }}>
              {Array.from({ length: Math.min(estimacion.tandas, 12) }, (_, i) => (
                <Box key={i} sx={{ height: 10, bgcolor: 'primary.main', borderRadius: i === 0 ? '5px 0 0 5px' : i === Math.min(estimacion.tandas, 12) - 1 ? '0 5px 5px 0' : 0, ...(estimacion.tandas === 1 ? { borderRadius: 5 } : {}) }} />
              ))}
            </Box>
            <Typography variant="body2">
              {estimacion.pasaDelDia
                ? `Al día salen ${ritmo.porDia} como mucho: lo que pase de ahí sale al día siguiente, a unos ${ritmo.porHora} por hora.`
                : estimacion.tandas === 1
                  ? 'Salen todos en unos minutos.'
                  : `Salen unos ${ritmo.porHora} cada hora: el último llega hacia las ${reloj(estimacion.fin!)}${diaEnMadrid(new Date(estimacion.fin!)) !== diaEnMadrid(new Date(elegido!)) ? ` del ${diaCorto(estimacion.fin!)}` : ''}.`}
            </Typography>
          </Box>
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCerrar}>Volver</Button>
      <Button variant="contained" disabled={modo === 'programado' && (elegido === null || !!fallo)}
        onClick={() => { if (modo === 'ahora') onEnviarAhora(); else if (elegido !== null) onProgramar(new Date(elegido).toISOString()) }}>
        {textoBoton}
      </Button>
    </DialogActions>
  </>
}
