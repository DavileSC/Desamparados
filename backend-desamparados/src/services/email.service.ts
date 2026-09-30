/**
 * Los correos que manda la casa: recuperar la contraseña, la papeleta de
 * sitio, la confirmación de un alta, el aviso a Secretaría de una solicitud
 * nueva, su aprobación o rechazo, la baja, la apertura de las papeletas, el
 * recordatorio de una papeleta sin recoger y el formulario de contacto.
 *
 * Cómo se maquetan está en `correos/plantilla` y por dónde salen en
 * `correos/envio`: aquí solo queda lo que dice cada correo.
 *
 * Criterio común: asuntos sin emojis y en minúscula normal, saludo según el
 * sexo de la ficha, firma del cargo y nada que el Grupo no haya confirmado.
 */
import type { Salida } from '@prisma/client';
import { DatosPapeleta } from '../dtos/email.dto';
import { ContactoDto } from '../dtos/contacto.dto';
import {
  COLORES, bloqueDeSecretaria, boton, cita, datos, esc, firma, lista, maquetar, rotulo,
  parrafo, recuadro, saludo, segunSexo, urlDeLaWeb, type Sexo,
} from './correos/plantilla.js';
import { cuentaDeContacto, enviarCorreo } from './correos/envio.js';
import { identidad } from '../domain/datos-entidad.js';

/** Quien entra en el censo al aprobar la solicitud, con el número que recibe. */
export interface HermanoAprobado { nombre: string; apellidos: string | null; numeroHermano: number }

const BENDICION = `Que ${identidad.titular} le guarde y bendiga.`;

/** «una hora», «3 días», «12 horas». */
function plazo(horas: number): string {
  if (horas === 1) return 'una hora';
  if (horas % 24 === 0) return horas === 24 ? 'un día' : `${horas / 24} días`;
  return `${horas} horas`;
}

export class EmailService {

  /**
   * El enlace para elegir contraseña. Sirve para dos cosas: recuperar la que
   * se olvidó (una hora de validez) y estrenar la cuenta propia de quien se
   * emancipa de la de su familia (72 horas).
   */
  static async enviarRecuperacionContrasena(
    emailDestino: string, nombreHermano: string, token: string,
    opciones: { horas?: number; cuentaNueva?: boolean; sexo?: Sexo } = {},
  ) {
    const { horas = 1, cuentaNueva = false, sexo } = opciones;
    const enlace = urlDeLaWeb(`/reset-password?token=${encodeURIComponent(token)}`);

    const content = cuentaNueva
      ? [
        saludo(nombreHermano, sexo),
        parrafo('La Secretaría le ha creado una <strong>cuenta propia en el área de hermanos</strong>, separada de la de su familia. Para entrar por primera vez, elija su contraseña:'),
        boton('Crear mi contraseña', enlace),
        parrafo(`El enlace caduca en ${plazo(horas)} y solo puede usarse una vez. Si caduca, pida uno nuevo desde «He olvidado mi contraseña».`),
        firma(null),
      ].join('')
      : [
        saludo(nombreHermano, sexo),
        parrafo('Hemos recibido una petición para restablecer la contraseña de su cuenta en el área de hermanos. Para elegir una nueva, pulse el botón:'),
        boton('Elegir una contraseña nueva', enlace),
        parrafo(`El enlace caduca en ${plazo(horas)} y solo puede usarse una vez.`),
        recuadro(null, 'Si no ha pedido este cambio, puede ignorar este correo: su contraseña actual sigue funcionando y nadie más ha visto este enlace.'),
        firma(null),
      ].join('');

    const titulo = cuentaNueva ? 'Su cuenta en el área de hermanos' : 'Restablecer su contraseña';
    return await enviarCorreo(emailDestino, cuentaNueva ? titulo : 'Restablecer su contraseña del área de hermanos', maquetar({
      titulo,
      antetitulo: 'Área de hermanos',
      resumen: cuentaNueva ? `Elija su contraseña para entrar. El enlace vale ${plazo(horas)}.` : `Enlace para elegir una contraseña nueva, válido ${plazo(horas)}.`,
      contenido: content,
    }));
  }

