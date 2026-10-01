import { useState } from 'react'
import { Alert, Box, Divider, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import Boton from '../../../components/Boton'
import { euros182, misCertificados, traerMiCertificado } from '../../../lib/api/modelo182'
import { guardarEnDisco } from '../../../lib/api/datos'
import { aLaCorporacion } from '../../../domain/articulos'

/**
 * Los certificados de donativos de la cuenta, para la declaración de la
 * renta: uno por persona con DNI y año cerrado. Las cuotas de un niño sin DNI
 * van en el del titular, que es quien las paga. Si no hay ninguno, no se pinta.
 */
export default function CertificadosDonativos() {
  const { data } = useQuery({ queryKey: ['mis-certificados'], queryFn: misCertificados })
  const [error, setError] = useState<string | null>(null)
  const [bajando, setBajando] = useState<string | null>(null)

  if (!data || data.certificados.length === 0) return null

  const bajar = async (ejercicio: number, nif: string) => {
    const clave = `${ejercicio}-${nif}`
    setBajando(clave)
    setError(null)
    try { guardarEnDisco(await traerMiCertificado(ejercicio, nif), `certificado-donativos-${ejercicio}.pdf`) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido descargar el certificado.') }
    finally { setBajando(null) }
  }

  return (
    <Box component="section" aria-labelledby="certificados-titulo" sx={{ mt: 6 }}>
      <Typography id="certificados-titulo" variant="h3" component="h2" sx={{ fontSize: { xs: 20, md: 24 }, mb: 1 }}>
        Certificados para la renta
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {`Las cuotas y los donativos ${aLaCorporacion({ corto: true })} desgravan. El certificado de cada año, con lo que se declara a Hacienda.`}
      </Typography>
      {!data.disponibles && <Alert severity="info" sx={{ mb: 2 }}>Los certificados estarán aquí en cuanto Tesorería los prepare.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Divider />
      {data.certificados.map((c) => (
        <Box key={`${c.ejercicio}-${c.nif}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, minHeight: 56, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 180 }}>
              <Typography sx={{ fontWeight: 600 }}>{c.ejercicio} · {c.nombre}</Typography>
              <Typography variant="body2" color="text.secondary">{euros182(c.centimos)}</Typography>
            </Box>
            <Boton appVariant="outline" size="small" disabled={!data.disponibles || bajando !== null} onClick={() => void bajar(c.ejercicio, c.nif)}>
              {bajando === `${c.ejercicio}-${c.nif}` ? 'Preparando…' : 'Descargar'}
            </Boton>
          </Box>
          <Divider />
        </Box>
      ))}
    </Box>
  )
}
