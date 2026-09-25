import { Box, FormControlLabel, InputAdornment, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import topes from '../../../../../shared/topes-contenido.json'
import CampoImagen from '../CampoImagen'
import { OPCIONES_COMUNES, libreDe, opcionesPropias, siDe, valorDe, type Opcion } from '../../../components/bloques/presentacion'
import { AYUDA_OPCION, ETIQUETA_OPCION, etiquetaDeValor } from './etiquetas'
import { aAncla } from './utilidades'
import type { Bloque, Presentacion } from '../../../lib/api/contenido'

/** Las comunes que van en «Franja y aire»; `oculto` va en «Cuándo se ve». */
const DE_FRANJA = ['fondo', 'ancho', 'espacio', 'alineacionTitulo', 'separador']

/**
 * La pestaña «Presentación» de un bloque: cómo se ve, no qué dice. Los
 * controles salen del catálogo compartido (`shared/presentacion-de-bloques.json`):
 * una lista de valores es una fila de botones y un sí/no, un interruptor.
 *
 * Elegir el valor de siempre QUITA la opción del documento en vez de
 * guardarla: así un bloque que vuelve a su aspecto de siempre queda igual que
 * uno que nunca se tocó, y la pantalla no avisa de cambios que no lo son.
 */
export default function PanelDePresentacion({ bloque, ruta, onCambio }: {
  bloque: Bloque
  /** La dirección de la página, para enseñar el enlace con el ancla. */
  ruta: string
  onCambio: (presentacion: Presentacion | undefined) => void
}) {
  const fijar = (clave: string, valor: string | boolean, porDefecto: string | boolean) => {
    const siguiente: Presentacion = { ...(bloque.presentacion ?? {}) }
    if (valor === porDefecto) delete siguiente[clave]
    else siguiente[clave] = valor
    // Sin fondo de foto, la foto del fondo sobra.
    if (clave === 'fondo' && valor !== 'foto') delete siguiente.fondoFoto
    onCambio(Object.keys(siguiente).length > 0 ? siguiente : undefined)
  }

  const control = (clave: string, opcion: Opcion) => {
    if ('siNo' in opcion) {
      return (
        <FormControlLabel key={clave} label={ETIQUETA_OPCION[clave] ?? clave}
          control={<Switch checked={siDe(bloque, clave)} onChange={(e) => fijar(clave, e.target.checked, false)} />} />
      )
    }
    const actual = valorDe(bloque, clave)
    return (
      <Box key={clave}>
        <Typography id={`opcion-${clave}`} variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>{ETIQUETA_OPCION[clave] ?? clave}</Typography>
        <ToggleButtonGroup
          exclusive size="small" value={actual} aria-labelledby={`opcion-${clave}`}
          onChange={(_, valor: string | null) => { if (valor !== null) fijar(clave, valor, opcion.valores[0]) }}
          sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { border: 1, borderColor: 'divider', borderRadius: '6px !important', px: 1.25, py: 0.5, textTransform: 'none' } }}
        >
          {opcion.valores.map((valor) => <ToggleButton key={valor} value={valor}>{etiquetaDeValor(valor)}</ToggleButton>)}
        </ToggleButtonGroup>
        {AYUDA_OPCION[clave] && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{AYUDA_OPCION[clave]}</Typography>}
      </Box>
    )
  }

  const propias = Object.entries(opcionesPropias(bloque.tipo))
  const comunes = Object.entries(OPCIONES_COMUNES).filter(([clave]) => DE_FRANJA.includes(clave))
  const ancla = libreDe(bloque, 'ancla')
  const libre = (clave: 'fondoFoto' | 'ancla' | 'desde' | 'hasta', valor: string) => fijar(clave, valor, '')

  return (
    <Stack spacing={3}>
      {propias.length > 0 && (
        <Seccion titulo="Aspecto del bloque">
          {propias.map(([clave, opcion]) => control(clave, opcion))}
        </Seccion>
      )}

      <Seccion titulo="Franja y aire">
        {comunes.map(([clave, opcion]) => control(clave, opcion))}
        {valorDe(bloque, 'fondo') === 'foto' && (
          <CampoImagen valor={libreDe(bloque, 'fondoFoto')} onCambio={(ruta) => libre('fondoFoto', ruta)} etiqueta="Foto del fondo" apaisada
            ayuda="JPG, PNG o WebP grande y apaisado, de hasta 5 MB. Se ve muy velada, detrás del bloque." />
        )}
      </Seccion>

      <Seccion titulo="Cuándo se ve">
        {control('oculto', OPCIONES_COMUNES.oculto)}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField label="Desde el día" type="date" size="small" fullWidth value={libreDe(bloque, 'desde')}
            onChange={(e) => libre('desde', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Hasta el día" type="date" size="small" fullWidth value={libreDe(bloque, 'hasta')}
            onChange={(e) => libre('hasta', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: '4px !important' }}>
          Opcional. Fuera de esas fechas el bloque no sale en la web, sin tener que acordarse de quitarlo. Los dos días cuentan enteros.
        </Typography>
      </Seccion>

      <Seccion titulo="Enlazar a este bloque">
        <TextField label="Ancla" size="small" fullWidth value={ancla}
          onChange={(e) => libre('ancla', aAncla(e.target.value))}
          // Mientras se escribe puede quedar un guion al final («horario-»); al salir, fuera.
          onBlur={() => { if (ancla.endsWith('-')) libre('ancla', ancla.replace(/-+$/, '')) }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start">#</InputAdornment> }, htmlInput: { maxLength: topes.ancla } }}
          helperText={ancla
            ? `Se enlaza con ${ruta}#${ancla}: la página se abre ya en este bloque.`
            : 'Opcional. Un nombre corto, como «horarios», para enlazar directamente a este bloque.'} />
      </Seccion>
    </Stack>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
      <Typography component="legend" variant="overline" sx={{ color: 'text.secondary', mb: 1, p: 0 }}>{titulo}</Typography>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  )
}
