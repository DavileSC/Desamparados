// Las plantillas de correo sin base de datos: el catálogo de usos es
// coherente, el formato de texto de los originales se lee en piezas, la
// revisión avisa de lo que dejaría un hueco, cada pieza se pinta como debe y
// lo que escribe Secretaría se escapa.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  USOS, avisosDePlantilla, dePlantillaDeTexto, enlaceValido, leerCuerpo, plantillaLimpia, problemasDePlantilla, resumenDe, usoDe,
  type Pieza, type PiezaDeTexto, type PlantillaDeCorreo,
} from '../src/domain/plantillas-correo.js';
import { componer } from '../src/services/correos/componer.js';
import { maquetar, medidaDelEscudo, tablaDeImportes } from '../src/services/correos/plantilla.js';
import { PlantillasCorreoService, cuerpoParaElEditor } from '../src/services/plantillas-correo.service.js';
import { direccionDeLaSede, identidad, secretaria, type Identidad } from '../src/domain/datos-entidad.js';
import { aLaCorporacion, deLaCorporacion, nuestraCorporacion } from '../src/domain/articulos.js';

test('cada texto original del catálogo es una plantilla válida de su uso', () => {
  const claves = USOS.map((u) => u.clave);
  assert.equal(new Set(claves).size, claves.length, 'claves repetidas');
  for (const uso of USOS) {
    if (uso.libre) continue;
    assert.deepEqual(problemasDePlantilla(uso, uso.porDefecto), [], uso.clave);
  }
});

test('el formato de texto de los originales, en piezas: párrafos, negrita, listas, recuadros con título y bloques fijos', () => {
  assert.deepEqual(leerCuerpo('Hola, **{{nombre}}**:\nsegunda línea\n\n- uno\n- dos\n\n> **Antes de salir**\n> Puntualidad.\n\n[[papeleta]]'), [
    { tipo: 'parrafo', trozos: [{ texto: 'Hola, ' }, { texto: '{{nombre}}', negrita: true }, { texto: ':\nsegunda línea' }] },
    { tipo: 'lista', elementos: [[{ texto: 'uno' }], [{ texto: 'dos' }]] },
    { tipo: 'recuadro', titulo: 'Antes de salir', piezas: [{ tipo: 'parrafo', trozos: [{ texto: 'Puntualidad.' }] }] },
    { tipo: 'fijo', clave: 'papeleta' },
  ]);
});

const plantilla = (contenido: Pieza[], resto: Partial<PlantillaDeCorreo> = {}): PlantillaDeCorreo => ({ asunto: 'Asunto', resumen: '', titulo: 'Título', contenido, despedida: '', ...resto });
const texto = (t: string): PiezaDeTexto => ({ tipo: 'parrafo', trozos: [{ texto: t }] });

test('la revisión avisa de campos y bloques que el correo no tiene y de los obligatorios que faltan', () => {
  const papeleta = usoDe('papeleta')!;
  const problemas = problemasDePlantilla(papeleta, plantilla([texto('Hola {{nombr}}'), { tipo: 'fijo', clave: 'recibo' }], { asunto: 'Papeleta {{anio}}' }));
  assert.ok(problemas.includes('Este correo no tiene el dato «nombr»: quítalo del texto.'));
  assert.ok(problemas.includes('Este correo no tiene el bloque «recibo»: quítalo.'));
  assert.ok(problemas.some((p) => p.startsWith('Falta un bloque que no puede faltar')));
  const dosVeces = problemasDePlantilla(papeleta, plantilla([{ tipo: 'fijo', clave: 'papeleta' }, { tipo: 'fijo', clave: 'papeleta' }]));
  assert.ok(dosVeces.some((p) => p.endsWith('está puesto 2 veces: va una sola.')), dosVeces.join(' | '));
  assert.deepEqual(problemasDePlantilla(papeleta, plantilla([{ tipo: 'separador' }], { asunto: ' ', titulo: '' })).slice(0, 3), ['Falta el asunto.', 'Falta el título.', 'Falta el texto.']);

  // Los campos se buscan en todas partes: el resumen, el botón, el título de un recuadro, el pie de una foto.
  const pesame = usoDe('pesame')!;
  const escondidos = problemasDePlantilla(pesame, plantilla([
    { tipo: 'recuadro', titulo: '{{uno}}', piezas: [] }, { tipo: 'boton', texto: '{{dos}}', enlace: '/' },
    { tipo: 'foto', src: `/storage/public/${'a'.repeat(32)}.webp`, alt: '', pie: '{{tres}}' },
  ], { resumen: '{{cuatro}}' }));
  for (const c of ['uno', 'dos', 'tres', 'cuatro']) assert.ok(escondidos.includes(`Este correo no tiene el dato «${c}»: quítalo del texto.`), c);
});

