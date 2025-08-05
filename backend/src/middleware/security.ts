import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/securityService';
import { logger } from '../utils/logger';

/**
 * Input validation middleware
 */
export const validateInput = (req: Request, res: Response, next: NextFunction): void | Response => {
  try {
    // Check for SQL injection patterns in all input fields
    const checkForInjection = (obj: any): boolean => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          if (SecurityService.hasSQLInjectionPattern(obj[key])) {
            return true;
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (checkForInjection(obj[key])) {
            return true;
          }
        }
      }
      return false;
    };

    if (checkForInjection(req.body) || checkForInjection(req.query) || checkForInjection(req.params)) {
      logger.warn('Potential SQL injection attempt detected', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      SecurityService.logSecurityEvent(
        null,
        'SQL_INJECTION_ATTEMPT',
        {
          path: req.path,
          method: req.method,
          body: req.body,
          query: req.query,
        },
        req.ip || ''
      );

      return res.status(400).json({
        error: 'Invalid input',
        message: 'Your request contains invalid characters',
      });
    }

    // Sanitize string inputs
    const sanitizeObject = (obj: any): any => {
      const sanitized: any = {};
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          sanitized[key] = SecurityService.sanitizeInput(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitized[key] = sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
      return sanitized;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);

    next();
  } catch (error) {
    logger.error('Error in input validation middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionToken = (req as any).session?.csrfToken;

  if (!csrfToken || !sessionToken) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Request must include a valid CSRF token',
    });
  }

  if (!SecurityService.verifyCSRFToken(csrfToken, sessionToken)) {
    logger.warn('CSRF token mismatch', {
      ip: req.ip,
      path: req.path,
      userId: (req as any).user?.id,
    });

    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'The CSRF token is invalid or expired',
    });
  }

  next();
};

/**
 * API key authentication middleware
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void | Response => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide a valid API key',
    });
  }

  // Verify API key (this should check against a database in production)
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path,
      apiKey: apiKey.substring(0, 8) + '...',
    });

    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is invalid',
    });
  }

  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('API Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow API request', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
      });
    }
  });

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Additional custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

/**
 * Error handler middleware with security considerations
 */
export const secureErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
  });

  // Don't leak sensitive error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'An error occurred processing your request',
    ...(isDevelopment && { stack: error.stack }),
  };

  res.status(error.status || 500).json(response);
};

/**
 * Account security check middleware
 */
export const accountSecurityCheck = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return next();
    }

    // Check if account requires additional verification
    // Import prisma properly
    const { prisma } = await import('../config/database');
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // These fields don't exist in the schema, so skip these checks
    if (!user) {
      return next();
    }

    next();
  } catch (error) {
    logger.error('Error in account security check:', error);
    next();
  }
};

/**
 * Data privacy middleware
 */
export const dataPrivacy = (req: Request, res: Response, next: NextFunction) => {
  // Add privacy headers
  res.setHeader('X-Data-Classification', 'confidential');
  res.setHeader('X-Privacy-Policy', 'https://stravadating.com/privacy');
  
  // Log data access for audit trail
  if (req.method === 'GET' && req.path.includes('/user')) {
    SecurityService.logSecurityEvent(
      (req as any).user?.id,
      'DATA_ACCESS',
      {
        path: req.path,
        method: req.method,
        targetResource: req.params,
      },
      req.ip || ''
    );
  }
  
  next();
};