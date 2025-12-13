import { beforeEach, describe, expect, test } from 'bun:test';
import { CacheManager } from '../src/cache/manager';
import {
  interpretKp,
  interpretSfi,
  interpretXrayClass,
  parseQueryString,
  timeAgo,
} from '../src/utils/query';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({
      ttlSeconds: 60,
      maxEntries: 10,
      // No persistence for tests
    });
  });

  test('should store and retrieve data', () => {
    const testData = { foo: 'bar' };
    cache.set('test-key', testData);

    const result = cache.get<typeof testData>('test-key');
    expect(result).not.toBeNull();
    expect(result?.data).toEqual(testData);
  });

  test('should return null for non-existent key', () => {
    const result = cache.get('non-existent');
    expect(result).toBeNull();
  });

  test('should respect TTL', async () => {
    const shortTtlCache = new CacheManager({
      ttlSeconds: 0.1, // 100ms
      maxEntries: 10,
    });

    shortTtlCache.set('expire-test', 'data');

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = shortTtlCache.get('expire-test');
    expect(result).toBeNull();
  });

  test('should evict oldest entries when max reached', () => {
    for (let i = 0; i < 15; i++) {
      cache.set(`key-${i}`, `value-${i}`);
    }

    const stats = cache.getStats();
    expect(stats.size).toBeLessThanOrEqual(10);
  });

  test('should invalidate specific key', () => {
    cache.set('to-delete', 'data');
    expect(cache.get('to-delete')).not.toBeNull();

    cache.invalidate('to-delete');
    expect(cache.get('to-delete')).toBeNull();
  });

  test('should invalidate all entries', () => {
    cache.set('key1', 'data1');
    cache.set('key2', 'data2');

    cache.invalidateAll();

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});

describe('Query Utilities', () => {
  describe('parseQueryString', () => {
    test('should parse basic query string', () => {
      const result = parseQueryString('limit=10&sortBy=time_tag');
      expect(result.limit).toBe(10);
      expect(result.sortBy).toBe('time_tag');
    });

    test('should parse time filters', () => {
      const result = parseQueryString('startTime=2024-01-01&endTime=2024-12-31');
      expect(result.startTime).toBe('2024-01-01');
      expect(result.endTime).toBe('2024-12-31');
    });

    test('should parse sort order', () => {
      const result = parseQueryString('sortOrder=asc');
      expect(result.sortOrder).toBe('asc');
    });

    test('should parse custom filters', () => {
      const result = parseQueryString('kp=5&observed=true');
      expect(result.filter).toEqual({ kp: 5, observed: true });
    });

    test('should handle empty string', () => {
      const result = parseQueryString('');
      expect(result).toEqual({});
    });
  });

  describe('interpretKp', () => {
    test('should interpret quiet conditions', () => {
      const result = interpretKp(1);
      expect(result.level).toBe('Quiet');
      expect(result.hfImpact).toContain('Good');
    });

    test('should interpret storm conditions', () => {
      const result = interpretKp(5);
      expect(result.level).toContain('Storm');
    });

    test('should interpret extreme conditions', () => {
      const result = interpretKp(9);
      expect(result.level).toContain('Extreme');
    });
  });

  describe('interpretSfi', () => {
    test('should interpret very low SFI', () => {
      const result = interpretSfi(65);
      expect(result.level).toBe('Very Low');
      expect(result.bands).toContain('40m');
    });

    test('should interpret high SFI', () => {
      const result = interpretSfi(130);
      expect(result.level).toBe('High');
      expect(result.bands).toContain('10m');
    });
  });

  describe('interpretXrayClass', () => {
    test('should interpret background levels', () => {
      const result = interpretXrayClass('A1.0');
      expect(result.category).toBe('Background');
    });

    test('should interpret M-class flares', () => {
      const result = interpretXrayClass('M5.0');
      expect(result.category).toBe('Medium');
      expect(result.radioImpact).toContain('fadeout');
    });

    test('should interpret X-class flares', () => {
      const result = interpretXrayClass('X1.0');
      expect(result.category).toBe('Major');
      expect(result.radioImpact).toContain('blackout');
    });
  });

  describe('timeAgo', () => {
    test('should return "just now" for recent times', () => {
      const now = new Date().toISOString();
      expect(timeAgo(now)).toBe('just now');
    });

    test('should return minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(timeAgo(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    test('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(twoHoursAgo)).toBe('2 hours ago');
    });

    test('should return days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(threeDaysAgo)).toBe('3 days ago');
    });
  });
});

describe('NOAA Client', () => {
  // Note: These tests would require mocking fetch
  // For now, we'll test the data transformation logic

  test('placeholder for NOAA client tests', () => {
    expect(true).toBe(true);
  });
});

describe('MCP Tools', () => {
  // Integration tests for MCP tools would go here
  test('placeholder for MCP tool tests', () => {
    expect(true).toBe(true);
  });
});
