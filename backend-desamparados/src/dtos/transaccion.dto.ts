export interface CreateTransaccionDto {
  tipo: any;
  categoria: any;
  concepto: string;
  importe: number;
  fecha?: string;
  metodoPago?: any;
  hermanoId?: number;
  reciboId?: number;
}