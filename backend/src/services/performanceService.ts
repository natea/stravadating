import { createClient } from 'redis';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

export class PerformanceService {
  private static redisClient: any = null;
  private static cacheEnabled = false;

  /**
   * Initialize Redis connection for caching
   */
  static async initializeRedis(url?: string) {
    if (!url) {
      logger.info('Redis URL not provided, caching disabled');
      return;
    }

    try {
      this.redisClient = createClient({ url });
      
      this.redisClient.on('error', (err: any) => {
        logger.error('Redis Client Error:', err);
        this.cacheEnabled = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis client connected');
        this.cacheEnabled = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.cacheEnabled = false;
    }
  }

  /**
   * Cache middleware
   */
  static cacheMiddleware(ttl: number = 300) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.cacheEnabled || req.method !== 'GET') {
        return next();
      }

      const key = `cache:${req.originalUrl}:${(req as any).user?.id || 'anonymous'}`;

      try {
        const cached = await this.redisClient.get(key);
        
        if (cached) {
          logger.debug('Cache hit:', key);
          return res.json(JSON.parse(cached));
        }

        // Store original send function
        const originalSend = res.json.bind(res);
        
        // Override json method to cache the response
        res.json = (body: any) => {
          if (res.statusCode === 200) {
            this.redisClient.setEx(key, ttl, JSON.stringify(body)).catch((err: any) => {
              logger.error('Failed to cache response:', err);
            });
          }
          return originalSend(body);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidateCache(pattern: string) {
    if (!this.cacheEnabled) return;

    try {
      const keys = await this.redisClient.keys(`cache:${pattern}*`);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Get compression middleware
   */
  static getCompressionMiddleware() {
    return compression({
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // Balance between speed and compression ratio
    });
  }

  /**
   * Database query optimization
   */
  static async optimizeQuery<T>(
    query: () => Promise<T>,
    cacheKey?: string,
    ttl: number = 300
  ): Promise<T> {
    // Try cache first
    if (cacheKey && this.cacheEnabled) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.error('Cache retrieval error:', error);
      }
    }

    // Execute query
    const result = await query();

    // Cache result
    if (cacheKey && this.cacheEnabled && result) {
      try {
        await this.redisClient.setEx(cacheKey, ttl, JSON.stringify(result));
      } catch (error) {
        logger.error('Cache storage error:', error);
      }
    }

    return result;
  }

  /**
   * Batch database operations
   */
  static async batchOperation<T>(
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    return await prisma.$transaction(operations.map(op => op()));
  }

  /**
   * Connection pooling configuration
   */
  static getDatabaseConfig() {
    return {
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
    };
  }

  /**
   * Lazy loading implementation
   */
  static lazyLoad<T>(
    loader: () => Promise<T>,
    options: {
      preload?: boolean;
      cacheKey?: string;
      ttl?: number;
    } = {}
  ) {
    let promise: Promise<T> | null = null;
    let result: T | null = null;
    let error: Error | null = null;

    const load = async () => {
      if (error) throw error;
      if (result !== null) return result;
      
      if (!promise) {
        promise = loader()
          .then(res => {
            result = res;
            return res;
          })
          .catch(err => {
            error = err;
            throw err;
          });
      }
      
      return promise;
    };

    if (options.preload) {
      load().catch(() => {}); // Preload in background
    }

    return {
      get: load,
      reset: () => {
        promise = null;
        result = null;
        error = null;
      },
    };
  }

  /**
   * Image optimization settings
   */
  static getImageOptimizationConfig() {
    return {
      sizes: {
        thumbnail: { width: 150, height: 150 },
        small: { width: 320, height: 320 },
        medium: { width: 640, height: 640 },
        large: { width: 1024, height: 1024 },
      },
      formats: ['webp', 'jpg'],
      quality: {
        webp: 85,
        jpg: 80,
      },
    };
  }

  /**
   * CDN configuration
   */
  static getCDNConfig() {
    return {
      enabled: process.env.CDN_ENABLED === 'true',
      baseUrl: process.env.CDN_BASE_URL || '',
      staticAssets: [
        '/images',
        '/css',
        '/js',
        '/fonts',
      ],
      cacheControl: {
        images: 'public, max-age=31536000, immutable',
        css: 'public, max-age=31536000, immutable',
        js: 'public, max-age=31536000, immutable',
        fonts: 'public, max-age=31536000, immutable',
      },
    };
  }

  /**
   * Performance monitoring
   */
  static performanceMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Log slow requests
        if (duration > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            url: req.originalUrl,
            duration: `${duration}ms`,
            statusCode: res.statusCode,
          });
        }

        // Store metrics
        this.storePerformanceMetric({
          endpoint: req.originalUrl,
          method: req.method,
          duration,
          statusCode: res.statusCode,
          timestamp: new Date(),
        }).catch(err => {
          logger.error('Failed to store performance metric:', err);
        });
      });

      next();
    };
  }

  /**
   * Store performance metrics
   */
  private static async storePerformanceMetric(metric: any) {
    if (this.cacheEnabled) {
      const key = `metrics:${Date.now()}`;
      await this.redisClient.setEx(key, 86400, JSON.stringify(metric)); // Store for 24 hours
    }
  }

  /**
   * Get performance metrics
   */
  static async getPerformanceMetrics(timeRange: number = 3600000) {
    if (!this.cacheEnabled) {
      return { message: 'Metrics not available - Redis not configured' };
    }

    try {
      const keys = await this.redisClient.keys('metrics:*');
      const now = Date.now();
      const cutoff = now - timeRange;
      
      const metrics = [];
      for (const key of keys) {
        const timestamp = parseInt(key.split(':')[1]);
        if (timestamp > cutoff) {
          const metric = await this.redisClient.get(key);
          if (metric) {
            metrics.push(JSON.parse(metric));
          }
        }
      }

      // Calculate statistics
      const stats = {
        totalRequests: metrics.length,
        averageResponseTime: 0,
        slowestEndpoint: '',
        fastestEndpoint: '',
        errorRate: 0,
      };

      if (metrics.length > 0) {
        const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
        stats.averageResponseTime = Math.round(totalDuration / metrics.length);
        
        const sorted = metrics.sort((a, b) => b.duration - a.duration);
        stats.slowestEndpoint = sorted[0]?.endpoint || '';
        stats.fastestEndpoint = sorted[sorted.length - 1]?.endpoint || '';
        
        const errors = metrics.filter(m => m.statusCode >= 400).length;
        stats.errorRate = (errors / metrics.length) * 100;
      }

      return {
        stats,
        recentMetrics: metrics.slice(-10),
      };
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      return { error: 'Failed to retrieve metrics' };
    }
  }

  /**
   * Load testing utilities
   */
  static async runLoadTest(config: {
    endpoint: string;
    method: string;
    concurrency: number;
    iterations: number;
    payload?: any;
  }) {
    const results = [];
    const { endpoint, method, concurrency, iterations, payload } = config;

    for (let i = 0; i < iterations; i++) {
      const batch = [];
      
      for (let j = 0; j < concurrency; j++) {
        batch.push(
          fetch(endpoint, {
            method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: payload ? JSON.stringify(payload) : undefined,
          }).then(res => ({
            status: res.status,
            time: Date.now(),
          }))
        );
      }

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    return {
      totalRequests: results.length,
      successfulRequests: results.filter(r => r.status < 400).length,
      failedRequests: results.filter(r => r.status >= 400).length,
      averageResponseTime: 0, // Calculate based on actual timings
    };
  }
}