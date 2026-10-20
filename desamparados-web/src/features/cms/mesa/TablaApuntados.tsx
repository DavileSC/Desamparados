import { useRef } from 'react'
import { Box, ButtonBase, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import type { Apuntado } from '../../../lib/api/mesa'
import type { Salida } from '../../../lib/api/salidas'
import { useColoresContabilidad } from '../contabilidad/tema'
import { cabeceraTabla } from '../inventario/tabla'
import Pildora from '../listados/Pildora'
import { alturaEnMetros, euros } from './formato'
import { useAltoHastaElPie } from './useAltoHastaElPie'
import { Dato, DatosDeFicha, Ficha, ListaDeFichas } from '../listados/Fichas'
import { useEnFichas } from '../listados/useEnFichas'

interface Props {
  apuntados: Apuntado[]
  salida: Salida
  /** De quién es la ficha abierta en el panel, para marcar su fila. */
  seleccionado: number | null
  onElegir: (hermanoId: number) => void
  /** Reimprimir la papeleta de quien ya la recogió (una perdida, una en mal estado). */
  onImprimir: (papeletaId: number) => void
}

const tenue = { color: 'text.disabled' } as const

/** Qué pasó con su cíngulo: el que se le debe salta a la vista. */
function Cingulo({ a }: { a: Apuntado }) {
  switch (a.cingulo) {
    case 'DEBIDO': return <Pildora texto="Se le debe" tono="aviso" />
    case 'PRESTADO': return <>Prestado</>
    case 'DEVUELTO': return <>Devuelto</>
    case 'PROPIO': return <>Propio</>
    case 'NINGUNO': return <>No lleva</>
    default: return <>—</>
  }
}

/** En qué punto está: con algo por pagar, listo para recoger o ya recogido. */
function Estado({ a }: { a: Apuntado }) {
  if (a.estado === 'recogida') return <Pildora texto="Recogida" tono="neutro" />
  if (a.estado === 'lista') return <Pildora texto="Lista" tono="ok" />
  return <Pildora texto={a.pendiente > 0 ? `Debe ${euros(a.pendiente)}` : 'Por pagar'} tono="aviso" />
}

/**
 * Los apuntados como la hoja de siempre: nombre, puesto (el que lleva, no el
 * que pidió; con la talla al hombro, que solo llevan los de trono), túnica, capirote o faraona y
 * cíngulo, y en qué punto está cada uno. Cabe a lo ancho sin barra: nombre y
 * apellidos van juntos. La fecha de nacimiento y el teléfono están en su
 * ficha: al pulsar una fila se abre la persona. En una salida sin ropa se va
 * de traje: sin esas columnas.
 */
export default function TablaApuntados({ apuntados, salida, seleccionado, onElegir, onImprimir }: Props) {
  const { fondoCabecera } = useColoresContabilidad()
  const conRopa = salida.conRopa
  const columnas = conRopa ? 6 : 3
  const enFichas = useEnFichas()
  // La tabla llega hasta el pie de la pantalla y baja por dentro: la página no.
  const caja = useRef<HTMLDivElement>(null)
  const alto = useAltoHastaElPie(caja, 240)
  const ropaDe = (a: Apuntado) => ({
    tunica: a.origenTunica === 'PROPIA' ? 'Propia' : a.origenTunica === 'NINGUNA' ? 'No lleva' : a.numTunicaAsignada,
    tocado: a.numCapiroteAsignado ?? (a.numFaraonaAsignada && `${a.numFaraonaAsignada} (faraona)`),
  })
  const imprimir = (a: Apuntado) => a.tipo === 'papeleta' && (
    <Tooltip title="Imprimir la papeleta">
      {/* La fila abre la ficha: el clic del botón no debe llegar a ella. */}
      <IconButton
        size="small"
        aria-label={`Imprimir la papeleta de ${a.hermano.nombre} ${a.hermano.apellidos}`}
        onClick={(e) => { e.stopPropagation(); onImprimir(a.id) }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <PrintOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )

  if (enFichas) {
    return (
      <ListaDeFichas etiqueta="Apuntados" vacia={apuntados.length === 0 ? 'Todavía no hay nadie apuntado con esta búsqueda.' : undefined}>
        {apuntados.map((a) => {
          const { tunica, tocado } = ropaDe(a)
          return (
            <Ficha
              key={`${a.tipo}-${a.id}`}
              acciones={imprimir(a) || undefined}
              titulo={
                <ButtonBase
                  onClick={() => onElegir(a.hermano.id)}
                  aria-label={`Abrir a ${a.hermano.nombre} ${a.hermano.apellidos}`}
                  sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 1, fontFamily: 'inherit', ...(a.hermano.id === seleccionado && { color: 'primary.main' }) }}
                >
                  <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{a.hermano.nombre} {a.hermano.apellidos}</Typography>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {a.puesto}
                  </Typography>
                </ButtonBase>
              }
            >
              <Box><Estado a={a} /></Box>
              <DatosDeFicha>
                {a.hermano.alturaHombro && <Dato etiqueta="Hombro">{alturaEnMetros(a.hermano.alturaHombro)} m</Dato>}
                {conRopa && <Dato etiqueta="Túnica">{tunica || '—'}</Dato>}
                {conRopa && <Dato etiqueta="Capirote / faraona">{tocado || '—'}</Dato>}
                {conRopa && <Dato etiqueta="Cíngulo"><Cingulo a={a} /></Dato>}
              </DatosDeFicha>
            </Ficha>
          )
        })}
      </ListaDeFichas>
    )
  }

  return (
    <TableContainer ref={caja} component={Paper} sx={{ maxHeight: alto ?? 'calc(100vh - 300px)' }}>
      <Table size="small" stickyHeader aria-label="Apuntados" sx={{ minWidth: conRopa ? 760 : 480 }}>
        <TableHead>
          {/* La cabecera se queda fija al bajar: su tinte es translúcido en oscuro, así que va sobre el color de la tarjeta para tapar las filas. */}
          <TableRow sx={{ ...cabeceraTabla(fondoCabecera), '& th': { ...cabeceraTabla(fondoCabecera)['& th'], backgroundColor: 'background.paper', backgroundImage: `linear-gradient(${fondoCabecera}, ${fondoCabecera})` } }}>
            <TableCell>Nombre</TableCell>
            <TableCell>Puesto</TableCell>
            {conRopa && <TableCell>Túnica</TableCell>}
            {conRopa && <TableCell>Capirote / faraona</TableCell>}
            {conRopa && <TableCell>Cíngulo</TableCell>}
            <TableCell>Estado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {apuntados.map((a) => {
            const { tunica, tocado } = ropaDe(a)
            return (
              <TableRow
                key={`${a.tipo}-${a.id}`}
                hover
                selected={a.hermano.id === seleccionado}
                onClick={() => onElegir(a.hermano.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onElegir(a.hermano.id) } }}
                tabIndex={0}
                aria-label={`Abrir a ${a.hermano.nombre} ${a.hermano.apellidos}`}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell><Box component="span" sx={{ fontWeight: 600 }}>{a.hermano.nombre}</Box> {a.hermano.apellidos}</TableCell>
                <TableCell>
                  {a.puesto}
                  {a.hermano.alturaHombro && <Typography component="span" variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}> · {alturaEnMetros(a.hermano.alturaHombro)} m</Typography>}
                </TableCell>
                {conRopa && <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(!tunica && tenue) }}>{tunica || '—'}</TableCell>}
                {conRopa && <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(!tocado && tenue) }}>{tocado || '—'}</TableCell>}
                {conRopa && <TableCell sx={{ whiteSpace: 'nowrap', ...(!a.cingulo && tenue) }}><Cingulo a={a} /></TableCell>}
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Estado a={a} />
                    {imprimir(a)}
                  </Stack>
                </TableCell>
              </TableRow>
            )
          })}
          {apuntados.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnas} sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">Todavía no hay nadie apuntado con esta búsqueda.</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
