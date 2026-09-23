/**
 * Quién debe cuotas: los hermanos activos con cuotas de hermano pendientes o
 * devueltas por el banco, agrupados por persona. Es lo que mira Secretaría
 * antes de dar una baja por impago, así que se ordena por quién debe más.
 *
 * La cuota del año en curso se deja fuera por defecto: en febrero casi nadie
 * la ha pagado aún y eso no es un impago. Un recibo REMESADO tampoco cuenta:
 * está en el banco, cobrándose.
 */

export interface CuotaImpagada {
  id: number;
  year: number;
  estado: 'PENDIENTE' | 'DEVUELTO';
  importe: number;
}

export interface HermanoConImpagos {
  hermano: { id: number; nombre: string; apellidos: string; numeroHermano: number | null };
  cuotas: CuotaImpagada[];
  /** Lo que debe en total, en euros con dos decimales. */
  total: number;
}

type ReciboLeido = {
  id: number;
  year: number;
  estado: string;
  importe: { toString(): string } | number;
  hermano: HermanoConImpagos['hermano'];
};

export function agruparImpagos(recibos: ReciboLeido[], minimo = 1): HermanoConImpagos[] {
  const porHermano = new Map<number, HermanoConImpagos>();
  for (const recibo of recibos) {
    const fila = porHermano.get(recibo.hermano.id) ?? { hermano: recibo.hermano, cuotas: [], total: 0 };
    const importe = Number(recibo.importe.toString());
    fila.cuotas.push({ id: recibo.id, year: recibo.year, estado: recibo.estado as CuotaImpagada['estado'], importe });
    // En céntimos para no arrastrar errores de coma flotante al sumar.
    fila.total = Math.round(fila.total * 100 + importe * 100) / 100;
    porHermano.set(recibo.hermano.id, fila);
  }
  return [...porHermano.values()]
    .filter((fila) => fila.cuotas.length >= minimo)
    .map((fila) => ({ ...fila, cuotas: fila.cuotas.sort((a, b) => a.year - b.year) }))
    .sort((a, b) =>
      b.cuotas.length - a.cuotas.length
      || a.hermano.apellidos.localeCompare(b.hermano.apellidos, 'es')
      || a.hermano.nombre.localeCompare(b.hermano.nombre, 'es')
      || a.hermano.id - b.hermano.id);
}
