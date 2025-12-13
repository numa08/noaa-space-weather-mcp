import { CacheManager, DATA_TTL, DEFAULT_CACHE_CONFIG } from '../cache/manager';
import {
  type ApiResponse,
  type EndpointKey,
  type KpIndex,
  NOAA_ENDPOINTS,
  type QueryOptions,
  type SolarWind,
  type XrayFlux,
} from './types';

/**
 * NOAA Space Weather API Client
 * Handles data fetching, caching, and querying
 */
export class NoaaClient {
  private cache: CacheManager;
  private userAgent: string;

  constructor(cacheManager?: CacheManager) {
    this.cache = cacheManager ?? new CacheManager(DEFAULT_CACHE_CONFIG);
    this.userAgent = 'NOAA-Space-Weather-MCP/0.1.0 (Amateur Radio Propagation Tool)';
  }

  /**
   * Fetch data from NOAA API with caching
   */
  async fetchEndpoint<T>(
    endpoint: EndpointKey,
    options?: { forceRefresh?: boolean; ttl?: number },
  ): Promise<ApiResponse<T>> {
    const url = NOAA_ENDPOINTS[endpoint];
    const cacheKey = `noaa_${endpoint}`;

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          cachedAt: cached.fetchedAt,
          source: 'cache',
        };
      }
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        // Try to use stale cache as fallback
        const stale = this.cache.getStale<T>(cacheKey);
        if (stale) {
          return {
            success: true,
            data: stale.data,
            cachedAt: stale.fetchedAt,
            source: 'cache',
            error: `API returned ${response.status}, using stale cache`,
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as T;

      // Determine TTL based on endpoint type
      const ttl = options?.ttl ?? this.getTtlForEndpoint(endpoint);
      this.cache.set(cacheKey, data, ttl);

      return {
        success: true,
        data,
        cachedAt: Date.now(),
        source: 'fetch',
      };
    } catch (error) {
      // Try stale cache as last resort
      const stale = this.cache.getStale<T>(cacheKey);
      if (stale) {
        return {
          success: true,
          data: stale.data,
          cachedAt: stale.fetchedAt,
          source: 'cache',
          error: `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}, using stale cache`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'fetch',
      };
    }
  }

  private getTtlForEndpoint(endpoint: EndpointKey): number {
    switch (endpoint) {
      case 'XRAY_FLUX':
      case 'PROTON_FLUX':
        return DATA_TTL.XRAY_FLUX;
      case 'KP_INDEX':
        return DATA_TTL.KP_INDEX;
      case 'SOLAR_WIND_REALTIME':
      case 'SOLAR_WIND_MAG':
        return DATA_TTL.SOLAR_WIND;
      case 'FORECAST_27DAY':
      case 'PREDICTED_SFI':
        return DATA_TTL.FORECAST;
      case 'SUNSPOT_NUMBER':
        return DATA_TTL.HISTORICAL;
      case 'ALERTS':
        return DATA_TTL.ALERTS;
      default:
        return DATA_TTL.KP_INDEX;
    }
  }

  /**
   * Query data with filters - reduces context size for AI
   */
  queryData<T extends { time_tag: string }>(data: T[], options: QueryOptions): T[] {
    let result = [...data];

    // Time range filter
    if (options.startTime || options.endTime) {
      result = result.filter((item) => {
        const timeTag = item.time_tag;
        if (!timeTag) return true;

        const itemTime = new Date(timeTag).getTime();
        const start = options.startTime ? new Date(options.startTime).getTime() : 0;
        const end = options.endTime ? new Date(options.endTime).getTime() : Infinity;

        return itemTime >= start && itemTime <= end;
      });
    }

    // Custom filter
    if (options.filter) {
      const filter = options.filter;
      result = result.filter((item) => {
        const record = item as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(filter)) {
          if (record[key] !== value) return false;
        }
        return true;
      });
    }

    // Sort
    if (options.sortBy) {
      const sortKey = options.sortBy;
      const order = options.sortOrder === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        const aRecord = a as unknown as Record<string, unknown>;
        const bRecord = b as unknown as Record<string, unknown>;
        const aVal = aRecord[sortKey];
        const bVal = bRecord[sortKey];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        return aVal < bVal ? -order : order;
      });
    }

    // Limit
    if (options.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Get X-ray flux data from GOES satellite
   */
  async getXrayFlux(options?: QueryOptions): Promise<ApiResponse<XrayFlux[]>> {
    const response = await this.fetchEndpoint<XrayFlux[]>('XRAY_FLUX');
    if (!response.success || !response.data) return response;

    if (options) {
      response.data = this.queryData(response.data, options);
    }

    return response;
  }

  /**
   * Get Kp index data
   */
  async getKpIndex(options?: QueryOptions): Promise<ApiResponse<KpIndex[]>> {
    const response = await this.fetchEndpoint<Array<string[]>>('KP_INDEX');
    if (!response.success || !response.data) {
      return { ...response, data: undefined } as ApiResponse<KpIndex[]>;
    }

    // NOAA returns Kp data as array of arrays, convert to objects
    const [_header, ...rows] = response.data;
    const kpData: KpIndex[] = rows.map((row) => ({
      time_tag: row[0],
      kp: parseFloat(row[1]),
      a_running: parseFloat(row[2]),
      station_count: Number.parseInt(row[3], 10),
    }));

    const result: ApiResponse<KpIndex[]> = {
      ...response,
      data: options ? this.queryData(kpData, options) : kpData,
    };

    return result;
  }

  /**
   * Get solar wind data
   */
  async getSolarWind(options?: QueryOptions): Promise<ApiResponse<SolarWind[]>> {
    const [plasma, mag] = await Promise.all([
      this.fetchEndpoint<Array<string[]>>('SOLAR_WIND_REALTIME'),
      this.fetchEndpoint<Array<string[]>>('SOLAR_WIND_MAG'),
    ]);

    if (!plasma.success || !plasma.data || !mag.success || !mag.data) {
      return {
        success: false,
        error: 'Failed to fetch solar wind data',
        source: 'fetch',
      };
    }

    // Merge plasma and magnetic field data by time
    const [, ...plasmaRows] = plasma.data;
    const [, ...magRows] = mag.data;

    const magMap = new Map(magRows.map((row) => [row[0], row]));

    const solarWindData: SolarWind[] = plasmaRows
      .map((row) => {
        const magRow = magMap.get(row[0]);
        return {
          time_tag: row[0],
          density: parseFloat(row[1]) || 0,
          speed: parseFloat(row[2]) || 0,
          temperature: parseFloat(row[3]) || 0,
          bx: magRow ? parseFloat(magRow[1]) || 0 : 0,
          by: magRow ? parseFloat(magRow[2]) || 0 : 0,
          bz: magRow ? parseFloat(magRow[3]) || 0 : 0,
          bt: magRow ? parseFloat(magRow[6]) || 0 : 0,
        };
      })
      .filter((item) => !Number.isNaN(item.speed));

    return {
      success: true,
      data: options ? this.queryData(solarWindData, options) : solarWindData,
      source: plasma.source,
      cachedAt: plasma.cachedAt,
    };
  }

  /**
   * Get current space weather summary
   */
  async getSummary(): Promise<
    ApiResponse<{
      latestKp: KpIndex | null;
      latestXray: XrayFlux | null;
      latestSolarWind: SolarWind | null;
      fetchedAt: number;
    }>
  > {
    const [kp, xray, solarWind] = await Promise.all([
      this.getKpIndex({ limit: 1, sortBy: 'time_tag', sortOrder: 'desc' }),
      this.getXrayFlux({ limit: 1, sortBy: 'time_tag', sortOrder: 'desc' }),
      this.getSolarWind({ limit: 1, sortBy: 'time_tag', sortOrder: 'desc' }),
    ]);

    return {
      success: true,
      data: {
        latestKp: kp.data?.[0] ?? null,
        latestXray: xray.data?.[0] ?? null,
        latestSolarWind: solarWind.data?.[0] ?? null,
        fetchedAt: Date.now(),
      },
      source: 'fetch',
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxEntries: number; ttlSeconds: number } {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.invalidateAll();
  }
}
