import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore, type AuthUser } from '../features/altas/auth/store'
import FormularioAccesoCms from '../features/altas/auth/FormularioAccesoCms'
import FormularioAccesoHermano from '../features/altas/auth/FormularioAccesoHermano'

/**
 * La ventana que sale cuando la sesión del CMS o la del área de hermanos
 * caduca con alguien dentro.
 *
 * Antes, el 401 vaciaba la sesión y `ExigeRol` (o `ExigeSesion`) cambiaba la
 * pantalla entera por el acceso: el formulario se desmontaba con su texto y
 * con él el aviso de cambios sin guardar, así que quien llevaba un rato
 * escribiendo una noticia, o su dirección en Mi perfil, lo perdía todo al
 * pulsar Guardar. Aquí se vuelve a entrar sin salir de la pantalla y, ya
 * dentro, se pulsa Guardar otra vez.
 *
 * Sin `onClose`: ni Escape ni pulsar fuera la cierran, porque detrás no se
 * puede hacer nada útil sin sesión. La salida explícita es «Salir…».
 */
export default function VentanaSesionCaducada({ area = 'cms' }: { area?: 'cms' | 'hermanos' }) {
  const deCms = area === 'cms'
  const caducada = useAuthStore((state) => (deCms ? state.cmsCaducada : state.hermanoCaducada))
  const anterior = useAuthStore((state) => (deCms ? state.cms : state.hermano))
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
  const salirSesion = useAuthStore((state) => state.salirSesion)
  const queryClient = useQueryClient()

  const alEntrar = (user: AuthUser) => {
    // Otra cuenta en el área de hermanos: lo que hay en pantalla (sus datos,
    // lo que escribía) es de la anterior y no se le puede guardar a esta.
    // Se empieza de cero en su área.
    if (!deCms && anterior && anterior.id !== user.id) {
      entrarSesion(area, user)
      window.location.assign('/area-hermano')
      return
    }
    entrarSesion(area, user)
    // Lo que recibió el 401 mientras tanto se quedaba en «No se ha podido
    // cargar…» hasta recargar a mano: el usuario es el mismo, así que la
    // caché no se vacía sola. Se vuelve a pedir lo que falló.
    void queryClient.invalidateQueries({ predicate: (consulta) => consulta.state.status === 'error' })
  }

  return (
    <Dialog open={caducada} maxWidth="xs" fullWidth aria-labelledby="titulo-sesion-caducada">
      <DialogTitle id="titulo-sesion-caducada">Tu sesión ha caducado</DialogTitle>
      <DialogContent>
        {/* Se monta de nuevo cada vez que se abre: así no arrastra el código
            del 2FA ni los errores de la vez anterior. */}
        {caducada && (deCms ? (
          <FormularioAccesoCms
            subtitulo="Vuelve a entrar para seguir. Lo que estabas haciendo sigue en pantalla: después, pulsa Guardar otra vez."
            emailInicial={anterior?.email}
            sinEnlaceDeOlvido
            alEntrar={alEntrar}
          />
        ) : (
          <FormularioAccesoHermano
            subtitulo="Vuelve a entrar para seguir. Lo que estabas escribiendo sigue en pantalla: después, pulsa Guardar otra vez."
            emailInicial={anterior?.email}
            sinEnlaceDeOlvido
            alEntrar={alEntrar}
          />
        ))}
        <Button fullWidth onClick={() => salirSesion(area)} sx={{ mt: 1, color: 'text.secondary' }}>
          {deCms ? 'Salir del CMS' : 'Salir del área'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
