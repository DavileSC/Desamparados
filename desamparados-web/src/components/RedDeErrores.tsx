import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Box, Button, Typography } from '@mui/material'
import ContenedorDePagina from './ContenedorDePagina'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Última red de seguridad de la interfaz.
 *
 * Sin esto, un error al pintar cualquier componente —una noticia con un campo
 * inesperado, una respuesta de la API con otra forma— hace que React desmonte
 * el árbol entero y el visitante se quede ante una página en blanco, sin
 * mensaje ni forma de volver.
 *
 * Tiene que ser una clase: los hooks no pueden capturar errores de render.
 */
export default class RedDeErrores extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en la consola del navegador para poder diagnosticarlo con el
    // visitante delante. Si algún día se añade un servicio de monitorización,
    // este es el punto donde enviarlo.
    console.error('[RedDeErrores] Error no controlado en la interfaz:', error, info.componentStack)
  }

  private recargar = () => {
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <Box
        component="main"
        role="alert"
        sx={{ py: { xs: 10, md: 16 }, minHeight: '60vh', display: 'flex', alignItems: 'center' }}
      >
        <ContenedorDePagina>
          <Box sx={{ maxWidth: 560, mx: 'auto', textAlign: 'center' }}>
            <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
              Algo ha fallado en esta página
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              No hemos podido mostrar el contenido. El resto del sitio sigue funcionando: vuelve a
              la portada e inténtalo de nuevo. Si se repite, escríbenos y lo revisamos.
            </Typography>
            <Button variant="contained" color="primary" onClick={this.recargar}>
              Volver a la portada
            </Button>
          </Box>
        </ContenedorDePagina>
      </Box>
    )
  }
}
