/**
 * El formulario del horario vivo: las franjas de misas con sus días y horas
 * (y las de verano, si cambian), los turnos del despacho, las fechas del
 * verano y unas líneas sueltas (confesiones, teléfono, correo).
 */
import { useState } from 'react'
import { Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import topes from '../../../../../../shared/topes-contenido.json'
import ListaEditable from './ListaEditable'
import type { Props } from './comunes'
import type { BloqueHorario, FranjaDeMisas, LineaDatos, TurnoDeDespacho } from '../../../../lib/api/contenido'

/** La semana empieza el lunes; el valor es el de `Date.getDay()` (0 domingo). */
const SEMANA = [
  { valor: 1, corto: 'L', nombre: 'lunes' }, { valor: 2, corto: 'M', nombre: 'martes' }, { valor: 3, corto: 'X', nombre: 'miércoles' },
  { valor: 4, corto: 'J', nombre: 'jueves' }, { valor: 5, corto: 'V', nombre: 'viernes' }, { valor: 6, corto: 'S', nombre: 'sábado' },
  { valor: 0, corto: 'D', nombre: 'domingo' },
]

function CampoDias({ dias, onCambio, etiqueta }: { dias: number[]; onCambio: (dias: number[]) => void; etiqueta: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <ToggleButtonGroup size="small" value={dias} onChange={(_, valor: number[]) => onCambio(valor)} aria-label={etiqueta}>
        {SEMANA.map((dia) => (
          <ToggleButton key={dia.valor} value={dia.valor} aria-label={dia.nombre} sx={{ width: 40 }}>{dia.corto}</ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  )
}

/** «9:30» o «09:30» → «09:30»; lo que no es una hora, `null`. */
function normalizarHora(texto: string): string | null {
  const partes = /^(\d{1,2})[:.](\d{2})$/.exec(texto.trim())
  if (!partes) return null
  const [horas, minutos] = [Number(partes[1]), Number(partes[2])]
  if (horas > 23 || minutos > 59) return null
  return `${String(horas).padStart(2, '0')}:${partes[2]}`
}

const horasEnTexto = (horas: string[]) => horas.map((h) => h.replace(/^0(\d)/, '$1')).join(', ')

/**
 * Unas horas escritas de corrido, «9:30, 19:00». Se guardan en cuanto todas
 * son horas de verdad; mientras se escribe una a medias, el campo lo avisa y
 * no se guarda nada roto.
 */
function CampoHoras({ horas, onCambio, etiqueta, ayuda }: { horas: string[]; onCambio: (horas: string[]) => void; etiqueta: string; ayuda: string }) {
  const [texto, setTexto] = useState(() => horasEnTexto(horas))
  const trozos = texto.split(/[,;\s]+/).filter(Boolean)
  const normalizadas = trozos.map(normalizarHora)
  const valen = normalizadas.every((h) => h !== null)
  // Las horas pueden cambiar sin escribir aquí: al deshacer, o al mover la
  // franja. Si lo escrito ya no dice lo mismo que lo guardado, manda lo guardado.
  const [vistas, setVistas] = useState(horas)
  if (vistas !== horas) {
    setVistas(horas)
    if (!valen || [...new Set(normalizadas as string[])].sort().join() !== horas.join()) setTexto(horasEnTexto(horas))
  }
  return (
    <TextField label={etiqueta} value={texto} size="small" fullWidth error={!valen}
      helperText={valen ? ayuda : 'Escribe las horas así: 9:30, 19:00'}
      onChange={(e) => {
        setTexto(e.target.value)
        const nuevas = e.target.value.split(/[,;\s]+/).filter(Boolean).map(normalizarHora)
        if (nuevas.every((h) => h !== null)) onCambio([...new Set(nuevas as string[])].sort().slice(0, topes.horasPorFranja))
      }}
      onBlur={() => { if (valen) setTexto(horasEnTexto(horas)) }} />
  )
}

/**
 * Un día del año (MM-DD) con el selector de fecha del navegador. El año no se
 * guarda: el verano es el mismo todos los años.
 */
function CampoDiaDelAnio({ valor, onCambio, etiqueta }: { valor: string; onCambio: (valor: string) => void; etiqueta: string }) {
  return (
    <TextField label={etiqueta} type="date" size="small" fullWidth value={valor ? `2000-${valor}` : ''}
      onChange={(e) => onCambio(e.target.value ? e.target.value.slice(5) : '')}
      slotProps={{ inputLabel: { shrink: true } }} />
  )
}

const FRANJA_NUEVA = (): FranjaDeMisas => ({ etiqueta: '', dias: [], horas: [], horasVerano: [] })
const TURNO_NUEVO = (): TurnoDeDespacho => ({ dias: [], desde: '18:00', hasta: '20:00' })
const LINEA_NUEVA = (): LineaDatos => ({ etiqueta: '', valor: '' })

export function FormularioHorario({ bloque, onCambio }: Props<BloqueHorario>) {
  return (
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Misas</Typography>
        <ListaEditable elementos={bloque.misas} onCambio={(misas) => onCambio({ misas })} nuevo={FRANJA_NUEVA}
          nombre="Franja" maximo={topes.franjasPorHorario}
          pintar={(franja, cambiar, i) => (
            <>
              <TextField label={`Nombre de la franja ${i + 1}`} value={franja.etiqueta} size="small" fullWidth
                onChange={(e) => cambiar({ etiqueta: e.target.value })}
                helperText="Como se lee en el tablón: «Lunes a sábado», «Domingos y festivos»."
                slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
              <CampoDias etiqueta="Días en que hay misa a estas horas" dias={franja.dias} onCambio={(dias) => cambiar({ dias })} />
              <CampoHoras etiqueta="Horas" horas={franja.horas} onCambio={(horas) => cambiar({ horas })}
                ayuda="Separadas por comas: 9:30, 19:00." />
              <CampoHoras etiqueta="Horas en verano" horas={franja.horasVerano} onCambio={(horasVerano) => cambiar({ horasVerano })}
                ayuda="Solo si cambian en verano. Vacío: las mismas." />
            </>
          )} />
        <Typography variant="caption" color="text.secondary">
          Los festivos no se saben de antemano: un festivo entre semana cuenta como día de diario al calcular la próxima misa.
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Despacho parroquial</Typography>
        <ListaEditable elementos={bloque.despacho} onCambio={(despacho) => onCambio({ despacho })} nuevo={TURNO_NUEVO}
          nombre="Turno" maximo={topes.franjasPorHorario} minimo={0}
          pintar={(turno, cambiar) => (
            <>
              <CampoDias etiqueta="Días en que abre" dias={turno.dias} onCambio={(dias) => cambiar({ dias })} />
              <Stack direction="row" spacing={1.5}>
                <TextField label="Abre" type="time" size="small" fullWidth value={turno.desde} onChange={(e) => cambiar({ desde: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Cierra" type="time" size="small" fullWidth value={turno.hasta} onChange={(e) => cambiar({ hasta: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
            </>
          )} />
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Verano</Typography>
        <Stack direction="row" spacing={1.5}>
          <CampoDiaDelAnio etiqueta="Empieza" valor={bloque.verano.desde} onCambio={(desde) => onCambio({ verano: { ...bloque.verano, desde } })} />
          <CampoDiaDelAnio etiqueta="Acaba" valor={bloque.verano.hasta} onCambio={(hasta) => onCambio({ verano: { ...bloque.verano, hasta } })} />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          El año da igual: vale para todos. Sin fechas, no hay horario de verano.
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Otros datos</Typography>
        <ListaEditable elementos={bloque.lineas} onCambio={(lineas) => onCambio({ lineas })} nuevo={LINEA_NUEVA}
          nombre="Línea" maximo={topes.lineasPorBloque} minimo={0}
          pintar={(linea, cambiar, i) => (
            <>
              <TextField label={`Concepto ${i + 1}`} value={linea.etiqueta} size="small" fullWidth onChange={(e) => cambiar({ etiqueta: e.target.value })}
                helperText="Como «Confesiones» o «Teléfono». Un teléfono o un correo se pueden pulsar en la web."
                slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
              <TextField label="Valor" value={linea.valor} size="small" fullWidth onChange={(e) => cambiar({ valor: e.target.value })}
                slotProps={{ htmlInput: { maxLength: topes.lugar } }} />
            </>
          )} />
      </Stack>
    </Stack>
  )
}
