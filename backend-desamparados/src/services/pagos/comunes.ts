/** Lo que comparten el pago de recibos y el donativo por la pasarela. */
import type { Prisma } from '@prisma/client';
import type { FormularioRedsys } from '../../domain/redsys.js';

export type MetodoEnLinea = 'TARJETA' | 'BIZUM';

/** Lo que devuelve empezar un pago: hecho ya (simulado) o el formulario para ir al banco. */
export type InicioDePago =
  | { tipo: 'hecho'; total: number; repetida: boolean }
  | ({ tipo: 'banco'; pedido: string } & FormularioRedsys);

export const aCentimos = (importe: Prisma.Decimal | number) => Math.round(Number(importe) * 100);

/** La clave de la operación del cobro: la misma en cada aviso repetido del mismo pedido. */
export const claveDelCobro = (pedido: string) => `redsys-${pedido}`;

/** La dirección del aviso del banco: tiene que ser pública (ver docs/despliegue.md). */
export const urlDelAviso = () => `${process.env.API_URL || 'http://localhost:3001'}/api/pagos/redsys/notificacion`;
