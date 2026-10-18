/**
 * Los bloques que son una lista de piezas iguales: tarjetas, líneas de datos y
 * paradas de un itinerario. Los tres se añaden, se ordenan y se borran igual.
 */
import { lazy, Suspense, useState } from 'react'
import { Alert, Box, Button, Chip, Divider, IconButton, MenuItem, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import topes from '../../../../../../shared/topes-contenido.json'
import CampoEnlace from '../../contenido/CampoEnlace'
import CampoImagen from '../../CampoImagen'
import { ICONOS } from '../../../../components/bloques/iconos'
import { valorDe } from '../../../../components/bloques/presentacion'
import DialogoConfirmacion from '../../../../components/DialogoConfirmacion'
import { varianteEnUso } from '../../../../components/bloques/recorrido'
import EditorDeLineas from './EditorDeLineas'
import ListaEditable from './ListaEditable'
import { intercambiar, type Props } from './comunes'
import type { BloqueTarjetas, BloqueDatos, BloqueItinerario, Coordenada, TarjetaEnlace, IconoTarjeta, VarianteDelRecorrido } from '../../../../lib/api/contenido'

// El editor del mapa lleva MapLibre: se descarga solo al abrir un itinerario.
const EditorDeRecorrido = lazy(() => import('./EditorDeRecorrido'))
const CallesDelRecorrido = lazy(() => import('./CallesDelRecorrido'))

/**
 * Una tarjeta recién añadida, en blanco y sin enlace. Antes apuntaba a la
 * portada por defecto, y una tarjeta a medio hacer llevaba al inicio sin que
 * nadie lo hubiera decidido.
 */
const TARJETA_NUEVA: TarjetaEnlace = { titulo: '', descripcion: '', enlace: '' }

export function FormularioTarjetas({ bloque, onCambio }: Props<BloqueTarjetas>) {
  // Numeradas, el número hace de icono: ni foto ni icono se pintan, así que no se piden.
  const numeradas = valorDe(bloque, 'estilo') === 'numeradas'
  return (
    <Stack spacing={2}>
      {numeradas && (
        <Typography variant="body2" color="text.secondary">
          En el estilo «Numeradas» cada tarjeta lleva su número en vez de foto o icono.
        </Typography>
      )}
      <ListaEditable elementos={bloque.tarjetas} onCambio={(tarjetas) => onCambio({ tarjetas })} nuevo={() => ({ ...TARJETA_NUEVA })}
        nombre="Tarjeta" maximo={topes.tarjetasPorBloque}
        pintar={(tarjeta, cambiar, indice) => (
          <>
            <TextField label={`Título de la tarjeta ${indice + 1}`} value={tarjeta.titulo}
              onChange={(e) => cambiar({ titulo: e.target.value })} size="small" fullWidth
              slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
            <TextField label="Descripción" value={tarjeta.descripcion} multiline
              onChange={(e) => cambiar({ descripcion: e.target.value })} size="small" fullWidth
              slotProps={{ htmlInput: { maxLength: topes.textoTarjeta } }} />
            <CampoEnlace etiqueta={`Enlace de la tarjeta ${indice + 1}`} valor={tarjeta.enlace} opcional
              onCambio={(enlace) => cambiar({ enlace })}
              ayuda="Opcional. Sin enlace, la tarjeta es informativa y no lleva a ninguna parte." />
            {/* Foto o icono, no los dos: con foto, el icono no se pinta. */}
            {!numeradas && (
              <CampoImagen valor={tarjeta.foto ?? ''} onCambio={(foto) => cambiar({ foto })}
                etiqueta={`Foto de la tarjeta ${indice + 1}`} apaisada
                ayuda="Opcional. Va arriba de la tarjeta, recortada a lo ancho." />
            )}
            {!numeradas && ((tarjeta.foto ?? '') !== '' ? (
              <TextField label="Descripción de la foto" value={tarjeta.fotoAlt ?? ''} size="small" fullWidth
                onChange={(e) => cambiar({ fotoAlt: e.target.value })}
                helperText="Obligatoria con foto: lo que se ve, en una frase."
                slotProps={{ htmlInput: { maxLength: topes.descripcion } }} />
            ) : (
              <TextField select label="Icono" value={tarjeta.icono ?? ''} size="small" fullWidth
                onChange={(e) => cambiar({ icono: e.target.value as IconoTarjeta | '' })}
                helperText="Opcional. Un icono redondo encima del título.">
                <MenuItem value="">Sin icono</MenuItem>
                {Object.entries(ICONOS).map(([clave, { Icono, nombre }]) => (
                  <MenuItem key={clave} value={clave}><Icono fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />{nombre}</MenuItem>
                ))}
              </TextField>
            ))}
          </>
        )} />
    </Stack>
  )
}

export function FormularioDatos({ bloque, onCambio }: Props<BloqueDatos>) {
  return <EditorDeLineas lineas={bloque.lineas} onCambio={(lineas) => onCambio({ lineas })} minimo={1} />
}

/** Una parada recién añadida, sin hora: hasta que se sepa, la web dice «por confirmar». */
const PARADA_NUEVA = { hora: '', lugar: '' }

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/** Fija: un `[]` nuevo en cada pintado haría repintar el mapa a cada tecla. */
const SIN_LINEA: Coordenada[] = []

const NOMBRE: Record<VarianteDelRecorrido, string> = { habitual: 'el habitual', alternativo: 'el alternativo' }

/**
 * El itinerario tiene dos recorridos (18-10-2026): el habitual y uno
 * alternativo por si la salida cambia (la lluvia acortó el Rosario de 2026 y
 * el mapa siguió enseñando el de siempre). Se edita uno cada vez, con el mismo
 * formulario; el que está «en uso» es el que enseñan la web y el directo, y
 * desde la calle se cambia en «Cortejo en directo».
 */
export function FormularioItinerario({ bloque, onCambio }: Props<BloqueItinerario>) {
  const enUso = varianteEnUso(bloque)
  const { alternativo } = bloque
  const [pestana, setPestana] = useState<VarianteDelRecorrido>(enUso)
  const [quitando, setQuitando] = useState(false)

  // Lo que se edita: el bloque tal cual o, en la otra pestaña, con las paradas y el mapa del alternativo.
  const vista: BloqueItinerario = pestana === 'alternativo' && alternativo
    ? { ...bloque, paradas: alternativo.paradas, recorrido: alternativo.recorrido }
    : bloque
  const onVista = (cambios: Partial<BloqueItinerario>) => {
    if (pestana === 'habitual' || !alternativo) { onCambio(cambios); return }
    const { paradas, recorrido, ...resto } = cambios
    onCambio({ ...resto, alternativo: { paradas: paradas ?? alternativo.paradas, recorrido: 'recorrido' in cambios ? recorrido : alternativo.recorrido } })
  }
  // El otro recorrido, a trazos debajo del mapa: el alternativo se dibuja casi siempre sobre el habitual.
  const referencia: Coordenada[] = (pestana === 'habitual' ? alternativo?.recorrido?.linea : bloque.recorrido?.linea) ?? SIN_LINEA

  // Copia entera: lo que se cambie en el alternativo no toca al habitual.
  const partirDelHabitual = () => onCambio({ alternativo: structuredClone({ paradas: bloque.paradas, ...(bloque.recorrido ? { recorrido: bloque.recorrido } : {}) }) })
  const quitarAlternativo = () => {
    setQuitando(false)
    setPestana('habitual')
    onCambio({ alternativo: undefined, enUso: undefined })
  }

  return (
    <Stack spacing={1.5}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={pestana} onChange={(_, valor: VarianteDelRecorrido) => setPestana(valor)} aria-label="Recorrido que editas">
          {(['habitual', 'alternativo'] as const).map((v) => (
            <Tab
              key={v} value={v} sx={{ textTransform: 'none', minHeight: 48 }}
              label={(
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <span>{v === 'habitual' ? 'Habitual' : 'Alternativo'}</span>
                  {enUso === v && <Chip label="En uso" size="small" color="primary" sx={{ height: 20, fontSize: 11 }} />}
                </Stack>
              )}
            />
          ))}
        </Tabs>
      </Box>

      {pestana === 'alternativo' && !alternativo ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Sin recorrido alternativo</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Un segundo recorrido por si la salida cambia: lluvia, obras, un corte de calle. Lo normal es partir del habitual y quitar o mover lo que cambie.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={partirDelHabitual}>Partir del habitual</Button>
            <Button onClick={() => onCambio({ alternativo: { paradas: [{ ...PARADA_NUEVA }] } })}>Empezar desde cero</Button>
          </Stack>
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {pestana === enUso ? 'La web y el directo enseñan este.' : `La web y el directo enseñan ${NOMBRE[enUso]}.`}
            </Typography>
            <Stack direction="row" spacing={1}>
              {pestana !== enUso && <Button size="small" variant="outlined" onClick={() => onCambio({ enUso: pestana })}>Usar este</Button>}
              {pestana === 'alternativo' && <Button size="small" color="error" onClick={() => setQuitando(true)}>Quitar el alternativo</Button>}
            </Stack>
          </Stack>
          {pestana === 'alternativo' && enUso === 'alternativo' && (
            <Alert severity="info">El alternativo está en uso. Cuando la salida vuelva a ser la de siempre, pulsa «Usar este» en el habitual.</Alert>
          )}
          <ParadasYMapa key={pestana} bloque={vista} onCambio={onVista} referencia={referencia} />
        </>
      )}

      <DialogoConfirmacion
        abierto={quitando} peligro titulo="¿Quitar el recorrido alternativo?"
        mensaje={enUso === 'alternativo' ? 'Está en uso: la web y el directo volverán al habitual. Sus paradas y su mapa se pierden al guardar la página.' : 'Sus paradas y su mapa se pierden al guardar la página.'}
        textoConfirmar="Quitar" onConfirmar={quitarAlternativo} onCancelar={() => setQuitando(false)}
      />
    </Stack>
  )
}

