import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { GlobalStyles } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import {
  ESTILOS_GLOBALES_CMS,
  crearTemaCms,
  graficasCms,
  superficiesCms,
  type GraficasCms,
  type ModoCms,
  type SuperficiesCms,
} from '../theme/cms'

/** Dónde recuerda el navegador el modo elegido. Es por persona y por equipo. */
export const CLAVE_TEMA_CMS = 'cms-tema'

/** Sin nada guardado, oscuro: es la dirección elegida; quien prefiera claro lo cambia una vez. */
const POR_DEFECTO: ModoCms = 'oscuro'

interface ValorTemaCms {
  modo: ModoCms
  cambiarModo: (modo: ModoCms) => void
  superficies: SuperficiesCms
  graficas: GraficasCms
}

const Contexto = createContext<ValorTemaCms | null>(null)

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
    <Contexto.Provider value={valor}>
      <ThemeProvider theme={tema}>
        <GlobalStyles styles={ESTILOS_GLOBALES_CMS} />
        {children}
      </ThemeProvider>
    </Contexto.Provider>
  )
}

export function useTemaCms(): ValorTemaCms {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useTemaCms solo funciona dentro de TemaCmsProvider')
  return valor
}
