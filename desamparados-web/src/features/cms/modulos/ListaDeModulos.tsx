import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GRUPOS } from '../../../app/cmsNavegacion'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { CLAVE_MODULOS, cambiarModulo, listasDelRechazo, modulosDelCms, type ModuloDelCms } from '../../../lib/api/modulos'
import { dependientesActivos, fichaDeModulo, type ClaveModulo } from '../../../domain/modulos'

export const CLAVE_LISTA = ['modulos', 'cms'] as const

/** «12 productos, 1 venta de caja», o nada. */
const datosEnPalabras = (m: ModuloDelCms) => m.datos.map((d) => `${d.total} ${d.total === 1 ? d.uno : d.que}`).join(', ')
const nombres = (claves: ClaveModulo[]) => claves.map((c) => fichaDeModulo(c).nombre).join(', ')

type Pregunta =
  | { tipo: 'apagar'; modulo: ModuloDelCms }
  | { tipo: 'encender-con'; modulo: ModuloDelCms; faltan: ClaveModulo[] }
  | { tipo: 'no-se-puede-apagar'; modulo: ModuloDelCms; dependientes: ClaveModulo[] }

/**
 * Los módulos con su interruptor, por grupos: la pantalla Módulos y el paso
 * «Las secciones» del asistente de primer arranque. Cada cambio se guarda al
 * pulsarlo. Las reglas (qué requiere qué, qué impide apagar) las aplica el
 * servidor; aquí se adelantan con la lista que hay para avisar antes de
 * preguntar, pero si esa lista está vieja manda el servidor.
 */
export default function ListaDeModulos() {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_LISTA, queryFn: modulosDelCms })
  const [pregunta, setPregunta] = useState<Pregunta | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cambiar = useMutation({
    mutationFn: ({ clave, activo, conRequisitos }: { clave: ClaveModulo; activo: boolean; conRequisitos: boolean }) => cambiarModulo(clave, activo, conRequisitos),
    onSuccess: async () => {
      setAviso(null)
      // Los menús, las rutas y los bloques leen la lista pública: que la vuelvan a pedir.
      await Promise.all([queryClient.invalidateQueries({ queryKey: CLAVE_LISTA }), queryClient.invalidateQueries({ queryKey: CLAVE_MODULOS })])
    },
  })

  const alCambiar = (modulo: ModuloDelCms, activar: boolean) => {
    if (!activar) {
      // Con dependientes encendidos el servidor diría que no: se avisa antes de preguntar «¿apagar?».
      const activos = new Set((data ?? []).filter((m) => m.activo).map((m) => m.clave))
      const dependientes = dependientesActivos(modulo.clave, activos)
      setPregunta(dependientes.length ? { tipo: 'no-se-puede-apagar', modulo, dependientes } : { tipo: 'apagar', modulo })
      return
    }
    cambiar.mutate({ clave: modulo.clave, activo: true, conRequisitos: false }, {
      onError: (e) => {
        // Faltan requisitos: se proponen en el mismo paso, en vez de mandar a encenderlos uno a uno.
        const { faltan } = e instanceof ErrorDeApi ? listasDelRechazo(e.payload) : { faltan: [] }
        if (faltan.length) setPregunta({ tipo: 'encender-con', modulo, faltan })
        else setAviso(e.message)
      },
    })
  }

  const confirmar = () => {
    if (!pregunta || pregunta.tipo === 'no-se-puede-apagar') return
    const { modulo } = pregunta
    const activo = pregunta.tipo !== 'apagar'
    setPregunta(null)
    cambiar.mutate({ clave: modulo.clave, activo, conRequisitos: activo }, {
      onError: (e) => setAviso(e.message),
    })
  }

  return (
    <>
      {aviso && <Alert severity="error" onClose={() => setAviso(null)} sx={{ mb: 2 }}>{aviso}</Alert>}
      {isError && <Alert severity="error">No se han podido cargar los módulos.</Alert>}
      {isPending && <Typography color="text.secondary">Cargando…</Typography>}
      {data && GRUPOS.map((grupo) => {
        const delGrupo = data.filter((m) => m.grupo === grupo)
        if (delGrupo.length === 0) return null
        return (
          <Box key={grupo} component="section" aria-labelledby={`modulos-${grupo}`} sx={{ mb: 4 }}>
            <Typography id={`modulos-${grupo}`} component="h2" variant="overline" color="text.secondary">{grupo}</Typography>
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
              {delGrupo.map((m) => (
                <Box key={m.clave} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', py: 1.5 }}>
                  <Switch
                    checked={m.activo}
                    disabled={cambiar.isPending}
                    onChange={(e) => alCambiar(m, e.target.checked)}
                    slotProps={{ input: { role: 'switch', 'aria-label': m.nombre } }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{m.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">{m.descripcion}</Typography>
                    {m.requiere.length > 0 && (
                      <Typography variant="body2" color="text.secondary">Requiere: {nombres(m.requiere)}</Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">{m.datos.length ? datosEnPalabras(m) : 'Sin datos propios'}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        )
      })}

      <Dialog open={pregunta !== null} onClose={() => setPregunta(null)}>
        {pregunta?.tipo === 'apagar' && (
          <>
            <DialogTitle>¿Apagar «{pregunta.modulo.nombre}»?</DialogTitle>
            <DialogContent>
              <Typography>
                {pregunta.modulo.datos.length ? `Tiene ${datosEnPalabras(pregunta.modulo)}. ` : ''}
                Sus datos se conservan: solo se ocultan, y vuelven al encenderlo. Sus pantallas desaparecen del CMS, de la web y del área de hermanos.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPregunta(null)}>Cancelar</Button>
              <Button variant="contained" color="error" onClick={confirmar}>Apagar</Button>
            </DialogActions>
          </>
        )}
        {pregunta?.tipo === 'encender-con' && (
          <>
            <DialogTitle>«{pregunta.modulo.nombre}» necesita otros módulos</DialogTitle>
            <DialogContent>
              <Typography>Para encenderlo hay que encender también: {nombres(pregunta.faltan)}. Se encienden todos en este paso.</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPregunta(null)}>Cancelar</Button>
              <Button variant="contained" onClick={confirmar}>Encender todos</Button>
            </DialogActions>
          </>
        )}
        {pregunta?.tipo === 'no-se-puede-apagar' && (
          <>
            <DialogTitle>No se puede apagar «{pregunta.modulo.nombre}»</DialogTitle>
            <DialogContent>
              <Typography>
                {pregunta.dependientes.length === 1
                  ? `Lo necesita ${nombres(pregunta.dependientes)}. Apaga antes ese módulo.`
                  : `Lo necesitan ${nombres(pregunta.dependientes)}. Apaga antes esos módulos.`}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setPregunta(null)}>Entendido</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  )
}
