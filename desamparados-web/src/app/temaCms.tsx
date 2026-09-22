import { useCallback, useMemo, useState } from 'react'
import { GlobalStyles } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import {
  ESTILOS_GLOBALES_CMS,
  crearTemaCms,
  graficasCms,
  superficiesCms,
  type ModoCms,
} from '../theme/cms'
import { ContextoTemaCms, type ValorTemaCms } from './useTemaCms'

/** Dónde recuerda el navegador el modo elegido. Es por persona y por equipo. */
export const CLAVE_TEMA_CMS = 'cms-tema'

/** Sin nada guardado, oscuro: es la dirección elegida; quien prefiera claro lo cambia una vez. */
const POR_DEFECTO: ModoCms = 'oscuro'

/**
 * localStorage puede lanzar (modo privado, almacenamiento bloqueado, iframes) y
 * puede traer basura si alguien lo edita a mano: en los dos casos, el modo por
 * defecto. Se lee en el inicializador de useState, antes del primer pintado,
 * para que no haya un parpadeo de claro a oscuro al entrar.
 */
function leerModo(): ModoCms {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TEMA_CMS)
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : POR_DEFECTO
  } catch {
    return POR_DEFECTO
  }
}

export function TemaCmsProvider({ children }: { children: React.ReactNode }) {
  const [modo, setModo] = useState<ModoCms>(leerModo)

  const cambiarModo = useCallback((nuevo: ModoCms) => {
    setModo(nuevo)
    try {
      window.localStorage.setItem(CLAVE_TEMA_CMS, nuevo)
    } catch {
      // Sin almacenamiento: la elección dura lo que dure la pestaña.
    }
  }, [])

  const valor = useMemo<ValorTemaCms>(
    () => ({ modo, cambiarModo, superficies: superficiesCms(modo), graficas: graficasCms(modo) }),
    [modo, cambiarModo],
  )
  const tema = useMemo(() => crearTemaCms(modo), [modo])

  return (
    <ContextoTemaCms.Provider value={valor}>
      <ThemeProvider theme={tema}>
        <GlobalStyles styles={ESTILOS_GLOBALES_CMS} />
        {children}
      </ThemeProvider>
    </ContextoTemaCms.Provider>
  )
}
