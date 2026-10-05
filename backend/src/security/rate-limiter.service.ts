/**
 * Rate Limiter Service
 * Service for rate limiting requests
 */

import { RateLimitConfig, RateLimitResult } from './types/security.types';

export class RateLimiterService {
  private requests: Map<string, { count: number; resetTime: Date }> = new Map();

  /**
   * Builds the storage key for a bucket. The scope is part of the key so that
   * different limiters (global, api, auth) never share counters for the same
   * identifier.
   */
  private buildKey(identifier: string, scope: string): string {
    return `${scope}:${identifier}`;
  }

  /**
   * Check if request is allowed
   */
  checkLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
    const now = new Date();
    const key = this.buildKey(identifier, config.scope);

    let requestInfo = this.requests.get(key);

    // Clean up expired entries
    if (requestInfo && requestInfo.resetTime <= now) {
      this.requests.delete(key);
      requestInfo = undefined;
    }

    if (!requestInfo) {
      requestInfo = {
        count: 0,
        resetTime: new Date(now.getTime() + config.windowMs),
      };
      this.requests.set(key, requestInfo);
    }

    requestInfo.count++;

    const remaining = Math.max(0, config.maxRequests - requestInfo.count);
    const success = remaining >= 0 && requestInfo.count <= config.maxRequests;

    // Sliding window: push the reset forward while the client keeps the
    // bucket below the limit, so throttling is spread out instead of piling
    // up at the start of every window.
    if (success) {
      requestInfo.resetTime = new Date(now.getTime() + config.windowMs);
    }

    return {
      success,
      limit: config.maxRequests,
      remaining,
      resetTime: requestInfo.resetTime,
    };
  }

  /**
   * Reset rate limit for an identifier within a scope
   */
  resetLimit(identifier: string, scope = 'default'): void {
    this.requests.delete(this.buildKey(identifier, scope));
  }

  /**
   * Get current usage for an identifier within a scope
   */
  getUsage(identifier: string, scope = 'default'): { count: number; resetTime: Date } | undefined {
    return this.requests.get(this.buildKey(identifier, scope));
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = new Date();
    for (const [identifier, info] of this.requests.entries()) {
      if (info.resetTime < now) {
        this.requests.delete(identifier);
      }
    }
  }
}
