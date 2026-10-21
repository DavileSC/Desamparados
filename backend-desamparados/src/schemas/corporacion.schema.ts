import { type } from 'arktype';

// Vacío es «pendiente»: se guarda null y la web y los correos omiten el dato
// en vez de inventarlo. Por eso todos admiten null.
const texto = (max: number) => type('string').pipe((v) => v.trim()).to(`string <= ${max}`).pipe((v) => v || null).or('null');
const correo = type('string').pipe((v) => v.trim())
  .narrow((v, ctx) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || ctx.mustBe('un correo como secretaria@ejemplo.es'))
  .to('string <= 254').pipe((v) => v || null).or('null');
const enlace = type('string').pipe((v) => v.trim())
  .narrow((v, ctx) => v === '' || /^https:\/\/\S+$/.test(v) || ctx.mustBe('una dirección que empiece por https://'))
  .to('string <= 300').pipe((v) => v || null).or('null');

// El teléfono se guarda sin el prefijo de España: la web lo antepone en los
// datos estructurados («+34 952…») y, escrito con él, salía dos veces. Uno de
// fuera conserva su «+» y la web lo deja como está. Solo cifras, espacios,
// guiones, puntos y paréntesis, con entre 6 y 15 cifras.
const PREFIJO_ESPANA = /^(?:\+|00)\s*34[\s.-]*/;
const telefono = type('string').pipe((v) => v.trim().replace(PREFIJO_ESPANA, ''))
  .narrow((v, ctx) => {
    if (v === '') return true;
    const cifras = v.replace(/\D/g, '').length;
    return (/^\+?[\d\s().-]+$/.test(v) && cifras >= 6 && cifras <= 15)
      || ctx.mustBe('un teléfono con sus cifras (y si acaso espacios, guiones o puntos), como 952 123 456');
  })
  .to('string <= 30').pipe((v) => v || null).or('null');

/** Sistema → Datos de la corporación: todo de una vez, como lo enseña la pantalla. */
export const corporacionSchema = type({
  body: {
    secretaria: { horario: texto(120), telefono, email: correo },
    sede: { nombre: texto(120), calle: texto(160), codigoPostal: texto(10), localidad: texto(80) },
    redes: { facebook: enlace, instagram: enlace, x: enlace, tiktok: enlace, youtube: enlace },
    privacidad: { emailDerechos: correo },
  },
});

// La identidad, con las reglas del fichero de la instalación
// (shared/datos-entidad.mjs): lo obligatorio no puede ir vacío, y lo pendiente
// (denominación, domicilio, normas) vacío es null y su apartado no sale.
const obligatorio = (max: number) => type('string').pipe((v) => v.trim()).to(`0 < string <= ${max}`);
const enlaceObligatorio = type('string').pipe((v) => v.trim())
  .narrow((v, ctx) => /^https:\/\/\S+$/.test(v) || ctx.mustBe('una dirección que empiece por https://'))
  .to('string <= 300');
const color = type('string').pipe((v) => v.trim().toLowerCase())
  .narrow((v, ctx) => v === '' || /^#[0-9a-f]{6}$/.test(v) || ctx.mustBe('un color #rrggbb, como #6e1822'))
  .pipe((v) => v || null).or('null');

/** Sistema → Datos de la corporación → Identidad y marca: el nombre y los colores. Las imágenes van una a una. */
export const identidadSchema = type({
  body: {
    identidad: {
      nombre: obligatorio(160),
      nombreCorto: obligatorio(40),
      tipo: obligatorio(60),
      tipoCorto: obligatorio(40),
      articulo: "'el' | 'la' | 'los' | 'las'",
      titulares: obligatorio(160).array().atLeastLength(1).atMostLength(6),
      localidad: obligatorio(80),
      descripcion: obligatorio(300),
      denominacion: texto(240),
      domicilio: texto(200),
      normas: type({ titulo: obligatorio(160), url: enlaceObligatorio }).or('null'),
    },
    colores: { colorPrincipal: color, colorAcento: color },
  },
});

/** Qué imagen se sube o se quita: los iconos no, salen del escudo sobre oscuro. */
export const imagenDeMarcaSchema = type({
  params: { clave: "'escudoSobreOscuro' | 'escudoSobreClaro' | 'escudoDestacado' | 'compartir' | 'correoCabecera'" },
});
