import { useEffect, useState } from 'react'
import { useBlocker, useNavigate, type Blocker } from 'react-router-dom'
import { useVolverAlListado } from '../../../hooks/useVolverAlListado'
import { useAvisoAlCerrarLaPestana } from '../../../hooks/useAvisoAlCerrarLaPestana'

/*
 * El borrador de una ficha sucia, en sessionStorage: es la red por si todo lo
 * demás falla (la pestaña se recarga, el navegador se cierra con la sesión
 * caducada). sessionStorage y no localStorage: muere con la pestaña, y en un
 * ordenador compartido no deja el texto a mano del siguiente. Todo con try,
 * porque con el almacenamiento bloqueado tocarlo lanza.
 */
const PREFIJO_BORRADOR = 'cms-borrador:'

function leerBorrador<F>(clave: string): F | null {
  try {
    const texto = sessionStorage.getItem(clave)
    return texto ? (JSON.parse(texto) as F) : null
  } catch {
    return null
  }
}

function escribirBorrador(clave: string, valor: unknown) {
  try {
    sessionStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // Lleno o bloqueado: el borrador es una ayuda, no algo que deba romper la edición.
  }
}

function borrarBorrador(clave: string) {
  try {
    sessionStorage.removeItem(clave)
  } catch {
    // Igual que arriba.
  }
}

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
  const claveBorrador = `${PREFIJO_BORRADOR}${listado}:${comoCopia ? 'copia-' : ''}${origen ?? 'nueva'}`
  /** Un borrador que quedó sin guardar de esta misma ficha, a la espera de que se decida qué hacer con él. */
  const [borrador, setBorrador] = useState<F | null>(null)
  // Hasta haber mirado si quedaba un borrador, no se escribe ni se borra
  // ninguno: el primer render, aún sin mirar, lo borraría antes de ofrecerlo.
  const [comprobado, setComprobado] = useState(false)

  /** Pone la ficha de partida y, si quedó un borrador distinto de ella, lo ofrece. */
  const empezarCon = (datos: F) => {
    setForm(datos)
    setInicial(datos)
    const guardado = leerBorrador<F>(claveBorrador)
    setBorrador(guardado && JSON.stringify(guardado) !== JSON.stringify(datos) ? guardado : null)
    setComprobado(true)
  }

  useEffect(() => {
    if (origen === null) {
      empezarCon(vacio)
      return
    }
    // Si cambia el origen (de una ficha a otra sin desmontar la pantalla), la
    // respuesta de la anterior puede llegar después que la de la nueva y
    // pintarla encima. Se ignora todo lo que llegue de una petición superada.
    let vigente = true
    setComprobado(false)
    setCargado(null)
    setForm(null)
    setInicial(null)
    setError(null)
    cargar(origen)
      .then((dato) => {
        if (!vigente) return
        setCargado(dato)
        empezarCon(aFormulario(dato))
      })
      .catch(() => {
        if (!vigente) return
        setError(errorAlCargar)
        if (comoCopia) empezarCon(vacio)
      })
    return () => { vigente = false }
    // `cargar` y compañía se rehacen en cada render de la pantalla: la ficha se
    // trae por su origen, que es lo único que la identifica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen, comoCopia])

  const sucio = JSON.stringify(form) !== JSON.stringify(inicial)

  // Mientras se ofrece un borrador no se toca lo guardado: si se recarga otra
  // vez antes de decidir, tiene que seguir ahí.
  useEffect(() => {
    if (!comprobado || borrador !== null || form === null) return
    if (sucio) escribirBorrador(claveBorrador, form)
    else borrarBorrador(claveBorrador)
  }, [comprobado, borrador, form, sucio, claveBorrador])

  // `guardando` fuera del bloqueo: al guardar se navega al listado con el
  // formulario aún distinto del cargado, y no hay nada que perder.
  const bloqueoDelRouter = useBlocker(({ currentLocation, nextLocation }) => sucio && !guardando && currentLocation.pathname !== nextLocation.pathname)
  useAvisoAlCerrarLaPestana(sucio && !guardando)
  // «Salir sin guardar» es decidir perder los cambios: el borrador se va con ellos.
  const bloqueo: Blocker = bloqueoDelRouter.state === 'blocked'
    ? { ...bloqueoDelRouter, proceed: () => { borrarBorrador(claveBorrador); bloqueoDelRouter.proceed() } }
    : bloqueoDelRouter

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
    borrarBorrador(claveBorrador)
    navegar(volverAlListado, { state: { aviso } })
  }

  const recuperarBorrador = () => {
    if (borrador !== null) setForm(borrador)
    setBorrador(null)
  }
  const descartarBorrador = () => {
    borrarBorrador(claveBorrador)
    setBorrador(null)
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
    /** Lo que quedó sin guardar de esta ficha la última vez, para ofrecerlo (`AvisoCambiosSinGuardar`). */
    borrador: { pendiente: borrador !== null, recuperar: recuperarBorrador, descartar: descartarBorrador },
    volverAlListado,
    campo,
    setForm,
    setError,
    guardar,
  }
}
