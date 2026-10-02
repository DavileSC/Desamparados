import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from './CabeceraSeccion'
import { GRUPOS } from '../../app/cmsNavegacion'
import { site } from '../../config/site'
import { ErrorDeApi } from '../../lib/api/cliente'
import { CLAVE_MODULOS, cambiarModulo, listasDelRechazo, modulosDelCms, type ModuloDelCms } from '../../lib/api/modulos'
import { fichaDeModulo, type ClaveModulo } from '../../domain/modulos'

const CLAVE_LISTA = ['modulos', 'cms'] as const

/** «12 productos, 40 ventas de caja», o nada. */
const datosEnPalabras = (m: ModuloDelCms) => m.datos.map((d) => `${d.total} ${d.que}`).join(', ')
const nombres = (claves: ClaveModulo[]) => claves.map((c) => fichaDeModulo(c).nombre).join(', ')

type Pregunta =
  | { tipo: 'apagar'; modulo: ModuloDelCms }
  | { tipo: 'encender-con'; modulo: ModuloDelCms; faltan: ClaveModulo[] }

/**
 * Qué módulos tiene encendidos esta instalación. Solo Administración: encender
 * uno abre pantallas y rutas a toda la junta. Las reglas (qué requiere qué, qué
 * impide apagar) las aplica el servidor: aquí solo se preguntan y se cuentan.
 */
export default function ModulosAdminPage() {
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
      setPregunta({ tipo: 'apagar', modulo })
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

  /**
   * Apagar es un solo cambio. Encender con requisitos apagados son varios: primero
   * lo que falta y el módulo pulsado al final, cada uno con su propia llamada (el
   * servidor no tiene un «encender estos tres» de una vez).
   */
  const confirmar = async () => {
    if (!pregunta) return
    const { modulo } = pregunta
    const activo = pregunta.tipo !== 'apagar'
    const claves = pregunta.tipo === 'encender-con' ? [...pregunta.faltan, modulo.clave] : [modulo.clave]
    setPregunta(null)
    try {
      for (const clave of claves) {
        await cambiar.mutateAsync({ clave, activo, conRequisitos: activo })
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se ha podido completar el cambio.')
    }
  }

  return (
    <>
      <Helmet><title>{`Módulos | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      {isPending ? (
        // La cabecera no sale hasta tener datos: si saliera antes, un «Módulos»
        // siempre presente dejaría a quien prueba la pantalla por su título sin
        // ninguna señal de que falta esperar a la lista (la consulta llega
        // después, y nada volvería a comprobarlo).
        <Typography color="text.secondary">Cargando…</Typography>
      ) : (
        <>
          <CabeceraSeccion titulo="Módulos" />
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
            Lo que esta instalación usa. Apagar un módulo lo quita del CMS, de la web y del área de hermanos y cierra sus rutas; sus datos se conservan y vuelven al encenderlo.
          </Typography>
          {aviso && <Alert severity="error" onClose={() => setAviso(null)} sx={{ mb: 2 }}>{aviso}</Alert>}
          {isError && <Alert severity="error">No se han podido cargar los módulos.</Alert>}
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
        </>
      )}

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
      </Dialog>
    </>
  )
}
