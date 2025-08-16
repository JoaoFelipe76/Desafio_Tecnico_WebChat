export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode || 500;
    this.details = details;
    Error.captureStackTrace?.(this, HttpError);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', details) { super(400, message, details); this.name = 'BadRequestError'; }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', details) { super(404, message, details); this.name = 'NotFoundError'; }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', details) { super(500, message, details); this.name = 'InternalServerError'; }
}


