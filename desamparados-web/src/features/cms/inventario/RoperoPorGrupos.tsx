import { useEffect, useState } from 'react'
import { Alert, Box, Button, ButtonBase, CircularProgress, Paper, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { listarPrendas, type FiltrosPrendas, type Prenda, type RecuentoDeTipo } from '../../../lib/api/inventario'
import { ETIQUETA_ESTADO } from '../ropero'
import { ESTADO_PRENDA } from './colores'
import { BotonPaso, MenuPrenda, prestadaA, type AccionesPrenda } from './piezasPrenda'

/** Cuántas se traen cada vez que se pide más de un grupo. */
const POR_TANDA = 24

const ORDEN_TIPOS: Prenda['tipo'][] = ['TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO']
const NOMBRE_GRUPO: Record<Prenda['tipo'], string> = { TUNICA: 'Túnicas', CAPIROTE: 'Capirotes', FARAONA: 'Faraonas', CAPA: 'Capas', OTRO: 'Otras prendas' }
const MASCULINO: Record<Prenda['tipo'], boolean> = { TUNICA: false, CAPIROTE: true, FARAONA: false, CAPA: false, OTRO: false }
const ORDEN_ESTADOS: Prenda['estado'][] = ['DISPONIBLE', 'PRESTADA', 'LAVADO', 'TALLER', 'BAJA']

/** «30 disponibles», «9 prestados», «1 en el lavado»: con el género del grupo. */
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

interface Props extends AccionesPrenda {
  recuento: RecuentoDeTipo[] | null
  filtros: FiltrosPrendas
  volver: string
  /** Sube cada vez que algo cambia una prenda: los grupos abiertos se vuelven a pedir. */
  recarga: number
}

/**
 * El ropero en el PC: un grupo por tipo de prenda, con lo que hay en cada
 * estado en su cabecera, y dentro sus prendas en dos columnas. Sin buscar,
 * se abre el primero; buscando o filtrando, todos, y los que no tienen nada
 * que enseñar se esconden. Las cifras de la cabecera son del ropero entero.
 */
export default function RoperoPorGrupos({ recuento, filtros, volver, recarga, ...acciones }: Props) {
  const filtrando = Boolean(filtros.q || filtros.estado || filtros.tipo)
  const tipos = ORDEN_TIPOS
    .map((tipo) => recuento?.find((r) => r.tipo === tipo))
    .filter((r): r is RecuentoDeTipo => Boolean(r && r.total > 0))
    .filter((r) => !filtros.tipo || r.tipo === filtros.tipo)
  const [abiertos, setAbiertos] = useState<Partial<Record<Prenda['tipo'], boolean>>>({})
  // Lo que encontró cada grupo con los filtros puestos: si ninguno encuentra nada, se dice una vez.
  const [encontradas, setEncontradas] = useState<Partial<Record<Prenda['tipo'], number>>>({})

  if (!recuento) return <CircularProgress aria-label="Cargando el ropero" />
  if (tipos.length === 0) {
    return <Paper sx={{ py: 5, px: 2, textAlign: 'center', color: 'text.secondary' }}>{filtrando ? 'No hay prendas con esta búsqueda o estos filtros.' : 'Todavía no hay prendas en el ropero.'}</Paper>
  }
  const ningunaEncontrada = filtrando && tipos.every((r) => encontradas[r.tipo] === 0)

  return (
    <Box component="section" aria-label="Ropero" sx={{ display: 'grid', gap: 2 }}>
      {ningunaEncontrada && (
        <Paper sx={{ py: 5, px: 2, textAlign: 'center', color: 'text.secondary' }}>No hay prendas con esta búsqueda o estos filtros.</Paper>
      )}
      {tipos.map((r, i) => (
        <Grupo
          key={r.tipo}
          recuento={r}
          filtros={filtros}
          volver={volver}
          recarga={recarga}
          acciones={acciones}
          abierto={abiertos[r.tipo] ?? (filtrando || i === 0)}
          oculto={filtrando && encontradas[r.tipo] === 0}
          onAlternar={() => setAbiertos((a) => ({ ...a, [r.tipo]: !(a[r.tipo] ?? (filtrando || i === 0)) }))}
          onEncontradas={(n) => setEncontradas((e) => (e[r.tipo] === n ? e : { ...e, [r.tipo]: n }))}
        />
      ))}
    </Box>
  )
}

interface GrupoProps {
  recuento: RecuentoDeTipo
  filtros: FiltrosPrendas
  volver: string
  recarga: number
  acciones: AccionesPrenda
  abierto: boolean
  oculto: boolean
  onAlternar: () => void
  onEncontradas: (n: number) => void
}

function Grupo({ recuento: r, filtros, volver, recarga, acciones, abierto, oculto, onAlternar, onEncontradas }: GrupoProps) {
  const [prendas, setPrendas] = useState<Prenda[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = `grupo-${r.tipo.toLowerCase()}`
  const { q, estado, orden } = filtros

  // La primera tanda, cada vez que cambian los filtros o algo cambia una prenda.
  // Cerrado no se pide nada, salvo filtrando: hay que saber si esconderlo.
  const filtrando = Boolean(q || estado)
  useEffect(() => {
    if (!abierto && !filtrando) return
    let vigente = true
    setCargando(true)
    listarPrendas({ pagina: 1, porPagina: POR_TANDA }, { q, estado, orden, tipo: r.tipo })
      .then((res) => {
        if (!vigente) return
        setPrendas(res.data)
        setTotal(res.meta.total)
        setError(null)
        onEncontradas(res.meta.total)
      })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : 'No se ha podido cargar el grupo.') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
    // onEncontradas cambia en cada pintado del padre; lo que manda son los filtros.
  }, [abierto, filtrando, q, estado, orden, r.tipo, recarga])

  const verMas = async () => {
    setCargando(true)
    try {
      const res = await listarPrendas({ pagina: Math.floor(prendas.length / POR_TANDA) + 1, porPagina: POR_TANDA }, { q, estado, orden, tipo: r.tipo })
      setPrendas((antes) => [...antes, ...res.data.filter((p) => !antes.some((a) => a.id === p.id))])
      setTotal(res.meta.total)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se han podido cargar más.')
    } finally {
      setCargando(false)
    }
  }

  if (oculto) return null
  const quedan = total === null ? 0 : total - prendas.length

  return (
    <Paper component="section" aria-labelledby={`${id}-titulo`} sx={{ overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, py: 1.5, backgroundColor: 'action.hover' }}>
        <ButtonBase
          id={`${id}-titulo`}
          aria-expanded={abierto}
          aria-controls={id}
          onClick={onAlternar}
          sx={{ gap: 1, borderRadius: 1, px: 0.5, minHeight: 40, fontSize: 19, fontWeight: 600, fontFamily: 'inherit' }}
        >
          <ExpandMoreIcon aria-hidden="true" sx={{ transition: 'transform 0.2s', transform: abierto ? 'none' : 'rotate(-90deg)' }} />
          {NOMBRE_GRUPO[r.tipo]}
          <Box component="span" sx={{ fontWeight: 400, fontSize: 15, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{r.total}</Box>
        </ButtonBase>
        <Box sx={{ flex: 1 }} />
        <Box component="ul" aria-label={`${NOMBRE_GRUPO[r.tipo]} por estado`} sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {ORDEN_ESTADOS.filter((e) => (r.estados[e] ?? 0) > 0).map((e) => (
            <Box
              component="li"
              key={e}
              title={ETIQUETA_ESTADO[e]}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 26, px: 1.25, borderRadius: 13,
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: ESTADO_PRENDA[e].fondo,
                ...(e === 'BAJA' && { border: 1, borderColor: 'divider' }),
              }}
            >
              <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ESTADO_PRENDA[e].punto }} />
              {cuentaDeEstado(r.estados[e] ?? 0, e, r.tipo)}
            </Box>
          ))}
        </Box>
      </Box>

      {abierto && (
        <Box id={id} sx={{ px: 2.5, pb: 1.5 }}>
          {error && <Alert severity="error" sx={{ my: 1.5 }}>{error}</Alert>}
          {total === null && cargando && <CircularProgress size={24} aria-label={`Cargando ${NOMBRE_GRUPO[r.tipo].toLowerCase()}`} sx={{ my: 2 }} />}
          {total === 0 && <Typography sx={{ py: 2, color: 'text.secondary' }}>Ninguna con esta búsqueda o estos filtros.</Typography>}
          <Box component="ul" aria-label={NOMBRE_GRUPO[r.tipo]} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { md: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, columnGap: 4 }}>
            {prendas.map((p) => (
              <Box component="li" key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 52, borderBottom: 1, borderColor: 'divider' }}>
                <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, flexShrink: 0, borderRadius: '50%', backgroundColor: ESTADO_PRENDA[p.estado].punto }} />
                <Typography component="span" sx={{ width: 92, flexShrink: 0, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.numero}</Typography>
                <Typography component="span" sx={{ width: 52, flexShrink: 0, fontSize: 14, color: p.talla ? 'text.primary' : 'text.disabled' }}>{p.talla || '—'}</Typography>
                <Typography component="span" title={prestadaA(p) ?? undefined} sx={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prestadaA(p) ?? ETIQUETA_ESTADO[p.estado]}
                </Typography>
                <BotonPaso prenda={p} acciones={acciones} />
                <MenuPrenda prenda={p} volver={volver} onBorrar={acciones.onBorrar} />
              </Box>
            ))}
          </Box>
          {quedan > 0 && (
            <Button onClick={() => void verMas()} disabled={cargando} sx={{ mt: 1, textTransform: 'none', fontSize: 14 }}>
              {quedan > POR_TANDA ? `Ver ${POR_TANDA} más · quedan ${quedan}` : `Ver ${quedan === 1 ? 'la que queda' : `las ${quedan} que quedan`}`}
            </Button>
          )}
        </Box>
      )}
    </Paper>
  )
}
