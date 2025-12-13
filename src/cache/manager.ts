import type { CacheConfig, CacheEntry } from '../noaa/types';

/**
 * In-memory Cache Manager
 * Lightweight cache without disk persistence
 */
export class CacheManager {
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry;
  }

  set<T>(key: string, data: T, ttlOverride?: number): void {
    const ttl = ttlOverride ?? this.config.ttlSeconds;
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      fetchedAt: now,
      expiresAt: now + ttl * 1000,
    };

    // Enforce max entries limit
    if (this.memoryCache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    this.memoryCache.set(key, entry);
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.fetchedAt < oldestTime) {
        oldestTime = entry.fetchedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  invalidate(key: string): boolean {
    return this.memoryCache.delete(key);
  }

  invalidateAll(): void {
    this.memoryCache.clear();
  }

  getStats(): { size: number; maxEntries: number; ttlSeconds: number } {
    return {
      size: this.memoryCache.size,
      maxEntries: this.config.maxEntries,
      ttlSeconds: this.config.ttlSeconds,
    };
  }

  // Check if data is stale but still usable (for fallback)
  getStale<T>(key: string): CacheEntry<T> | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    return entry ?? null;
  }
}

// Default cache configuration for NOAA data
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlSeconds: 300, // 5 minutes default
  maxEntries: 100,
};

// Specific TTLs for different data types (in seconds)
export const DATA_TTL = {
  XRAY_FLUX: 60, // Updates every minute
  KP_INDEX: 180, // Updates every 3 hours, but check more frequently
  SOLAR_WIND: 60, // Real-time data
  FORECAST: 3600, // Forecasts update less frequently
  HISTORICAL: 86400, // Historical data rarely changes
  ALERTS: 60, // Alerts should be checked frequently
} as const;
