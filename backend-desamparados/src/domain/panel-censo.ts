export interface MovimientoMensual {
  /** 'YYYY-MM' */
  mes: string;
  total: number;
}

export interface PuntoCenso {
  mes: string;
  activos: number;
}

/** Etiqueta 'YYYY-MM' de una fecha, en UTC para no depender de la zona del servidor. */
export function claveMes(fecha: Date): string {
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  return `${fecha.getUTCFullYear()}-${mes}`;
}

/** Los `cuantos` últimos meses hasta `hasta`, del más antiguo al más reciente. */
export function ultimosMeses(hasta: Date, cuantos: number): string[] {
  const meses: string[] = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const fecha = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth() - i, 1));
    meses.push(claveMes(fecha));
  }
  return meses;
}

/**
 * Reconstruye cuántos hermanos activos había al cierre de cada mes.
 *
 * No se puede consultar directamente: la base de datos solo sabe quién está
 * activo HOY, con su fecha de alta y su fecha de baja. Así que se parte del
 * total actual y se camina hacia atrás:
 *
 *     activos(mes anterior) = activos(mes) - altas(mes) + bajas(mes)
 */
export function serieCensoMensual(
  activosHoy: number,
  altas: MovimientoMensual[],
  bajas: MovimientoMensual[],
  meses: string[],
): PuntoCenso[] {
  const porMes = (lista: MovimientoMensual[]) =>
    new Map(lista.map((m) => [m.mes, m.total]));
  const altasPorMes = porMes(altas);
  const bajasPorMes = porMes(bajas);

  const serie: PuntoCenso[] = new Array(meses.length);
  let acumulado = activosHoy;

  for (let i = meses.length - 1; i >= 0; i--) {
    serie[i] = { mes: meses[i], activos: Math.max(0, acumulado) };
    acumulado = acumulado - (altasPorMes.get(meses[i]) ?? 0) + (bajasPorMes.get(meses[i]) ?? 0);
  }

  return serie;
}
