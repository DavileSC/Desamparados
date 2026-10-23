import { useEffect, useState } from 'react'

/** Lo que se espera antes de enseñar el esqueleto: si el servidor contesta antes, no hay parpadeo. */
export const ESPERA_ANTES_DEL_ESQUELETO = 300

/** `activo` lleva ya `ms` seguidos en verdadero. Lo usan también los textos de la portada (`TextoDePortada`). */
export function useTrasUnMomento(activo: boolean, ms = ESPERA_ANTES_DEL_ESQUELETO) {
  const [cumplido, setCumplido] = useState(false)
  useEffect(() => {
    if (!activo || cumplido) return
    const reloj = setTimeout(() => setCumplido(true), ms)
    return () => clearTimeout(reloj)
  }, [activo, cumplido, ms])
  return activo && cumplido
}

/** El estado de `EnCarga` a partir de una consulta de react-query: al reintentar tras un fallo, vuelve a «cargando». */
export const estadoDeConsulta = (consulta: { isError: boolean; isFetching: boolean }) =>
  consulta.isError && !consulta.isFetching ? 'error' : 'cargando'
