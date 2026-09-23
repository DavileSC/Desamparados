/**
 * Las piezas comunes del acabado de las gráficas: el degradado que rellena
 * áreas y columnas y el halo de las líneas (la curva suavizada está en
 * `ejes.ts`). Van aparte
 * para que todas las gráficas brillen igual.
 */

/** Degradado vertical de `color`: opaco arriba y desvanecido abajo. */
export function Degradado({ id, color, arriba = 0.55, abajo = 0 }: { id: string; color: string; arriba?: number; abajo?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={arriba} />
      <stop offset="100%" stopColor={color} stopOpacity={abajo} />
    </linearGradient>
  )
}

/** Halo difuminado para poner debajo de una línea o una columna. */
export function Halo({ id, radio = 4 }: { id: string; radio?: number }) {
  return (
    <filter id={id} x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation={radio} />
    </filter>
  )
}
