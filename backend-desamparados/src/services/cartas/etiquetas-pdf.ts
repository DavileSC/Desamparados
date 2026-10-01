/**
 * Las etiquetas postales en PDF, a la medida de la hoja de etiquetas: se
 * imprime al 100 % (sin «ajustar a la página») y cada dirección cae en su
 * etiqueta. Sin adornos: una etiqueta la lee el cartero, no el hermano.
 */
import { lineasDeDireccion, posicionDe, type FormatoDeEtiquetas, type Sobre } from '../../domain/etiquetas.js';
import { LETRA, NEGRO, aBuffer, nuevoDocumento, sinMargenes, type Doc } from '../informes/pdf.js';

const MM = 72 / 25.4;
/** Lo que se deja libre dentro de cada etiqueta: la impresora no clava el borde. */
const RELLENO = 5 * MM;
const RELLENO_ALTO = 3 * MM;
const TAM = 10;
const TAM_MINIMO = 7;
const INTERLINEA = 1.3;

const letraDe = (i: number) => (i === 0 ? LETRA.textoMedio : LETRA.texto);

/** Parte una línea en las que quepan en el ancho, por palabras (una palabra que no cabe sola se queda entera). */
function partir(doc: Doc, linea: string, ancho: number): string[] {
  const trozos: string[] = [];
  let actual = '';
  for (const palabra of linea.split(/\s+/)) {
    const con = actual ? `${actual} ${palabra}` : palabra;
    if (actual && doc.widthOfString(con) > ancho) { trozos.push(actual); actual = palabra; } else actual = con;
  }
  return actual ? [...trozos, actual] : trozos;
}

/**
 * Cómo cabe la dirección: con la letra más grande a la que, partiendo las
 * líneas largas, entra entera en el alto de la etiqueta. Una calle no se
 * recorta nunca con «…»: sin el piso o la escalera la carta no llega.
 */
function componer(doc: Doc, lineas: string[], ancho: number, alto: number): { tam: number; filas: { texto: string; letra: string }[] } {
  for (let tam = TAM; ; tam -= 0.5) {
    doc.fontSize(tam);
    const filas = lineas.flatMap((l, i) => partir(doc.font(letraDe(i)), l, ancho).map((texto) => ({ texto, letra: letraDe(i) })));
    if (filas.length * tam * INTERLINEA <= alto || tam <= TAM_MINIMO) return { tam, filas };
  }
}

function etiqueta(doc: Doc, s: Sobre, x: number, y: number, f: FormatoDeEtiquetas) {
  const ancho = f.ancho * MM - 2 * RELLENO;
  const { tam, filas } = componer(doc, lineasDeDireccion(s), ancho, f.alto * MM - 2 * RELLENO_ALTO);
  const interlinea = tam * INTERLINEA;
  // Centrada en alto: queda bien aunque falte la línea de la localidad.
  let yy = y + (f.alto * MM - filas.length * interlinea) / 2;
  for (const fila of filas) {
    doc.font(fila.letra).fontSize(tam).fillColor(NEGRO).text(fila.texto, x + RELLENO, yy, { lineBreak: false });
    yy += interlinea;
  }
}

/** Todas las etiquetas, empezando tras las `saltar` primeras de la hoja (las ya gastadas). */
export async function etiquetasEnPdf(sobres: Sobre[], f: FormatoDeEtiquetas, saltar = 0): Promise<Buffer> {
  const doc = nuevoDocumento('Etiquetas postales');
  let hoja = 0;
  sobres.forEach((s, i) => {
    const p = posicionDe(f, i + saltar);
    while (hoja < p.hoja) { doc.addPage(); hoja++; }
    sinMargenes(doc, () => etiqueta(doc, s, p.x * MM, p.y * MM, f));
  });
  return aBuffer(doc);
}
