import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../../../components/Boton'
import { useContacto } from '../../../hooks/useContacto'
import { SERIF } from '../../inicio/estilos'
import { FILETE_TARJETA } from './temaTarjeta'
import { secretariaEnLaSede } from './secretariaEnLaSede'

interface SolicitudRecibidaProps {
  nombre: string
  email: string
  /** Cuántas personas van en la solicitud: el adulto y los menores a su cargo. */
  fichas?: number
  /** Quien solo apunta a un menor no se hace hermano: lo que toca no es lo mismo. */
  soloMenores?: boolean
}

/**
 * Lo que sustituye al formulario al enviar la solicitud. El servidor responde
 * lo mismo se haya tramitado o no (si el correo o un DNI ya estaban
 * registrados, no lo dice: el formulario no puede servir para averiguar quién
 * está en el censo) y en los dos casos escribe al correo con lo que toca. Por
 * eso aquí no se promete que la solicitud esté en Secretaría: se remite al
 * correo.
 * Se lleva el foco al título para que quien usa teclado o lector de pantalla
 * sepa que la página ha cambiado y no se quede sobre un botón que ya no está.
 */
export default function SolicitudRecibida({ nombre, email, fichas = 1, soloMenores = false }: SolicitudRecibidaProps) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const contacto = useContacto()
  const horario = contacto?.secretaria.horario

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
  }, [])

  return (
    <Box role="status" aria-live="polite">
      <Typography
        ref={titulo}
        component="h2"
        tabIndex={-1}
        sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 32 }, lineHeight: 1.15, letterSpacing: '-0.01em', outline: 'none', mb: 1.5 }}
      >
        Gracias, {nombre}. Te hemos escrito.
      </Typography>
      <Typography sx={{ fontSize: 16, lineHeight: 1.65, maxWidth: '58ch', mb: 3 }}>
        Te hemos escrito a <strong>{email}</strong> con los siguientes pasos. Si no lo ves en unos minutos,
        mira en la carpeta de correo no deseado.
        {fichas > 1 && <> Has enviado <strong>{fichas} fichas</strong> en la misma solicitud.</>}
      </Typography>

      <Box sx={{ borderTop: `1px solid ${FILETE_TARJETA}`, pt: 2.5, mb: 3.5 }}>
        <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.25, mb: 1 }}>
          Qué toca ahora
        </Typography>
        <Typography sx={{ fontSize: 15, lineHeight: 1.7, maxWidth: '58ch', color: 'text.secondary' }}>
          Sigue lo que te decimos en el correo. Lo habitual es pasarse por {secretariaEnLaSede(contacto?.sede)} con
          el DNI y el certificado de bautismo de cada persona que apuntas
          {horario ? ` (${horario.toLowerCase()})` : ''}: allí se formaliza el alta y se activa el acceso al área
          de hermanos.
          {soloMenores && ' Desde ahí gestionarás sus fichas, aunque tú no seas hermano.'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <Boton component={Link} to="/" sx={{ borderRadius: '3px' }}>
          Volver a la portada
        </Boton>
        <Boton component={Link} to="/contacto" appVariant="outline" sx={{ borderRadius: '3px' }}>
          Escribir a Secretaría
        </Boton>
      </Box>
    </Box>
  )
}
