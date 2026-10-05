/**
 * Security Middleware
 * Express middleware for security features
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from '../rate-limiter.service';

const rateLimiter = new RateLimiterService();

/**
 * Rate limiting middleware
 */
export const rateLimit = (windowMs: number = 60000, maxRequests: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    const result = rateLimiter.checkLimit(identifier, {
      windowMs,
      maxRequests,
    });

    res.setHeader('X-RateLimit-Limit', result.limit.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());

    if (!result.success) {
      return res.status(429).json({
        error: 'Too many requests',
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetTime,
      });
    }

    next();
  };
};

/**
 * Strict rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit(15 * 60 * 1000, process.env.NODE_ENV === 'development' ? 100 : 5); // 100 requests in dev, 5 in prod per 15 minutes

/**
 * API rate limiting
 */
export const apiRateLimit = rateLimit(60 * 1000, 100); // 100 requests per minute

/**
 * Global rate limiting
 */
export const globalRateLimit = rateLimit(60 * 1000, 1000); // 1000 requests per minute

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * CORS middleware
 */
export const cors = (origin: string | string[] = '*') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = Array.isArray(origin) ? origin : [origin];
    const requestOrigin = req.headers.origin;

    if (allowedOrigins.includes('*') || (requestOrigin && allowedOrigins.includes(requestOrigin))) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
};

/**
 * Request ID middleware
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};
