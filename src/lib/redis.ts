import Redis from 'ioredis';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  showFriendlyErrorStack: process.env.NODE_ENV === 'development',
};

// Create Redis client
export const redis = new Redis(redisConfig);

// Redis event handlers
redis.on('connect', () => {
  console.log('Redis client connected');
});

redis.on('ready', () => {
  console.log('Redis client ready');
});

redis.on('error', (error) => {
  console.error('Redis client error:', error);
});

redis.on('close', () => {
  console.log('Redis client connection closed');
});

redis.on('reconnecting', () => {
  console.log('Redis client reconnecting...');
});

// Redis utility functions
export class RedisService {
  // Set key with expiration
  static async set(key: string, value: any, expireSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (expireSeconds) {
        await redis.setex(key, expireSeconds, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  }

  // Get value by key
  static async get(key: string): Promise<any> {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  // Delete key
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
      throw error;
    }
  }

  // Check if key exists
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  // Set expiration for existing key
  static async expire(key: string, seconds: number): Promise<void> {
    try {
      await redis.expire(key, seconds);
    } catch (error) {
      console.error('Redis expire error:', error);
      throw error;
    }
  }

  // Get time to live for key
  static async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  }

  // Increment counter
  static async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error('Redis incr error:', error);
      throw error;
    }
  }

  // Decrement counter
  static async decr(key: string): Promise<number> {
    try {
      return await redis.decr(key);
    } catch (error) {
      console.error('Redis decr error:', error);
      throw error;
    }
  }

  // Set hash field
  static async hset(key: string, field: string, value: any): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await redis.hset(key, field, serializedValue);
    } catch (error) {
      console.error('Redis hset error:', error);
      throw error;
    }
  }

  // Get hash field
  static async hget(key: string, field: string): Promise<any> {
    try {
      const value = await redis.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis hget error:', error);
      return null;
    }
  }

  // Get all hash fields
  static async hgetall(key: string): Promise<Record<string, any>> {
    try {
      const hash = await redis.hgetall(key);
      const result: Record<string, any> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Redis hgetall error:', error);
      return {};
    }
  }

  // Delete hash field
  static async hdel(key: string, field: string): Promise<void> {
    try {
      await redis.hdel(key, field);
    } catch (error) {
      console.error('Redis hdel error:', error);
      throw error;
    }
  }

  // Add to set
  static async sadd(key: string, member: string): Promise<void> {
    try {
      await redis.sadd(key, member);
    } catch (error) {
      console.error('Redis sadd error:', error);
      throw error;
    }
  }

  // Remove from set
  static async srem(key: string, member: string): Promise<void> {
    try {
      await redis.srem(key, member);
    } catch (error) {
      console.error('Redis srem error:', error);
      throw error;
    }
  }

  // Check if member exists in set
  static async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await redis.sismember(key, member);
      return result === 1;
    } catch (error) {
      console.error('Redis sismember error:', error);
      return false;
    }
  }

  // Get all set members
  static async smembers(key: string): Promise<string[]> {
    try {
      return await redis.smembers(key);
    } catch (error) {
      console.error('Redis smembers error:', error);
      return [];
    }
  }

  // Add to sorted set
  static async zadd(key: string, score: number, member: string): Promise<void> {
    try {
      await redis.zadd(key, score, member);
    } catch (error) {
      console.error('Redis zadd error:', error);
      throw error;
    }
  }

  // Get sorted set range
  static async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await redis.zrange(key, start, stop);
    } catch (error) {
      console.error('Redis zrange error:', error);
      return [];
    }
  }

  // Get sorted set range with scores
  static async zrangeWithScores(key: string, start: number, stop: number): Promise<Array<[string, number]>> {
    try {
      const result = await redis.zrange(key, start, stop, 'WITHSCORES');
      // Convert string array to [string, number][] pairs
      const pairs: Array<[string, number]> = [];
      for (let i = 0; i < result.length; i += 2) {
        pairs.push([result[i], parseFloat(result[i + 1])]);
      }
      return pairs;
    } catch (error) {
      console.error('Redis zrangeWithScores error:', error);
      return [];
    }
  }

  // Remove from sorted set
  static async zrem(key: string, member: string): Promise<void> {
    try {
      await redis.zrem(key, member);
    } catch (error) {
      console.error('Redis zrem error:', error);
      throw error;
    }
  }

  // Flush all keys (use with caution)
  static async flushall(): Promise<void> {
    try {
      await redis.flushall();
    } catch (error) {
      console.error('Redis flushall error:', error);
      throw error;
    }
  }

  // Get Redis info
  static async info(): Promise<string> {
    try {
      return await redis.info();
    } catch (error) {
      console.error('Redis info error:', error);
      return '';
    }
  }

  // Ping Redis
  static async ping(): Promise<string> {
    try {
      return await redis.ping();
    } catch (error) {
      console.error('Redis ping error:', error);
      throw error;
    }
  }
}

// Cache decorator for methods
export function cache(ttlSeconds: number = 300) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      try {
        // Try to get from cache
        const cached = await RedisService.get(cacheKey);
        if (cached !== null) {
          return cached;
        }

        // Execute method and cache result
        const result = await method.apply(this, args);
        await RedisService.set(cacheKey, result, ttlSeconds);
        
        return result;
      } catch (error) {
        // If caching fails, just execute the method
        console.error('Cache error:', error);
        return await method.apply(this, args);
      }
    };
  };
}

// Rate limiting utility
export class RateLimiter {
  static async isAllowed(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    try {
      const current = await RedisService.incr(key);
      
      if (current === 1) {
        await RedisService.expire(key, windowSeconds);
      }
      
      return current <= maxRequests;
    } catch (error) {
      console.error('Rate limiter error:', error);
      return true; // Allow if rate limiting fails
    }
  }

  static async getRemaining(key: string): Promise<number> {
    try {
      const ttl = await RedisService.ttl(key);
      if (ttl === -1) return 0;
      
      const current = await RedisService.get(key) || 0;
      return Math.max(0, current);
    } catch (error) {
      console.error('Get remaining error:', error);
      return 0;
    }
  }
}