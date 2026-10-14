/**
 * Los correos que manda la casa: recuperar la contraseña, la papeleta de
 * sitio, la confirmación de un alta, el aviso a Secretaría de una solicitud
 * nueva, su aprobación o rechazo, la baja, la apertura de las papeletas, el
 * recordatorio de una papeleta sin recoger y el formulario de contacto.
 *
 * El texto de los correos a hermanos y donantes es una plantilla que se
 * edita en el CMS (Emails; ver `plantillas-correo.service`): aquí cada correo
 * prepara sus campos ({{nombre}}, {{fecha}}…) y sus bloques fijos (la
 * papeleta, el enlace…), que siguen siendo código para que nadie los rompa.
 * El aviso interno a Secretaría y el del formulario de contacto no son
 * plantillas: no los lee ningún hermano.
 *
 * Criterio común: asuntos sin emojis y en minúscula normal, saludo según el
 * sexo de la ficha, firma del cargo y nada que el Grupo no haya confirmado.
 */
import { DatosPapeleta } from '../dtos/email.dto';
import { ContactoDto } from '../dtos/contacto.dto';
import { conArticulo, deArticulo, deLaCorporacion, type Articulo } from '../domain/articulos.js';
import {
  COLORES, bloqueDeSecretaria, boton, cita, datos, esc, lista, maquetar, rotulo,
  parrafo, recuadro, segunSexo, urlDeLaWeb, type Sexo,
} from './correos/plantilla.js';
import { cuentaDeContacto, direccionDeEnvio, enviarCorreo } from './correos/envio.js';
import { PlantillasCorreoService } from './plantillas-correo.service.js';
import type { AreaSesion } from '../utils/cookies.js';

/** Quien entra en el censo al aprobar la solicitud, con el número que recibe. */
interface HermanoAprobado { nombre: string; apellidos: string | null; numeroHermano: number }

/** «Estimado Juan:», como lo pone el campo {{saludo}} (sin HTML: la plantilla lo escapa). */
const textoDeSaludo = (nombre: string, sexo?: Sexo) =>
  `${sexo === 'HOMBRE' ? 'Estimado' : sexo === 'MUJER' ? 'Estimada' : 'Estimado/a'} ${nombre}:`;

/**
 * Un texto de varias líneas escrito en el CMS (las indicaciones de una salida):
 * escapado y con sus saltos de línea, que el HTML del correo se comería.
 */
function conSaltos(texto: string): string {
  return esc(texto).replace(/\r?\n/g, '<br>');
}

