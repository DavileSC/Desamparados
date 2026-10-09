import { Box, Typography } from '@mui/material'
import type { Prenda } from '../../../lib/api/inventario'
import { ETIQUETA_TIPO } from '../ropero'
import { Dato, DatosDeFicha, Ficha, ListaDeFichas } from '../listados/Fichas'
import { ESTADO_PRENDA } from './colores'
import { BotonPaso, MenuPrenda, PildoraEstado, prestadaA, type AccionesPrenda } from './piezasPrenda'

interface Props extends AccionesPrenda {
  prendas: Prenda[]
  volver: string
}

/**
 * El ropero en el móvil: una ficha por prenda, con la marca del color de su
 * estado a la izquierda, su paso siguiente a todo lo ancho (para el pulgar) y
 * editar y eliminar arriba a la derecha. En el PC, un tipo cada vez en tabla (TablaPrendas).
 */
export default function PrendasEnFichas({ prendas, volver, ...acciones }: Props) {
  return (
    <ListaDeFichas etiqueta="Ropero" vacia={prendas.length === 0 ? 'No hay prendas con esta búsqueda o estos filtros.' : undefined}>
      {prendas.map((p) => (
        <Ficha
          key={p.id}
          color={ESTADO_PRENDA[p.estado].punto}
          acciones={<MenuPrenda prenda={p} volver={volver} onBorrar={acciones.onBorrar} />}
          titulo={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', minHeight: 32 }}>
              <Typography component="span" sx={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.numero}</Typography>
              <PildoraEstado estado={p.estado} />
            </Box>
          }
        >
          <DatosDeFicha>
            <Dato etiqueta="Tipo">{ETIQUETA_TIPO[p.tipo] ?? p.tipo}</Dato>
            <Dato etiqueta="Talla">{p.talla || '—'}</Dato>
            {p.hermano && <Dato etiqueta="La tiene" ancho>{prestadaA(p)}</Dato>}
            {p.observaciones && <Dato etiqueta="Observaciones" ancho>{p.observaciones}</Dato>}
          </DatosDeFicha>
          <BotonPaso prenda={p} acciones={acciones} ancho />
        </Ficha>
      ))}
    </ListaDeFichas>
  )
}
