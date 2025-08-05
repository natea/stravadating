import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;
}

export class ErrorService {
  private static sentryInitialized = false;

  /**
   * Initialize error monitoring with Sentry
   */
  static initializeSentry(dsn?: string) {
    if (this.sentryInitialized || !dsn) return;

    Sentry.init({
      dsn,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: require('express')() }),
        new ProfilingIntegration(),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: 1.0,
      environment: process.env.NODE_ENV || 'development',
    });

    this.sentryInitialized = true;
    logger.info('Sentry error monitoring initialized');
  }

  /**
   * Create custom application error
   */
  static createError(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true,
    details?: any
  ): AppError {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    error.isOperational = isOperational;
    error.code = code;
    error.details = details;
    return error;
  }

  /**
   * Error handler middleware
   */
  static errorHandler = (
    error: AppError,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const {
      statusCode = 500,
      message,
      code,
      details,
      isOperational = true,
    } = error;

    // Log error
    logger.error('Application Error', {
      statusCode,
      message,
      code,
      details,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
    });

    // Send to Sentry if critical
    if (!isOperational && this.sentryInitialized) {
      Sentry.captureException(error, {
        extra: {
          statusCode,
          code,
          details,
          requestUrl: req.url,
          requestMethod: req.method,
          userId: (req as any).user?.id,
        },
      });
    }

    // Store error in database for analysis
    this.logErrorToDatabase(error, req).catch(err => {
      logger.error('Failed to log error to database:', err);
    });

    // Prepare response
    const isDevelopment = process.env.NODE_ENV === 'development';
    const response: any = {
      error: true,
      message: isOperational ? message : 'An unexpected error occurred',
      code,
    };

    if (isDevelopment) {
      response.details = details;
      response.stack = error.stack;
    }

    res.status(statusCode).json(response);
  };

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Log error to database
   */
  private static async logErrorToDatabase(error: AppError, req: Request) {
    try {
      await prisma.errorLog.create({
        data: {
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
          stack: error.stack,
          details: JSON.stringify(error.details),
          url: req.url,
          method: req.method,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          userId: (req as any).user?.id,
        },
      });
    } catch (err) {
      // Fail silently - don't break the app if logging fails
      logger.error('Database error logging failed:', err);
    }
  }

  /**
   * Not found handler
   */
  static notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    const error = this.createError(
      `Resource not found: ${req.originalUrl}`,
      404,
      'RESOURCE_NOT_FOUND'
    );
    next(error);
  };

  /**
   * Validation error handler
   */
  static validationError(errors: any) {
    return this.createError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      true,
      errors
    );
  }

  /**
   * Database error handler
   */
  static databaseError(err: any) {
    // Handle specific database errors
    if (err.code === 'P2002') {
      return this.createError(
        'A record with this value already exists',
        409,
        'DUPLICATE_ENTRY',
        true,
        { field: err.meta?.target }
      );
    }

    if (err.code === 'P2025') {
      return this.createError(
        'Record not found',
        404,
        'RECORD_NOT_FOUND'
      );
    }

    // Generic database error
    return this.createError(
      'Database operation failed',
      500,
      'DATABASE_ERROR',
      false,
      process.env.NODE_ENV === 'development' ? err : undefined
    );
  }

  /**
   * Strava API error handler
   */
  static stravaApiError(err: any) {
    if (err.response?.status === 401) {
      return this.createError(
        'Strava authentication expired',
        401,
        'STRAVA_AUTH_EXPIRED',
        true
      );
    }

    if (err.response?.status === 429) {
      return this.createError(
        'Strava API rate limit exceeded',
        429,
        'STRAVA_RATE_LIMIT',
        true,
        { retryAfter: err.response.headers['x-ratelimit-reset'] }
      );
    }

    return this.createError(
      'Strava API error',
      err.response?.status || 500,
      'STRAVA_API_ERROR',
      true,
      err.response?.data
    );
  }

  /**
   * Unauthorized error
   */
  static unauthorizedError(message: string = 'Unauthorized') {
    return this.createError(message, 401, 'UNAUTHORIZED');
  }

  /**
   * Forbidden error
   */
  static forbiddenError(message: string = 'Access denied') {
    return this.createError(message, 403, 'FORBIDDEN');
  }

  /**
   * Bad request error
   */
  static badRequestError(message: string, details?: any) {
    return this.createError(message, 400, 'BAD_REQUEST', true, details);
  }

  /**
   * Internal server error
   */
  static internalError(message: string = 'Internal server error', details?: any) {
    return this.createError(message, 500, 'INTERNAL_ERROR', false, details);
  }

  /**
   * Handle uncaught exceptions
   */
  static handleUncaughtException() {
    process.on('uncaughtException', (error: Error) => {
      logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
        error: error.message,
        stack: error.stack,
      });

      if (this.sentryInitialized) {
        Sentry.captureException(error);
      }

      // Give time for logs to be written
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }

  /**
   * Handle unhandled rejections
   */
  static handleUnhandledRejection() {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('UNHANDLED REJECTION! Shutting down...', {
        reason,
        promise,
      });

      if (this.sentryInitialized) {
        Sentry.captureException(new Error(`Unhandled Rejection: ${reason}`));
      }

      // Give time for logs to be written
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }

  /**
   * Graceful shutdown handler
   */
  static gracefulShutdown(server: any) {
    const shutdown = (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(() => {
        logger.info('HTTP server closed');

        // Close database connections
        prisma.$disconnect().then(() => {
          logger.info('Database connections closed');
          process.exit(0);
        });
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Health check endpoint
   */
  static async healthCheck(): Promise<{
    status: string;
    timestamp: Date;
    uptime: number;
    services: Record<string, boolean>;
  }> {
    const services: Record<string, boolean> = {};

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.database = true;
    } catch {
      services.database = false;
    }

    // Check Redis (if configured)
    if (process.env.REDIS_URL) {
      try {
        // Add Redis health check
        services.redis = true;
      } catch {
        services.redis = false;
      }
    }

    // Check Strava API
    try {
      // Add Strava API health check
      services.stravaApi = true;
    } catch {
      services.stravaApi = false;
    }

    const allHealthy = Object.values(services).every(status => status);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      uptime: process.uptime(),
      services,
    };
  }
}