export class HttpError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode || 500;
    this.details = details;
    this.code = code || 'HTTP_ERROR';
    Error.captureStackTrace?.(this, HttpError);
  }
}


export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', details, code = 'BAD_REQUEST') { super(400, message, details, code); this.name = 'BadRequestError'; }
}

export class ValidationError extends HttpError {
  constructor(message = 'Invalid request', details) { super(400, message, details, 'VALIDATION_ERROR'); this.name = 'ValidationError'; }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', details, code = 'NOT_FOUND') { super(404, message, details, code); this.name = 'NotFoundError'; }
}

export class RateLimitError extends HttpError {
  constructor(message = 'Too Many Requests', details) { super(429, message, details, 'RATE_LIMITED'); this.name = 'RateLimitError'; }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', details) { super(500, message, details, 'INTERNAL_ERROR'); this.name = 'InternalServerError'; }
}

export class LlmProviderError extends HttpError {
  constructor(message = 'LLM provider error', details) { super(502, message, details, 'LLM_PROVIDER_ERROR'); this.name = 'LlmProviderError'; }
}


