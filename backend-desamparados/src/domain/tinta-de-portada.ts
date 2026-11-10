import colores from '../../../shared/tinta-de-portada.json' with { type: 'json' };

/**
 * La letra de la cubierta «Foto callada» de las publicaciones: la foto va
 * entera y el texto, pequeño, en dos sitios (el nombre arriba a la izquierda;
 * número y fecha en la franja de abajo). Cada sitio se mide por separado porque
 * una foto con cielo arriba y gente abajo pide letra oscura en uno y clara en
 * el otro. Si la letra no se lee sola, un velo del color contrario, el justo.
 */

export type Letra = 'clara' | 'oscura';
// `type` y no `interface`: Prisma solo guarda en una columna JSON objetos con
// firma de índice, y los alias la tienen implícita.
export type TintaDeZona = {
  letra: Letra;
  /** Opacidad del velo bajo la letra, de 0 a VELO_MAXIMO. */
  velo: number;
};
export type TintaDePortada = {
  arriba: TintaDeZona;
  abajo: TintaDeZona;
};

/** La foto se mide reducida a este tamaño, en la proporción de la tapa (3:4). */
export const ANCHO_MUESTRA = 60;
export const ALTO_MUESTRA = 80;

/** Dónde va el texto en la tapa, en píxeles de la muestra. */
const ZONAS = {
  // El nombre y el Grupo: el 60 % del ancho y el 20 % de arriba.
  arriba: { x0: 0, y0: 0, x1: 36, y1: 16 },
  // Número y fecha: la franja del 12 % de abajo, de lado a lado.
  abajo: { x0: 0, y0: 70, x1: 60, y1: 80 },
} as const;

// AA para texto normal: la letra de la tapa es pequeña (8 px en la franja).
const CONTRASTE_MINIMO = 4.5;
// No todos los píxeles: un brillo suelto en la plata o una vela no tiene que
// oscurecer la zona entera.
const PROPORCION_QUE_SE_LEE = 0.9;
// Más allá, el velo ya no es un velo sino una faja: la foto se pierde.
export const VELO_MAXIMO = 0.8;
const PASO = 0.02;

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const LETRA_CLARA = rgb(colores.letraClara);
const LETRA_OSCURA = rgb(colores.letraOscura);
const VELO_OSCURO = rgb(colores.veloOscuro);
const VELO_CLARO = rgb(colores.veloClaro);

/** Luminancia relativa de WCAG. */
function luminancia([r, g, b]: readonly number[]) {
  const lineal = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

function contraste(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * El velo más flojo con el que la letra se lee en la zona, o null si ni con
 * el máximo. Se mezcla en sRGB, igual que pinta el navegador un rgba encima.
 */
function veloNecesario(pixeles: readonly (readonly number[])[], letra: Letra): number | null {
  const tinta = luminancia(letra === 'clara' ? LETRA_CLARA : LETRA_OSCURA);
  const velo = letra === 'clara' ? VELO_OSCURO : VELO_CLARO;
  for (let paso = 0; paso * PASO <= VELO_MAXIMO + 1e-9; paso++) {
    const a = paso * PASO;
    let seLeen = 0;
    for (const p of pixeles) {
      const mezcla = p.map((v, i) => v + (velo[i] - v) * a);
      if (contraste(luminancia(mezcla), tinta) >= CONTRASTE_MINIMO) seLeen++;
    }
    if (seLeen >= pixeles.length * PROPORCION_QUE_SE_LEE) return Math.round(a * 100) / 100;
  }
  return null;
}

/** Letra y velo de una zona: la letra que pida menos velo. */
export function tintaDeZona(pixeles: readonly (readonly number[])[]): TintaDeZona {
  const clara = veloNecesario(pixeles, 'clara');
  const oscura = veloNecesario(pixeles, 'oscura');
  if (oscura !== null && (clara === null || oscura < clara)) return { letra: 'oscura', velo: oscura };
  // Ni con el máximo: letra clara sobre el velo más oscuro, que es lo que más
  // se acerca y lo que llevaba la tapa antes.
  return { letra: 'clara', velo: clara ?? VELO_MAXIMO };
}

/**
 * La tinta de toda la tapa a partir de la foto ya reducida a la muestra
 * (ANCHO_MUESTRA × ALTO_MUESTRA, recortada como `object-fit: cover`) en RGB
 * crudo, tres bytes por píxel.
 */
export function tintaDePortada(rgbCrudo: Uint8Array): TintaDePortada {
  const zona = ({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) => {
    const pixeles: number[][] = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * ANCHO_MUESTRA + x) * 3;
        pixeles.push([rgbCrudo[i], rgbCrudo[i + 1], rgbCrudo[i + 2]]);
      }
    }
    return tintaDeZona(pixeles);
  };
  return { arriba: zona(ZONAS.arriba), abajo: zona(ZONAS.abajo) };
}
