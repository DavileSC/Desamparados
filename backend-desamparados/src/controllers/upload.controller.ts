import { Request, Response } from 'express';
import { handleHttp } from '../utils/error.handle.js';
import { fileTypeFromFile } from 'file-type';
import path from 'path';
import fs from 'fs/promises';
import { scanBufferClamav } from '../utils/clamd.js';

export class UploadController {

  static async uploadFile(req: Request, res: Response) {
    try {
      const { file } = req;

      // Validación doble: Multer puede rechazar por tipo o tamaño antes de llegar aquí
      if (!file) {
        return res.status(400).json({ 
            error: 'No has subido ningún archivo o el formato no es válido (solo imágenes/PDF < 5MB)' 
        });
      }

      // ================== VALIDACIÓN DE SEGURIDAD POST-SUBIDA ==================
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      const filePath = file.path;

      // 1. Verificamos el tipo real del archivo leyendo sus "magic numbers"
      const fileTypeResult = await fileTypeFromFile(filePath);

      // 2. Si el tipo no es reconocido o no está en nuestra lista, lo borramos y rechazamos.
      if (!fileTypeResult || !allowedMimeTypes.includes(fileTypeResult.mime)) {
        await fs.unlink(filePath); // Borramos el archivo malicioso/inválido
        return res.status(400).json({ 
            error: 'El tipo de archivo real no es válido. Solo se permiten imágenes (jpg, png, webp) y PDF.' 
        });
      }

      // 2b. ANTI-SPOOFING: la extensión guardada debe corresponderse con el tipo REAL
      // detectado por magic numbers. Un JPEG renombrado a ".html" muere aquí:
      // nunca se servirá HTML desde nuestro dominio.
      const extOk: Record<string, string[]> = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'application/pdf': ['.pdf']
      };
      const realExt = path.extname(file.filename).toLowerCase();
      if (!extOk[fileTypeResult.mime].includes(realExt)) {
        await fs.unlink(filePath);
        return res.status(400).json({
            error: 'La extensión del archivo no coincide con su contenido real.'
        });
      }

      // 3. Advertimos si el mimetype del header no coincide con el real (señal de spoofing)
      if (file.mimetype !== fileTypeResult.mime) {
        console.warn(`[Security] Mismatch de Mime-Type detectado para ${file.originalname}. Header: ${file.mimetype}, Real: ${fileTypeResult.mime}`);
      }

      // ================== ANTIVIRUS OPCIONAL (ClamAV) ==================
      // Si el entorno define CLAMAV_HOST, escaneamos el contenido contra malware
      // (PDFs con exploits, imágenes polyglotas...). Sin CLAMAV_HOST se omite.
      const avResult = await scanBufferClamav(await fs.readFile(filePath));
      if (avResult.scanned && !avResult.clean) {
        await fs.unlink(filePath);
        console.error(`[Security] Archivo RECHAZADO por el antivirus: ${file.originalname} (${avResult.reason})`);
        return res.status(400).json({
            error: 'El archivo ha sido rechazado por el análisis antivirus.'
        });
      }

      // Generamos la URL pública usando una fuente confiable (Variable de entorno).
      // Evitamos usar req.get('host') para prevenir ataques de Host Header Injection.
      // Fallback a localhost para entornos de desarrollo locales.
      const baseUrl = process.env.API_URL || 'http://localhost:3001';
      
      // Construimos la URL que guardaremos en la DB
      const fileUrl = `${baseUrl}/storage/${file.filename}`;

      res.status(201).json({
        message: 'Archivo subido correctamente',
        data: {
            url: fileUrl,  
            filename: file.filename,
            type: file.mimetype,
            size: `${(file.size / 1024).toFixed(2)} KB`
        }
      });

    } catch (e) {
      handleHttp(res, e, 'Error subiendo archivo');
    }
  }
}