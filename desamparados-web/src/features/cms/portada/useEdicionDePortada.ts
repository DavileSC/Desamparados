/**
 * Lo que se está editando de la portada y cómo llega y vuelve al servidor:
 * las fotos de la cabecera, los textos de cada bloque, si hay cambios sin
 * guardar y el guardado, que son dos almacenes y dos peticiones.
 *
 * Vive aparte de `PortadaAdminPage` porque esa pantalla es larga de por sí:
 * seis bloques con su vista previa. Aquí está cómo se comporta; allí, cómo se
 * ve.
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { portadaDelInicio, guardarImagenesPortada, type ImagenPortada, type TextosPortada } from '../../../lib/api/portada'
import { guardarContenido } from '../../../lib/api/contenido'

/**
 * La misma clave con la que la portada pública guarda su caché
 * (features/inicio/useContenidoPortada.ts). Si las dos dejan de coincidir,
 * guardar aquí deja de refrescar el inicio y nadie se entera hasta que se
 * queja quien lo lee; hay un test que las compara.
 */
const CLAVE_PORTADA_PUBLICA = ['home', 'portada']

/** Tope del servidor (portada.schema.ts): se avisa antes de enviar. */
export const MAX_FOTOS_PORTADA = 12

/** Una fila del formulario: la clave la da el propio CMS, para que React siga la fila al reordenar. */
interface Fila extends ImagenPortada {
  clave: number
}

export type Tesela = TextosPortada['accesos']['teselas'][number]

let ultimaClave = 0
const conClave = (imagen: ImagenPortada): Fila => ({ ...imagen, clave: ++ultimaClave })
/** Lo que se guarda de cada foto, siempre con la misma forma: así comparar con lo cargado dice si algo cambió. */
const datosDe = ({ url, descripcion, encuadre }: ImagenPortada): ImagenPortada => ({ url, descripcion, ...(encuadre === undefined ? {} : { encuadre }) })
const sinClave = (filas: Fila[]): ImagenPortada[] => filas.map(datosDe)

