// La instalación de mentira: con una identidad «la Hermandad» en vez de «el
// Grupo Parroquial» (instalacion/datos-entidad.json), los textos que antes se
// escribían a mano tienen que seguir leyéndose bien y sin rastro de «Grupo».
//
// Las funciones de domain/articulos.ts ya se prueban contra
// shared/casos-articulos.json (test/articulos.test.ts); aquí se comprueban
// los sitios donde se montan textos enteros: el pie de los correos, dos
// correos que ya salen de una plantilla (alta aprobada y pésame), la
// portada del Informe anual, la papeleta de sitio y el acta de un cabildo.
// Y una segunda instalación en plural («las Cofradías Fusionadas»), porque el
// artículo también dice el número y los verbos tienen que concordar con él.
//
// `pie`, `maquetar`, `componer`, `textosPortada`, `textosDeLaPapeleta`,
// `aperturaDelActa` y `entradilla` aceptan la identidad por
// parámetro (con la de esta instalación por defecto) solo para esto: ningún
// sitio de producción la pasa.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as OTPAuth from 'otpauth';
import { identidad, type Identidad } from '../src/domain/datos-entidad.js';
import { nuestraCorporacion } from '../src/domain/articulos.js';
import { maquetar, pie } from '../src/services/correos/plantilla.js';
import { componer, usoObligado } from '../src/services/correos/componer.js';
import { usoDe } from '../src/domain/plantillas-correo.js';
import { textosPortada } from '../src/services/informes/informes.js';
import { textosDeLaPapeleta } from '../src/services/procesion/papeleta-pdf.js';
import { aperturaDelActa } from '../src/services/informes/actas.js';
import { totpDeLaCuenta } from '../src/services/doble-factor.service.js';
import { entradilla, enTexto } from '../src/domain/entradillas.js';
import { periodoDe } from '../src/domain/periodo-datos.js';
import type { DatosCrudos } from '../src/domain/datos-areas.js';

/** Una instalación que no es la de Desamparados: para que no cuele un «Grupo» escrito a mano. */
const HERMANDAD: Identidad = {
  nombre: 'Hermandad de la Vera Cruz', nombreCorto: 'Vera Cruz',
  tipo: 'Hermandad', tipoCorto: 'Hermandad', articulo: 'la',
  titulares: ['Nuestro Padre Jesús de la Vera Cruz'], titular: 'Nuestro Padre Jesús de la Vera Cruz', localidad: 'Sevilla',
  dominio: 'www.veracruz.ejemplo', descripcion: 'Hermandad de ejemplo, para las pruebas.',
  denominacion: null, domicilio: null, normas: null,
};

/** Ninguno de los textos que nombran la corporación puede decir «Grupo». */
const sinGrupo = (texto: string) => assert.doesNotMatch(texto, /Grupo/, texto);

describe('el pie de los correos', () => {
  test('el aviso interno dice «de la Hermandad»', () => {
    const texto = pie('interno', HERMANDAD);
    assert.match(texto, /Aviso automático de la web de la Hermandad para el buzón de Secretaría\./);
    sinGrupo(texto);
  });

  test('el de un hermano dice «la Hermandad»', () => {
    const texto = pie('hermano', HERMANDAD);
    assert.match(texto, /Recibe este correo por su relación con la Hermandad,/);
    sinGrupo(texto);
  });
});

describe('dos correos que ya salen de una plantilla', () => {
  test('alta aprobada: «a la Hermandad» en el título y «de la Hermandad» en el cuerpo', () => {
    const uso = usoObligado('alta_aprobada');
    const { html } = componer(uso, uso.porDefecto, {
      campos: { saludo: 'Estimado Juan:', nombre: 'Juan', bienvenido: 'Bienvenido', forma_parte: 'forma parte' },
      bloques: { censo: '<table id="censo"></table>', boton: '' },
      identidad: HERMANDAD,
    });
    assert.match(html, /Bienvenido a la Hermandad/);
    assert.match(html, /forma parte del censo de hermanos de la Hermandad/);
    sinGrupo(html);
  });

  test('pésame: «la Hermandad» acompaña, sin ser el sujeto (así no depende del número)', () => {
    const uso = usoDe('pesame')!;
    const { html } = componer(uso, uso.porDefecto, {
      campos: { difunto: 'Antonio Ruiz', hermano: 'hermano' },
      identidad: HERMANDAD,
    });
    assert.match(html, /les acompañamos desde la Hermandad por el fallecimiento/);
    sinGrupo(html);
  });

  test('la maqueta entera (escudo, firma y pie de página) también deja de decir «Grupo»', () => {
    const html = maquetar({
      titulo: 'Prueba', antetitulo: 'Prueba', resumen: 'Prueba', contenido: '<p>Hola.</p>', identidad: HERMANDAD,
    });
    assert.match(html, /Escudo de la Hermandad/, 'el alt del escudo');
    assert.match(html, />Hermandad</, 'el rótulo bajo el escudo: identidad.tipo');
    assert.match(html, /Hermandad de la Vera Cruz &middot; Sevilla/, 'el pie con copyright');
    sinGrupo(html);
  });
});

describe('la portada del Informe anual', () => {
  // pdfkit comprime el contenido del PDF: no se puede leer el texto del
  // buffer, así que se prueba la función pura que calcula esos textos
  // (domain/articulos.ts ya prueba laCorporacion y compañía por su cuenta).
  test('dice «de la Hermandad», no «del Grupo Parroquial»', () => {
    const t = textosPortada(HERMANDAD);
    assert.equal(t.tipo, 'de la Hermandad');
    assert.equal(t.localidad, 'Sevilla');
    sinGrupo(t.tipo);
  });
});