  /**
   * La papeleta, cuando se recoge en la mesa (en la Pasión, con la ropa; en
   * el Rosario, con el puesto confirmado). Sin QR: el que llevaba solo
   * decía «año-nombre», cualquiera podía fabricarlo y nadie lo escaneaba. Lo
   * que identifica la papeleta en Secretaría es su número.
   */
  static async enviarPapeleta(emailDestino: string, nombreHermano: string, datosPapeleta: DatosPapeleta, sexo?: Sexo) {
    const { negro, burdeos, linea, sobreNegro } = COLORES;
    const rosario = datosPapeleta.salida === 'ROSARIO';
    const nombrePapeleta = rosario ? 'Rosario vespertino' : 'Papeleta de sitio';
    const referencia = datosPapeleta.papeletaId ? `${datosPapeleta.year}-${String(datosPapeleta.papeletaId).padStart(4, '0')}` : null;
    const celda = (titulo: string, valor: string, columnas = 1) =>
      `<td ${columnas === 2 ? 'colspan="2"' : 'width="50%"'} valign="top" style="padding: 12px 20px; border-top: 1px solid ${linea};">${rotulo(titulo)}<br><span style="font-size: 16px;">${esc(valor)}</span></td>`;

    const filasExtra = [
      datosPapeleta.tunica ? celda('Túnica', datosPapeleta.tunica) : '',
      datosPapeleta.importe ? celda(rosario ? 'Donativo' : 'Limosna abonada', datosPapeleta.importe) : '',
    ].filter(Boolean);

    // Como la de papel: recuadro negro, cabecera con el año y el número, el
    // puesto grande y los datos en rejilla.
    const papeleta = `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 8px 0 28px 0; border: 1px solid ${negro};">
        <tr>
          <td colspan="2" bgcolor="${negro}" style="background-color: ${negro}; padding: 11px 20px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr>
              <td style="font-family: Georgia, serif; font-size: 15px; font-style: italic; color: #ffffff;">${nombrePapeleta} ${datosPapeleta.year}</td>
              ${referencia ? `<td align="right" style="font-family: Georgia, serif; font-size: 14px; color: ${sobreNegro};">N.º ${referencia}</td>` : ''}
            </tr></table>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 20px 20px 18px 20px; border-bottom: 3px solid ${burdeos};">
            ${rotulo('Puesto')}<br>
            <span style="font-size: 28px; line-height: 1.25; color: ${burdeos};">${esc(datosPapeleta.puesto) || 'Por asignar'}</span>
            ${datosPapeleta.tramo ? `<br><span style="font-size: 16px;">${esc(datosPapeleta.tramo)}</span>` : ''}
          </td>
        </tr>
        <tr>${celda('Día', datosPapeleta.fechaSalida)}${celda('Hora de entrada', datosPapeleta.horaSalida)}</tr>
        <tr>${celda('Acceso', datosPapeleta.accesoPuerta, 2)}</tr>
        ${filasExtra.length ? `<tr>${filasExtra.join('')}${filasExtra.length === 1 ? `<td style="border-top: 1px solid ${linea};"></td>` : ''}</tr>` : ''}
        ${datosPapeleta.observaciones ? `<tr><td colspan="2" style="padding: 12px 20px; border-top: 1px dashed ${linea};">${rotulo('Observaciones')}<br><span style="font-size: 15px;">${esc(datosPapeleta.observaciones)}</span></td></tr>` : ''}
      </table>`;

    const normativa = process.env.NORMATIVA_URL
      ? parrafo(`Puede consultar la normativa completa de la Estación de Penitencia en <a href="${process.env.NORMATIVA_URL}" style="color: ${burdeos};">este enlace</a>.`)
      : '';

    const content = [
      saludo(nombreHermano, sexo),
      parrafo(rosario
        ? `La Secretaría le confirma su puesto en el Rosario vespertino del <strong>${esc(datosPapeleta.fechaSalida)}</strong>. Estos son los datos de su sitio:`
        : `La Secretaría certifica que está al día con el Grupo Parroquial y le autoriza a realizar la Estación de Penitencia el próximo <strong>${esc(datosPapeleta.fechaSalida)}</strong>. Estos son los datos de su sitio:`),
      papeleta,
      recuadro('Antes de salir', rosario
        ? 'Se va en traje oscuro, con la medalla del Grupo Parroquial. Se ruega puntualidad y recogimiento durante el rezo.'
        : 'Se ruega puntualidad y decoro en la vestimenta. Es obligatorio portar la medalla del Grupo Parroquial y calzado oscuro. Guarde silencio durante la formación.'),
      parrafo('Conserve este correo: puede enseñarlo en el acceso si se le pide.'),
      rosario ? '' : normativa,
      firma(BENDICION),
    ].join('');

    // El asunto es texto, no HTML: con el nombre escapado, «O'Brien» llegaba
    // como «O&#39;Brien». Los saltos de línea los aplana nodemailer.
    const asunto = `${nombrePapeleta} ${datosPapeleta.year}: ${nombreHermano}`;
    return await enviarCorreo(emailDestino, asunto, maquetar({
      titulo: rosario ? `Su puesto en el Rosario vespertino ${datosPapeleta.year}` : `Su papeleta de sitio ${datosPapeleta.year}`,
      antetitulo: rosario ? 'Rosario vespertino' : 'Estación de Penitencia',
      resumen: `${datosPapeleta.puesto || 'Puesto por asignar'} · ${datosPapeleta.fechaSalida}, ${datosPapeleta.horaSalida}.`,
      contenido: content,
    }));
  }

