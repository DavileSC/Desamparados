import lista from '../../../shared/ficha-obligatoria.json' with { type: 'json' };

/**
 * Lo que una ficha no puede tener vacío para darla por revisada en el primer
 * acceso. Es lo mismo que pide el alta por la web: quien entró con el censo
 * importado tiene que acabar con la ficha que habría hecho al darse de alta.
 * La lista vive en `shared/ficha-obligatoria.json` y la lee también la web,
 * que pide justo esos campos.
 */
export interface CampoObligatorio {
  campo: string;
  etiqueta: string;
}

/** Los campos de la ficha que mira la comprobación, con los nombres de la tabla. */
export interface FichaQueSeRevisa {
  esTitular: boolean;
  nombre: string;
  apellidos: string;
  primerApellido: string | null;
  dni: string | null;
  fechaNacimiento: Date | null;
  sexo: string | null;
  estadoCivil: string | null;
  fechaBautismo: Date | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  codigoPostal: string | null;
  poblacion: string | null;
  parentesco: string | null;
  formaPagoPref: string;
  iban: string | null;
  titularidadCuenta: string | null;
  titularCuenta: string | null;
}

const vacio = (valor: unknown) => valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '');

/**
 * Los obligatorios que le faltan. La cuota solo cuenta con las cuotas en
 * línea encendidas: sin ellas, el hermano no tiene dónde rellenarla.
 */
export function faltanEnLaFicha(ficha: FichaQueSeRevisa, conCuotas: boolean): CampoObligatorio[] {
  // Las fichas de antes de separar los apellidos solo tienen los dos juntos.
  const valores: Record<string, unknown> = { ...ficha, primerApellido: ficha.primerApellido ?? ficha.apellidos };
  const faltan = (ficha.esTitular ? lista.titular : lista.familiar).filter((c) => vacio(valores[c.campo]));
  if (ficha.esTitular && conCuotas && ficha.formaPagoPref === 'DOMICILIACION') {
    faltan.push(...lista.domiciliacion.filter((c) => vacio(valores[c.campo])));
    if (ficha.titularidadCuenta && ficha.titularidadCuenta !== 'PROPIA' && vacio(ficha.titularCuenta)) {
      faltan.push({ campo: 'titularCuenta', etiqueta: 'Titular de la cuenta', tipo: 'texto' });
    }
  }
  return faltan.map(({ campo, etiqueta }) => ({ campo, etiqueta }));
}

/** «teléfono móvil y estado civil»: para decirlo en una frase. «DNI» se queda en mayúsculas. */
export function enUnaFrase(campos: CampoObligatorio[]): string {
  const nombres = campos.map(({ etiqueta }) => (/^[A-ZÁÉÍÓÚ]{2}/.test(etiqueta) ? etiqueta : etiqueta.charAt(0).toLowerCase() + etiqueta.slice(1)));
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join('');
}
