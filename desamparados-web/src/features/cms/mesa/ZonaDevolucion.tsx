import { useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { devolverEnMesa, type FichaDeMesa } from '../../../lib/api/mesa'
import { leyenda } from './datosDeLaFicha'
import type { Aviso } from './piezas'
import { nombrePrenda, ropaSinDevolver } from './formato'
import { mensajeDeFallo, useClaveDeOperacion } from './enVivo'

interface Props {
  ficha: FichaDeMesa
  onHecho: (aviso: Aviso) => void
}

/**
 * Zona de Devolución, después de la salida (o cuando alguien lo lleva a la
 * parroquia más tarde): todo lo prestado vuelve al ropero. Sale marcado todo
 * lo que tiene: si lo trae todo, se pulsa y listo; si falta algo, se desmarca
 * y sigue a su nombre. Las túnicas van al lavado, sin excepción; lo roto se
 * marca y va al taller para arreglarlo.
 */
export default function ZonaDevolucion({ ficha, onHecho }: Props) {
  const [trae, setTrae] = useState<Record<number, boolean>>(() => Object.fromEntries(ficha.prendas.map((p) => [p.id, true])))
  const [rotas, setRotas] = useState<Record<number, boolean>>({})
  const [cingulos, setCingulos] = useState<Record<number, boolean>>(() => Object.fromEntries(ficha.cingulosSinDevolver.map((c) => [c.papeletaId, true])))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { clave, renovar } = useClaveDeOperacion()

  const hayAlgo = ficha.prendas.length > 0 || ficha.cingulosSinDevolver.length > 0
  if (!hayAlgo) return <Alert severity="success">No tiene nada del ropero sin devolver.</Alert>

  const prendas = ficha.prendas.filter((p) => trae[p.id])
  const deCingulos = ficha.cingulosSinDevolver.filter((c) => cingulos[c.papeletaId])
  const todo = prendas.length === ficha.prendas.length && deCingulos.length === ficha.cingulosSinDevolver.length
  const nada = prendas.length === 0 && deCingulos.length === 0

  const devolver = async () => {
    setEnviando(true); setError(null)
    try {
      await devolverEnMesa({
        hermanoId: ficha.id,
        prendas: prendas.map((p) => ({ id: p.id, ...(rotas[p.id] && { rota: true }) })),
        cingulos: deCingulos.map((c) => c.papeletaId),
        clave,
      })
      renovar()
      const faltan = ficha.prendas.filter((p) => !trae[p.id])
      const cingulosQueFaltan = ficha.cingulosSinDevolver.length - deCingulos.length
      onHecho({
        tono: todo ? 'success' : 'warning',
        texto: todo
          ? `${ficha.nombre} ${ficha.primerApellido ?? ''}: lo ha devuelto todo.`
          : `${ficha.nombre} ${ficha.primerApellido ?? ''}: devuelto lo que trae. Le falta: ${ropaSinDevolver(faltan, cingulosQueFaltan)}.`,
      })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido registrar la devolución.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Stack spacing={2} component="form" onSubmit={(e) => { e.preventDefault(); if (!nada) void devolver() }}>
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 0.5 }}>
        <Typography component="legend" sx={leyenda}>Lo que tiene del ropero</Typography>
        {ficha.prendas.map((p) => (
          <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Checkbox checked={Boolean(trae[p.id])} onChange={(e) => setTrae({ ...trae, [p.id]: e.target.checked })} />}
              label={<><Box component="span" sx={{ textTransform: 'capitalize' }}>{nombrePrenda(p)}</Box>{p.tipo === 'TUNICA' && trae[p.id] && !rotas[p.id] ? <Typography component="span" variant="body2" color="text.secondary"> · al lavado</Typography> : null}</>}
            />
            {trae[p.id] && (
              <FormControlLabel
                sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13.5 } }}
                control={<Switch size="small" color="warning" checked={Boolean(rotas[p.id])} onChange={(e) => setRotas({ ...rotas, [p.id]: e.target.checked })} />}
                label="Rota: al taller"
              />
            )}
          </Box>
        ))}
        {ficha.cingulosSinDevolver.map((c) => (
          <FormControlLabel
            key={c.papeletaId}
            control={<Checkbox checked={Boolean(cingulos[c.papeletaId])} onChange={(e) => setCingulos({ ...cingulos, [c.papeletaId]: e.target.checked })} />}
            label={`Cíngulo${ficha.cingulosSinDevolver.length > 1 || c.year !== ficha.year ? ` (${c.year})` : ''}`}
          />
        ))}
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Button type="submit" variant="contained" size="large" disabled={enviando || nada}>
        {enviando ? 'Guardando…' : todo ? 'Lo devuelve todo' : 'Devolver lo marcado'}
      </Button>
    </Stack>
  )
}