/** El recuadro «Antes de salir» con las indicaciones de la salida, o nada si no tiene. */
function indicacionesDe(salida: { indicaciones: string | null }): string {
  return salida.indicaciones?.trim() ? recuadro('Antes de salir', conSaltos(salida.indicaciones.trim())) : '';
}

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
    opciones: { horas?: number; cuentaNueva?: boolean; sexo?: Sexo; area?: AreaSesion } = {},
  ) {
    const { horas = 1, cuentaNueva = false, sexo, area = 'hermanos' } = opciones;
    // Con `area=cms`, al terminar la web lleva a la entrada del CMS y no a la de
    // hermanos, que puede estar apagada y no es la de quien lo pidió.
    const enlace = urlDeLaWeb(`/reset-password?token=${encodeURIComponent(token)}${area === 'cms' ? '&area=cms' : ''}`);
    const { asunto, html, uso } = await PlantillasCorreoService.correo(cuentaNueva ? 'contrasena_cuenta_nueva' : 'contrasena_recuperar', {
      campos: { saludo: textoDeSaludo(nombreHermano, sexo), nombre: nombreHermano, plazo: plazo(horas) },
      bloques: { enlace: boton(cuentaNueva ? 'Crear mi contraseña' : 'Elegir una contraseña nueva', enlace) },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * La invitación al primer acceso de quien entró con el censo importado: el
   * enlace pone la contraseña y lleva derecho a revisar la ficha. Va a otra
   * página que la recuperación porque saluda por el nombre y entra sin pasar
   * por el acceso.
   */
  static async enviarInvitacionPrimerAcceso(emailDestino: string, nombre: string, token: string, opciones: { horas: number; sexo?: Sexo }) {
    const enlace = urlDeLaWeb(`/primer-acceso?token=${encodeURIComponent(token)}`);
    const { asunto, html, uso } = await PlantillasCorreoService.correo('primer_acceso_invitacion', {
      campos: { saludo: textoDeSaludo(nombre, opciones.sexo), nombre, plazo: plazo(opciones.horas) },
      bloques: { enlace: boton('Entrar por primera vez', enlace) },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * Aviso de que la contraseña se ha cambiado desde la propia cuenta. Si no
   * fue su dueño, es la única forma de que se entere a tiempo.
   */
  static async enviarContrasenaCambiada(emailDestino: string, nombre: string, fecha: string, sexo?: Sexo) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('contrasena_cambiada', {
      campos: { saludo: textoDeSaludo(nombre, sexo), nombre, fecha },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * El doble factor se ha bloqueado por códigos equivocados. Para llegar a
   * pedirlo hay que acertar la contraseña, así que si no era el titular, el
   * aviso le dice que alguien la conoce.
   */
  static async enviarDobleFactorBloqueado(emailDestino: string, nombre: string, plazoTexto: string, sexo?: Sexo) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('doble_factor_bloqueado', {
      campos: { saludo: textoDeSaludo(nombre, sexo), nombre, plazo: plazoTexto },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * Se ha apuntado un móvil para aprobar la entrada al CMS. Apuntarlo pide la
   * contraseña, pero quien tenga una sesión abierta y la contraseña podría
   * quedarse con un segundo factor propio: este aviso es lo que se entera.
   */
  static async enviarMovilApuntado(emailDestino: string, nombre: string, movil: string, fecha: string, sexo?: Sexo) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('movil_apuntado', {
      campos: { saludo: textoDeSaludo(nombre, sexo), nombre, movil, fecha },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * Un alta que no se ha podido tramitar porque el correo o algún DNI ya
   * figura en una cuenta o en el censo. La web contesta lo mismo que a un alta
   * normal para no revelar quién está en el censo: este correo, que solo lee
   * el dueño de la dirección, es lo que le dice qué hacer, y tampoco dice qué
   * dato chocó ni de quién es.
   */
  static async enviarSolicitudNoTramitada(emailDestino: string, nombre: string) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('solicitud_no_tramitada', {
      campos: { saludo: textoDeSaludo(nombre), nombre },
      bloques: { secretaria: bloqueDeSecretaria('Atención en Secretaría') },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * La papeleta, cuando se recoge en la mesa (con la ropa en las salidas que
   * la llevan; si no, con el puesto confirmado). El QR no va en el cuerpo, que
   * muchos clientes de correo esconden o recortan: va en el PDF adjunto, el
   * mismo que se imprime en la mesa. Lo que la identifica en Secretaría es su
   * número.
   */
  static async enviarPapeleta(emailDestino: string, nombreHermano: string, datosPapeleta: DatosPapeleta, sexo?: Sexo, pdf?: { nombre: string; contenido: Buffer }) {
    const { negro, burdeos, linea, sobreNegro } = COLORES;
    const { salida } = datosPapeleta;
    const donativo = salida.cobro === 'DONATIVO';
    const nombrePapeleta = salida.nombre;
    const referencia = datosPapeleta.papeletaId ? `${datosPapeleta.year}-${String(datosPapeleta.papeletaId).padStart(4, '0')}` : null;
    const celda = (titulo: string, valor: string, columnas = 1) =>
      `<td ${columnas === 2 ? 'colspan="2"' : 'width="50%"'} valign="top" style="padding: 12px 20px; border-top: 1px solid ${linea};">${rotulo(titulo)}<br><span style="font-size: 16px;">${esc(valor)}</span></td>`;

    const filasExtra = [
      datosPapeleta.tunica ? celda('Túnica', datosPapeleta.tunica) : '',
      datosPapeleta.importe ? celda(donativo ? 'Donativo' : 'Limosna abonada', datosPapeleta.importe) : '',
    ].filter(Boolean);

    // Como la de papel: recuadro negro, cabecera con el año y el número, el
    // puesto grande y los datos en rejilla.
    const papeleta = `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 8px 0 28px 0; border: 1px solid ${negro};">
        <tr>
          <td colspan="2" bgcolor="${negro}" style="background-color: ${negro}; padding: 11px 20px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr>
              <td style="font-family: Georgia, serif; font-size: 15px; font-style: italic; color: #ffffff;">${esc(nombrePapeleta)} ${datosPapeleta.year}</td>
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
      ? parrafo(`Puede consultar la normativa completa de la salida en <a href="${process.env.NORMATIVA_URL}" style="color: ${burdeos};">este enlace</a>.`)
      : '';
    const adjunto = parrafo(pdf
      ? 'Le adjuntamos su papeleta en PDF, con el código que se lee en la puerta del templo. También la tiene en el área de hermanos, en Procesión, para enseñarla desde el móvil.'
      : 'Conserve este correo: puede enseñarlo en el acceso si se le pide. Su papeleta, con el código que se lee en la puerta, está en el área de hermanos, en Procesión.');

    const { asunto, html, uso } = await PlantillasCorreoService.correo('papeleta', {
      campos: {
        saludo: textoDeSaludo(nombreHermano, sexo), nombre: nombreHermano.split(' ')[0], nombre_completo: nombreHermano,
        salida: salida.nombre, anio: datosPapeleta.year, fecha: datosPapeleta.fechaSalida, hora: datosPapeleta.horaSalida,
        puesto: datosPapeleta.puesto || 'Por asignar',
        de_la_salida: deArticulo(salida.articulo, salida.nombre), la_salida: conArticulo(salida.articulo, salida.nombre),
      },
      // Las indicaciones las escribe el CMS para cada salida; sin ellas, no hay recuadro.
      bloques: { papeleta, indicaciones: indicacionesDe(salida), adjunto, normativa: salida.conRopa ? normativa : '' },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso, adjuntos: pdf ? [{ filename: pdf.nombre, content: pdf.contenido, contentType: 'application/pdf' }] : [] });
  }

  /**
   * Acuse de la solicitud de ingreso. `certificadoAdjunto`: si subió el
   * certificado de bautismo con el formulario no se le pide otra vez.
   */
  /**
   * Las gracias por un donativo en línea, si el donante dejó su correo. Sin
   * nombre, el saludo no se lo inventa. No es un certificado de donación: eso
   * es otra cosa, con NIF, y la emite Tesorería.
   */
  static async enviarGraciasDonativo(emailDestino: string, nombre: string | null, importe: string, destino: string | null) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('donativo_gracias', {
      campos: { saludo: nombre ? textoDeSaludo(nombre) : 'Estimado/a amigo/a:', importe, para_destino: destino ? ` para ${destino}` : '' },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * El pésame a la familia de un hermano difunto. Va a quien Secretaría
   * decida (lo propone el censo: otra ficha de la familia o el titular de la
   * cuenta), nunca a la cuenta del propio difunto.
   */
  static async enviarPesame(emailDestino: string, difunto: string, sexo?: Sexo) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('pesame', {
      campos: { difunto, hermano: sexo === 'MUJER' ? 'hermana' : 'hermano' },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /** El aviso a la familia de un sufragio por su difunto: qué, cuándo y dónde. */
  static async enviarAvisoSufragio(emailDestino: string, difunto: string, sufragio: { que: string; cuando: string; donde: string | null }) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('sufragio', {
      campos: { difunto, que: sufragio.que, que_minusculas: sufragio.que.toLowerCase(), cuando: `${sufragio.cuando}${sufragio.donde ? `, ${sufragio.donde}` : ''}` },
      bloques: { cuando: recuadro(sufragio.que, `${esc(sufragio.cuando)}${sufragio.donde ? `<br>${esc(sufragio.donde)}` : ''}`) },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  static async enviarConfirmacionRegistro(emailDestino: string, nombreHermano: string, opciones: { sexo?: Sexo; certificadoAdjunto?: boolean } = {}) {
    const { sexo, certificadoAdjunto = false } = opciones;
    const documentos = ['DNI original.'];
    if (!certificadoAdjunto) documentos.push('Certificado de bautismo (copia expedida por su parroquia).');
    const { asunto, html, uso } = await PlantillasCorreoService.correo('solicitud_recibida', {
      campos: { saludo: textoDeSaludo(nombreHermano, sexo), nombre: nombreHermano },
      bloques: {
        documentos: recuadro('Próximo paso: pasar por Secretaría',
          `Según nuestras Reglas, para completar su alta en el censo de hermanos debe acudir en persona a la Casa ${deLaCorporacion()} con:${lista(documentos, '10px 0 0 0')}`),
        secretaria: bloqueDeSecretaria('Atención en Secretaría'),
      },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * Aviso al buzón de Secretaría de que ha entrado una solicitud nueva.
   *
   * Antes no existía: una solicitud solo se veía si alguien entraba al CMS y
   * miraba el contador de «Hermanos», así que podía quedarse semanas parada sin
   * que nadie lo supiera.
   *
   * Va al buzón de la corporación (CONTACT_EMAIL_TO, con respaldo en el remitente)
   * y no a las cuentas personales del staff: el destinatario es el cargo, no la
   * persona que hoy lo ocupa.
   */
  static async enviarAvisoSolicitud(datosSolicitud: { nombre: string; apellidos?: string | null; email: string; fichas?: number }) {
    const destino = process.env.CONTACT_EMAIL_TO || direccionDeEnvio();
    if (!destino) {
      console.error('❌ Aviso de solicitud: ni CONTACT_EMAIL_TO ni EMAIL_FROM o EMAIL_USER están configurados.');
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
    }), { uso: 'aviso_solicitud' });
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

    const { asunto, html, uso } = await PlantillasCorreoService.correo('alta_aprobada', {
      campos: {
        saludo: textoDeSaludo(nombreCuenta, sexo), nombre: nombreCuenta,
        bienvenido: varios ? 'Bienvenidos' : segunSexo(sexo, 'Bienvenido', 'Bienvenida'),
        forma_parte: varios ? 'forman parte' : 'forma parte',
      },
      bloques: { censo, boton: boton('Entrar en el área de hermanos', urlDeLaWeb('/acceso')) },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * La solicitud no sale adelante, o se tramita una baja.
   *
   * Sin motivos automáticos a propósito: la decisión la explica Secretaría, y un
   * correo generado no puede dar por escrito una razón que nadie ha redactado.
   * La única excepción es el impago, que Secretaría elige al dar la baja.
   *
   * El asunto NO lleva el nombre: una plantilla del CMS puede cambiarlo, y no
   * debe sacar a ningún sitio el nombre que `rechazarSolicitud` acaba de
   * borrar. (Si el envío falla, la auditoría ya no guarda el asunto, solo la
   * clave del correo.)
   */
  static async enviarBajaORechazo(emailDestino: string, nombreHermano: string, motivo: 'rechazo' | 'baja', porImpago = false, sexo?: Sexo) {
    const clave = motivo === 'rechazo' ? 'solicitud_rechazada' : porImpago ? 'baja_impago' : 'baja';
    const { asunto, html, uso } = await PlantillasCorreoService.correo(clave, {
      campos: { saludo: textoDeSaludo(nombreHermano, sexo), nombre: nombreHermano },
      bloques: { secretaria: bloqueDeSecretaria('Contacto con Secretaría') },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * Se abre la solicitud de papeletas: un correo por cuenta, con las fichas de
   * esa cuenta que pueden salir y los días de reparto. El nombre de cada ficha
   * va porque quien recibe el correo muchas veces pide también las de sus
   * menores.
   */
  static async enviarAperturaPapeletas(emailDestino: string, nombreCuenta: string, fichas: string[], dias: string[], year: number, sexo: Sexo | undefined, salida: { nombre: string; cobro: 'CUOTA' | 'DONATIVO'; indicaciones: string | null; articulo: Articulo }) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('apertura', {
      campos: {
        saludo: textoDeSaludo(nombreCuenta, sexo), nombre: nombreCuenta, salida: salida.nombre, anio: year, primer_dia: dias[0] ?? 'por anunciar',
        de_la_salida: deArticulo(salida.articulo, salida.nombre), la_salida: conArticulo(salida.articulo, salida.nombre),
      },
      bloques: {
        dias: recuadro('Días de reparto', lista(dias, '0')),
        fichas: parrafo(fichas.length > 1 ? 'Puede pedirla para:' : 'Puede pedirla para su ficha:', 'margin-bottom: 6px;') + lista(fichas),
        // El cobro sale de la salida y no de la plantilla: una plantilla vale para todas, y cada una cobra a su manera.
        cobro: parrafo(salida.cobro === 'DONATIVO'
          ? 'Para participar se pide la voluntad, y hay que estar al día con la cuota de hermano: puede pagarla desde el área de hermanos o el día del reparto.'
          : 'Para recoger la papeleta hay que estar al día con la cuota de hermano: puede pagarla desde el área de hermanos o el día del reparto. Recuerde llevar el DNI.'),
        indicaciones: indicacionesDe(salida),
        boton: boton('Pedir la papeleta', urlDeLaWeb('/area-hermano/procesion')),
      },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * A quien tenía cita para recoger la papeleta y no pasó. `fechaCita` es el
   * día de la cita, ya escrito para leerlo («lunes, 8 de marzo»).
   */
  static async enviarRecordatorioAusencia(emailDestino: string, nombreHermano: string, fechaCita: string, salida: { nombre: string; articulo: Articulo }, sexo?: Sexo) {
    // Con el nombre de la salida y no «papeleta de sitio» ni «Estación de
    // Penitencia»: hay salidas sin ropa (el Rosario) a las que no les cuadra.
    const { asunto, html, uso } = await PlantillasCorreoService.correo('papeleta_sin_recoger', {
      campos: {
        saludo: textoDeSaludo(nombreHermano, sexo), nombre: nombreHermano, salida: salida.nombre, fecha_cita: fechaCita,
        de_la_salida: deArticulo(salida.articulo, salida.nombre), la_salida: conArticulo(salida.articulo, salida.nombre),
      },
      bloques: { secretaria: bloqueDeSecretaria('Horario de reparto'), boton: boton('Ir al área de hermanos', urlDeLaWeb('/area-hermano/procesion')) },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  static async enviarContacto(datosContacto: ContactoDto): Promise<boolean> {
    const destino = process.env.CONTACT_EMAIL_TO || direccionDeEnvio();
    if (!destino) {
      console.error('❌ Contacto: CONTACT_EMAIL_TO o EMAIL_FROM o EMAIL_USER no está configurado.');
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
    }), { replyTo: datosContacto.email, cuenta: cuentaDeContacto(), uso: 'contacto' });
  }
}
