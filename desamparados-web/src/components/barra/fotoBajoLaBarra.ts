import { useEffect } from 'react'

/**
 * Lo llaman las piezas que ponen una foto justo bajo la barra de escritorio
 * (el hero, las cabeceras a sangre). Con él, el velo de la barra sale con su
 * cola de desenfoque desde arriba del todo; sin él, la cola espera a que se
 * baje: en reposo caería sobre el título de la página (la Agenda) y lo
 * emborronaría.
 *
 * Un atributo en <html> y no un contexto: la barra no envuelve a la página,
 * y así el CSS del velo lo lee sin volver a pintarla.
 */
export function useFotoBajoLaBarra() {
  useEffect(() => {
    const raiz = document.documentElement
    raiz.setAttribute('data-foto-bajo-la-barra', '')
    return () => raiz.removeAttribute('data-foto-bajo-la-barra')
  }, [])
}
