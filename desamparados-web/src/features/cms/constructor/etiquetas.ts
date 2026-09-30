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
  grande: 'Grande', pequena: 'Pequeña', mediana: 'Mediana', completa: 'De lado a lado',
  original: 'Original', fino: 'Filete fino', dorado: 'Dorado',
  pase: 'Pase', cuadricula: 'Cuadrícula', mosaico: 'Mosaico', tiras: 'Tiras', estampas: 'Estampas', carteles: 'Carteles',
  rueda: 'Números que ruedan',
  auto: 'Automático', cristal: 'Cristal', contorno: 'Recuadro sobrio', numeradas: 'Numeradas',
  separada: 'Foto al lado', fundido: 'Foto fundida en negro',
  vertical: 'Vertical', horizontal: 'Horizontal',
  recuadro: 'Recuadro', franja: 'Franja', sencilla: 'Sencilla',
  lista: 'Lista', tabla: 'Tabla', tarjetas: 'Tarjetas', linea: 'Línea', indice: 'Índice de devocionario', plano: 'Sobre el mapa', cinta: 'Cinta que pasa al bajar',
  lado: 'Datos al lado', debajo: 'Datos debajo', solo: 'Solo el formulario',
  mitad: 'La mitad', tercio: 'Un tercio', arriba: 'Arriba',
  clasica: 'Clásica', lineas: 'Líneas',
  bajo: 'Bajo', medio: 'Medio', alto: 'Alto', natural: 'Natural', compacta: 'Compacta',
  pequeno: 'Pequeño', mediano: 'Mediano',
  anillos: 'Anillos entrelazados', foco: 'En foco', enfoque: 'Se enfoca al leerla', fila: 'En una fila',
}

export const etiquetaDeValor = (valor: string): string => ETIQUETA_VALOR[valor] ?? valor

/** Una ayuda corta debajo de algunas opciones, donde el nombre no basta. */
export const AYUDA_OPCION: Record<string, string> = {
  fondo: 'Una franja de color de lado a lado de la ventana, con el bloque dentro. La foto va muy velada.',
  ancho: 'Estrecho se lee más cómodo; todo el ancho aprovecha la pantalla.',
  proporcion: 'Recorta la foto a esa forma. Original la deja como es.',
  cantidad: 'Solo en «Últimas noticias» y «Próximos actos».',
  columnas: 'En el ordenador; en el móvil se apilan siempre.',
}

export interface FichaDeBloque { nombre: string; descripcion: string; grupo: string }

/** La ficha de cada tipo en la galería de «Añadir bloque», y su grupo. */
export const FICHA_DE_BLOQUE: Record<string, FichaDeBloque> = {
  texto: { nombre: 'Texto', grupo: 'Texto', descripcion: 'Párrafos con formato: negritas, listas, enlaces y subtítulos.' },
  cita: { nombre: 'Cita', grupo: 'Texto', descripcion: 'Unas palabras destacadas en grande, con quién las dijo.' },
  preguntas: { nombre: 'Preguntas plegables', grupo: 'Texto', descripcion: 'Preguntas que se abren al pulsarlas: ideal para dudas frecuentes.' },
  foto: { nombre: 'Foto', grupo: 'Imagen y vídeo', descripcion: 'Una foto con su pie, del tamaño y recorte que quieras.' },
  fotoTexto: { nombre: 'Foto con texto', grupo: 'Imagen y vídeo', descripcion: 'Foto a un lado y texto al otro, con un botón si quieres.' },
  galeria: { nombre: 'Galería', grupo: 'Imagen y vídeo', descripcion: 'Varias fotos y vídeos: en pase, cuadrícula, mosaico, tiras, estampas o carteles.' },
  carrusel: { nombre: 'Carrusel de piezas', grupo: 'Imagen y vídeo', descripcion: 'Una pieza cada vez: la foto grande y, al lado, su historia y su cartela.' },
  fotoFija: { nombre: 'Foto fija y texto que pasa', grupo: 'Imagen y vídeo', descripcion: 'La foto se queda quieta y cambia según se lee cada parte del texto.' },
  video: { nombre: 'Vídeo', grupo: 'Imagen y vídeo', descripcion: 'Un vídeo de YouTube o Vimeo, que no se carga hasta darle al play.' },
  tarjetas: { nombre: 'Tarjetas', grupo: 'Composición', descripcion: 'Una rejilla de tarjetas con título, texto, foto o icono y enlace.' },
  llamada: { nombre: 'Llamada', grupo: 'Composición', descripcion: 'Un texto con un botón que lleva a otra página.' },
  botones: { nombre: 'Botones', grupo: 'Composición', descripcion: 'Hasta cuatro botones en fila, cada uno a una página.' },
  espacio: { nombre: 'Espacio', grupo: 'Composición', descripcion: 'Aire entre dos bloques, con una línea si quieres.' },
  datos: { nombre: 'Datos', grupo: 'Información', descripcion: 'Pares de concepto y valor: horarios, direcciones, medidas.' },
  itinerario: { nombre: 'Itinerario', grupo: 'Información', descripcion: 'Las paradas de un recorrido con su hora, y el recorrido sobre el mapa.' },
  cronologia: { nombre: 'Cronología', grupo: 'Información', descripcion: 'Momentos de una historia en orden, con fecha y relato.' },
  descargas: { nombre: 'Descargas', grupo: 'Información', descripcion: 'Documentos en PDF para descargar.' },
  mapa: { nombre: 'Mapa', grupo: 'Información', descripcion: 'Un lugar en el mapa, con el enlace para llegar.' },
  horario: { nombre: 'Horario vivo', grupo: 'Información', descripcion: 'Misas y despacho, con la próxima misa y cuánto falta, calculado al momento.' },
  relacion: { nombre: 'Relación de cargos', grupo: 'Información', descripcion: 'Los cargos de la Junta, con quién los ocupa y qué hace cada uno.' },
  programa: { nombre: 'Programa', grupo: 'Automáticos', descripcion: 'Los cultos del año mes a mes, con el próximo marcado solo y su fecha de la Agenda.' },
  puertas: { nombre: 'Dos puertas', grupo: 'Composición', descripcion: 'Dos paneles para dos lectores, como «Necesito ayuda» y «Quiero ayudar», con sus datos y un botón.' },
  anillos: { nombre: 'Tres fines', grupo: 'Composición', descripcion: 'Tres fines que van juntos: en anillos entrelazados, o en foco, una palabra nítida y las otras dos desenfocadas.' },
  dibujo: { nombre: 'Dibujo con texto', grupo: 'Imagen y vídeo', descripcion: 'El templo o el signo pasionista, que se dibujan al bajar, con un texto al lado.' },
  cuentaAtras: { nombre: 'Cuenta atrás', grupo: 'Información', descripcion: 'Días, horas y minutos que faltan para una fecha.' },
  listado: { nombre: 'Listado', grupo: 'Automáticos', descripcion: 'Noticias, actos o publicaciones, que salen solos de otras pantallas.' },
  contacto: { nombre: 'Formulario de contacto', grupo: 'Automáticos', descripcion: 'El formulario que llega por correo, con los datos al lado.' },
}

/** El orden de los grupos en la galería. */
export const GRUPOS_DE_BLOQUES = ['Texto', 'Imagen y vídeo', 'Composición', 'Información', 'Automáticos']
