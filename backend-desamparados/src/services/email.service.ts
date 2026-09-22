/**
 * Los correos que manda la casa: recuperar la contraseña, la papeleta de
 * sitio, la confirmación de un alta, el aviso a Secretaría de una solicitud
 * nueva, su aprobación o rechazo, el recordatorio de una ausencia y el
 * formulario de contacto.
 *
 * Cómo se maquetan está en `correos/plantilla` y por dónde salen en
 * `correos/envio`: aquí solo queda lo que dice cada correo.
 */
import QRCode from 'qrcode';
import { DatosPapeleta } from '../dtos/email.dto';
import { ContactoDto } from '../dtos/contacto.dto';
import { escudoUrl } from '../domain/datos-entidad.js';
import { COLORES, bloqueDeSecretaria, enlacesDelPie, esc, maquetar } from './correos/plantilla.js';
import { cuentaDeContacto, enviarCorreo } from './correos/envio.js';

export class EmailService {

  // --- MÉTODOS DE NEGOCIO ---

  static async enviarRecuperacionContrasena(emailDestino: string, nombreHermano: string, token: string) {
    const enlaceReset = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(token)}`;
    const { primario } = COLORES;
    const nombre = esc(nombreHermano);

    const content = `
      <p style="margin-top: 0;">Estimado/a hermano/a <strong>${nombre}</strong>,</p>
      <p>Hemos recibido una solicitud para restablecer la contraseña de su acceso al portal del hermano.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${enlaceReset}" style="background-color: ${primario}; color: #ffffff; padding: 12px 25px; text-decoration: none; font-family: 'Arial', sans-serif; font-size: 14px; border-radius: 4px; display: inline-block;">Restablecer Contraseña</a>
      </div>
      <p>Si no ha realizado esta solicitud, puede ignorar este correo de forma segura.</p>
    `;

    const asunto = `🔐 Restablecer Contraseña - Portal del Hermano`;
    return await enviarCorreo(emailDestino, asunto, maquetar("Recuperación de Contraseña", "Portal del Hermano", content));
  }

  // Nota: Tenías dos funciones 'enviarPapeleta' y 'enviarRecuperacionContrasena' haciendo lo mismo (enviando papeletas). 
  // He dejado una sola función robusta para la papeleta.
  static async enviarPapeleta(emailDestino: string, nombreHermano: string, datos: DatosPapeleta) {
    const { primario, secundario } = COLORES;
    const nombre = esc(nombreHermano);
    const puesto = esc(datos.puesto) || 'Por asignar en Fiscalía';
    const tramo = esc(datos.tramo) || 'Tramo General';
    const obs = datos.observaciones ? `<p style="font-style: italic; color: #666; margin: 10px 0 5px 0;">Notas: ${esc(datos.observaciones)}</p>` : '';

    // QR generado EN LOCAL (librería 'qrcode'): no enviamos datos personales
    // a servicios externos (api.qrserver.com). Cumplimiento RGPD.
    const qrDataUrl = await QRCode.toDataURL(`${datos.year}-${nombreHermano}`, {
      width: 100,
      margin: 0,
      color: { dark: '#5c1919', light: '#ffffff' }
    });

    const content = `
      <p style="margin-top: 0;">Estimado/a hermano/a <strong>${nombre}</strong>,</p>
      <p>La Secretaría certifica que ha abonado correctamente la limosna de salida, autorizándole a realizar la Estación de Penitencia el próximo <strong>${esc(datos.fechaSalida)}</strong>.</p>
      
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fcfcfc; border: 1px dashed #cccccc; border-radius: 4px; margin: 20px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%">
              <tr>
                <td style="padding-bottom: 15px;">
                  <span style="font-family: 'Arial', sans-serif; font-size: 12px; color: #999; text-transform: uppercase;">Puesto Asignado</span><br>
                  <strong style="font-size: 20px; color: ${primario};">${puesto}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 15px; border-bottom: 1px solid #eeeeee;">
                  <span style="font-family: 'Arial', sans-serif; font-size: 12px; color: #999; text-transform: uppercase;">Tramo / Sección</span><br>
                  <strong style="font-size: 18px; color: #333;">${tramo}</strong>
                </td>
              </tr>
            </table>

