import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { DatosPapeleta } from '../dtos/email.dto';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // CONFIGURACIÓN GLOBAL DE COLORES
  private static readonly COLORS = {
    primario: '#5c1919',   // Rojo Burdeos
    secundario: '#d4af37', // Dorado
    fondo: '#f9f9f9',
    texto: '#333333'
  };

  /**
   * Escapa caracteres HTML de datos que vienen de la BD (nombres, puestos...)
   * para impedir HTML/Phishing injection en los correos (un hermano
   * registrado como "<b>Estafador</b>" no puede maquillar el email).
   */
  private static esc(text: string | null | undefined): string {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * PLANTILLA MAESTRA (Layout)
   * Centraliza el HTML, head, body, header, footer y estilos comunes.
   */
  private static getHtmlLayout(tituloCabecera: string, subtitulo: string, contenidoPrincipal: string, footerExtra: string = '', legalExtra: string = ''): string {
    const { primario, fondo, texto } = this.COLORS;
    const year = new Date().getFullYear();

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tituloCabecera}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${fondo}; font-family: 'Georgia', 'Times New Roman', serif; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${fondo};">
        <tr>
          <td align="center" style="padding: 40px 10px;">
            <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #eaeaeb; border-top: 6px solid ${primario}; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
              
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                  <img src="https://via.placeholder.com/80x100?text=ESCUDO" alt="Escudo Corporativo" width="80" style="display: block; margin: 0 auto 15px auto; border: 0;">
                  <h1 style="color: ${primario}; margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 2px; font-weight: normal;">Archicofradía de los Desamparados</h1>
                  <p style="margin: 10px 0 0; color: #888; font-size: 13px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 1px;">${subtitulo}</p>
                </td>
              </tr>

              <tr>
                <td style="padding: 30px 40px; color: ${texto}; font-size: 15px; line-height: 1.8;">
                  ${contenidoPrincipal}
                </td>
              </tr>

              <tr>
                <td style="background-color: #2b2b2b; color: #999999; padding: 30px 40px; font-family: 'Arial', sans-serif; font-size: 11px; line-height: 1.5; text-align: center;">
                  <p style="margin-top: 0; color: #ffffff;">&copy; ${year} ARCHICOFRADÍA DE LOS DESAMPARADOS</p>
                  ${footerExtra}
                  <p style="text-align: justify;"><strong>Aviso Legal y Protección de Datos:</strong> En cumplimiento del RGPD, le informamos que sus datos serán tratados por la Hermandad. Este mensaje es confidencial. No responda a este correo automatizado. Dudas en <em>secretaria@tucofradia.com</em></p>
                  ${legalExtra}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
  }

  // --- MÉTODOS DE NEGOCIO ---

  static async enviarRecuperacionContrasena(emailDestino: string, nombreHermano: string, token: string) {
    const enlaceReset = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const { primario } = this.COLORS;
    const nombre = this.esc(nombreHermano);

    const content = `
      <p style="margin-top: 0;">Estimado/a hermano/a <strong>${nombre}</strong>,</p>
      <p>Hemos recibido una solicitud para restablecer la contraseña de su acceso al portal del hermano.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${enlaceReset}" style="background-color: ${primario}; color: #ffffff; padding: 12px 25px; text-decoration: none; font-family: 'Arial', sans-serif; font-size: 14px; border-radius: 4px; display: inline-block;">Restablecer Contraseña</a>
      </div>
      <p>Si no ha realizado esta solicitud, puede ignorar este correo de forma segura.</p>
    `;

    const asunto = `🔐 Restablecer Contraseña - Portal del Hermano`;
    return await this.enviarEmailBase(emailDestino, asunto, this.getHtmlLayout("Recuperación de Contraseña", "Portal del Hermano", content));
  }

  // Nota: Tenías dos funciones 'enviarPapeleta' y 'enviarRecuperacionContrasena' haciendo lo mismo (enviando papeletas). 
  // He dejado una sola función robusta para la papeleta.
  static async enviarPapeleta(emailDestino: string, nombreHermano: string, datos: DatosPapeleta) {
    const { primario, secundario } = this.COLORS;
    const nombre = this.esc(nombreHermano);
    const puesto = this.esc(datos.puesto) || 'Por asignar en Fiscalía';
    const tramo = this.esc(datos.tramo) || 'Tramo General';
    const obs = datos.observaciones ? `<p style="font-style: italic; color: #666; margin: 10px 0 5px 0;">Notas: ${this.esc(datos.observaciones)}</p>` : '';

    // QR generado EN LOCAL (librería 'qrcode'): no enviamos datos personales
    // a servicios externos (api.qrserver.com). Cumplimiento RGPD.
    const qrDataUrl = await QRCode.toDataURL(`${datos.year}-${nombreHermano}`, {
      width: 100,
      margin: 0,
      color: { dark: '#5c1919', light: '#ffffff' }
    });

    const content = `
      <p style="margin-top: 0;">Estimado/a hermano/a <strong>${nombre}</strong>,</p>
      <p>La Secretaría certifica que ha abonado correctamente la limosna de salida, autorizándole a realizar la Estación de Penitencia el próximo <strong>${this.esc(datos.fechaSalida)}</strong>.</p>
      
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
                  <strong style="color: #333;">${this.esc(datos.horaSalida)}</strong>
                </td>
                <td width="50%" valign="top">
                  <span style="font-family: 'Arial', sans-serif; font-size: 12px; color: #999; text-transform: uppercase;">Puerta</span><br>
                  <strong style="color: #333;">${this.esc(datos.accesoPuerta)}</strong>
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
        <p style="margin: 0; font-size: 13px; color: #5d4037; font-style: italic;">Se ruega puntualidad y decoro en la vestimenta. Es obligatorio portar la medalla de la Hermandad y calzado oscuro. Mantenga el silencio durante la formación.</p>
      </div>
    `;

    const footerLinks = `<p style="margin: 10px 0 15px 0;"><a href="#" style="color: #ffffff; text-decoration: underline;">Descargar Normativa</a> | <a href="#" style="color: #ffffff; text-decoration: underline;">Contactar Secretaría</a></p>`;
    const asunto = `📜 Papeleta de Sitio ${datos.year} - ${nombre}`;
    
    return await this.enviarEmailBase(emailDestino, asunto, this.getHtmlLayout(`Papeleta de Sitio ${datos.year}`, `Papeleta de Sitio - ${datos.year}`, content, footerLinks));
  }

  static async enviarConfirmacionRegistro(emailDestino: string, nombreHermano: string) {
    const { primario, secundario } = this.COLORS;
    const nombre = this.esc(nombreHermano);

    const content = `
      <p style="margin-top: 0;">Estimado/a en Cristo, <strong>${nombre}</strong>:</p>
      <p>La Secretaría de esta corporación hace acuse de recibo de su solicitud de ingreso, cumplimentada a través de nuestros canales telemáticos. Le damos nuestra más sincera enhorabuena por dar este primer paso para formar parte de nuestra Hermandad.</p>
      
      <div style="background-color: #fafafa; border-left: 4px solid ${secundario}; padding: 20px 25px; margin: 30px 0;">
        <h2 style="margin: 0 0 10px 0; font-size: 14px; color: ${primario}; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 1px;">Trámite de Personación Obligatorio</h2>
        <p style="margin: 0; font-size: 14px; color: #555;">De acuerdo con nuestras Reglas, para elevar a definitivo su expediente y formalizar su alta en el censo de hermanos, es preceptivo que acuda personalmente a nuestra Casa de Hermandad.</p>
      </div>

      <p style="margin-bottom: 10px;">En dicha cita, deberá aportar la siguiente documentación indispensable:</p>
      <ul style="font-size: 14px; color: #444; margin-top: 0; padding-left: 20px; line-height: 1.6;">
        <li>Documento Nacional de Identidad (DNI) original.</li>
        <li>Certificado de Bautismo (copia expedida por su parroquia).</li>
      </ul>

      <table width="100%" style="background-color: #fcfcfc; border: 1px solid #eeeeee; padding: 20px; text-align: center; font-family: 'Arial', sans-serif; font-size: 13px; color: #555; margin-top: 20px;">
        <tr>
          <td>
            <strong style="color: ${primario}; font-size: 14px; display: block; margin-bottom: 5px;">Atención al Hermano en Secretaría</strong>
            Martes y Jueves, de 19:00h a 21:00h<br>
            <span style="color: #888; font-size: 12px; margin-top: 8px; display: block;">Casa Hermandad · C/ Falsa, 123, 29000 Málaga</span>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 30px; font-style: italic;">
        <p>Que nuestros Sagrados Titulares le guarden y bendigan.</p>
        <p style="margin-top: 20px; font-weight: bold; font-style: normal; font-size: 14px;">El Secretario</p>
      </div>
    `;

    const asunto = `📋 Solicitud de Registro Recibida - ${nombre}`;
    return await this.enviarEmailBase(emailDestino, asunto, this.getHtmlLayout("Acuse de Recibo", "Secretaría General", content));
  }

  static async enviarRecordatorioAusencia(emailDestino: string, nombreHermano: string, fechaCita: string) {
    const { primario, secundario } = this.COLORS;
    const nombre = this.esc(nombreHermano);

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

      <table width="100%" style="background-color: #fcfcfc; border: 1px solid #eeeeee; padding: 20px; text-align: center; font-family: 'Arial', sans-serif; font-size: 13px; color: #555; margin-top: 20px;">
        <tr>
          <td>
            <strong style="color: ${primario}; font-size: 14px; display: block; margin-bottom: 5px;">Horario de Reparto de Puestos</strong>
            Lunes a Viernes, de 18:30h a 21:00h<br>
            <span style="color: #888; font-size: 12px; margin-top: 8px; display: block;">Lugar: Parroquia de Santa Mª Goretti</span>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 30px; font-style: italic;">
        <p>Esperamos contar con su presencia acompañando a nuestros Sagrados Titulares.</p>
        <p style="margin-top: 20px; font-weight: bold; font-style: normal; font-size: 14px;">El Albacea General / El Secretario</p>
      </div>
    `;

    const infoExtra = `<p style="margin-top: 15px;"><strong>Información:</strong> Este correo se envía de forma automática para la gestión del cortejo procesional. Si ya ha retirado su puesto en las últimas 24 horas, por favor ignore este mensaje.</p>`;
    // Nota: El asunto en tu código original decía "Solicitud de Registro Recibida", lo he cambiado por uno más adecuado.
    const asunto = `⚠️ Aviso de Salida Procesional - Recogida de Puesto pendiente`;
    
    return await this.enviarEmailBase(emailDestino, asunto, this.getHtmlLayout("Aviso de Salida Procesional", "Secretaría y Albacería", content, '', infoExtra));
  }

  // --- MOTOR DE ENVÍO ---
  private static async enviarEmailBase(to: string, subject: string, html: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Secretaría'}" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`✅ Email enviado con éxito a: ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Error enviando email a ${to}:`, error);
      return false;
    }
  }
}