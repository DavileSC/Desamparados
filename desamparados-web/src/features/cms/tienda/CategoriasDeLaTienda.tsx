import { Fragment, useState } from 'react'
import { Alert, Box, Button, CircularProgress, IconButton, Paper, TextField, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { borrarCategoria, categoriasDelCms, crearCategoria, ordenarCategorias, renombrarCategoria, type CategoriaDelCms } from '../../../lib/api/tienda'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

/** Cuántas se ven en la tienda sin abrir «Más»: en el ordenador, tres; en el móvil, dos. */
const A_LA_VISTA = 3

/**
 * Las categorías de la tienda, para filtrar en la web. El orden es el de la
 * píldora de filtros: las primeras se ven siempre y el resto queda en «Más».
 * En la tienda solo salen las que tienen algo a la venta.
 */
export default function CategoriasDeLaTienda({ onAviso, onError }: { onAviso: (t: string) => void; onError: (t: string) => void }) {
  const cliente = useQueryClient()
  const consulta = useQuery({ queryKey: ['tienda', 'categorias'], queryFn: categoriasDelCms })
  const [nueva, setNueva] = useState('')
  const [nombres, setNombres] = useState<Record<number, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [aBorrar, setABorrar] = useState<CategoriaDelCms | null>(null)

  const lista = consulta.data
  // Los productos y el catálogo llevan la categoría: también se recargan.
  const recargar = () => cliente.invalidateQueries({ queryKey: ['tienda'] })
  const hacer = async (accion: () => Promise<string | null>) => {
    setOcupado(true)
    try {
      const aviso = await accion()
      if (aviso) onAviso(aviso)
      await recargar()
    } catch (err: unknown) { onError(mensaje(err, 'No se ha podido guardar.')) }
    finally { setOcupado(false) }
  }

  const anadir = () => void hacer(async () => {
    const c = await crearCategoria(nueva.trim())
    setNueva('')
    return `Categoría «${c.nombre}» creada.`
  })
  const renombrar = (c: CategoriaDelCms) => void hacer(async () => {
    await renombrarCategoria(c.id, (nombres[c.id] ?? c.nombre).trim())
    setNombres((antes) => Object.fromEntries(Object.entries(antes).filter(([id]) => Number(id) !== c.id)))
    return 'Nombre guardado.'
  })
  const mover = (i: number, paso: -1 | 1) => void hacer(async () => {
    if (!lista) return null
    const ids = lista.map((c) => c.id)
    ;[ids[i], ids[i + paso]] = [ids[i + paso], ids[i]]
    await ordenarCategorias(ids)
    return null
  })
  const borrar = () => {
    const c = aBorrar
    setABorrar(null)
    if (c) void hacer(async () => (await borrarCategoria(c.id)).message)
  }

  if (!lista) {
    return consulta.isError
      ? <Alert severity="error">{mensaje(consulta.error, 'No se han podido cargar las categorías.')}</Alert>
      : <CircularProgress aria-label="Cargando las categorías" />
  }

  return (
    <Paper component="section" aria-label="Categorías" sx={{ p: { xs: 2, sm: 2.5 }, maxWidth: 720, display: 'grid', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Por ellas se filtra en la tienda. Las {A_LA_VISTA} primeras se ven siempre (dos en el móvil); las demás, al pulsar «Más». Solo salen las que tienen algo a la venta.
      </Typography>

      <Box component="form" onSubmit={(e) => { e.preventDefault(); if (nueva.trim()) anadir() }} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <TextField size="small" label="Nueva categoría" value={nueva} onChange={(e) => setNueva(e.target.value)}
          helperText="Corta: es lo que se lee en el filtro. Ej.: Ropa, Medallas" slotProps={{ htmlInput: { maxLength: 40 } }} sx={{ flex: 1 }} />
        <Button type="submit" variant="contained" disabled={ocupado || !nueva.trim()}>Añadir</Button>
      </Box>

      {lista.length === 0
        ? <Typography color="text.secondary">Todavía no hay categorías: la tienda no enseña filtros.</Typography>
        : (
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
            {lista.map((c, i) => {
              const nombre = nombres[c.id] ?? c.nombre
              const cambiado = nombre.trim() !== c.nombre && nombre.trim() !== ''
              // Con una sola de más, la tienda la enseña también: no hay «Más».
              const empiezaMas = i === A_LA_VISTA && lista.length > A_LA_VISTA + 1
              return (
                <Fragment key={c.id}>
                {empiezaMas && (
                  <Box component="li" aria-hidden sx={{ pt: 1.5, pb: 0.5, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>
                    Dentro de «Más»
                  </Box>
                )}
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
                  <Typography sx={{ width: 28, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</Typography>
                  <TextField size="small" value={nombre} onChange={(e) => setNombres({ ...nombres, [c.id]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && cambiado) renombrar(c) }}
                    slotProps={{ htmlInput: { maxLength: 40, 'aria-label': `Nombre de la categoría ${i + 1}` } }} sx={{ flex: '1 1 200px' }} />
                  {cambiado && <Button size="small" variant="contained" disabled={ocupado} onClick={() => renombrar(c)}>Guardar</Button>}
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 96 }}>
                    {c.productos === 1 ? '1 producto' : `${c.productos} productos`}
                  </Typography>
                  <IconButton aria-label={`Subir ${c.nombre}`} disabled={ocupado || i === 0} onClick={() => mover(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
                  <IconButton aria-label={`Bajar ${c.nombre}`} disabled={ocupado || i === lista.length - 1} onClick={() => mover(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
                  <IconButton aria-label={`Borrar ${c.nombre}`} disabled={ocupado} onClick={() => setABorrar(c)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Box>
                </Fragment>
              )
            })}
          </Box>
        )}

      <DialogoConfirmacion
        abierto={aBorrar !== null}
        titulo="¿Borrar la categoría?"
        mensaje={aBorrar ? `«${aBorrar.nombre}» deja de salir en los filtros. ${aBorrar.productos > 0 ? 'Sus productos siguen a la venta, sin categoría.' : ''}` : ''}
        textoConfirmar="Borrar"
        peligro
        onConfirmar={borrar}
        onCancelar={() => setABorrar(null)}
      />
    </Paper>
  )
}
