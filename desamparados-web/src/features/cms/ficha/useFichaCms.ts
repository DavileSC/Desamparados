import { useEffect, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { useVolverAlListado } from '../../../hooks/useVolverAlListado'

interface Opciones<T, F> {
  /** La ruta del listado al que se vuelve: '/cms/noticias' y sus hermanas. */
  listado: string
  /**
   * Qué ficha traer: el id de la URL, el de la que se duplica, o `null` para
   * empezar en blanco.
   */
  origen: number | null
  cargar: (id: number) => Promise<T>
  /** De lo que devuelve el servidor a lo que se edita en pantalla. */
  aFormulario: (dato: T) => F
  /** El formulario de una ficha nueva. */
  vacio: F
  /** Qué se dice si la ficha no se puede traer. */
  errorAlCargar: string
  /**
   * Duplicar: lo que se carga es el punto de partida de una ficha nueva, no una
   * ficha guardada. Si falla, se empieza en blanco en vez de quedarse sin
   * pantalla: se venía a crear algo, y que el original no aparezca no es motivo
   * para no dejar crearlo.
   */
  comoCopia?: boolean
}

/**
 * El ciclo de una ficha del CMS: traerla, saber si se ha tocado, avisar antes
 * de salir con cambios sin guardar, y guardarla volviendo al listado.
 *
 * Lo tenían escrito igual Noticias, Publicaciones y Agenda, con las mismas
 * cinco variables de estado y el mismo `JSON.stringify` para el «sucio». Tres
 * copias de lo mismo son tres sitios donde arreglar cualquier cosa, y ya se
 * habían separado en detalles (una traía el aviso al fallar la carga y las
 * otras no). Lo que cambia de una ficha a otra son sus campos, no su ciclo.
 *
 * Lo que NO entra aquí: qué campos tiene cada una, qué se puede guardar y qué
 * no, y qué botones se enseñan. Eso es lo propio de cada ficha y vive en su
 * pantalla.
 */
export function useFichaCms<T, F>({ listado, origen, cargar, aFormulario, vacio, errorAlCargar, comoCopia = false }: Opciones<T, F>) {
  const navegar = useNavigate()
  // El listado del que se vino, con su página y sus filtros: el enlace de editar
  // los trae en el state. Sin state (URL tecleada) se cae en la ruta pelada.
  const volverAlListado = useVolverAlListado(listado)
  const [cargado, setCargado] = useState<T | null>(null)
  const [form, setForm] = useState<F | null>(origen === null ? vacio : null)
  const [inicial, setInicial] = useState<F | null>(form)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (origen === null) return
    cargar(origen)
      .then((dato) => {
        const datos = aFormulario(dato)
        setCargado(dato)
        setForm(datos)
        setInicial(datos)
      })
      .catch(() => {
        setError(errorAlCargar)
        if (comoCopia) { setForm(vacio); setInicial(vacio) }
      })
    // `cargar` y compañía se rehacen en cada render de la pantalla: la ficha se
    // trae por su origen, que es lo único que la identifica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen])

  const sucio = JSON.stringify(form) !== JSON.stringify(inicial)
  // `guardando` fuera del bloqueo: al guardar se navega al listado con el
  // formulario aún distinto del cargado, y no hay nada que perder.
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sucio && !guardando && currentLocation.pathname !== nextLocation.pathname)

  const campo = <K extends keyof F>(clave: K, valor: F[K]) =>
    setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))

  /**
   * Guardar: enseña el aviso en el listado si sale bien y deja el error a la
   * vista, con la ficha como estaba, si no. La pantalla solo pone la llamada.
   */
  const guardar = async (enviar: () => Promise<unknown>, { aviso, siFalla }: { aviso: string; siFalla: string }) => {
    setGuardando(true)
    setError(null)
    try {
      await enviar()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : siFalla)
      setGuardando(false)
      return
    }
    navegar(volverAlListado, { state: { aviso } })
  }

  return {
    /** Lo que vino del servidor: la ficha guardada, o el original del que se copia. */
    cargado,
    form,
    inicial,
    sucio,
    guardando,
    error,
    bloqueo,
    volverAlListado,
    campo,
    setForm,
    setError,
    guardar,
  }
}