export function useEdicionDePortada() {
  const queryClient = useQueryClient()
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [inicialFotos, setInicialFotos] = useState<ImagenPortada[]>([])
  const [textos, setTextos] = useState<TextosPortada | null>(null)
  const [inicialTextos, setInicialTextos] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    portadaDelInicio()
      .then(({ imagenes, textos: cargados }) => {
        setFilas(imagenes.map(conClave))
        setInicialFotos(imagenes.map(datosDe))
        setTextos(cargados)
        setInicialTextos(JSON.stringify(cargados))
      })
      .catch(() => setError('No se ha podido cargar la portada.'))
  }, [])

  const cambiar = (clave: number, cambios: Partial<ImagenPortada>) =>
    setFilas((actual) => actual?.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)) ?? actual)

  const quitar = (clave: number) => setFilas((actual) => actual?.filter((fila) => fila.clave !== clave) ?? actual)

  const mover = (indice: number, salto: -1 | 1) =>
    setFilas((actual) => {
      if (!actual) return actual
      const destino = indice + salto
      if (destino < 0 || destino >= actual.length) return actual
      const copia = [...actual]
      copia[indice] = actual[destino]
      copia[destino] = actual[indice]
      return copia
    })

  const anadir = (url: string) => {
    if (!url) return
    setGuardado(false)
    setFilas((actual) => [...(actual ?? []), conClave({ url, descripcion: '' })])
  }

  // Un cambiador por bloque en vez de uno genérico: con una clave genérica, el
  // objeto que sale del spread deja de ser `TextosPortada` para TypeScript y
  // haría falta un cast, que es justo lo que evitaría equivocarse de campo.
  const cambiarHero = (cambios: Partial<TextosPortada['hero']>) =>
    setTextos((t) => t && { ...t, hero: { ...t.hero, ...cambios } })
  const cambiarActualidad = (cambios: Partial<TextosPortada['actualidad']>) =>
    setTextos((t) => t && { ...t, actualidad: { ...t.actualidad, ...cambios } })
  const cambiarAgenda = (cambios: Partial<TextosPortada['agenda']>) =>
    setTextos((t) => t && { ...t, agenda: { ...t.agenda, ...cambios } })
  const cambiarPlaca = (cambios: Partial<TextosPortada['accesos']['placa']>) =>
    setTextos((t) => t && { ...t, accesos: { ...t.accesos, placa: { ...t.accesos.placa, ...cambios } } })
  const cambiarTesela = (indice: number, cambios: Partial<Tesela>) =>
    setTextos((t) => t && {
      ...t,
      accesos: { ...t.accesos, teselas: t.accesos.teselas.map((tesela, i) => (i === indice ? { ...tesela, ...cambios } : tesela)) },
    })
  const cambiarSabado = (cambios: Partial<TextosPortada['sabadoDePasion']>) =>
    setTextos((t) => t && { ...t, sabadoDePasion: { ...t.sabadoDePasion, ...cambios } })
  const cambiarPublicaciones = (cambios: Partial<TextosPortada['publicaciones']>) =>
    setTextos((t) => t && { ...t, publicaciones: { ...t.publicaciones, ...cambios } })

  const fotosSucias = !!filas && JSON.stringify(sinClave(filas)) !== JSON.stringify(inicialFotos)
  const textosSucios = !!textos && JSON.stringify(textos) !== inicialTextos
  const sucio = fotosSucias || textosSucios

  // Vuelve a lo último que llegó al servidor. Las fotos reciben claves nuevas:
  // son filas nuevas para React, y así ningún campo conserva lo que se escribió.
  const descartar = () => {
    setFilas(inicialFotos.map(conClave))
    setTextos(JSON.parse(inicialTextos) as TextosPortada)
    setError(null)
    setGuardado(false)
  }

  const guardar = async () => {
    if (!filas || !textos) return
    setGuardando(true)
    setGuardado(false)
    setError(null)
    // Lo que de verdad ha llegado al servidor, no lo que se pretendía guardar:
    // el mensaje del final se escribe con esto y no con las banderas de sucio.
    let fotosGuardadas = false
    let textosGuardados = false
    try {
      // Primero las fotos: si fallan, no se ha tocado nada.
      if (fotosSucias) {
        await guardarImagenesPortada(sinClave(filas))
        setInicialFotos(sinClave(filas))
        fotosGuardadas = true
      }
      if (textosSucios) {
        await guardarContenido('portada', textos)
        setInicialTextos(JSON.stringify(textos))
        textosGuardados = true
      }
      // Solo se marca éxito si algo llegó de verdad al servidor: pulsar Guardar
      // sin haber cambiado nada no manda ninguna petición, y decir «guardado»
      // sería la misma mentira pequeña que este botón tiene prohibida.
      setGuardado(fotosGuardadas || textosGuardados)
    } catch (e: unknown) {
      // Son dos almacenes y dos peticiones. Si el fallo llega en la segunda, las
      // fotos YA están guardadas: decirlo, o quien lo lea creerá que no se ha
      // guardado nada y lo repetirá todo.
      const motivo = e instanceof Error ? e.message : 'No se ha podido guardar.'
      // Y decir además POR QUÉ. El aviso terminaba en «vuelve a intentarlo», que
      // con el fallo más probable —un 400 porque uno de los treinta campos lleva
      // un `<`, que el esquema prohíbe— no puede funcionar por muchas veces que
      // se reintente. `lib/api/cliente.ts` ya trae ahí el campo y el motivo.
      setError(fotosGuardadas ? `Las fotos se han guardado, pero los textos no. ${motivo}` : motivo)
    } finally {
      setGuardando(false)
      // La portada pública comparte caché con el CMS en la misma pestaña: que la
      // siguiente visita al inicio pida lo nuevo en vez de lo guardado. También
      // tras un guardado a medias, porque las fotos sí han cambiado.
      if (fotosGuardadas || textosGuardados) void queryClient.invalidateQueries({ queryKey: CLAVE_PORTADA_PUBLICA })
    }
  }


  return {
    filas, textos, error, guardado, guardando, sucio,
    cambiar, quitar, mover, anadir, descartar, guardar,
    cambiarHero, cambiarActualidad, cambiarAgenda, cambiarPlaca, cambiarTesela,
    cambiarSabado, cambiarPublicaciones,
    borrador: filas && textos ? { imagenes: sinClave(filas), textos } : null,
  }
}
