import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  limit?: number; // Maximum number of requests
  window?: number; // Time limit (seconds)
}

export const RateLimit = (options: RateLimitOptions = {}) =>
  SetMetadata(RATE_LIMIT_KEY, {
    limit: options.limit || 100, // Default 100 requests
    window: options.window || 3600, // Default 1 hour
  });