            <table width="100%" style="margin-top: 15px;">
              <tr>
                <td width="50%" valign="top">
                  <span style="font-family: 'Arial', sans-serif; font-size: 12px; color: #999; text-transform: uppercase;">Hora de Acceso</span><br>
                  <strong style="color: #333;">${esc(datos.horaSalida)}</strong>
                </td>
                <td width="50%" valign="top">
                  <span style="font-family: 'Arial', sans-serif; font-size: 12px; color: #999; text-transform: uppercase;">Puerta</span><br>
                  <strong style="color: #333;">${esc(datos.accesoPuerta)}</strong>
                </td>
              </tr>
            </table>
            ${obs}
          </td>
          
          <td width="100" valign="middle" align="center" style="border-left: 1px dashed #cccccc; padding: 10px; background-color: #fff;">
             <img src="${qrDataUrl}" alt="QR Acceso" width="80" height="80">
             <p style="font-family: 'Arial', sans-serif; font-size: 9px; color: #999; margin: 5px 0 0 0;">Control Acceso</p>
          </td>
        </tr>
      </table>

      <div style="background-color: #fff8e1; border-left: 4px solid ${secundario}; padding: 15px;">
        <p style="margin: 0 0 5px 0; font-family: 'Arial', sans-serif; font-size: 12px; font-weight: bold; color: #bcaaa4;">RECORDATORIO</p>
        <p style="margin: 0; font-size: 13px; color: #5d4037; font-style: italic;">Se ruega puntualidad y decoro en la vestimenta. Es obligatorio portar la medalla del Grupo Parroquial y calzado oscuro. Mantenga el silencio durante la formación.</p>
      </div>
    `;

    const footerLinks = enlacesDelPie();
    // El asunto es texto, no HTML: con el nombre escapado, «O'Brien» llegaba
    // como «O&#39;Brien». Los saltos de línea los aplana nodemailer.
    const asunto = `📜 Papeleta de Sitio ${datos.year} - ${nombreHermano}`;
    
    return await enviarCorreo(emailDestino, asunto, maquetar(`Papeleta de Sitio ${datos.year}`, `Papeleta de Sitio - ${datos.year}`, content, footerLinks));
  }

  static async enviarConfirmacionRegistro(emailDestino: string, nombreHermano: string) {
    const { primario, secundario } = COLORES;
    const nombre = esc(nombreHermano);

    const content = `
      <p style="margin-top: 0;">Estimado/a en Cristo, <strong>${nombre}</strong>:</p>
      <p>La Secretaría de esta corporación hace acuse de recibo de su solicitud de ingreso, cumplimentada a través de nuestros canales telemáticos. Le damos nuestra más sincera enhorabuena por dar este primer paso para formar parte de nuestro Grupo Parroquial.</p>
      
      <div style="background-color: #fafafa; border-left: 4px solid ${secundario}; padding: 20px 25px; margin: 30px 0;">
        <h2 style="margin: 0 0 10px 0; font-size: 14px; color: ${primario}; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 1px;">Trámite de Personación Obligatorio</h2>
        <p style="margin: 0; font-size: 14px; color: #555;">De acuerdo con nuestras Reglas, para elevar a definitivo su expediente y formalizar su alta en el censo de hermanos, es preceptivo que acuda personalmente a nuestra Casa de Grupo Parroquial.</p>
      </div>

      <p style="margin-bottom: 10px;">En dicha cita, deberá aportar la siguiente documentación indispensable:</p>
      <ul style="font-size: 14px; color: #444; margin-top: 0; padding-left: 20px; line-height: 1.6;">
        <li>Documento Nacional de Identidad (DNI) original.</li>
        <li>Certificado de Bautismo (copia expedida por su parroquia).</li>
      </ul>