/** Las paradas y el mapa de un recorrido: el habitual o el alternativo, con el mismo formulario. */
function ParadasYMapa({ bloque, onCambio, referencia }: Props<BloqueItinerario> & { referencia: Coordenada[] }) {
  const cambiar = (indice: number, campo: 'hora' | 'lugar' | 'nota', texto: string) =>
    onCambio({ paradas: bloque.paradas.map((p, i) => (i === indice ? { ...p, [campo]: texto } : p)) })
  const cambiarMinutos = (indice: number, texto: string) => {
    const minutos = texto === '' ? undefined : Math.max(0, Math.min(topes.minutosDeParada, Math.round(Number(texto) || 0)))
    onCambio({ paradas: bloque.paradas.map((p, i) => (i === indice ? { ...p, minutos } : p)) })
  }
  // Con calles, las paradas son los sitios de interés: llevan qué pasa allí y cuánto se para el trono.
  const porCalles = (bloque.recorrido?.calles?.length ?? 0) > 0

  const anadir = () => onCambio({ paradas: [...bloque.paradas, { ...PARADA_NUEVA }] })
  const quitar = (indice: number) => onCambio({ paradas: bloque.paradas.filter((_, i) => i !== indice) })

  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.paradas.length) return
    onCambio({ paradas: intercambiar(bloque.paradas, indice, destino) })
  }

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = bloque.paradas.length > 1
  const cabenMas = bloque.paradas.length < topes.paradasPorItinerario

  return (
    <Stack spacing={1.5}>
      {porCalles && (
        <Typography variant="body2" color="text.secondary">
          El recorrido va por calles: estas paradas son los sitios de interés (una peña, una petalada). Sitúalos en el mapa; la hora puede quedar vacía y se calcula sola.
        </Typography>
      )}
      {bloque.paradas.map((parada, indice) => (
        // Clave posicional: una parada no tiene identificador y el itinerario
        // repite lugares. Aquí no importa como en la galería, porque ninguno de
        // estos campos guarda estado propio: son cuadros de texto.
        <Stack key={indice} spacing={1}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
            <TextField
              label={`Hora ${indice + 1}`} value={parada.hora}
              onChange={(e) => cambiar(indice, 'hora', e.target.value)}
              size="small" sx={{ width: { sm: 120 } }}
              placeholder="Sin hora"
              // Se marca al momento, y no solo al guardar: así se ve cuál es.
              error={parada.hora !== '' && !HORA.test(parada.hora)}
              helperText={parada.hora !== '' && !HORA.test(parada.hora) ? 'Como 17:30' : undefined}
              slotProps={{ htmlInput: { maxLength: 5, inputMode: 'numeric' } }}
            />
            <TextField
              label="Lugar" value={parada.lugar}
              onChange={(e) => cambiar(indice, 'lugar', e.target.value)}
              size="small" fullWidth
              slotProps={{ htmlInput: { maxLength: topes.lugar } }}
            />
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Subir"><span>
                <IconButton size="small" aria-label={`Subir la parada ${indice + 1}`}
                  disabled={indice === 0} onClick={() => mover(indice, -1)}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title="Bajar"><span>
                <IconButton size="small" aria-label={`Bajar la parada ${indice + 1}`}
                  disabled={indice === bloque.paradas.length - 1} onClick={() => mover(indice, 1)}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El itinerario necesita al menos una parada'}><span>
                <IconButton size="small" color="error" aria-label={`Quitar la parada ${indice + 1}`}
                  disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            </Stack>
          </Stack>
          {porCalles && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pl: { sm: '136px' } }}>
              <TextField
                label="Qué pasa allí" value={parada.nota ?? ''} placeholder="Saetas a la Virgen"
                onChange={(e) => cambiar(indice, 'nota', e.target.value)}
                size="small" fullWidth slotProps={{ htmlInput: { maxLength: topes.lugar } }}
              />
              <TextField
                label="Minutos parado" value={parada.minutos ?? ''} type="number"
                onChange={(e) => cambiarMinutos(indice, e.target.value)}
                size="small" sx={{ width: { sm: 150 } }} slotProps={{ htmlInput: { min: 0, max: topes.minutosDeParada } }}
              />
            </Stack>
          )}
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        {porCalles ? 'Añadir sitio de interés' : 'Añadir parada'}
      </Button>
      <Typography variant="caption" color="text.secondary">
        {cabenMas
          ? 'La hora va en formato de 24 horas, como 17:30. Puede quedar vacía mientras no se sepa: la web dice «por confirmar». Si no lleva ninguna, solo se ven las calles.'
          : `Son ya ${topes.paradasPorItinerario} paradas, el máximo de un itinerario.`}
      </Typography>

      <Divider sx={{ pt: 1 }} />
      <RecorridoDelMapa bloque={bloque} onCambio={onCambio} referencia={referencia} />
    </Stack>
  )
}

