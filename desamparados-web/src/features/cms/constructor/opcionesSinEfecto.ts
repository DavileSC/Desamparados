import { pintaSuTitulo } from '../../../components/bloques/registro'
import { valorDe } from '../../../components/bloques/presentacion'
import type { Bloque } from '../../../lib/api/contenido'

/**
 * Los tipos que no hacen caso del ancho: llevan el suyo propio (el vídeo, por
 * su tamaño; la cuenta atrás, los botones) o el de la página entera.
 */
const SIN_ANCHO = new Set(['botones', 'contacto', 'cronologia', 'cuentaAtras', 'espacio', 'listado', 'video'])

/** Los listados cortos: los únicos que eligen cuántos y si van en lista. */
const LISTADOS_CORTOS = new Set(['noticias-recientes', 'agenda-proxima'])

/**
 * Las opciones de presentación que, con lo que el bloque es ahora, no
 * cambiarían nada: la pestaña no las enseña, porque un control que no hace
 * nada solo confunde. Lo guardado no se toca: si el bloque cambia (otro
 * estilo, otra fuente), la opción vuelve con el valor que tuviera.
 */
export function opcionesSinEfecto(bloque: Bloque): Set<string> {
  const fuera = new Set<string>()
  if (SIN_ANCHO.has(bloque.tipo)) fuera.add('ancho')
  // Sin título, o con uno que el bloque pinta a su manera, no hay nada que alinear.
  if (bloque.tipo === 'espacio' || pintaSuTitulo(bloque)) fuera.add('alineacionTitulo')

  if (bloque.tipo === 'listado') {
    const corto = LISTADOS_CORTOS.has(bloque.fuente)
    if (!corto) { fuera.add('cantidad'); fuera.add('disposicion') }
    // La agenda completa es un calendario; un listado corto en lista no va en columnas.
    if (bloque.fuente === 'agenda' || (corto && valorDe(bloque, 'disposicion') === 'lista')) fuera.add('columnas')
  }
  if (bloque.tipo === 'fotoTexto' && valorDe(bloque, 'estilo') === 'fundido') {
    // Fundida, la foto va de lado a lado de la ventana: ni su ancho ni el del bloque cambian nada.
    for (const clave of ['anchoFoto', 'proporcion', 'alineacionVertical', 'ancho']) fuera.add(clave)
  }
  // Numeradas y con filete son columnas de texto: ni van de lado ni llevan foto.
  if (bloque.tipo === 'tarjetas' && ['numeradas', 'filetes'].includes(valorDe(bloque, 'estilo'))) fuera.add('orientacion')
  if (bloque.tipo === 'foto' && valorDe(bloque, 'tamano') === 'completa') fuera.add('marco')
  return fuera
}

/** Los que están pensados para fondo oscuro: su texto claro no se lee sobre papel. */
export const SOLO_FONDO_OSCURO = new Set(['cronologia', 'anillos'])
