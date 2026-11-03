import { manejar } from '../utils/manejar.js';
import { InstagramService } from '../services/redes/instagram.service.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';

export class InstagramController {
  static estado = manejar('Error leyendo la cuenta de Instagram', async (_req, res) => {
    res.json(await InstagramService.estado());
  });

  static conectar = manejar('Error conectando Instagram', async (req, res) => {
    const estado = await InstagramService.conectar(req.body.token, req.user?.id);
    // El usuario de la cuenta sí: es público y dice a dónde se publica. El token, nunca.
    AuditoriaService.log(ACCIONES_AUDITORIA.INSTAGRAM_CONECTAR, AuditoriaService.metaFromReq(req), 'instagram', undefined, { usuario: estado.usuario });
    res.json(estado);
  });

  static desconectar = manejar('Error desconectando Instagram', async (req, res) => {
    await InstagramService.desconectar();
    AuditoriaService.log(ACCIONES_AUDITORIA.INSTAGRAM_DESCONECTAR, AuditoriaService.metaFromReq(req), 'instagram');
    res.json(await InstagramService.estado());
  });

  static publicarNoticia = manejar('Error publicando la noticia en Instagram', async (req, res) => {
    const id = Number(req.params.id);
    const publicada = await InstagramService.publicarNoticia(id, req.body.pie, { otraVez: req.body.otraVez === true });
    AuditoriaService.log(ACCIONES_AUDITORIA.NOTICIA_INSTAGRAM, AuditoriaService.metaFromReq(req), 'noticia', id);
    res.json(publicada);
  });
}
