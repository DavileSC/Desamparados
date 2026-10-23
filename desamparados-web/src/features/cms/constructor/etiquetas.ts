/**
 * Lo que lee quien edita en el constructor: el nombre de cada opción de
 * presentación y de cada valor, y la ficha de cada tipo de bloque en la
 * galería de «Añadir bloque». Los valores en sí son los del catálogo
 * compartido (`shared/presentacion-de-bloques.json`); esto solo los nombra.
 */

/** El nombre de cada opción. */
export const ETIQUETA_OPCION: Record<string, string> = {
  fondo: 'Fondo',
  ancho: 'Ancho',
  espacio: 'Aire encima',
  alineacionTitulo: 'Título',
  separador: 'Adorno separador encima',
  oculto: 'Ocultar el bloque',
  estilo: 'Estilo',
  columnas: 'Columnas',
  alineacion: 'Alineación',
  capitular: 'Letra capital en el primer párrafo',
  tamano: 'Tamaño',
  proporcion: 'Recorte',
  marco: 'Marco',
  ampliable: 'Se amplía a pantalla completa al pulsarla',
  disposicion: 'Disposición',
  orientacion: 'Orientación',
  boton: 'Color del botón',
  cantidad: 'Cuántos',
  lado: 'Foto a la',
  anchoFoto: 'Ancho de la foto',
  alineacionVertical: 'Alineación vertical',
  abrirPrimera: 'La primera, abierta al entrar',
  alto: 'Alto',
  linea: 'Con una línea fina en medio',
  ladoDibujo: 'Dibujo a la',
}

/** El nombre de cada valor, cuando no se lee bien tal cual. */
const ETIQUETA_VALOR: Record<string, string> = {
  ninguno: 'Ninguno', papel: 'Papel', granate: 'Granate', oscuro: 'Oscuro', foto: 'Foto',
  normal: 'Normal', estrecho: 'Estrecho', ancho: 'Todo el ancho',
  compacto: 'Poco', amplio: 'Mucho',
  centro: 'Centrado', izquierda: 'Izquierda', derecha: 'Derecha', justificado: 'Justificado',
  entradilla: 'Entradilla', destacado: 'Destacado', carta: 'Carta',
  preguntas: 'Preguntas grandes', margen: 'Título al margen',
  grande: 'Grande', pequena: 'Pequeña', mediana: 'Mediana', completa: 'De lado a lado',
  original: 'Original', fino: 'Filete fino', dorado: 'Dorado',
  pase: 'Pase', cuadricula: 'Cuadrícula', mosaico: 'Mosaico', tiras: 'Tiras', estampas: 'Estampas', carteles: 'Carteles',
  rueda: 'Números que ruedan',
  auto: 'Automático', cristal: 'Cristal', contorno: 'Recuadro sobrio', numeradas: 'Numeradas', filetes: 'Columnas con filete',
  separada: 'Foto al lado', fundido: 'Foto fundida en negro',
  vertical: 'Vertical', horizontal: 'Horizontal',
  recuadro: 'Recuadro', franja: 'Franja', sencilla: 'Sencilla',
  lista: 'Lista', tabla: 'Tabla', tarjetas: 'Tarjetas', linea: 'Línea', indice: 'Índice de devocionario', plano: 'Sobre el mapa', cinta: 'Cinta que pasa al bajar',
  lado: 'Datos al lado', debajo: 'Datos debajo', solo: 'Solo el formulario',
  mitad: 'La mitad', tercio: 'Un tercio', arriba: 'Arriba',
  clasica: 'Clásica', lineas: 'Líneas',
  bajo: 'Bajo', medio: 'Medio', alto: 'Alto', compacta: 'Compacta',
  pequeno: 'Pequeño', mediano: 'Mediano',
  anillos: 'Anillos entrelazados', foco: 'En foco', enfoque: 'Se enfoca al leerla', fila: 'En una fila',
}

export const etiquetaDeValor = (valor: string): string => ETIQUETA_VALOR[valor] ?? valor

/** El sitio de cada valor de tamaño en una escala, de menos a más. */
const ESCALA: Record<string, number> = {
  pequena: 0, pequeno: 0, compacto: 0, bajo: 0,
  mediana: 1, mediano: 1, normal: 1, medio: 1,
  grande: 2, amplio: 2, alto: 2,
  completa: 3,
}

/**
 * Los valores en el orden en que se enseñan. En el catálogo el primero es el
 * de siempre, y así salían «Grande, Pequeña, Mediana»; una lista que es toda
 * de tamaños se enseña de menor a mayor. Lo que se guarda no cambia.
 */
export function ordenDeValores(valores: string[]): string[] {
  if (!valores.every((valor) => valor in ESCALA)) return valores
  return [...valores].sort((a, b) => ESCALA[a] - ESCALA[b])
}

/** Una ayuda corta debajo de algunas opciones, donde el nombre no basta. */
export const AYUDA_OPCION: Record<string, string> = {
  fondo: 'Una franja de color de lado a lado de la ventana, con el bloque dentro. La foto va muy velada.',
  ancho: 'Estrecho se lee más cómodo; todo el ancho aprovecha la pantalla.',
  proporcion: 'Recorta la foto a esa forma. Original la deja como es.',
  columnas: 'En el ordenador; en el móvil se apilan siempre.',
}

