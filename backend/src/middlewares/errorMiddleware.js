import { HttpError } from '../exceptions/HttpError.js';

export function errorMiddleware(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.name,
      code: err.code,
      message: err.message,
      details: err.details
    });
  }
  console.error(err);
  return res.status(500).json({ error: 'InternalServerError', code: 'INTERNAL_ERROR', message: 'Ocorreu um erro inesperado.' });
}


