import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { actosDelCurso, cuandoFalta, diaMes, rangoDe, tandaInicial, tandasDelCurso, type Tanda } from './tandas'
import { contar } from './plural'
import { aparecer, sinMovimiento } from './animaciones'
import { FILETE, FILETE_SUAVE, FONDO_PIEZA, ORO, SERIF } from './estiloRetablo'

/** Lo que dice cada tanda bajo su nombre. */
function estadoDe(tanda: Tanda, hoy: Date): string {
  const n = contar(tanda.actos.length, 'acto', 'actos')
  if (tanda.estado === 'viva') return `En curso · ${n}`
  if (tanda.estado === 'pasada') return n
  const cuando = cuandoFalta(hoy, tanda.inicio)
  return `${cuando[0].toUpperCase()}${cuando.slice(1)} · ${n}`
}

/**
 * El curso, de un Sábado de Pasión al siguiente, por tandas: la Hermandad hace
 * muchos actos en pocas semanas y luego pasa meses sin nada, así que cada
 * tanda ocupa lo que pesa (sus actos), no lo que dura. Se abre sola la de
 * ahora o la próxima, y debajo van sus actos; al pulsar otra, los suyos.
 */
export default function ElCurso({ eventos, hoy = new Date() }: { eventos: PanelResponse['curso']['eventos']; hoy?: Date }) {
  const { porcentaje } = cuentaAtrasEstacion(hoy)
  const actos = actosDelCurso(hoy, eventos)
  const tandas = tandasDelCurso(actos, hoy)
  const [elegida, setElegida] = useState<number | null>(null)
  const indiceAbierta = elegida !== null && elegida < tandas.length ? elegida : tandaInicial(tandas)
  const siguiente = actos.find((a) => !a.pasado)
  const porDelante = actos.filter((a) => !a.pasado).length

  return (
    <Box
      component="section"
      aria-labelledby="el-curso"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, p: { xs: 2.25, md: 3.5 }, borderRadius: 2.5, border: `1px solid ${FILETE}`, backgroundColor: FONDO_PIEZA }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2px 16px', flexWrap: 'wrap' }}>
        <Typography id="el-curso" component="h2" sx={{ ...SERIF, fontSize: 28 }}>El curso</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {porcentaje} % recorrido · {porDelante ? `${contar(porDelante, 'acto', 'actos')} por delante` : 'sin actos por delante'}
        </Typography>
      </Box>

      {tandas.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          {tandas.map((tanda, i) => {
            const abierta = i === indiceAbierta
            const viva = tanda.estado === 'viva'
            return (
              <Box
                key={`${tanda.inicio.getTime()}-${tanda.actos.length}`}
                component="button"
                type="button"
                onClick={() => setElegida(i)}
                aria-expanded={abierta}
                aria-controls="curso-detalle"
                aria-label={`${tanda.nombre}, ${contar(tanda.actos.length, 'acto', 'actos')}, ${rangoDe(tanda)}`}
                sx={{
                  // Cada tanda ocupa lo que pesa; nunca más estrecha que su texto.
                  flex: `${Math.max(tanda.actos.length, 1)} 1 0`, minWidth: 'max-content',
                  px: 1.75, py: 1.5, m: 0, borderRadius: 1.5, textAlign: 'left', fontFamily: 'inherit', color: 'text.primary', cursor: 'pointer',
                  border: '1px solid', borderColor: abierta ? `color-mix(in srgb, ${ORO} 60%, transparent)` : FILETE,
                  backgroundColor: abierta ? `color-mix(in srgb, ${ORO} 9%, transparent)` : 'transparent',
                  opacity: tanda.estado === 'pasada' && !abierta ? 0.55 : 1,
                  '&:hover': { borderColor: `color-mix(in srgb, ${ORO} 45%, transparent)` },
                  '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
                  animation: `${aparecer} .45s cubic-bezier(.2, .9, .3, 1.2) backwards`, animationDelay: `${200 + i * 70}ms`, ...sinMovimiento,
                }}
              >
                <Box component="span" sx={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{tanda.nombre}</Box>
                <Box component="span" sx={{ display: 'block', fontSize: 12, mt: 0.5, whiteSpace: 'nowrap', color: viva ? ORO : 'text.secondary' }}>{estadoDe(tanda, hoy)}</Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/*
        Todas las listas en la misma celda y solo se ve la de la tanda abierta:
        la celda mide lo que la más larga (con su tope), así que al pulsar otra
        tanda la pieza no cambia de alto.
      */}
      {tandas.length > 0 && (
        <Box id="curso-detalle" aria-live="polite" sx={{ display: 'grid' }}>
          {tandas.map((tanda, t) => {
            const visible = t === indiceAbierta
            return (
              <Box
                key={`${tanda.inicio.getTime()}-${tanda.actos.length}`}
                aria-hidden={!visible}
                inert={!visible}
                sx={{ gridArea: '1 / 1', visibility: visible ? 'visible' : 'hidden', minWidth: 0 }}
              >
                <Typography component="h3" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                  {tanda.nombre} · {rangoDe(tanda)} · {contar(tanda.actos.length, 'acto', 'actos')}
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    listStyle: 'none', m: 0, p: 0, display: 'grid', columnGap: 4, alignContent: 'start',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                    // La Cuaresma trae veinte actos: se desplazan dentro en lugar de estirar la pieza.
                    maxHeight: 240, overflowY: 'auto', scrollbarWidth: 'thin',
                  }}
                >
                  {tanda.actos.map((acto, i) => {
                    const esSiguiente = acto === siguiente
                    return (
                      <Box
                        component="li"
                        key={i}
                        sx={{ display: 'flex', gap: 1.75, alignItems: 'baseline', py: 1.25, borderTop: `1px solid ${FILETE_SUAVE}`, opacity: acto.pasado ? 0.5 : 1 }}
                      >
                        <Box component="span" sx={{ ...SERIF, width: 60, flexShrink: 0, fontSize: 20, color: esSiguiente ? ORO : 'text.secondary' }}>
                          {diaMes(acto.fecha)}
                        </Box>
                        <Box component="span" sx={{ fontSize: 15, fontWeight: esSiguiente ? 500 : 400, overflowWrap: 'anywhere' }}>{acto.titulo}</Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
