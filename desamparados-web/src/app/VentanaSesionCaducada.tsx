import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material'
import { useAuthStore } from '../features/altas/auth/store'
import FormularioAccesoCms from '../features/altas/auth/FormularioAccesoCms'

/**
 * La ventana que sale cuando la sesión del CMS caduca con alguien dentro.
 *
 * Antes, el 401 vaciaba la sesión y `ExigeRol` cambiaba la pantalla entera por
 * el acceso: el formulario se desmontaba con su texto y con él el aviso de
 * cambios sin guardar, así que quien llevaba un rato escribiendo una noticia lo
 * perdía todo al pulsar Guardar. Aquí se vuelve a entrar sin salir de la
 * pantalla y, ya dentro, se pulsa Guardar otra vez.
 *
 * Sin `onClose`: ni Escape ni pulsar fuera la cierran, porque detrás no se
 * puede hacer nada útil sin sesión. La salida explícita es «Salir del CMS».
 */
export default function VentanaSesionCaducada() {
  const caducada = useAuthStore((state) => state.cmsCaducada)
  const email = useAuthStore((state) => state.cms?.email)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
  const salirSesion = useAuthStore((state) => state.salirSesion)

  return (
    <Dialog open={caducada} maxWidth="xs" fullWidth aria-labelledby="titulo-sesion-caducada">
      <DialogTitle id="titulo-sesion-caducada">Tu sesión ha caducado</DialogTitle>
      <DialogContent>
        {/* Se monta de nuevo cada vez que se abre: así no arrastra el código
            del 2FA ni los errores de la vez anterior. */}
        {caducada && (
          <FormularioAccesoCms
            subtitulo="Vuelve a entrar para seguir. Lo que estabas haciendo sigue en pantalla: después, pulsa Guardar otra vez."
            emailInicial={email}
            sinEnlaceDeOlvido
            alEntrar={(user) => entrarSesion('cms', user)}
          />
        )}
        <Button fullWidth onClick={() => salirSesion('cms')} sx={{ mt: 1, color: 'text.secondary' }}>
          Salir del CMS
        </Button>
      </DialogContent>
    </Dialog>
  )
}
