import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../altas/auth/store'
import { apuntados, fichaDeMesa } from '../../../lib/api/mesa'
import CabeceraSeccion from '../CabeceraSeccion'
import CampoBusqueda from '../listados/CampoBusqueda'
import AltaEnMesa from './AltaEnMesa'
import BuscadorPersonas from './BuscadorPersonas'
import FormularioApuntar from './FormularioApuntar'
import TablaApuntados from './TablaApuntados'
import { euros, fechaCorta } from './formato'

type Modo = { tipo: 'buscar' } | { tipo: 'ficha'; id: number } | { tipo: 'alta' }

const CLAVE = ['mesa'] as const

/**
 * La mesa de la procesión: lo que antes era una hoja de cálculo con su panel
 * lateral. A la izquierda, quién sale este año; a la derecha, buscar a la
 * persona (o darla de alta), comprobar sus datos con ella delante y
 * apuntarla con su puesto y su ropa, cobrando.
 */
export default function MesaProcesionPage() {
  const role = useAuthStore((s) => s.cms?.role ?? 'USER')
  const queryClient = useQueryClient()
  const [modo, setModo] = useState<Modo>({ tipo: 'buscar' })
  const [aviso, setAviso] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<{ q: string; puesto: string }>({ q: '', puesto: '' })

  const listado = useQuery({
    queryKey: [...CLAVE, 'apuntados', filtro.q, filtro.puesto],
    queryFn: () => apuntados(filtro),
    placeholderData: (anterior) => anterior,
  })
  const idFicha = modo.tipo === 'ficha' ? modo.id : null
  const ficha = useQuery({
    queryKey: [...CLAVE, 'ficha', idFicha],
    queryFn: () => fichaDeMesa(idFicha!),
    enabled: idFicha !== null,
  })

  const abrir = (id: number) => { setAviso(null); setModo({ tipo: 'ficha', id }) }
  const hecho = (texto: string) => {
    setAviso(texto)
    setModo({ tipo: 'buscar' })
    void queryClient.invalidateQueries({ queryKey: CLAVE })
  }

  const datos = listado.data
  const recaudado = datos?.papeletas.reduce((s, p) => s + (p.recibo.estado === 'PAGADO' ? p.recibo.importe : 0), 0) ?? 0
  const total = datos?.puestos.reduce((s, p) => s + p.total, 0) ?? 0

  return (
    <>
      <Helmet><title>Mesa de la procesión | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion
        titulo="Mesa de la procesión"
        subtitulo={datos ? `${total} ${total === 1 ? 'apuntado' : 'apuntados'} en ${datos.year} · ${euros(recaudado)} cobrados` : undefined}
      />

      <Box sx={{ containerType: 'inline-size' }}>
        <Box
          sx={{
            display: 'grid', gap: 3, alignItems: 'start',
            gridTemplateColumns: 'minmax(0, 1fr)',
            '@container (min-width: 1100px)': { gridTemplateColumns: 'minmax(0, 1fr) 420px' },
          }}
        >
          {/* En pantallas estrechas, el panel va primero: es donde se trabaja. */}
          <Paper
            component="section"
            aria-label="Apuntar"
            sx={{
              p: 2.5, order: { xs: -1 }, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
              '@container (min-width: 1100px)': { order: 1 },
            }}
          >
            {aviso && <Alert severity="success" onClose={() => setAviso(null)} sx={{ mb: 2 }}>{aviso}</Alert>}

            {modo.tipo === 'buscar' && (
              <Stack spacing={2}>
                <Typography variant="h5" component="h2">Apuntar</Typography>
                <BuscadorPersonas autoFocus onElegir={(p) => abrir(p.id)} />
                <Button startIcon={<PersonAddAltOutlinedIcon />} onClick={() => { setAviso(null); setModo({ tipo: 'alta' }) }} sx={{ alignSelf: 'start' }}>
                  No está en el censo: darla de alta
                </Button>
              </Stack>
            )}

            {modo.tipo !== 'buscar' && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <Tooltip title="Buscar a otra persona">
                  <IconButton aria-label="Buscar a otra persona" onClick={() => setModo({ tipo: 'buscar' })} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
                </Tooltip>
                <Box sx={{ minWidth: 0 }}>
                  {modo.tipo === 'alta' && <Typography variant="h5" component="h2">Persona nueva</Typography>}
                  {modo.tipo === 'ficha' && ficha.data && (
                    <>
                      <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>{ficha.data.nombre} {ficha.data.apellidos}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {ficha.data.numeroHermano ? `N.º ${ficha.data.numeroHermano} · ` : ''}{fechaCorta(ficha.data.fechaNacimiento)}
                      </Typography>
                    </>
                  )}
                </Box>
              </Stack>
            )}

            {modo.tipo === 'alta' && (
              <AltaEnMesa onCancelar={() => setModo({ tipo: 'buscar' })} onHecha={(id, texto) => { setModo({ tipo: 'ficha', id }); setAviso(texto) }} />
            )}

            {modo.tipo === 'ficha' && (
              ficha.isError ? <Alert severity="error">No se ha podido abrir la ficha.</Alert>
                : !ficha.data ? <CircularProgress aria-label="Cargando la ficha" />
                  : (
                    <FormularioApuntar
                      key={`${ficha.data.id}-${ficha.data.papeleta?.id ?? 'nueva'}-${ficha.data.situacion}`}
                      ficha={ficha.data}
                      role={role}
                      puestosUsados={datos?.puestos.map((p) => p.puesto) ?? []}
                      onHecho={hecho}
                      onRecargar={() => void ficha.refetch()}
                    />
                  )
            )}
          </Paper>

          <Box component="section" aria-label="Apuntados" sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <CampoBusqueda etiqueta="Buscar entre los apuntados" valor={filtro.q} onCambiar={(q) => setFiltro({ ...filtro, q })} sx={{ maxWidth: 360 }} />
            </Stack>
            {datos && datos.puestos.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: 'wrap' }} role="group" aria-label="Filtrar por puesto">
                {[{ puesto: '', total }, ...datos.puestos].map((p) => (
                  <Button
                    key={p.puesto || 'todos'}
                    size="small"
                    variant={filtro.puesto === p.puesto ? 'contained' : 'outlined'}
                    color={filtro.puesto === p.puesto ? 'primary' : 'inherit'}
                    aria-pressed={filtro.puesto === p.puesto}
                    onClick={() => setFiltro({ ...filtro, puesto: p.puesto })}
                    sx={{ borderRadius: 999, py: 0.25 }}
                  >
                    {p.puesto || 'Todos'} · {p.total}
                  </Button>
                ))}
              </Stack>
            )}
            {listado.isError && <Alert severity="error">No se ha podido cargar el listado de apuntados.</Alert>}
            {!datos && !listado.isError && <CircularProgress aria-label="Cargando los apuntados" />}
            {datos && <TablaApuntados apuntados={datos.papeletas} seleccionado={idFicha} onElegir={abrir} />}
          </Box>
        </Box>
      </Box>
    </>
  )
}
