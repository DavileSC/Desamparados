// Un extracto Norma 43 de una cuenta, escrito como lo sacan los bancos, para
// las pruebas del lector y del casado con las remesas.

const num = (n: number, ancho: number) => String(n).padStart(ancho, '0');
const txt = (t: string, ancho: number) => t.padEnd(ancho, ' ').slice(0, ancho);

export interface Mov { fecha: string; signo: 1 | 2; centimos: number; ref1?: string; ref2?: string; conceptos?: string[] }

/** Un extracto de una cuenta, con sus totales bien calculados salvo que se pida otra cosa. */
export function extracto(movs: Mov[], { saldoInicial = 100000, trucarTotales = false } = {}): string {
  const lineas = [`11${'2100'}${'0418'}${'4502000513'}${'260901'}${'260930'}2${num(saldoInicial, 14)}9783${txt('GRUPO PARROQUIAL', 26)}   `];
  for (const m of movs) {
    lineas.push(`22${'    '}${'0418'}${m.fecha}${m.fecha}03${'000'}${m.signo}${num(m.centimos, 14)}${num(0, 10)}${txt(m.ref1 ?? '', 12)}${txt(m.ref2 ?? '', 16)}`);
    for (const [i, c] of (m.conceptos ?? []).entries()) lineas.push(`23${num(i + 1, 2)}${txt(c, 38)}${txt('', 38)}`);
  }
  const cargos = movs.filter((m) => m.signo === 1);
  const abonos = movs.filter((m) => m.signo === 2);
  const suma = (ms: Mov[]) => ms.reduce((s, m) => s + m.centimos, 0);
  const saldoFinal = saldoInicial - suma(cargos) + suma(abonos);
  lineas.push(`33${'2100'}${'0418'}${'4502000513'}${num(cargos.length, 5)}${num(suma(cargos) + (trucarTotales ? 1 : 0), 14)}${num(abonos.length, 5)}${num(suma(abonos), 14)}2${num(saldoFinal, 14)}978    `);
  lineas.push(`88${'9'.repeat(18)}${num(lineas.length + 1, 6)}${' '.repeat(54)}`);
  return lineas.join('\r\n');
}

