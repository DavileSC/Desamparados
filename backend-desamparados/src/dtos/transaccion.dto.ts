import type { MetodoPago, TipoTransaccion } from '@prisma/client';

/** Un apunte que se teclea a mano en la contabilidad (los de recibos los crea el recibo). */
export interface CreateTransaccionDto {
  tipo: TipoTransaccion;
  categoriaId: number;
  concepto: string;
  importe: number;
  /** Día de Madrid, `AAAA-MM-DD`. Si falta, hoy. */
  fecha?: string;
  metodoPago: MetodoPago;
}

/** Corregir un apunte manual: se manda entero, con su fecha. */
export interface UpdateTransaccionDto extends CreateTransaccionDto {
  fecha: string;
}
