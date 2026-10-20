/**
 * Los correos que manda la casa: recuperar la contraseña, la confirmación
 * de un alta, el aviso a Secretaría de una solicitud nueva, su aprobación o
 * rechazo, la baja, la apertura de las papeletas, el recordatorio de la cita y
 * el de una papeleta sin recoger, los avisos de dinero (la cuenta
 * bancaria cambiada, el cargo en cuenta, el justificante de un pago y el pago
 * que se devuelve) y el formulario de contacto.
 *
 * El texto de los correos a hermanos y donantes es una plantilla que se
 * edita en el CMS (Emails; ver `plantillas-correo.service`): aquí cada correo
 * prepara sus campos ({{nombre}}, {{fecha}}…) y sus bloques fijos (la
 * tabla de un cargo, el enlace…), que siguen siendo código para que nadie los rompa.
 * El aviso interno a Secretaría y el del formulario de contacto no son
 * plantillas: no los lee ningún hermano.
 *
 * Criterio común: asuntos sin emojis y en minúscula normal, saludo según el
 * sexo de la ficha, firma del cargo y nada que el Grupo no haya confirmado.
 */
import { ContactoDto } from '../dtos/contacto.dto';
import { conArticulo, deArticulo, deLaCorporacion, type Articulo } from '../domain/articulos.js';
import {
  COLORES, bloqueDeSecretaria, boton, cita, datos, esc, lista, maquetar, rotulo,
  parrafo, recuadro, SANS, segunSexo, tablaDeImportes, urlDeLaWeb, type Sexo,
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

/** Una línea de dinero de un correo: qué, de quién (y de qué cuenta) y cuánto, ya en texto. */
export interface LineaDeImporte { concepto: string; detalle?: string; importe: string }

/** Lo de la salida que dice el correo de apertura. */
type DatosDeLaApertura = { nombre: string; cobro: 'CUOTA' | 'DONATIVO'; indicaciones: string | null; articulo: Articulo };

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
   * La cuenta en la que se cargan los recibos de una ficha ha cambiado desde
   * el área de hermanos. Va al correo de la cuenta y no a un aviso en la web:
   * si quien la cambió no era su dueño, el aviso en la web lo leería él.
   */
  static async enviarCuentaBancariaCambiada(emailDestino: string, nombre: string, d: { ficha: string; cuenta: string | null; fecha: string }, sexo?: Sexo) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('cuenta_bancaria_cambiada', {
      campos: { saludo: textoDeSaludo(nombre, sexo), nombre, ficha: d.ficha, cuenta: d.cuenta ?? 'ninguna', fecha: d.fecha },
    });
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /**
   * El aviso previo de un cargo en cuenta (la «prenotificación» SEPA), ya
   * maquetado y sin enviar: la remesa lo deja en la cola de correos, uno por
   * cuenta con todos sus recibos. Debajo de la tabla, el acreedor y su
   * identificador, que es lo que el hermano verá en su banco.
   */
  static async correoCargoDomiciliado(nombre: string, sexo: Sexo | undefined, d: { fechaCobro: string; total: string; lineas: LineaDeImporte[]; acreedor: { nombre: string; id: string } }) {
    const cargos = tablaDeImportes(d.lineas, d.total)
      + parrafo(`Acreedor: ${esc(d.acreedor.nombre)} · Identificador de acreedor: ${esc(d.acreedor.id)}`, `font-family: ${SANS}; font-size: 12px; color: ${COLORES.suave};`);
    return await PlantillasCorreoService.correo('cargo_domiciliado', {
      campos: { saludo: textoDeSaludo(nombre, sexo), nombre, fecha_cobro: d.fechaCobro, total: d.total },
      bloques: { cargos, secretaria: bloqueDeSecretaria('Contacto con Secretaría') },
    });
  }

  /**
   * El justificante de lo pagado en línea desde el área de hermanos, sin
   * enviar: va como aviso personal (al móvil, o por correo si no tiene).
   */
  static async correoJustificantePago(nombre: string, sexo: Sexo | undefined, d: { total: string; metodo: string; fecha: string; pedido: string; lineas: LineaDeImporte[] }) {
    return await PlantillasCorreoService.correo('justificante_pago', {
      campos: { saludo: textoDeSaludo(nombre, sexo), nombre, total: d.total, metodo: d.metodo, fecha: d.fecha, pedido: d.pedido },
      bloques: { detalle: tablaDeImportes(d.lineas, d.total) },
    });
  }

  /**
   * Un pago en línea que el banco cobró y no se pudo aplicar: se le dice a
   * quien pagó que se le devuelve. Sin saludo con nombre: muchos pagan sin
   * cuenta (la tienda, un donativo) y el pago no siempre lo sabe.
   */
  static async enviarPagoDevuelto(emailDestino: string, d: { importe: string; pedido: string; fecha: string }) {
    const { asunto, html, uso } = await PlantillasCorreoService.correo('pago_devuelto', {
      campos: { importe: d.importe, pedido: d.pedido, fecha: d.fecha },
      bloques: { secretaria: bloqueDeSecretaria('Contacto con Secretaría') },
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
  static async enviarAperturaPapeletas(emailDestino: string, nombreCuenta: string, fichas: string[], dias: string[], year: number, sexo: Sexo | undefined, salida: DatosDeLaApertura) {
    const { asunto, html, uso } = await EmailService.correoAperturaPapeletas(nombreCuenta, fichas, dias, year, sexo, salida);
    return await enviarCorreo(emailDestino, asunto, html, { uso });
  }

  /** El correo de la apertura ya maquetado, sin enviar: la apertura lo deja en la cola de correos. */
  static async correoAperturaPapeletas(nombreCuenta: string, fichas: string[], dias: string[], year: number, sexo: Sexo | undefined, salida: DatosDeLaApertura) {
    return await PlantillasCorreoService.correo('apertura', {
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
  }

  /**
   * A quien tenía cita para recoger la papeleta y no pasó. `fechaCita` es el
   * día de la cita, ya escrito para leerlo («lunes, 8 de marzo»).
   */
  static async correoRecordatorioAusencia(nombreHermano: string, fechaCita: string, salida: { nombre: string; articulo: Articulo }, sexo?: Sexo) {
    // Con el nombre de la salida y no «papeleta de sitio» ni «Estación de
    // Penitencia»: hay salidas sin ropa (el Rosario) a las que no les cuadra.
    return await PlantillasCorreoService.correo('papeleta_sin_recoger', {
      campos: {
        saludo: textoDeSaludo(nombreHermano, sexo), nombre: nombreHermano, salida: salida.nombre, fecha_cita: fechaCita,
        de_la_salida: deArticulo(salida.articulo, salida.nombre), la_salida: conArticulo(salida.articulo, salida.nombre),
      },
      bloques: { secretaria: bloqueDeSecretaria('Horario de reparto'), boton: boton('Ir al área de hermanos', urlDeLaWeb('/area-hermano/procesion')) },
    });
  }

  /**
   * La víspera de la cita para recoger la papeleta: uno por cuenta, con las
   * fichas que tienen cita ese día (una familia recibe uno, no uno por ficha).
   */
  static async correoRecordatorioCita(nombreCuenta: string, sexo: Sexo | undefined, d: { fichas: string[]; fechaCita: string; horario: string; salida: { nombre: string; articulo: Articulo } }) {
    const { salida } = d;
    return await PlantillasCorreoService.correo('cita_manana', {
      campos: {
        saludo: textoDeSaludo(nombreCuenta, sexo), nombre: nombreCuenta, salida: salida.nombre, fecha_cita: d.fechaCita, horario: d.horario,
        de_la_salida: deArticulo(salida.articulo, salida.nombre), la_salida: conArticulo(salida.articulo, salida.nombre),
      },
      bloques: {
        fichas: parrafo(d.fichas.length > 1 ? 'Tienen cita:' : 'Tiene cita:', 'margin-bottom: 6px;') + lista(d.fichas),
        secretaria: bloqueDeSecretaria('Horario de reparto'),
        boton: boton('Ir al área de hermanos', urlDeLaWeb('/area-hermano/procesion')),
      },
    });
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
