import { AuthService } from '../services/auth.service';
import { AuditoriaService } from '../services/auditoria.service';
import { PrimerAccesoService } from '../services/primer-acceso.service';
import { ponerCookieSesion } from '../utils/cookies';
import { manejar } from '../utils/manejar';

export class PrimerAccesoController {
  static listar = manejar('Error leyendo el primer acceso', async (req, res) => {
    res.status(200).json(await PrimerAccesoService.listar(req.query));
  });

  static invitar = manejar('Error mandando las invitaciones', async (req, res) => {
    res.status(202).json(await PrimerAccesoService.invitar(req.body.ids, AuditoriaService.metaFromReq(req)));
  });

  static datosDeLaInvitacion = manejar('Error leyendo la invitación', async (req, res) => {
    res.status(200).json(await PrimerAccesoService.datosDeLaInvitacion(req.body.token));
  });

  /** Pone la contraseña y deja la sesión del área de hermanos abierta, como un login. */
  static estrenar = manejar('Error estrenando la cuenta', async (req, res) => {
    const recordarme = req.body.recordarme === true;
    const { userId, role, token } = await PrimerAccesoService.estrenar(req.body.token, req.body.newPassword, recordarme);
    ponerCookieSesion(res, 'hermanos', token, role, recordarme);
    const user = await AuthService.perfilSesion(userId);
    res.status(200).json({ status: 'OK', user: { ...user, origen: 'hermanos' } });
  });

  static confirmar = manejar('Error confirmando la ficha', async (req, res) => {
    res.status(200).json(await PrimerAccesoService.confirmar(req.user!.id, AuditoriaService.metaFromReq(req)));
  });

  static fichaAjena = manejar('Error devolviendo la ficha', async (req, res) => {
    res.status(200).json(await PrimerAccesoService.fichaAjena(req.user!.id, Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });
}
