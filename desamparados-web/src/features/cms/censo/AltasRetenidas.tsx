import { useState } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import type { AltaRetenida, ConQuienChoca } from '../../../lib/api/hermanos'

const dia = (iso: string) => new Date(iso).toLocaleDateString('es-ES')

/** Con quién choca el DNI, en una frase que diga a quién llamar o a quién mirar. */
function conQuien(con: ConQuienChoca) {
  if (con.tipo === 'ya-no-esta') return 'ya estaba registrado, pero ese registro ya no existe: vuelve a cargar'
  if (con.tipo === 'cuenta') return `ya es de la cuenta de ${con.nombre} ${con.apellidos}`
  const quien = `${con.nombre} ${con.apellidos}${con.numeroHermano ? `, n.º ${con.numeroHermano}` : ''}`
  if (con.situacion === 'baja') return `ya está en el censo: ${quien}, de baja${con.fechaBaja ? ` desde el ${dia(con.fechaBaja)}` : ''}`
  if (con.situacion === 'pendiente') return `ya está en otra solicitud sin aprobar: ${quien}`
  return `ya está en el censo: ${quien}`
}

const clave = (quien: 'adulto' | number) => String(quien)

/**
 * Las altas por la web con un DNI que ya estaba registrado. A quien la mandó
 * se le respondió como a cualquier alta —no se le puede decir que el DNI
 * existe, porque eso diría quién es hermano—, así que es Secretaría quien
 * comprueba quién es y decide: tramitarla con el DNI bueno, que la convierte
 * en una solicitud normal, o descartarla.
 */
export default function AltasRetenidas({
  retenidas, ocupado, onTramitar, onDescartar,
}: {
  retenidas: AltaRetenida[]
  /** Otra acción de la pantalla en marcha: mientras, ningún botón responde. */
  ocupado: boolean
  onTramitar: (retenida: AltaRetenida, dnis: { adulto?: string; menores?: { indice: number; dni: string }[] }) => Promise<void>
  onDescartar: (retenida: AltaRetenida) => Promise<void>
}) {
  // Los DNI corregidos de cada retenida, por persona.
  const [corregidos, setCorregidos] = useState<Record<number, Record<string, string>>>({})
  const [porDescartar, setPorDescartar] = useState<AltaRetenida | null>(null)

  if (retenidas.length === 0) return null

  return (
    <Box component="section" aria-labelledby="retenidas-titulo" sx={{ mb: 4 }}>
      <Typography id="retenidas-titulo" component="h2" sx={{ fontSize: 15, fontWeight: 600, mb: 0.5 }}>
        Con un DNI ya registrado ({retenidas.length})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        A quien las envió se le dijo que su solicitud había llegado, sin más: la web no puede decir que un DNI
        ya existe. Antes de tramitarlas, comprueba quién es (por teléfono o en persona, con el DNI delante).
        Si fue un error al escribirlo, pon el bueno y tramítala. Si ya era hermano o tiene cuenta, descártala y
        ayúdale a entrar con su cuenta o a pedir volver.
      </Typography>
      <Stack spacing={2}>
        {retenidas.map((retenida) => {
          const choquesDe = (quien: 'adulto' | number) => retenida.choques.filter((c) => c.quien === quien)
          const suyos = corregidos[retenida.id] ?? {}
          const conChoque = retenida.personas.filter((p) => choquesDe(p.quien).length > 0)
          const completo = conChoque.every((p) => (suyos[clave(p.quien)] ?? '').trim().length > 0)
          const tramitar = () => {
            const adulto = suyos.adulto?.trim()
            const menores = retenida.personas
              .filter((p): p is typeof p & { quien: number } => typeof p.quien === 'number' && Boolean(suyos[clave(p.quien)]?.trim()))
              .map((p) => ({ indice: p.quien, dni: suyos[clave(p.quien)].trim().toUpperCase() }))
            void onTramitar(retenida, { ...(adulto ? { adulto: adulto.toUpperCase() } : {}), ...(menores.length ? { menores } : {}) })
          }
          return (
            <Paper key={retenida.id} variant="outlined" sx={{ p: 2.5, borderColor: 'warning.main' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography>{retenida.nombre} {retenida.apellidos}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {retenida.email} · {retenida.telefono} · la envió el {dia(retenida.creadaEl)}
                  </Typography>
                </Box>
              </Box>

              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {retenida.personas.map((persona) => {
                  const choques = choquesDe(persona.quien)
                  return (
                    <Box key={clave(persona.quien)}>
                      <Typography variant="body2">
                        {persona.nombre} {persona.apellidos}
                        {persona.quien === 'adulto' && !persona.seHaceHermano && ' (solo apunta a los menores)'}
                        {persona.fechaNacimiento && ` · ${dia(persona.fechaNacimiento)}`}
                        {persona.dni ? ` · ${persona.dni}` : ' · sin DNI'}
                      </Typography>
                      {choques.map((choque) => (
                        <Box key={choque.motivo} sx={{ mt: 0.75, display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                          <Alert severity="warning" sx={{ flex: '1 1 320px', py: 0 }}>
                            El DNI {choque.dni} {conQuien(choque.con)}.
                            {choque.con.tipo === 'ficha' && (
                              <> <Box component={Link} to={`/cms/hermanos?ficha=${choque.con.id}`} sx={{ color: 'inherit' }}>Ver la ficha</Box></>
                            )}
                          </Alert>
                          <TextField
                            size="small"
                            label="DNI correcto"
                            value={suyos[clave(persona.quien)] ?? ''}
                            onChange={(e) => setCorregidos((antes) => ({ ...antes, [retenida.id]: { ...suyos, [clave(persona.quien)]: e.target.value } }))}
                            slotProps={{ htmlInput: { maxLength: 9, autoComplete: 'off', 'aria-label': `DNI correcto de ${persona.nombre}` } }}
                            sx={{ width: 160 }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )
                })}
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mt: 2.5, flexWrap: 'wrap' }}>
                <Button variant="contained" disabled={ocupado || !completo} onClick={tramitar}>
                  Tramitar con el DNI corregido
                </Button>
                <Button color="error" disabled={ocupado} onClick={() => setPorDescartar(retenida)}>Descartar</Button>
              </Stack>
            </Paper>
          )
        })}
      </Stack>

      <DialogoConfirmacion
        abierto={porDescartar !== null}
        titulo="¿Descartar esta solicitud?"
        mensaje={porDescartar ? `Se borrará la solicitud de ${porDescartar.nombre} ${porDescartar.apellidos} con sus datos y documentos. No se le escribe: si hace falta, avísale tú. No se puede deshacer.` : ''}
        textoConfirmar="Descartar"
        peligro
        onConfirmar={() => { const retenida = porDescartar; setPorDescartar(null); if (retenida) void onDescartar(retenida) }}
        onCancelar={() => setPorDescartar(null)}
      />
    </Box>
  )
}
