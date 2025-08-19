export function notFoundMiddleware(req, res, _next) {
  res.status(404).json({
    error: 'NotFound',
    code: 'NOT_FOUND',
    message: 'Rota não encontrada',
    details: { method: req.method, path: req.path, url: req.originalUrl }
  });
}


