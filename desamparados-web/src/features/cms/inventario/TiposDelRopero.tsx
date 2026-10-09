import { Box, ButtonBase, Tab, Tabs, Typography } from '@mui/material'
import type { Prenda, RecuentoDeTipo } from '../../../lib/api/inventario'
import { ESTADO_PRENDA } from './colores'

export const ORDEN_TIPOS: Prenda['tipo'][] = ['TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO']
const NOMBRE_TIPO: Record<Prenda['tipo'], string> = { TUNICA: 'Túnicas', CAPIROTE: 'Capirotes', FARAONA: 'Faraonas', CAPA: 'Capas', OTRO: 'Otras prendas' }
const MASCULINO: Record<Prenda['tipo'], boolean> = { TUNICA: false, CAPIROTE: true, FARAONA: false, CAPA: false, OTRO: false }
const ORDEN_ESTADOS: Prenda['estado'][] = ['DISPONIBLE', 'PRESTADA', 'LAVADO', 'TALLER', 'BAJA']

/** «71 disponibles», «14 prestados», «1 en el lavado»: con el género del tipo. */
function cuentaDeEstado(n: number, estado: Prenda['estado'], tipo: Prenda['tipo']) {
  const plural = n !== 1
  const o = MASCULINO[tipo] ? 'o' : 'a'
  const texto = estado === 'DISPONIBLE' ? (plural ? 'disponibles' : 'disponible')
    : estado === 'PRESTADA' ? `prestad${o}${plural ? 's' : ''}`
      : estado === 'LAVADO' ? 'en el lavado'
        : estado === 'TALLER' ? 'para arreglar'
          : 'de baja'
  return `${n} ${texto}`
}

/** Los tipos que tienen alguna prenda, en el orden de siempre. */
export const tiposConPrendas = (recuento: RecuentoDeTipo[]) => ORDEN_TIPOS
  .map((tipo) => recuento.find((r) => r.tipo === tipo))
  .filter((r): r is RecuentoDeTipo => Boolean(r && r.total > 0))

interface Props {
  recuento: RecuentoDeTipo[]
  tipo: Prenda['tipo']
  estado: string
  onTipo: (tipo: Prenda['tipo']) => void
  /** `''` lo quita. */
  onEstado: (estado: string) => void
}

/**
 * El ropero en el PC se ve un tipo cada vez: arriba se elige cuál y, debajo,
 * cuántas hay en cada estado. Antes iba por grupos plegables en dos columnas,
 * y se leían en zigzag sin saber dónde se estaba. Los recuentos son del tipo
 * entero (no de la búsqueda) y también filtran: pulsar «6 prestadas» deja
 * solo esas, y pulsarlo otra vez lo quita. Es el mismo filtro que el
 * desplegable «Estado» de la barra.
 */
export default function TiposDelRopero({ recuento, tipo, estado, onTipo, onEstado }: Props) {
  const tipos = tiposConPrendas(recuento)
  const actual = tipos.find((r) => r.tipo === tipo)

  return (
    <Box sx={{ display: 'grid', gap: 1.75, mb: 2 }}>
      <Tabs
        value={actual ? tipo : false}
        onChange={(_, valor: Prenda['tipo']) => onTipo(valor)}
        aria-label="Tipo de prenda"
        sx={{
          minHeight: 0, width: 'max-content', maxWidth: '100%', p: 0.5, borderRadius: 999, backgroundColor: 'action.hover',
          '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTab-root': { minHeight: 38, px: 2.25, borderRadius: 999, textTransform: 'none', fontSize: 15, fontWeight: 600, color: 'text.secondary' },
          '& .MuiTab-root.Mui-selected': { backgroundColor: 'text.primary', color: 'background.paper' },
        }}
      >
        {tipos.map((r) => (
          <Tab
            key={r.tipo}
            value={r.tipo}
            label={<span>{NOMBRE_TIPO[r.tipo]}<Box component="span" aria-hidden="true" sx={{ opacity: 0.7, fontWeight: 500, ml: 0.75 }}>{r.total}</Box></span>}
          />
        ))}
      </Tabs>

      {actual && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary', mr: 0.5 }}>De {actual.total}:</Typography>
          {ORDEN_ESTADOS.filter((e) => (actual.estados[e] ?? 0) > 0).map((e) => {
            const puesto = estado === e
            return (
              <ButtonBase
                key={e}
                aria-pressed={puesto}
                onClick={() => onEstado(puesto ? '' : e)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 28, px: 1.25, borderRadius: 14,
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', color: 'text.primary',
                  backgroundColor: ESTADO_PRENDA[e].fondo,
                  ...(e === 'BAJA' && { border: 1, borderColor: 'divider' }),
                  // Puesto, con un filo del color del texto: se ve en los dos modos y sin depender del tono.
                  ...(puesto && { outline: 2, outlineStyle: 'solid', outlineColor: 'text.primary', outlineOffset: 1 }),
                  '&.Mui-focusVisible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ESTADO_PRENDA[e].punto }} />
                {cuentaDeEstado(actual.estados[e] ?? 0, e, actual.tipo)}
              </ButtonBase>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