  /**
   * Acuse de la solicitud de ingreso. `certificadoAdjunto`: si subió el
   * certificado de bautismo con el formulario no se le pide otra vez.
   */
  static async enviarConfirmacionRegistro(emailDestino: string, nombreHermano: string, opciones: { sexo?: Sexo; certificadoAdjunto?: boolean } = {}) {
    const { sexo, certificadoAdjunto = false } = opciones;
    const documentos = ['DNI original.'];
    if (!certificadoAdjunto) documentos.push('Certificado de bautismo (copia expedida por su parroquia).');

    const content = [
      saludo(nombreHermano, sexo),
      parrafo('La Secretaría acusa recibo de su <strong>solicitud de ingreso</strong> en nuestro Grupo Parroquial. Le agradecemos de corazón que haya dado este paso.'),
      recuadro('Próximo paso: pasar por Secretaría',
        `Según nuestras Reglas, para completar su alta en el censo de hermanos debe acudir en persona a la Casa del Grupo Parroquial con:${lista(documentos, '10px 0 0 0')}`),
      bloqueDeSecretaria('Atención en Secretaría'),
      parrafo('Mientras tanto, su solicitud queda pendiente. Le escribiremos de nuevo en cuanto la Secretaría la haya revisado.'),
      firma(BENDICION),
    ].join('');

    // Sin escapar: el asunto es texto, no HTML (ver enviarPapeleta).
    return await enviarCorreo(emailDestino, 'Hemos recibido su solicitud de ingreso', maquetar({
      titulo: 'Hemos recibido su solicitud',
      antetitulo: 'Secretaría',
      resumen: 'Para completar el alta, pase por Secretaría con su DNI.',
      contenido: content,
    }));
  }

  /**
   * Aviso al buzón de Secretaría de que ha entrado una solicitud nueva.
   *
   * Antes no existía: una solicitud solo se veía si alguien entraba al CMS y
   * miraba el contador de «Hermanos», así que podía quedarse semanas parada sin
   * que nadie lo supiera.
   *
   * Va al buzón de la corporación (CONTACT_EMAIL_TO, con respaldo en EMAIL_USER)
   * y no a las cuentas personales del staff: el destinatario es el cargo, no la
   * persona que hoy lo ocupa.
   */
  static async enviarAvisoSolicitud(datosSolicitud: { nombre: string; apellidos?: string | null; email: string; fichas?: number }) {
    const destino = process.env.CONTACT_EMAIL_TO || process.env.EMAIL_USER;
    if (!destino) {
      console.error('❌ Aviso de solicitud: ni CONTACT_EMAIL_TO ni EMAIL_USER están configurados.');
      return false;
    }

    const nombreCompleto = [datosSolicitud.nombre, datosSolicitud.apellidos].filter(Boolean).join(' ');
    const filas: [string, string][] = [
      ['Solicitante', esc(nombreCompleto)],
      ['Correo', `<a href="mailto:${esc(datosSolicitud.email)}" style="color: ${COLORES.burdeos};">${esc(datosSolicitud.email)}</a>`],
    ];
    // Un alta puede traer varias personas: el adulto y los menores a su cargo.
    if (datosSolicitud.fichas && datosSolicitud.fichas > 1) {
      filas.push(['Fichas', `${datosSolicitud.fichas} (incluye menores a su cargo)`]);
    }

    const content = [
      parrafo('Ha entrado una <strong>solicitud de ingreso nueva</strong> por la web.'),
      datos(filas),
      parrafo('Queda pendiente hasta que Secretaría la revise. Mientras tanto, la cuenta no puede entrar en el área de hermanos.'),
      boton('Revisar las solicitudes', urlDeLaWeb('/cms/hermanos?vista=solicitudes')),
    ].join('');

    return await enviarCorreo(destino, `Solicitud de ingreso nueva: ${nombreCompleto}`, maquetar({
      titulo: 'Solicitud de ingreso nueva',
      antetitulo: 'Aviso interno · Secretaría',
      resumen: `${nombreCompleto} ha pedido el ingreso por la web.`,
      contenido: content,
      para: 'interno',
    }));
  }

