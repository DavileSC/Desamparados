import { createContext, useContext, useEffect } from 'react'

/**
 * La URL canónica la pone `RootLayout` en todas las páginas. Una página que no
 * se debe indexar (la 404, un producto que ya no existe, un pedido) no puede
 * llevarla: un canonical a la propia dirección rota, junto al noindex, son dos
 * señales contrarias para el buscador. Helmet solo deja pisar una etiqueta, no
 * quitarla, así que la página avisa y `RootLayout` deja de ponerla.
 */
export const QuitarCanonico = createContext<(quitar: boolean) => void>(() => {})

/** Mientras esté montada y `activo`, la página no lleva canonical. */
export function useSinCanonico(activo: boolean) {
  const quitar = useContext(QuitarCanonico)
  useEffect(() => {
    if (!activo) return
    quitar(true)
    return () => quitar(false)
  }, [activo, quitar])
}
