import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';
import { logger, logError } from '../utils/logger';

// Error handler middleware
export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logError(error, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error values
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';

  // Handle known ApiError instances
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  }
  // Handle validation errors
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  }
  // Handle database errors
  else if (error.message.includes('SQLITE')) {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
  }
  // Handle network/RPC errors
  else if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  }
  // Handle JSON parsing errors
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    code: code,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error.message
    })
  });
};

// Async error wrapper
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
};

// Validation error handler
export const validationErrorHandler = (errors: any[]) => {
  const formattedErrors = errors.map(error => ({
    field: error.param,
    message: error.msg,
    value: error.value
  }));

  throw new ApiError(
    `Validation failed: ${formattedErrors.map(e => e.message).join(', ')}`,
    400,
    'VALIDATION_ERROR'
  );
};