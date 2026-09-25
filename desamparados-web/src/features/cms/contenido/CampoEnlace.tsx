import { useMemo } from 'react'
import { Autocomplete, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { archivoDeNoticias } from '../../../lib/api/noticias'
import { DESTINOS_FIJOS, PREFIJO_NOTICIA, esDestinoValido, type Destino } from '../../../lib/destinos'

interface Props {
  etiqueta: string
  /** La ruta elegida; `''` es «sin enlace». */
  valor: string
  onCambio: (ruta: string) => void
  /** Si se puede dejar sin enlace (las tarjetas sí; el botón de una llamada, no). */
  opcional?: boolean
  ayuda?: string
}

/** Cuántas noticias se ofrecen: las más recientes, que son a las que se enlaza. */
const NOTICIAS_OFRECIDAS = 50

/**
 * Elegir adónde lleva un enlace, de entre las páginas que existen.
 *
 * Era un campo de texto libre y se podía escribir cualquier ruta:
 * «/hola» se guardaba y la tarjeta llevaba a «página no
 * encontrada». Ahora se elige de la lista (las páginas de la web agrupadas como
 * en su menú, y las noticias publicadas) y el servidor rechaza cualquier otra.
 *
 * Un enlace guardado antes de este cambio que no esté en la lista se enseña tal
 * cual, marcado como que no existe, para que se vea qué hay y se cambie.
 */
export default function CampoEnlace({ etiqueta, valor, onCambio, opcional = false, ayuda }: Props) {
  const { data } = useQuery({
    queryKey: ['noticias', 'destinos-de-enlace'],
    queryFn: () => archivoDeNoticias({ pagina: 1, porPagina: NOTICIAS_OFRECIDAS }),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const opciones = useMemo<Destino[]>(() => [
    ...DESTINOS_FIJOS,
    ...(data?.noticias ?? []).map((n) => ({ ruta: `${PREFIJO_NOTICIA}${n.slug}`, nombre: n.titulo, grupo: 'Noticias' })),
  ], [data])

  const roto = valor !== '' && !esDestinoValido(valor)
  // Lo guardado, aunque no esté entre las opciones (una noticia más antigua de
  // las que se ofrecen, o una ruta que no existe): sin esto, el campo se vería
  // vacío y parecería que la tarjeta no tiene enlace.
  const elegido = valor === ''
    ? null
    : opciones.find((o) => o.ruta === valor) ?? { ruta: valor, nombre: roto ? 'Página que no existe' : valor, grupo: '' }

  const conElegido = elegido && !opciones.some((o) => o.ruta === elegido.ruta) ? [elegido, ...opciones] : opciones

  return (
    <Autocomplete
      size="small"
      options={conElegido}
      groupBy={(o) => o.grupo}
      value={elegido}
      onChange={(_, destino) => onCambio(destino?.ruta ?? '')}
      getOptionLabel={(o) => (o.nombre === o.ruta ? o.ruta : `${o.nombre} · ${o.ruta}`)}
      isOptionEqualToValue={(a, b) => a.ruta === b.ruta}
      disableClearable={!opcional}
      noOptionsText="Ninguna página coincide"
      renderInput={(params) => (
        <TextField
          {...params}
          label={etiqueta}
          placeholder={opcional ? 'Sin enlace' : 'Elige una página'}
          error={roto}
          helperText={roto
            ? `«${valor}» no es ninguna página de la web: quien pulse irá a «página no encontrada». Elige una de la lista.`
            : ayuda}
        />
      )}
    />
  )
}
