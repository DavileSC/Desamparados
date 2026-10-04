import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { visuallyHidden } from '@mui/utils'
import { useQuery } from '@tanstack/react-query'
import { proximaSalidaWeb } from '../../lib/api/salidas'
import { useModulos } from '../../hooks/useModulos'
import { conArticulo, mayuscula } from '../../domain/articulos'
import { GOLD } from './estilos'
import { usePortada, useTextosPortada } from './useContenidoPortada'
import { cuentaDeLaPortada, partesQueFaltan } from './cuentaAtras'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** «20 de marzo»; con el año solo si no es el de ahora. */
const fechaDe = (dia: string, ahora: number) => {
  const texto = `${Number(dia.slice(8, 10))} de ${MESES[Number(dia.slice(5, 7)) - 1]}`
  return dia.slice(0, 4) === String(new Date(ahora).getFullYear()) ? texto : `${texto} de ${dia.slice(0, 4)}`
}
const dos = (n: number) => String(n).padStart(2, '0')

/**
 * La cuenta atrás hasta la próxima salida, en la portada: días, horas,
 * minutos y segundos en fino, separados por filetes (la forma B de la
 * maqueta). En el ordenador va dentro del hero, abajo a la izquierda, en el
 * mismo margen que el escudo de la barra y con su base a la altura de la de
 * los botones; en el móvil y la tableta, en una franja entre el hero y las
 * noticias, porque ahí el hero ya va lleno.
 *
 * No sale sin Procesión, con el interruptor del CMS apagado o sin ninguna
 * salida con fecha por delante. Los segundos no se anuncian: un lector de
 * pantalla leería la cuenta cada segundo. Lo que se dice es la frase, una vez.
 */
export default function CuentaAtrasDeSalida({ forma }: { forma: 'hero' | 'franja' }) {
  const conProcesion = useModulos().activo('procesion')
  // Hasta que llegan los textos no se sabe si está encendida: decidirlo antes
  // la enseñaría un instante para quitarla. Si fallan, se da por encendida.
  const { status } = usePortada()
  const encendida = useTextosPortada().hero.cuentaAtras !== false && status !== 'pending'
  const { data } = useQuery({ queryKey: ['home', 'proxima-salida'], queryFn: proximaSalidaWeb, enabled: conProcesion && encendida, staleTime: 5 * 60_000, retry: false })
  const [ahora, setAhora] = useState(() => Date.now())
  // Una respuesta inesperada no rompe la portada: sin cuenta y ya.
  const proxima = encendida && data && typeof data === 'object' && 'proxima' in data ? cuentaDeLaPortada(data.proxima, ahora) : null
  const conSegundos = Boolean(proxima?.conHora && !proxima.hoy)

  useEffect(() => {
    if (!proxima) return
    // Con hora, cada segundo; sin ella solo cambia de un día a otro.
    const reloj = window.setInterval(() => setAhora(Date.now()), conSegundos ? 1000 : 60_000)
    return () => window.clearInterval(reloj)
  }, [proxima, conSegundos])

  if (!proxima) return null
  const { dias, horas, minutos, segundos } = partesQueFaltan(proxima, ahora)
  const lo = conArticulo(proxima.articulo, proxima.nombre)
  const celdas = proxima.conHora
    ? [[dias, dias === 1 ? 'día' : 'días'], [dos(horas), 'horas'], [dos(minutos), 'minutos'], [dos(segundos), 'segundos']] as const
    : [[dias, dias === 1 ? 'día' : 'días']] as const
  const enHero = forma === 'hero'

  return (
    <Box
      component="section"
      aria-label={`Cuenta atrás para ${lo}`}
      sx={enHero
        ? {
          // Solo en pantallas anchas: por debajo, el texto del hero ocupa el ancho y la cuenta va en su franja.
          display: { xs: 'none', lg: 'block' },
          position: 'absolute', zIndex: 2, left: { lg: '40px', xl: '48px' }, bottom: 64,
        }
        : {
          display: { xs: 'block', lg: 'none' },
          px: '20px', pt: 2.5, pb: 2.75, bgcolor: '#0c0b0d', borderBottom: '1px solid rgba(236, 230, 232, 0.12)',
        }}
    >
      <Typography component="p" sx={{ fontSize: enHero ? 12 : 11, letterSpacing: '0.26em', textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>
        {proxima.hoy ? 'Hoy' : `${proxima.nombre} · ${fechaDe(proxima.dia, ahora)}`}
      </Typography>
      {proxima.hoy ? (
        <Typography component="p" sx={{ mt: 1, fontSize: enHero ? 44 : 30, fontWeight: 300, lineHeight: 1.05, color: '#fff' }}>
          {mayuscula(lo)}
        </Typography>
      ) : <>
        <Box component="span" sx={visuallyHidden}>{`Faltan ${dias} ${dias === 1 ? 'día' : 'días'} para ${lo}.`}</Box>
        <Box aria-hidden sx={{ display: 'flex', mt: 1.25, justifyContent: enHero ? 'flex-start' : 'space-between' }}>
          {celdas.map(([valor, etiqueta], i) => (
            <Box key={etiqueta} sx={{
              display: 'grid', gap: 0.25, flex: enHero ? 'none' : 1,
              px: enHero ? 2.75 : 0, pl: i === 0 ? 0 : enHero ? 2.75 : 1.5,
              borderLeft: i === 0 ? 0 : '1px solid rgba(247, 243, 236, 0.28)',
            }}>
              <Typography component="span" sx={{ fontSize: enHero ? 52 : 34, fontWeight: 300, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
              <Typography component="span" sx={{ fontSize: enHero ? 11 : 10, letterSpacing: enHero ? '0.18em' : '0.12em', textTransform: 'uppercase', color: '#cbc5c8' }}>{etiqueta}</Typography>
            </Box>
          ))}
        </Box>
      </>}
    </Box>
  )
}
