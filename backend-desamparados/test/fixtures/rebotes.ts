/**
 * Un rebote como el que deja el servidor de OVH en el buzón que envía
 * (Postfix: multipart/report con su parte message/delivery-status, RFC 3464).
 */
export interface DestinatarioDelInforme { email: string; estado: string; accion?: string; diagnostico?: string }

export function informeDeRebote(destinatarios: DestinatarioDelInforme[]): string {
  const bloques = destinatarios.map((d) => [
    `Final-Recipient: rfc822; ${d.email}`,
    `Original-Recipient: rfc822;${d.email}`,
    `Action: ${d.accion ?? 'failed'}`,
    `Status: ${d.estado}`,
    'Remote-MTA: dns; mx.ejemplo.test',
    ...(d.diagnostico ? [`Diagnostic-Code: ${d.diagnostico}`] : []),
  ].join('\r\n'));
  return [
    'Return-Path: <>',
    'From: MAILER-DAEMON@mail.ovh.net (Mail Delivery System)',
    'Subject: Undelivered Mail Returned to Sender',
    'Auto-Submitted: auto-replied',
    'MIME-Version: 1.0',
    'Content-Type: multipart/report; report-type=delivery-status;',
    '\tboundary="ABC123.1700000000/mail.ovh.net"',
    '',
    'This is a MIME-encapsulated message.',
    '',
    '--ABC123.1700000000/mail.ovh.net',
    'Content-Description: Notification',
    'Content-Type: text/plain; charset=us-ascii',
    '',
    'I\'m sorry to have to inform you that your message could not',
    'be delivered to one or more recipients.',
    '',
    '--ABC123.1700000000/mail.ovh.net',
    'Content-Description: Delivery report',
    'Content-Type: message/delivery-status',
    '',
    'Reporting-MTA: dns; mo1.mail.ovh.net',
    'X-Postfix-Queue-ID: ABC123',
    'Arrival-Date: Tue, 24 Nov 2026 10:00:00 +0100 (CET)',
    '',
    bloques.join('\r\n\r\n'),
    '',
    '--ABC123.1700000000/mail.ovh.net',
    'Content-Description: Undelivered Message Headers',
    'Content-Type: text/rfc822-headers',
    '',
    'From: "Desamparados" <noreply@ejemplo.test>',
    'Subject: Cultos',
    '',
    '--ABC123.1700000000/mail.ovh.net--',
    '',
  ].join('\r\n');
}
