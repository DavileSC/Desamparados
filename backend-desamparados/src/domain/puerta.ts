/**
 * Lo que dice la puerta del templo al leer una papeleta, sin base de datos.
 *
 * El QR solo dice qué papeleta es (`papeleta-qr.ts`); si deja pasar lo decide
 * esto, con la papeleta tal como está hoy en la base:
 *
 * - `FALSO`: el texto no es un código de papeleta, o la firma no cuadra.
 * - `ANULADA`: el código es bueno, pero la papeleta ya no existe (anular la
 *   borra, y con ella su sitio en el cortejo).
 * - `OTRA_SALIDA`: es de otro año o de otra salida (la del Rosario en la
 *   Pasión, o la del año pasado guardada en el móvil).
 * - `DE_BAJA`: la papeleta es buena, pero su hermano ya no está en el censo.
 *   Darle de baja no anula una papeleta pagada (eso lo decide la Junta), así
 *   que la puerta es quien lo para.
 * - `REPETIDA`: ya entró. No es un error de quien escanea: suele ser el mismo
 *   hermano pasando dos veces, o dos diputados leyendo la misma.
 * - `ENTRA`: adelante.
 */
export type Veredicto = 'ENTRA' | 'REPETIDA' | 'OTRA_SALIDA' | 'DE_BAJA' | 'ANULADA' | 'FALSO';

interface PapeletaEnLaPuerta {
  year: number;
  salidaId: number;
  entradaEl: Date | null;
  /** Su hermano no está en activo (de baja, o difunto). */
  deBaja: boolean;
}

export function veredicto(
  papeleta: PapeletaEnLaPuerta | null,
  esperada: { year: number; salidaId: number },
): Exclude<Veredicto, 'FALSO'> {
  if (!papeleta) return 'ANULADA';
  if (papeleta.year !== esperada.year || papeleta.salidaId !== esperada.salidaId) return 'OTRA_SALIDA';
  if (papeleta.deBaja) return 'DE_BAJA';
  return papeleta.entradaEl ? 'REPETIDA' : 'ENTRA';
}

interface TramoEnLaPuerta {
  /** Null: las papeletas sin tramo (trono, acólitos… o un cortejo sin repartir). */
  tramo: string | null;
  total: number;
  dentro: number;
}

/**
 * Las cuentas por tramo: en el orden del cortejo (el de la configuración),
 * después cualquier tramo escrito a mano, y al final las que no tienen.
 */
export function cuentasPorTramo(
  papeletas: { tramo: string | null; entradaEl: Date | null }[],
  ordenDelCortejo: string[],
): TramoEnLaPuerta[] {
  const porTramo = new Map<string | null, TramoEnLaPuerta>();
  for (const p of papeletas) {
    const t = porTramo.get(p.tramo) ?? { tramo: p.tramo, total: 0, dentro: 0 };
    t.total += 1;
    if (p.entradaEl) t.dentro += 1;
    porTramo.set(p.tramo, t);
  }
  const lugar = (t: string | null) => {
    if (t === null) return Number.MAX_SAFE_INTEGER;
    const i = ordenDelCortejo.indexOf(t);
    return i === -1 ? ordenDelCortejo.length : i;
  };
  return [...porTramo.values()].sort((a, b) => lugar(a.tramo) - lugar(b.tramo) || (a.tramo ?? '').localeCompare(b.tramo ?? '', 'es'));
}
