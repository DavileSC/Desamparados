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

/** Sistema → Datos de la corporación: todo de una vez, como lo enseña la pantalla. */
export const corporacionSchema = type({
  body: {
    secretaria: { horario: texto(120), telefono: texto(30), email: correo },
    sede: { nombre: texto(120), calle: texto(160), codigoPostal: texto(10), localidad: texto(80) },
    redes: { facebook: enlace, instagram: enlace, x: enlace, tiktok: enlace, youtube: enlace },
    privacidad: { emailDerechos: correo },
  },
});