interface FichaDeBloque { nombre: string; descripcion: string }

/** La ficha de cada tipo en la galería de «Añadir bloque»: su nombre y para qué sirve. */
export const FICHA_DE_BLOQUE: Record<string, FichaDeBloque> = {
  texto: { nombre: 'Texto', descripcion: 'Párrafos con formato: negritas, listas, enlaces y subtítulos.' },
  cita: { nombre: 'Cita', descripcion: 'Unas palabras destacadas en grande, con quién las dijo.' },
  preguntas: { nombre: 'Preguntas plegables', descripcion: 'Preguntas que se abren al pulsarlas: ideal para dudas frecuentes.' },
  foto: { nombre: 'Foto', descripcion: 'Una foto con su pie, del tamaño y recorte que quieras.' },
  fotoTexto: { nombre: 'Foto con texto', descripcion: 'Foto a un lado y texto al otro, con un botón si quieres.' },
  galeria: { nombre: 'Galería', descripcion: 'Varias fotos y vídeos: en pase, cuadrícula, mosaico, tiras, estampas o carteles.' },
  carrusel: { nombre: 'Carrusel de piezas', descripcion: 'Una pieza cada vez: la foto grande y, al lado, su historia y su cartela.' },
  donativo: { nombre: 'Donativo', descripcion: 'Importes sugeridos y el pago con tarjeta o Bizum en el banco, sin cuenta en la web.' },
  fotoFija: { nombre: 'Foto fija y texto que pasa', descripcion: 'La foto se queda quieta y cambia según se lee cada parte del texto.' },
  video: { nombre: 'Vídeo', descripcion: 'Un vídeo de YouTube o Vimeo, que no se carga hasta darle al play.' },
  tarjetas: { nombre: 'Tarjetas', descripcion: 'Una rejilla de tarjetas con título, texto, foto o icono y enlace.' },
  llamada: { nombre: 'Llamada', descripcion: 'Un texto con un botón que lleva a otra página.' },
  botones: { nombre: 'Botones', descripcion: 'Hasta cuatro botones en fila, cada uno a una página.' },
  espacio: { nombre: 'Espacio', descripcion: 'Aire entre dos bloques, con una línea si quieres.' },
  datos: { nombre: 'Datos', descripcion: 'Pares de concepto y valor: horarios, direcciones, medidas.' },
  itinerario: { nombre: 'Itinerario', descripcion: 'Las paradas de un recorrido con su hora, y el recorrido sobre el mapa.' },
  cronologia: { nombre: 'Cronología', descripcion: 'Momentos de una historia en orden, con fecha y relato.' },
  descargas: { nombre: 'Descargas', descripcion: 'Documentos en PDF para descargar.' },
  mapa: { nombre: 'Mapa', descripcion: 'Un lugar en el mapa, con el enlace para llegar.' },
  horario: { nombre: 'Horario vivo', descripcion: 'Misas y despacho, con la próxima misa y cuánto falta, calculado al momento.' },
  relacion: { nombre: 'Relación de cargos', descripcion: 'Los cargos de la Junta, con quién los ocupa y qué hace cada uno.' },
  programa: { nombre: 'Programa', descripcion: 'Los cultos del año mes a mes, con el próximo marcado solo y su fecha de la Agenda.' },
  puertas: { nombre: 'Dos puertas', descripcion: 'Dos paneles para dos lectores, como «Necesito ayuda» y «Quiero ayudar», con sus datos y un botón.' },
  anillos: { nombre: 'Tres fines', descripcion: 'Tres fines que van juntos: en anillos entrelazados, o en foco, una palabra nítida y las otras dos desenfocadas.' },
  dibujo: { nombre: 'Dibujo con texto', descripcion: 'Un dibujo de líneas que se traza al bajar, con un texto al lado.' },
  cuentaAtras: { nombre: 'Cuenta atrás', descripcion: 'Días, horas y minutos que faltan para una fecha.' },
  listado: { nombre: 'Listado', descripcion: 'Noticias, actos o publicaciones, que salen solos de otras pantallas.' },
  contacto: { nombre: 'Formulario de contacto', descripcion: 'El formulario que llega por correo, con los datos al lado.' },
}

/**
 * Las carpetas de la galería, en su orden, y los tipos de cada una en el suyo:
 * de lo más corriente a lo más especial. Un tipo nuevo que no esté en ninguna
 * no se ofrecería: lo vigila la prueba de la galería.
 */
export const CARPETAS_DE_BLOQUES: { nombre: string; tipos: string[] }[] = [
  { nombre: 'Texto', tipos: ['texto', 'cita', 'preguntas'] },
  { nombre: 'Fotos y vídeo', tipos: ['foto', 'fotoTexto', 'galeria', 'carrusel', 'fotoFija', 'video', 'dibujo'] },
  { nombre: 'Composición', tipos: ['tarjetas', 'llamada', 'botones', 'puertas', 'anillos', 'espacio'] },
  { nombre: 'Información', tipos: ['datos', 'itinerario', 'cronologia', 'horario', 'mapa', 'relacion', 'descargas', 'cuentaAtras'] },
  { nombre: 'Automáticos', tipos: ['listado', 'programa'] },
  { nombre: 'Formularios y pagos', tipos: ['contacto', 'donativo'] },
]
