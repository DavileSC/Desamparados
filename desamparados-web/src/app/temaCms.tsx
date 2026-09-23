import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { GlobalStyles } from '@mui/material'
import { ThemeProvider, useColorScheme } from '@mui/material/styles'
import { ATRIBUTO_MODO, ESTILOS_GLOBALES_CMS, GRAFICAS_CMS, SUPERFICIES_CMS, temaCms, type ModoCms } from '../theme/cms'
import { ContextoModoCms, ContextoTemaCms, type ValorTemaCms } from './useTemaCms'

/** Dónde recuerda el navegador el modo elegido. Es por persona y por equipo. */
export const CLAVE_TEMA_CMS = 'cms-tema'

/** Sin nada guardado, oscuro: es la dirección elegida; quien prefiera claro lo cambia una vez. */
const POR_DEFECTO: ModoCms = 'oscuro'

/**
 * localStorage puede lanzar (modo privado, almacenamiento bloqueado, iframes) y
 * puede traer basura si alguien lo edita a mano: en los dos casos, el modo por
 * defecto. Se lee antes del primer pintado, para que no haya un parpadeo de
 * claro a oscuro al entrar.
 */
function leerModo(): ModoCms {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TEMA_CMS)
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : POR_DEFECTO
  } catch {
    return POR_DEFECTO
  }
}

const aEsquema = (modo: ModoCms) => (modo === 'oscuro' ? 'dark' : 'light')

/**
 * Mientras cambia el modo, nada se anima por su cuenta: un botón con
 * `transition: all` saldría en la foto nueva todavía con el color viejo y
 * terminaría de cambiar después del fundido. Se quitan al siguiente fotograma.
 */
function sinTransicionesUnMomento() {
  const estilo = document.createElement('style')
  estilo.textContent = '*, *::before, *::after { transition: none !important; }'
  document.head.appendChild(estilo)
  return () => {
    // Obliga al navegador a aplicar los colores nuevos sin transición antes de quitar la regla.
    void window.getComputedStyle(document.body).opacity
    requestAnimationFrame(() => estilo.remove())
  }
}

/**
 * El tema del CMS. MUI trae los dos modos como variables CSS y los cambia con
 * un atributo de <html> (ver `temaCms` en theme/cms.ts): el tema es el mismo
 * objeto en los dos modos y cambiar no vuelve a pintar ningún componente.
 */
export function TemaCmsProvider({ children }: { children: React.ReactNode }) {
  // El modo de partida se lee una vez, al montar: luego lo lleva MUI.
  const [inicial] = useState(leerModo)
  // Al salir del CMS, el modo se va con él: la pantalla de acceso (siempre
  // clara) no debe heredar el atributo y verse con los colores del oscuro.
  useEffect(() => () => document.documentElement.removeAttribute(ATRIBUTO_MODO), [])

  return (
    <ThemeProvider theme={temaCms} defaultMode={aEsquema(inicial)} storageManager={null} noSsr>
      <GlobalStyles styles={ESTILOS_GLOBALES_CMS} />
      <PuenteModo>{children}</PuenteModo>
    </ThemeProvider>
  )
}

/**
 * Da a la aplicación el modo y la forma de cambiarlo. Al cambiar, solo se
 * vuelve a pintar lo que lee `useModoCms` (el interruptor): `children` es el
 * mismo elemento y el contexto de `useTemaCms` no cambia nunca.
 */
function PuenteModo({ children }: { children: React.ReactNode }) {
  const { mode, setMode } = useColorScheme()
  const modo: ModoCms = mode === 'light' ? 'claro' : 'oscuro'
  // MUI da un `setMode` nuevo en cada cambio: si `cambiarModo` dependiera de
  // él, el contexto cambiaría y se volvería a pintar todo lo que lo lee.
  const fijarModo = useRef(setMode)
  useLayoutEffect(() => { fijarModo.current = setMode }, [setMode])
  const cambiarModo = useCallback((nuevo: ModoCms) => {
    const aplicar = () => fijarModo.current(aEsquema(nuevo))
    // Con transiciones de vista, el navegador guarda la pantalla de antes,
    // cambia el atributo del modo (flushSync: tiene que estar puesto cuando
    // vuelva) y hace aparecer la nueva encima. Sin ellas, o si se pidió
    // reducir el movimiento, el cambio es inmediato.
    const reducir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducir && typeof document.startViewTransition === 'function') {
      const restaurar = sinTransicionesUnMomento()
      const transicion = document.startViewTransition(() => flushSync(aplicar))
      transicion.updateCallbackDone.finally(restaurar)
      // Si el navegador se salta el fundido (pestaña oculta), el cambio se hace igual: no es un error.
      transicion.ready.catch(() => {})
    } else {
      aplicar()
    }
    try {
      window.localStorage.setItem(CLAVE_TEMA_CMS, nuevo)
    } catch {
      // Sin almacenamiento: la elección dura lo que dure la pestaña.
    }
  }, [])

  const valor = useMemo<ValorTemaCms>(() => ({ cambiarModo, superficies: SUPERFICIES_CMS, graficas: GRAFICAS_CMS }), [cambiarModo])

  return (
    <ContextoTemaCms.Provider value={valor}>
      <ContextoModoCms.Provider value={modo}>{children}</ContextoModoCms.Provider>
    </ContextoTemaCms.Provider>
  )
}