test('componer: campos rellenos y escapados, bloques en su sitio, firma del cargo y asunto en texto', () => {
  const pesame = usoDe('pesame')!;
  const { asunto, html } = componer(pesame, dePlantillaDeTexto({
    asunto: 'Pésame por {{difunto}}', titulo: 'En memoria', cuerpo: 'Por **{{difunto}}**, {{hermano}}.\n\n<script>alert(1)</script>', despedida: 'Descanse en paz.',
  }), { campos: { difunto: "José O'Brien <b>", hermano: 'hermano' } });
  assert.equal(asunto, "Pésame por José O'Brien <b>", 'el asunto es texto: no se escapa');
  assert.match(html, /Por <strong>José O&#39;Brien &lt;b&gt;<\/strong>, hermano\./);
  assert.ok(!html.includes('<script>'), 'lo que escribe Secretaría no entra como HTML');
  assert.match(html, /Descanse en paz\./);
  assert.match(html, /La Secretaría/);

  const corporacion = componer(pesame, dePlantillaDeTexto({
    asunto: 'x', titulo: 'x',
    cuerpo: 'Bienvenido {{a_la_corporacion}}. Gracias por confiar en {{nuestra_corporacion}}; los datos {{de_la_corporacion_corto}}.',
    despedida: '',
  })).html;
  assert.ok(corporacion.includes(`Bienvenido ${aLaCorporacion()}. Gracias por confiar en ${nuestraCorporacion()}; los datos ${deLaCorporacion({ corto: true })}.`));

  const tienda = usoDe('pedido_tienda')!;
  const conBloque = componer(tienda, tienda.porDefecto, { campos: { nombre: 'Ana', numero: 7 }, bloques: { lineas: '<table id="lineas"></table>' } }).html;
  assert.match(conBloque, /<table id="lineas"><\/table>/);
  assert.match(conBloque, /pedido n\.º 7/);
});

test('el resumen del buzón es el escrito o, sin él, el primer párrafo que no es el saludo', () => {
  const campos = { saludo: 'Estimado Juan:', anio: '2027' };
  const contenido = leerCuerpo('{{saludo}}\n\nYa está **abierta** la solicitud de {{anio}}.');
  assert.equal(resumenDe({ resumen: '', contenido }, campos), 'Ya está abierta la solicitud de 2027.');
  assert.equal(resumenDe({ resumen: 'Abrimos el plazo de {{anio}}', contenido }, campos), 'Abrimos el plazo de 2027');
});

test('las piezas nuevas: botón, foto, oración, separador y enlaces, cada una con su forma y escapada', () => {
  const pesame = usoDe('pesame')!;
  const foto = `/storage/public/${'b'.repeat(32)}.webp`;
  const { html } = componer(pesame, plantilla([
    { tipo: 'parrafo', trozos: [{ texto: 'Lea ' }, { texto: 'la normativa', cursiva: true, enlace: '/normativa?a=1&b=2' }, { texto: ' o ' }, { texto: 'esto', enlace: 'javascript:alert(1)' }] },
    { tipo: 'oracion', trozos: [{ texto: 'Dale, Señor, el descanso eterno.' }] },
    { tipo: 'separador' },
    { tipo: 'foto', src: foto, alt: 'El trono "en" la calle', pie: 'Salida de {{difunto}}' },
    { tipo: 'foto', src: '/storage/public/../../.env', alt: 'x', pie: '' },
    { tipo: 'boton', texto: 'Ver la agenda', enlace: '/agenda' },
  ]), { campos: { difunto: 'José' } });
  assert.match(html, /<a href="http[^"]+\/normativa\?a=1&amp;b=2"[^>]*><em>la normativa<\/em><\/a>/, 'el enlace de la web, con su dominio y escapado');
  assert.ok(!html.includes('javascript:'), 'un enlace que no vale se queda en texto');
  assert.match(html, /text-align: center;[^>]*>Dale, Señor, el descanso eterno\.<\/p>/);
  assert.match(html, new RegExp(`src="cid:foto-${'b'.repeat(32)}\\.webp@subida" alt="El trono &quot;en&quot; la calle"`));
  assert.match(html, /Salida de José/);
  assert.ok(!html.includes('.env'), 'una ruta que no es una subida no se pinta');
  assert.match(html, /href="http[^"]+\/agenda"[^>]*>Ver la agenda/);

  // La vista previa del CMS enseña las fotos por su ruta pública.
  const previa = PlantillasCorreoService.vistaPrevia('pesame', plantilla([{ tipo: 'foto', src: foto, alt: '', pie: '' }]));
  assert.ok(previa.html.includes(`src="${foto}"`));
  assert.deepEqual(previa.avisos, ['La foto no tiene descripción: quien no cargue imágenes verá un hueco.']);
});

test('enlaces que valen: páginas de la web, https y correos; nada de javascript ni de http', () => {
  for (const e of ['/', '/hermanos/perfil', 'https://maps.google.com/?q=1', 'mailto:secretaria@ejemplo.es']) assert.ok(enlaceValido(e), e);
  for (const e of ['javascript:alert(1)', 'http://inseguro.es', '//otra.web', 'data:text/html,x', '', 'hermanos']) assert.ok(!enlaceValido(e), e);
});

test('lo que se guarda va limpio: sin claves de más, recortado y sin trozos vacíos', () => {
  const sucia = { asunto: ' A ', resumen: ' ', titulo: 'T ', despedida: '', contenido: [
    { tipo: 'parrafo', trozos: [{ texto: '' }, { texto: 'Hola', negrita: false, cursiva: true, estilo: 'color:red' }] },
    { tipo: 'boton', texto: ' Ir ', enlace: ' /agenda ', onclick: 'x' },
  ] } as unknown as PlantillaDeCorreo;
  assert.deepEqual(plantillaLimpia(sucia), { asunto: 'A', resumen: '', titulo: 'T', despedida: '', contenido: [
    { tipo: 'parrafo', trozos: [{ texto: 'Hola', cursiva: true }] },
    { tipo: 'boton', texto: 'Ir', enlace: '/agenda' },
  ] });
  assert.deepEqual(avisosDePlantilla(plantilla([texto('x')], { asunto: 'a'.repeat(61) })), ['El asunto pasa de 60 letras: en el móvil se corta.']);
});

test('una plantilla libre llega al editor del boletín en el HTML que ese editor entiende', () => {
  const html = cuerpoParaElEditor([
    { tipo: 'parrafo', trozos: [{ texto: 'Hola <b>', cursiva: true }] },
    { tipo: 'recuadro', titulo: 'Aviso', piezas: [texto('Dentro')] },
    { tipo: 'boton', texto: 'Ir', enlace: '/agenda' },
    { tipo: 'separador' },
  ]);
  assert.equal(html, '<p><em>Hola &lt;b&gt;</em></p><p><strong>Aviso</strong></p><p>Dentro</p><p><a href="/agenda">Ir</a></p>');
});

// La vista previa la miran quienes escriben la plantilla: si los campos de la
// corporación salieran del `ejemplo` fijo del catálogo, otra instalación vería
// «al Grupo Parroquial» en su propio correo, y {{grupo}} y {{titular}}, que no
// tienen ejemplo, saldrían vacíos.
test('la vista previa rellena los campos de la corporación con la identidad de la instalación', () => {
  const deEjemplo = dePlantillaDeTexto({ asunto: '{{grupo}}', titulo: 'Bienvenido {{a_la_corporacion}}', cuerpo: 'Hola, {{nombre}}.', despedida: 'Que {{titular}} le guarde.' });
  const previa = PlantillasCorreoService.vistaPrevia('alta_aprobada', deEjemplo);
  assert.equal(previa.asunto, identidad.nombre);
  assert.ok(previa.html.includes(`Bienvenido ${aLaCorporacion()}`));
  assert.ok(previa.html.includes(`Que ${identidad.titular} le guarde.`), 'la titular no puede salir vacía');
  assert.match(previa.html, /Hola, Juan\./, 'los campos propios del uso siguen con su ejemplo');

  const hermandad: Identidad = { ...identidad, nombre: 'Hermandad de la Vera Cruz', tipo: 'Hermandad', tipoCorto: 'Hermandad', articulo: 'la', titular: 'Nuestro Padre Jesús de la Vera Cruz', descripcion: 'Hermandad de ejemplo, para las pruebas.' };
  const otra = PlantillasCorreoService.vistaPrevia('alta_aprobada', deEjemplo, hermandad);
  assert.equal(otra.asunto, 'Hermandad de la Vera Cruz');
  assert.match(otra.html, /Bienvenido a la Hermandad/);
  assert.ok(otra.html.includes('Que Nuestro Padre Jesús de la Vera Cruz le guarde.'));
  assert.doesNotMatch(otra.html, /Grupo/);
});

// Una vista previa que titula «Rosario vespertino» y luego habla «del Sábado
// de Pasión» hace dudar a quien la revisa de si el campo está bien puesto.
test('los ejemplos de los campos de la salida hablan de la misma salida', () => {
  for (const uso of USOS) {
    const ejemplo = (clave: string) => uso.campos.find((c) => c.clave === clave)?.ejemplo;
    const salida = ejemplo('salida');
    if (!salida) continue;
    for (const clave of ['de_la_salida', 'la_salida']) {
      const valor = ejemplo(clave);
      if (valor !== undefined) assert.ok(valor.endsWith(` ${salida}`), `${uso.clave}: ${clave} «${valor}» no es «${salida}»`);
    }
  }
});

// La dirección de Secretaría estaba escrita dos veces en instalacion/datos-entidad.json
// (en `secretaria` y en `sede`); ahora sale solo de la sede.
test('la dirección de Secretaría es la de la sede, en una línea', () => {
  assert.equal(direccionDeLaSede({ nombre: 'Iglesia', calle: 'C. Mayor, 3', codigoPostal: '29006', localidad: 'Málaga' }), 'C. Mayor, 3, 29006 Málaga');
  assert.equal(direccionDeLaSede({ nombre: null, calle: 'C. Mayor, 3', codigoPostal: null, localidad: 'Málaga' }), 'C. Mayor, 3, Málaga');
  assert.equal(direccionDeLaSede({ nombre: 'Iglesia', calle: null, codigoPostal: '29006', localidad: 'Málaga' }), null, 'sin calle no hay dirección');
  assert.match(String(secretaria.direccion), /\b\d{5}\b/, 'el código postal sigue ahí: de él sale la provincia del Modelo 182');
});

test('el escudo del membrete: 56 de alto y el ancho que pida su proporción', () => {
  // Cerrojo: el de partida (246×300) y el de Desamparados (245×300) salen a
  // 46×56, como cuando la medida estaba escrita a mano.
  assert.deepEqual(medidaDelEscudo({ ancho: 246, alto: 300 }), { ancho: 46, alto: 56 });
  assert.deepEqual(medidaDelEscudo({ ancho: 245, alto: 300 }), { ancho: 46, alto: 56 });
  // Uno cuadrado o apaisado no se deforma: el alto se queda y el ancho crece.
  assert.deepEqual(medidaDelEscudo({ ancho: 512, alto: 512 }), { ancho: 56, alto: 56 });
  assert.deepEqual(medidaDelEscudo({ ancho: 400, alto: 200 }), { ancho: 112, alto: 56 });
  assert.deepEqual(medidaDelEscudo({ ancho: 200, alto: 240 }), { ancho: 47, alto: 56 });

  const html = maquetar({ titulo: 'Prueba', antetitulo: 'Secretaría', resumen: 'Prueba', contenido: '<p>Hola.</p>' });
  assert.match(html, /src="cid:escudo@marca"[^>]* width="46" height="56" style="[^"]*width: 46px; height: 56px;/);
});

test('la tabla de importes escapa lo que viene de la base y cierra con el total', () => {
  const html = tablaDeImportes([{ concepto: 'Cuota <2027>', detalle: 'Juan "el" Pérez · cuenta ES12•• 3456', importe: '30,00 €' }], '30,00 €');
  assert.ok(html.includes('Cuota &lt;2027&gt;'));
  assert.ok(html.includes('Juan &quot;el&quot; Pérez'));
  assert.match(html, /Total[\s\S]*30,00 €/);
});