/**
 * El recorrido sobre el mapa del barrio. Solo se ve con la disposición «Sobre
 * el mapa»; con las demás se guarda igual, por si se vuelve a ella.
 */
function RecorridoDelMapa({ bloque, onCambio, referencia }: Props<BloqueItinerario> & { referencia: Coordenada[] }) {
  const sobreElMapa = valorDe(bloque, 'disposicion') === 'plano'
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Recorrido sobre el mapa</Typography>
      <Typography variant="body2" color="text.secondary">
        {sobreElMapa
          ? 'Al bajar por las paradas, la línea del recorrido se dibuja por las calles y el trono llega a cada una. Quien lo ve puede darle al play.'
          : 'Se ve eligiendo «Sobre el mapa» en la pestaña Presentación: al bajar por las paradas, la línea del recorrido se dibuja por las calles.'}
      </Typography>
      <Suspense fallback={<Typography variant="body2" color="text.secondary">Cargando el mapa…</Typography>}>
        <EditorDeRecorrido
          recorrido={bloque.recorrido}
          paradas={bloque.paradas}
          onRecorrido={(recorrido) => onCambio({ recorrido })}
          onParadas={(paradas) => onCambio({ paradas })}
          referencia={referencia}
        />
        {bloque.recorrido && bloque.recorrido.linea.length >= 2 && (
          <>
            <Divider sx={{ pt: 1 }} />
            <CallesDelRecorrido bloque={{ ...bloque, recorrido: bloque.recorrido }} onRecorrido={(recorrido) => onCambio({ recorrido })} />
          </>
        )}
      </Suspense>
    </Stack>
  )
}
