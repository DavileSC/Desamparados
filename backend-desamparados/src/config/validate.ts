import { Request, Response, NextFunction } from 'express';
import { Type, ArkErrors } from 'arktype';

export const validate = (schema: Type<any>) => (req: Request, res: Response, next: NextFunction) => {
  // ArkType valida de forma síncrona y devuelve:
  //  - Los datos validados (con la misma estructura de entrada) si todo va bien
  //  - Una instancia de ArkErrors si algo falla
  const result = schema({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (result instanceof ArkErrors) {
    return res.status(400).json({
      status: 'error',
      message: 'Error de validación',
      errors: [...result].map((problem) => ({
        field: problem.path.join('.').replace(/^(body\.|query\.|params\.)/, ''),
        // Traducimos el prefijo "Must" de ArkType para que quede natural en español
        message: problem.message.replace(/^Must be/, 'Debe ser').replace(/^Must/, 'Debe')
      }))
    });
  }

  // Reemplazamos los datos con la versión validada y tipada
  const validData = result as unknown as Record<string, any>;
  if (validData?.body) req.body = validData.body;
  // OJO: En Express 5, 'query' y 'params' son getters de solo lectura en el prototype,
  // por lo que hay que redefinirlos a nivel de instancia con defineProperty.
  if (validData?.query) Object.defineProperty(req, 'query', { value: validData.query });
  if (validData?.params) Object.defineProperty(req, 'params', { value: validData.params });

  next();
};