      ${bloqueDeSecretaria('Atención al Hermano en Secretaría')}

      <div style="text-align: center; margin-top: 30px; font-style: italic;">
        <p>Que nuestros Sagrados Titulares le guarden y bendigan.</p>
        <p style="margin-top: 20px; font-weight: bold; font-style: normal; font-size: 14px;">El Secretario</p>
      </div>
    `;

    // Sin escapar: el asunto es texto, no HTML (ver enviarPapeleta).
    const asunto = `📋 Solicitud de Registro Recibida - ${nombreHermano}`;
    return await enviarCorreo(emailDestino, asunto, maquetar("Acuse de Recibo", "Secretaría General", content));
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
  static async enviarAvisoSolicitud(datos: { nombre: string; apellidos?: string | null; email: string; fichas?: number }) {
    const destino = process.env.CONTACT_EMAIL_TO || process.env.EMAIL_USER;
    if (!destino) {
      console.error('❌ Aviso de solicitud: ni CONTACT_EMAIL_TO ni EMAIL_USER están configurados.');
      return false;
    }

    const { primario, secundario } = COLORES;
    const nombreCompleto = esc([datos.nombre, datos.apellidos].filter(Boolean).join(' '));
    const enlace = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cms/hermanos`;

    const content = `
      <p style="margin-top: 0;">Ha entrado una <strong>solicitud de ingreso nueva</strong> por la web.</p>

      <div style="background-color: #fafafa; border-left: 4px solid ${secundario}; padding: 20px 25px; margin: 25px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> ${nombreCompleto}</p>
        <p style="margin: 0 0 6px 0;"><strong>Correo:</strong> ${esc(datos.email)}</p>
        ${/* Un alta puede traer varias personas: el adulto y los menores a su cargo. */ ''}
        ${datos.fichas && datos.fichas > 1 ? `<p style="margin: 0;"><strong>Fichas que trae:</strong> ${datos.fichas} (incluye menores a su cargo)</p>` : ''}
      </div>

      <p>Queda pendiente de aprobación hasta que Secretaría la revise. Mientras tanto, la cuenta no puede entrar al área de hermanos.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${enlace}" style="background-color: ${primario}; color: #ffffff; padding: 12px 25px; text-decoration: none; font-family: 'Arial', sans-serif; font-size: 14px; border-radius: 4px; display: inline-block;">Ver las solicitudes pendientes</a>
      </div>
    `;

