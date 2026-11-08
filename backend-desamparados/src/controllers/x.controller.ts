import { manejar } from '../utils/manejar.js';
import { XService } from '../services/redes/x.service.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';

export class XController {
  static estado = manejar('Error leyendo la cuenta de X', async (_req, res) => {
    res.json(await XService.estado());
  });

  static conectar = manejar('Error conectando X', async (req, res) => {
    const { apiKey, apiSecret, accessToken, accessSecret } = req.body;
    const estado = await XService.conectar({ apiKey, apiSecret, accessToken, accessSecret }, req.user?.id);
    // El usuario de la cuenta sí: es público y dice a dónde se publica. Las claves, nunca.
    AuditoriaService.log(ACCIONES_AUDITORIA.X_CONECTAR, AuditoriaService.metaFromReq(req), 'x', undefined, { usuario: estado.usuario });
    res.json(estado);
  });

  static desconectar = manejar('Error desconectando X', async (req, res) => {
    await XService.desconectar();
    AuditoriaService.log(ACCIONES_AUDITORIA.X_DESCONECTAR, AuditoriaService.metaFromReq(req), 'x');
    res.json(await XService.estado());
  });

  static publicarNoticia = manejar('Error publicando la noticia en X', async (req, res) => {
    const id = Number(req.params.id);
    const publicada = await XService.publicarNoticia(id, req.body.texto, { conFoto: req.body.conFoto, otraVez: req.body.otraVez === true });
    AuditoriaService.log(ACCIONES_AUDITORIA.NOTICIA_X, AuditoriaService.metaFromReq(req), 'noticia', id);
    res.json(publicada);
  });
}
