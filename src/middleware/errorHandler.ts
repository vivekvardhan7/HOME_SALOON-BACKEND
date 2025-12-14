import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle database errors (Supabase/PostgreSQL)
  if (error.code) {
    switch (error.code) {
      case '23505': // Unique constraint violation (Supabase/PostgreSQL)
        statusCode = 409;
        message = 'Resource already exists';
        break;
      case 'PGRST116': // Not found (Supabase)
        statusCode = 404;
        message = 'Resource not found';
        break;
      case '23503': // Foreign key violation
        statusCode = 400;
        message = 'Invalid foreign key reference';
        break;
      default:
        statusCode = 400;
        message = 'Database operation failed';
    }
  }
  
  // Handle validation errors
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    statusCode = 400;
    message = 'Invalid data provided';
  }
  
  // Handle database connection errors
  if (error.message?.includes('connection') || error.message?.includes('database')) {
    statusCode = 503;
    message = 'Database connection failed';
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  }

  // Handle cast errors (MongoDB)
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Log error for debugging
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error class
export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error responses
export const errorResponses = {
  notFound: (resource: string = 'Resource') => ({
    success: false,
    message: `${resource} not found`
  }),

  unauthorized: (message: string = 'Unauthorized access') => ({
    success: false,
    message
  }),

  forbidden: (message: string = 'Access forbidden') => ({
    success: false,
    message
  }),

  validationFailed: (details: any) => ({
    success: false,
    message: 'Validation failed',
    details
  }),

  serverError: (message: string = 'Internal server error') => ({
    success: false,
    message
  })
};