    const asunto = `📥 Solicitud de ingreso nueva - ${[datos.nombre, datos.apellidos].filter(Boolean).join(' ')}`;
    return await enviarCorreo(destino, asunto, maquetar('Solicitud de ingreso nueva', 'Aviso interno · Secretaría', content));
  }

  /**
   * La solicitud ha sido aprobada: ya figura en el censo y tiene número.
   * Antes aprobar era mudo y el solicitante no se enteraba de nada.
   */
  static async enviarAprobacionSolicitud(emailDestino: string, nombreHermano: string, numerosDeHermano: number[]) {
    const { primario, secundario } = COLORES;
    const nombre = esc(nombreHermano);
    const enlace = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/hermanos/acceso`;

    // Una cuenta puede tener varias fichas (los hijos de un tutor) y se aprueban
    // todas a la vez: el correo las nombra en plural o el padre creería que solo
    // ha entrado una.
    const varios = numerosDeHermano.length > 1;
    const bloqueNumero = numerosDeHermano.length
      ? `<div style="background-color: #fcfcfc; border: 1px dashed #cccccc; padding: 20px; text-align: center; margin: 25px 0;">
           <span style="font-family: 'Arial', sans-serif; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">${varios ? 'Números de hermano' : 'Número de hermano'}</span><br>
           <strong style="font-size: 28px; color: ${primario};">${esc(numerosDeHermano.join(', '))}</strong>
         </div>`
      : '';

    const content = `
      <p style="margin-top: 0;">Estimado/a en Cristo, <strong>${nombre}</strong>:</p>
      <p>Le comunicamos que la Secretaría ha <strong>aprobado su solicitud de ingreso</strong>. Desde este momento ${varios ? 'sus perfiles figuran' : 'figura'} oficialmente en el censo de hermanos de nuestro Grupo Parroquial.</p>

      ${bloqueNumero}

      <p>Con su alta ya en vigor, puede acceder al área de hermanos para consultar sus datos, sus recibos y, llegado el momento, su papeleta de sitio.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${enlace}" style="background-color: ${primario}; color: #ffffff; padding: 12px 25px; text-decoration: none; font-family: 'Arial', sans-serif; font-size: 14px; border-radius: 4px; display: inline-block;">Entrar en el área de hermanos</a>
      </div>

      <div style="background-color: #fff8e1; border-left: 4px solid ${secundario}; padding: 15px;">
        <p style="margin: 0; font-size: 13px; color: #5d4037; font-style: italic;">Conserve ${varios ? 'esos números' : 'ese número'}: ${varios ? 'son los que identifican' : 'es el que le identifica'} en el censo y ${varios ? 'los' : 'el'} que se le pedirá en Secretaría.</p>
      </div>

      <div style="text-align: center; margin-top: 30px; font-style: italic;">
        <p>Bienvenido/a. Que nuestros Sagrados Titulares le guarden y bendigan.</p>
        <p style="margin-top: 20px; font-weight: bold; font-style: normal; font-size: 14px;">El Secretario</p>
      </div>
    `;

    const asunto = `✅ Su solicitud ha sido aprobada - ${nombreHermano}`;
    return await enviarCorreo(emailDestino, asunto, maquetar('Solicitud aprobada', 'Secretaría General', content));
  }

  /**
   * La solicitud no sale adelante, o se tramita una baja.
   *
   * Sin motivos automáticos a propósito: la decisión la explica Secretaría, y un
   * correo generado no puede dar por escrito una razón que nadie ha redactado.
   *
   * El asunto NO lleva el nombre. Si el envío falla, `enviarEmailBase` guarda el
   * asunto en la auditoría (EMAIL_FALLIDO), y en un rechazo eso devolvería a la
   * base el nombre que `rechazarSolicitud` acaba de borrar.
   */
  static async enviarBajaORechazo(emailDestino: string, nombreHermano: string, motivo: 'rechazo' | 'baja') {
    const nombre = esc(nombreHermano);
    const esRechazo = motivo === 'rechazo';

    const cuerpo = esRechazo
      ? `<p>Le comunicamos que la Secretaría <strong>no ha podido dar curso a su solicitud de ingreso</strong>, y que sus datos han sido eliminados de nuestros registros.</p>
         <p>Si cree que se trata de un error, o desea volver a presentarla, puede ponerse en contacto con la Secretaría y le atenderemos con mucho gusto.</p>`
      : `<p>Le comunicamos que se ha tramitado su <strong>baja en el censo de hermanos</strong> de nuestro Grupo Parroquial.</p>
         <p>Si esta baja no responde a su voluntad, o desea reincorporarse más adelante, puede ponerse en contacto con la Secretaría.</p>`;

    const content = `
      <p style="margin-top: 0;">Estimado/a <strong>${nombre}</strong>:</p>
      ${cuerpo}
      ${bloqueDeSecretaria('Contacto con Secretaría')}
      <div style="text-align: center; margin-top: 30px; font-style: italic;">
        <p>Le agradecemos el interés mostrado por nuestro Grupo Parroquial.</p>
        <p style="margin-top: 20px; font-weight: bold; font-style: normal; font-size: 14px;">El Secretario</p>
      </div>
    `;

    const asunto = esRechazo
      ? 'Resolución de su solicitud de ingreso'
      : 'Baja en el censo de hermanos';
    return await enviarCorreo(
      emailDestino,
      asunto,
      maquetar(asunto, 'Secretaría General', content)
    );
  }

  static async enviarRecordatorioAusencia(emailDestino: string, nombreHermano: string, fechaCita: string) {
    const { primario, secundario } = COLORES;
    const nombre = esc(nombreHermano);

    const content = `
      <p style="margin-top: 0;">Estimado/a hermano/a en Cristo, <strong>${nombre}</strong>:</p>
      <p>Nos ponemos en contacto con usted ante la proximidad de nuestra Estación de Penitencia. Según nuestros registros, <strong>aún no ha procedido a la retirada de su tarjeta de sitio y puesto</strong> para la procesión del presente año.</p>
      
      <div style="background-color: #fafafa; border-left: 4px solid ${secundario}; padding: 20px 25px; margin: 30px 0;">
        <h2 style="margin: 0 0 10px 0; font-size: 14px; color: ${primario}; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 1px;">Recogida de Puesto en la Iglesia</h2>
        <p style="margin: 0; font-size: 14px; color: #555;">Es imprescindible que se persone en las dependencias de la <strong>Iglesia</strong> para confirmar su participación y recoger su puesto. La correcta organización del cortejo depende de la asistencia de todos los hermanos en los plazos establecidos.</p>
      </div>

      <p style="margin-bottom: 10px;">Para agilizar el trámite, recuerde llevar consigo:</p>
      <ul style="font-size: 14px; color: #444; margin-top: 0; padding-left: 20px; line-height: 1.6;">
        <li>Documento Nacional de Identidad (DNI).</li>
        <li>Recibo de la cuota anual de hermano (en caso de tenerla pendiente).</li>
      </ul>

      ${bloqueDeSecretaria('Horario de Reparto de Puestos')}

      <div style="text-align: center; margin-top: 30px; font-style: italic;">
        <p>Esperamos contar con su presencia acompañando a nuestros Sagrados Titulares.</p>
        <p style="margin-top: 20px; font-weight: bold; font-style: normal; font-size: 14px;">El Albacea General / El Secretario</p>
      </div>
    `;

    const infoExtra = `<p style="margin-top: 15px;"><strong>Información:</strong> Este correo se envía de forma automática para la gestión del cortejo procesional. Si ya ha retirado su puesto en las últimas 24 horas, por favor ignore este mensaje.</p>`;
    // Nota: El asunto en tu código original decía "Solicitud de Registro Recibida", lo he cambiado por uno más adecuado.
    const asunto = `⚠️ Aviso de Salida Procesional - Recogida de Puesto pendiente`;
    
    return await enviarCorreo(emailDestino, asunto, maquetar("Aviso de Salida Procesional", "Secretaría y Albacería", content, '', infoExtra));
  }

  static async enviarContacto(datos: ContactoDto): Promise<boolean> {
    const destino = process.env.CONTACT_EMAIL_TO || process.env.EMAIL_USER;
    if (!destino) {
      console.error('❌ Contacto: CONTACT_EMAIL_TO o EMAIL_USER no está configurado.');
      return false;
    }

    const nombre = esc(datos.nombre);
    const email = esc(datos.email);
    const telefono = datos.telefono?.trim() ? esc(datos.telefono) : 'No indicado';
    const asunto = esc(datos.asunto);
    const mensaje = esc(datos.mensaje).replace(/\r?\n/g, '<br>');
    const content = `
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${telefono}</p>
      <p><strong>Asunto:</strong> ${asunto}</p>
      <hr>
      <p>${mensaje}</p>
    `;

    // `datos.email` llega validado por contact.schema.ts (sin comas ni ángulos):
    // es seguro como Reply-To.
    return enviarCorreo(destino, `[Contacto web] ${datos.asunto}`, maquetar('Nuevo mensaje de contacto', 'Formulario web', content), datos.email, cuentaDeContacto());
  }

}
