import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../config/database';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export interface SecurityConfig {
  encryptionKey: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  sessionTimeout: number; // in minutes
  dataRetentionDays: number;
}

export class SecurityService {
  private static config: SecurityConfig = {
    encryptionKey: process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
    jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    sessionTimeout: 60,
    dataRetentionDays: 365,
  };

  private static algorithm = 'aes-256-gcm';

  /**
   * Encrypt sensitive data
   */
  static encryptData(data: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.config.encryptionKey, 'hex').slice(0, 32),
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt sensitive data
   */
  static decryptData(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(this.config.encryptionKey, 'hex').slice(0, 32),
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate secure token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate JWT token
   */
  static generateJWT(payload: any, expiresIn: string = '1h'): string {
    return jwt.sign(payload, this.config.jwtSecret, { expiresIn });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: any): string {
    return jwt.sign(payload, this.config.jwtRefreshSecret, { expiresIn: '7d' });
  }

  /**
   * Verify JWT token
   */
  static verifyJWT(token: string): any {
    return jwt.verify(token, this.config.jwtSecret);
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): any {
    return jwt.verify(token, this.config.jwtRefreshSecret);
  }

  /**
   * Create rate limiter for API endpoints
   */
  static createRateLimiter(windowMs: number = 15 * 60 * 1000, max: number = 100) {
    return rateLimit({
      windowMs,
      max,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: req.rateLimit?.resetTime,
        });
      },
    });
  }

  /**
   * Login rate limiter (stricter)
   */
  static loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    skipSuccessfulRequests: true,
    message: 'Too many login attempts, please try again later.',
  });

  /**
   * Get security headers middleware
   */
  static getSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.strava.com"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xssFilter: true,
    });
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input: string): string {
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>?/gm, '');
    
    // Remove script tags specifically
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Escape special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return sanitized.trim();
  }

  /**
   * Check for SQL injection patterns
   */
  static hasSQLInjectionPattern(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE|ORDER BY|GROUP BY|HAVING)\b)/gi,
      /('|(--|\/\*|\*\/|;))/g,
      /(xp_|sp_|0x)/gi,
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate and sanitize email
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && !this.hasSQLInjectionPattern(email);
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify CSRF token
   */
  static verifyCSRFToken(token: string, sessionToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(sessionToken)
    );
  }

  /**
   * Log security event
   */
  static async logSecurityEvent(
    userId: string | null,
    eventType: string,
    details: any,
    ipAddress: string
  ): Promise<void> {
    await prisma.securityLog.create({
      data: {
        userId,
        eventType,
        details: JSON.stringify(details),
        ipAddress,
        userAgent: details.userAgent || null,
      },
    });
  }

  /**
   * Check for account lockout
   */
  static async checkAccountLockout(email: string): Promise<boolean> {
    const recentAttempts = await prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: {
          gte: new Date(Date.now() - this.config.lockoutDuration * 60 * 1000),
        },
      },
    });

    return recentAttempts >= this.config.maxLoginAttempts;
  }

  /**
   * Record login attempt
   */
  static async recordLoginAttempt(
    email: string,
    success: boolean,
    ipAddress: string
  ): Promise<void> {
    await prisma.loginAttempt.create({
      data: {
        email,
        success,
        ipAddress,
      },
    });

    // Clean up old attempts
    await prisma.loginAttempt.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours
        },
      },
    });
  }

  /**
   * Anonymize user data
   */
  static async anonymizeUserData(userId: string): Promise<void> {
    // Generate anonymous identifiers
    const anonymousEmail = `deleted_${crypto.randomBytes(8).toString('hex')}@anonymous.com`;
    const anonymousName = 'Deleted User';

    // Update user record
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail,
        firstName: anonymousName,
        lastName: '',
        bio: null,
        photos: [],
        stravaAthleteId: null,
        stravaAccessToken: null,
        stravaRefreshToken: null,
        isDeleted: true,
      },
    });

    // Delete sensitive data
    await prisma.stravaActivity.deleteMany({ where: { userId } });
    await prisma.fitnessStats.deleteMany({ where: { userId } });
    await prisma.message.updateMany({
      where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      data: { isDeleted: true },
    });
  }

  /**
   * Export user data for GDPR compliance
   */
  static async exportUserData(userId: string): Promise<any> {
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        fitnessStats: true,
        matchingPreferences: true,
        sentMessages: {
          select: {
            id: true,
            content: false, // Don't include encrypted content
            createdAt: true,
            recipientId: true,
          },
        },
        receivedMessages: {
          select: {
            id: true,
            content: false,
            createdAt: true,
            senderId: true,
          },
        },
        matchesAsUser1: {
          select: {
            id: true,
            user2Id: true,
            compatibilityScore: true,
            matchedAt: true,
          },
        },
        matchesAsUser2: {
          select: {
            id: true,
            user1Id: true,
            compatibilityScore: true,
            matchedAt: true,
          },
        },
      },
    });

    // Remove sensitive tokens
    if (userData) {
      delete (userData as any).stravaAccessToken;
      delete (userData as any).stravaRefreshToken;
    }

    return userData;
  }

  /**
   * Verify data retention compliance
   */
  static async cleanupOldData(): Promise<void> {
    const retentionDate = new Date(
      Date.now() - this.config.dataRetentionDays * 24 * 60 * 60 * 1000
    );

    // Delete old security logs
    await prisma.securityLog.deleteMany({
      where: {
        createdAt: { lt: retentionDate },
      },
    });

    // Delete old login attempts
    await prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days
      },
    });

    // Archive old messages
    await prisma.message.updateMany({
      where: {
        createdAt: { lt: retentionDate },
        isDeleted: false,
      },
      data: {
        isArchived: true,
      },
    });
  }

  /**
   * Session validation middleware
   */
  static validateSession() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = this.verifyJWT(token);
        
        // Check if session is expired
        const session = await prisma.session.findUnique({
          where: { id: decoded.sessionId },
        });

        if (!session || session.expiresAt < new Date()) {
          return res.status(401).json({ error: 'Session expired' });
        }

        // Update session activity
        await prisma.session.update({
          where: { id: session.id },
          data: {
            lastActivity: new Date(),
            expiresAt: new Date(Date.now() + this.config.sessionTimeout * 60 * 1000),
          },
        });

        (req as any).user = decoded;
        (req as any).sessionId = session.id;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };
  }

  /**
   * IP-based access control
   */
  static ipAccessControl(allowedIPs: string[] = []) {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip || req.connection.remoteAddress || '';
      
      if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Your IP address is not authorized to access this resource',
        });
      }
      
      next();
    };
  }
}