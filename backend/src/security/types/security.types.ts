/**
 * Security Module Types
 * Type definitions for security features
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  scope: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  ivSize: number;
}

export interface EncryptedData {
  iv: string;
  encrypted: string;
  authTag: string;
}

export interface SecurityConfig {
  rateLimit: {
    global: RateLimitConfig;
    api: RateLimitConfig;
    auth: RateLimitConfig;
  };
  encryption: EncryptionConfig;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    hsts: boolean;
    noSniff: boolean;
  };
}
