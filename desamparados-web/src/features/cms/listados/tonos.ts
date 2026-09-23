import { GRAFICAS_CMS, SUPERFICIES_CMS, segunModo } from '../../../theme/cms'

export type TonoPildora = 'ok' | 'aviso' | 'info' | 'neutro'

/**
 * Los colores de un tono: el del punto y el del fondo. Valen para los dos modos
 * a la vez (variables CSS y `segunModo`), también fuera del proveedor del CMS
 * (en las pruebas), donde se ven en claro.
 */
const TONOS = {
  punto: {
    ok: GRAFICAS_CMS.estados.ok,
    aviso: GRAFICAS_CMS.estados.aviso,
    info: GRAFICAS_CMS.entrada,
    neutro: GRAFICAS_CMS.neutro,
  } satisfies Record<TonoPildora, string>,
  fondo: {
    ok: segunModo('rgba(27,175,122,0.12)', 'rgba(27,175,122,0.16)'),
    aviso: SUPERFICIES_CMS.pillPendiente,
    info: segunModo('rgba(42,120,214,0.10)', 'rgba(57,135,229,0.18)'),
    neutro: SUPERFICIES_CMS.pillNeutro,
  } satisfies Record<TonoPildora, string>,
}

export function useTonos() {
  return TONOS
}