test('la forma «nuestra Hermandad», la que usan las despedidas de las plantillas', () => {
  assert.equal(nuestraCorporacion({ identidad: HERMANDAD }), 'nuestra Hermandad');
});

// pdfkit comprime el contenido (ver la portada del Informe anual): la papeleta
// y el acta se prueban por las funciones puras que calculan sus textos.
describe('la papeleta de sitio en PDF', () => {
  test('la expide «Secretaría de la Hermandad», con la cabecera de la Hermandad', () => {
    const t = textosDeLaPapeleta(HERMANDAD);
    assert.equal(t.expide, 'Secretaría de la Hermandad');
    assert.equal(t.titular, 'Nuestro Padre Jesús de la Vera Cruz');
    assert.equal(t.localidad, 'Sevilla');
    for (const texto of Object.values(t)) sinGrupo(texto);
  });
});

describe('el acta de un cabildo', () => {
  test('abre con el cabildo «de hermanos de la Hermandad…»', () => {
    const texto = aperturaDelActa({ tipo: 'ORDINARIO', fecha: new Date('2026-10-15T16:30:00Z'), lugar: 'Casa de Hermandad', enSegunda: false }, HERMANDAD);
    assert.match(texto, /el cabildo ordinario de hermanos de la Hermandad de la Vera Cruz\. Lugar: Casa de Hermandad\.$/);
    sinGrupo(texto);
  });
});

describe('el doble factor', () => {
  // Lo que la app de autenticación del móvil enseña junto al código: antes
  // decía «Cofradía Virtual», escrito a mano (y con una palabra que la web no
  // usa para la corporación).
  test('la app de autenticación la nombra por su nombre corto', () => {
    const totp = totpDeLaCuenta('ana@ejemplo.es', new OTPAuth.Secret({ size: 20 }), HERMANDAD);
    assert.equal(totp.issuer, 'Vera Cruz');
    assert.match(totp.toString(), /^otpauth:\/\/totp\/Vera%20Cruz:ana%40ejemplo\.es\?issuer=Vera%20Cruz&/);
  });
  test('la de esta instalación, por su nombre corto', () => {
    assert.equal(totpDeLaCuenta('ana@ejemplo.es', new OTPAuth.Secret({ size: 20 })).issuer, identidad.nombreCorto);
  });
});

/** Una corporación en plural: el artículo «las» pide los verbos en plural. */
const COFRADIAS: Identidad = {
  nombre: 'Cofradías Fusionadas de Málaga', nombreCorto: 'Fusionadas',
  tipo: 'Cofradías Fusionadas', tipoCorto: 'Cofradías', articulo: 'las',
  titulares: ['Santísimo Cristo de la Columna'], titular: 'Santísimo Cristo de la Columna', localidad: 'Málaga',
  dominio: 'www.fusionadas.ejemplo', descripcion: 'Cofradías de ejemplo, para las pruebas.',
  denominacion: null, domicilio: null, normas: null,
};

describe('una corporación en plural', () => {
  test('el pie de los correos: «las Cofradías Fusionadas, que tratan sus datos»', () => {
    const texto = pie('hermano', COFRADIAS);
    assert.match(texto, /su relación con las Cofradías Fusionadas, que tratan sus datos/);
    sinGrupo(texto);
  });

  // Solo las áreas que nombran la corporación como sujeto: lo demás de
  // DatosCrudos no se lee, de ahí el `as`.
  const HOY = new Date('2026-09-29T12:00:00Z');
  const crudos = {
    hermanos: { activos: 228, activosAlEmpezar: 133, altas: 0, bajas: 0, porMes: [], edadMedia: null, menores: 0 },
    inventario: { enseres: [{ nombre: 'Candelería', optimo: 24, bueno: 6, reparar: 4, total: 34 }], prendas: [] },
  } as unknown as DatosCrudos;

  test('las plantillas de correo no ponen a la corporación de sujeto: valen igual en plural', () => {
    const certificado = usoDe('certificado_donativos')!;
    const { html: cert } = componer(certificado, certificado.porDefecto, { campos: { nombre: 'Ana', ejercicio: '2025', importe: '50,00 €' }, identidad: COFRADIAS });
    assert.match(cert, /la declaración que presentamos a Hacienda/);
    const pesame = usoDe('pesame')!;
    const { html: pes } = componer(pesame, pesame.porDefecto, { campos: { difunto: 'Antonio Ruiz', hermano: 'hermano' }, identidad: COFRADIAS });
    assert.match(pes, /les acompañamos desde las Cofradías Fusionadas por el fallecimiento/);
    const sufragio = usoDe('sufragio')!;
    const { html: suf } = componer(sufragio, sufragio.porDefecto, {
      campos: { difunto: 'Antonio Ruiz', que: 'Misa', que_minusculas: 'misa' }, bloques: { cuando: '<table id="cuando"></table>' }, identidad: COFRADIAS,
    });
    assert.match(suf, /Les comunicamos que desde las Cofradías Fusionadas ofreceremos una/);
    sinGrupo(cert + pes + suf);
  });

  test('las entradillas: «las Cofradías cuentan con» y «Las Cofradías guardan»', () => {
    const hermanos = enTexto(entradilla('hermanos', crudos, periodoDe(2025, HOY), HOY, COFRADIAS));
    assert.match(hermanos, /^Al cierre de 2025, las Cofradías cuentan con 228 hermanos/);
    const inventario = enTexto(entradilla('inventario', crudos, periodoDe(2025, HOY), HOY, COFRADIAS));
    assert.match(inventario, /^Las Cofradías guardan 34 piezas/);
    sinGrupo(hermanos + inventario);
  });
});