  /**
   * La solicitud ha sido aprobada: ya figuran en el censo y tienen número.
   * Antes aprobar era mudo y el solicitante no se enteraba de nada.
   *
   * Una cuenta puede traer varias fichas (el adulto y los menores a su cargo) y
   * se aprueban todas a la vez: el correo dice quién es cada número, o un padre
   * con tres hijos recibiría tres números sin saber de quién es cada uno.
   */
  static async enviarAprobacionSolicitud(emailDestino: string, nombreCuenta: string, aprobados: HermanoAprobado[], sexo?: Sexo) {
    const { burdeos, linea } = COLORES;
    const varios = aprobados.length > 1;
    const ordenados = [...aprobados].sort((a, b) => a.numeroHermano - b.numeroHermano);

    const filas = ordenados.map((h) => `
        <tr>
          <td style="padding: 11px 16px 11px 0; border-bottom: 1px solid ${linea}; font-size: 16px;">${esc([h.nombre, h.apellidos].filter(Boolean).join(' '))}</td>
          <td align="right" style="padding: 11px 0; border-bottom: 1px solid ${linea}; font-size: 20px; color: ${burdeos}; white-space: nowrap;">N.º ${h.numeroHermano}</td>
        </tr>`).join('');
    const censo = aprobados.length
      ? `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 4px 0 24px 0;">
          <tr>
            <td style="padding: 0 16px 6px 0; border-bottom: 1px solid ${linea};">${rotulo('Nombre y apellidos')}</td>
            <td align="right" style="padding: 0 0 6px 0; border-bottom: 1px solid ${linea};">${rotulo('Número de hermano')}</td>
          </tr>${filas}
        </table>`
      : '';

    const content = [
      saludo(nombreCuenta, sexo),
      parrafo(`La Secretaría ha <strong>aprobado su solicitud de ingreso</strong>. Desde hoy ${varios ? 'forman' : 'forma'} parte del censo de hermanos del Grupo Parroquial:`),
      censo,
      parrafo(`Conserve ${varios ? 'estos números' : 'este número'}: ${varios ? 'son los que identifican a cada uno' : 'es el que le identifica'} en el censo y se ${varios ? 'piden' : 'pide'} en Secretaría.`),
      parrafo('Ya puede entrar en el área de hermanos para consultar sus datos, sus recibos y, llegado el momento, pedir su papeleta de sitio.'),
      boton('Entrar en el área de hermanos', urlDeLaWeb('/acceso')),
      firma(BENDICION),
    ].join('');

    return await enviarCorreo(emailDestino, 'Su solicitud de ingreso ha sido aprobada', maquetar({
      titulo: `${varios ? 'Bienvenidos' : segunSexo(sexo, 'Bienvenido', 'Bienvenida')} al Grupo Parroquial`,
      antetitulo: 'Secretaría',
      resumen: ordenados.map((h) => `${h.nombre}, n.º ${h.numeroHermano}`).join(' · ') || 'Ya figura en el censo de hermanos.',
      contenido: content,
    }));
  }

