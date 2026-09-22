import { useTheme } from '@mui/material'
import { graficasCms, superficiesCms } from '../../../theme/cms'

export type TonoPildora = 'ok' | 'aviso' | 'info' | 'neutro'

/**
 * Los colores de un tono en el modo en que esté el CMS: el del punto y el del
 * fondo. Salen del tema de MUI, como en la contabilidad, para funcionar
 * también fuera del proveedor del CMS (en las pruebas).
 */
export function useTonos() {
  const oscuro = useTheme().palette.mode === 'dark'
  const modo = oscuro ? 'oscuro' : 'claro'
  const superficies = superficiesCms(modo)
  const graficas = graficasCms(modo)
  const punto: Record<TonoPildora, string> = {
    ok: graficas.estados.ok,
    aviso: graficas.estados.aviso,
    info: graficas.entrada,
    neutro: graficas.neutro,
  }
  const fondo: Record<TonoPildora, string> = {
    ok: oscuro ? 'rgba(27,175,122,0.16)' : 'rgba(27,175,122,0.12)',
    aviso: superficies.pillPendiente,
    info: oscuro ? 'rgba(57,135,229,0.18)' : 'rgba(42,120,214,0.10)',
    neutro: superficies.pillNeutro,
  }
  return { punto, fondo }
}
