export function notFoundMiddleware(_req, res, _next) {
  res.status(404).json({ error: 'NotFound', message: 'Rota não encontrada' });
}