  /**
   * La solicitud no sale adelante, o se tramita una baja.
   *
   * Sin motivos automáticos a propósito: la decisión la explica Secretaría, y un
   * correo generado no puede dar por escrito una razón que nadie ha redactado.
   * La única excepción es el impago, que Secretaría elige al dar la baja.
   *
   * El asunto NO lleva el nombre. Si el envío falla, `enviarEmailBase` guarda el
   * asunto en la auditoría (EMAIL_FALLIDO), y en un rechazo eso devolvería a la
   * base el nombre que `rechazarSolicitud` acaba de borrar.
   */
  static async enviarBajaORechazo(emailDestino: string, nombreHermano: string, motivo: 'rechazo' | 'baja', porImpago = false, sexo?: Sexo) {
    const esRechazo = motivo === 'rechazo';

    const cuerpo = esRechazo
      ? [
        parrafo('Le comunicamos que la Secretaría <strong>no ha podido dar curso a su solicitud de ingreso</strong>, y que sus datos han sido eliminados de nuestros registros.'),
        parrafo('Si cree que se trata de un error, o desea volver a presentarla, responda a este correo y le atenderemos con mucho gusto.'),
      ]
      : porImpago
        ? [
          parrafo('Le comunicamos que se ha tramitado su <strong>baja en el censo de hermanos</strong> del Grupo Parroquial, al no constar el pago de sus cuotas.'),
          recuadro('¿Es un error?', 'Si ya las ha pagado, o desea ponerse al corriente y reincorporarse, responda a este correo y la Secretaría lo revisará con usted.'),
        ]
        : [
          parrafo('Le comunicamos que se ha tramitado su <strong>baja en el censo de hermanos</strong> del Grupo Parroquial.'),
          parrafo('Si esta baja no responde a su voluntad, o desea volver más adelante, responda a este correo y la Secretaría le atenderá.'),
        ];

    const despedida = esRechazo
      ? 'Le agradecemos el interés mostrado por nuestro Grupo Parroquial.'
      : porImpago
        ? 'Quedamos a su disposición.'
        : `Le agradecemos el tiempo que ha formado parte de esta casa, que sigue abierta para cuando quiera volver. ${BENDICION}`;

    const content = [saludo(nombreHermano, sexo), ...cuerpo, bloqueDeSecretaria('Contacto con Secretaría'), firma(despedida)].join('');

    const asunto = esRechazo ? 'Resolución de su solicitud de ingreso' : 'Baja en el censo de hermanos';
    return await enviarCorreo(emailDestino, asunto, maquetar({
      titulo: esRechazo ? 'Resolución de su solicitud' : 'Baja en el censo de hermanos',
      antetitulo: 'Secretaría',
      resumen: esRechazo
        ? 'La Secretaría no ha podido dar curso a su solicitud de ingreso.'
        : porImpago ? 'Se ha tramitado su baja al no constar el pago de sus cuotas.' : 'Se ha tramitado su baja en el censo de hermanos.',
      contenido: content,
    }));
  }

  /**
   * Se abre la solicitud de papeletas: un correo por cuenta, con las fichas de
   * esa cuenta que pueden salir y los días de reparto. El nombre de cada ficha
   * va porque quien recibe el correo muchas veces pide también las de sus
   * menores.
   */
  static async enviarAperturaPapeletas(emailDestino: string, nombreCuenta: string, fichas: string[], dias: string[], year: number, sexo?: Sexo, salida: Salida = 'PASION') {
    const rosario = salida === 'ROSARIO';
    const content = [
      saludo(nombreCuenta, sexo),
      parrafo(rosario
        ? `Ya está <strong>abierta la inscripción para el Rosario vespertino</strong> de ${year}. Puede apuntarse desde el área de hermanos, pedir el puesto en que le gustaría ir y elegir el día en que pasará a recoger su papeleta.`
        : `Ya está <strong>abierta la solicitud de papeletas de sitio</strong> para la Estación de Penitencia de ${year}. Puede pedirla desde el área de hermanos y elegir el día en que pasará a recogerla.`),
      recuadro('Días de reparto', lista(dias, '0')),
      parrafo(fichas.length > 1 ? 'Puede pedirla para:' : 'Puede pedirla para su ficha:', 'margin-bottom: 6px;'),
      lista(fichas),
      parrafo(rosario
        ? 'Se va en traje. Para participar se pide la voluntad, y hay que estar al día con la cuota de hermano: puede pagarla desde el área de hermanos o el día del reparto.'
        : 'Para recoger la papeleta hay que estar al día con la cuota de hermano: puede pagarla desde el área de hermanos o el día del reparto. Recuerde llevar el DNI.'),
      boton(rosario ? 'Apuntarme al Rosario' : 'Pedir la papeleta', urlDeLaWeb('/area-hermano/procesion')),
      firma(`Esperamos contar con su presencia acompañando a ${identidad.titular}.`),
    ].join('');

    const titulo = rosario ? `Rosario vespertino ${year}` : `Papeletas de sitio ${year}`;
    return await enviarCorreo(emailDestino, rosario ? `Abierta la inscripción del Rosario vespertino ${year}` : `Abierta la solicitud de papeletas de sitio ${year}`, maquetar({
      titulo,
      antetitulo: rosario ? 'Rosario vespertino' : 'Estación de Penitencia',
      resumen: `Ya puede pedir su papeleta y elegir el día de reparto. Primer día: ${dias[0] ?? 'por anunciar'}.`,
      contenido: content,
    }));
  }

