import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';

export interface ApiError {
  statusCode: number;
  message: string;
  code: string;
  details?: Record<string, unknown> | undefined;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;

  constructor(statusCode: number, message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export function createApiError(statusCode: number, message: string, code: string, details?: Record<string, unknown>): AppError {
  return new AppError(statusCode, message, code, details);
}

export const errorHandler: ErrorRequestHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', error);

  if (error instanceof AppError) {
    const response: ApiError = {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
    };
    if (error.details !== undefined) {
      Object.assign(response, { details: error.details });
    }
    res.status(error.statusCode).json(response);
    return;
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    res.status(400).json({
      statusCode: 400,
      message: error.message,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    res.status(400).json({
      statusCode: 400,
      message: 'Invalid resource identifier',
      code: 'INVALID_ID',
    });
    return;
  }

  // Default server error
  res.status(500).json({
    statusCode: 500,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};