  /**
   * A quien tenía cita para recoger la papeleta y no pasó. `fechaCita` es el
   * día de la cita, ya escrito para leerlo («lunes, 8 de marzo»).
   */
  static async enviarRecordatorioAusencia(emailDestino: string, nombreHermano: string, fechaCita: string, sexo?: Sexo) {
    const content = [
      saludo(nombreHermano, sexo),
      parrafo(`Tenía cita el <strong>${esc(fechaCita)}</strong> para recoger su papeleta de sitio y, según nuestros registros, no pudo pasar.`),
      parrafo('La organización del cortejo depende de que cada hermano recoja su papeleta dentro del plazo de reparto. Si quiere salir este año, pase a recogerla en cuanto pueda, o pida una cita nueva desde el área de hermanos.'),
      recuadro('Qué llevar', lista(['DNI.', 'El recibo de la cuota anual, si la tiene pendiente.'], '0')),
      bloqueDeSecretaria('Horario de reparto'),
      boton('Ir al área de hermanos', urlDeLaWeb('/area-hermano/procesion')),
      parrafo('Si ya la ha recogido en las últimas horas, no haga caso de este mensaje.', `font-size: 14px; color: ${COLORES.suave};`),
      firma(`Esperamos contar con su presencia acompañando a ${identidad.titular}.`),
    ].join('');

    return await enviarCorreo(emailDestino, 'Recordatorio: su papeleta de sitio está sin recoger', maquetar({
      titulo: 'Su papeleta sigue sin recoger',
      antetitulo: 'Estación de Penitencia',
      resumen: `Tenía cita el ${fechaCita} y no consta que pasara. Aún está a tiempo.`,
      contenido: content,
    }));
  }

  static async enviarContacto(datosContacto: ContactoDto): Promise<boolean> {
    const destino = process.env.CONTACT_EMAIL_TO || process.env.EMAIL_USER;
    if (!destino) {
      console.error('❌ Contacto: CONTACT_EMAIL_TO o EMAIL_USER no está configurado.');
      return false;
    }

    const email = esc(datosContacto.email);
    const telefono = datosContacto.telefono?.trim() ? esc(datosContacto.telefono) : 'No indicado';
    const content = [
      datos([
        ['Nombre', esc(datosContacto.nombre)],
        ['Correo', `<a href="mailto:${email}" style="color: ${COLORES.burdeos};">${email}</a>`],
        ['Teléfono', telefono],
        ['Asunto', esc(datosContacto.asunto)],
      ]),
      cita(esc(datosContacto.mensaje).replace(/\r?\n/g, '<br>')),
    ].join('');

    // `datosContacto.email` llega validado por contact.schema.ts (sin comas ni
    // ángulos): es seguro como Reply-To.
    return enviarCorreo(destino, `[Contacto web] ${datosContacto.asunto}`, maquetar({
      titulo: 'Mensaje nuevo de contacto',
      antetitulo: 'Formulario de la web',
      resumen: `${datosContacto.nombre}: ${datosContacto.mensaje.slice(0, 90)}`,
      contenido: content,
      para: { contacto: datosContacto.nombre },
    }), datosContacto.email, cuentaDeContacto());
  }
}
