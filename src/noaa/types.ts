/**
 * NOAA Space Weather API Types
 * https://services.swpc.noaa.gov/
 */

// X-ray Flux from GOES satellite
export interface XrayFlux {
  time_tag: string;
  satellite: number;
  flux: number;
  observed_flux: number;
  electron_correction: number;
  electron_contaminaton: boolean; // NOAA's typo preserved
  energy: string; // "0.05-0.4nm" or "0.1-0.8nm"
}

// Kp Index (Geomagnetic Activity)
export interface KpIndex {
  time_tag: string;
  kp: number;
  a_running: number; // Running accumulative index
  station_count: number; // Number of observing stations
}

// Solar Wind (Real-time)
export interface SolarWind {
  time_tag: string;
  speed: number;
  density: number;
  temperature: number;
  bx: number;
  by: number;
  bz: number;
  bt: number;
}

// Sunspot Number / Solar Flux Index
export interface SolarFluxIndex {
  time_tag: string;
  sfi: number; // 10.7cm Solar Flux Index
  ssn: number; // Sunspot Number
}

// 27-Day Forecast
export interface Forecast27Day {
  time_tag: string;
  f107: number; // Predicted 10.7cm flux
  ap: number; // Predicted Ap index
}

// Proton Flux
export interface ProtonFlux {
  time_tag: string;
  satellite: number;
  flux: number;
  energy: string;
}

// Dst Index (Disturbance Storm Time)
export interface DstIndex {
  time_tag: string;
  dst: number;
}

// Aurora Forecast
export interface AuroraForecast {
  observation_time: string;
  forecast_time: string;
  data: number[][]; // 2D array of aurora probability
}

// NOAA API Endpoints
export const NOAA_ENDPOINTS = {
  // Real-time data
  XRAY_FLUX: 'https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json',
  KP_INDEX: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
  SOLAR_WIND_REALTIME: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json',
  SOLAR_WIND_MAG: 'https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json',

  // Historical/Predicted
  PREDICTED_SFI: 'https://services.swpc.noaa.gov/json/f107_cm_flux.json',
  FORECAST_27DAY: 'https://services.swpc.noaa.gov/products/27-day-outlook.json',
  SUNSPOT_NUMBER:
    'https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json',

  // Alerts and Watches
  ALERTS: 'https://services.swpc.noaa.gov/products/alerts.json',

  // Proton flux
  PROTON_FLUX: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json',

  // Geomagnetic
  DST_INDEX: 'https://services.swpc.noaa.gov/products/kyoto-dst.json',

  // Aurora
  AURORA_FORECAST: 'https://services.swpc.noaa.gov/products/animations/ovation_north_24h.json',
} as const;

export type EndpointKey = keyof typeof NOAA_ENDPOINTS;

// Cache configuration
export interface CacheConfig {
  ttlSeconds: number;
  maxEntries: number;
}

// Cache entry
export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  expiresAt: number;
}

// Query options for filtering data
export interface QueryOptions {
  startTime?: string;
  endTime?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, unknown>;
}

// Server configuration
export interface ServerConfig {
  mode: 'stdio' | 'http';
  port?: number;
  host?: string;
  cache: CacheConfig;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cachedAt?: number;
  source: 'cache' | 'fetch';
}

// Radio propagation assessment
export interface PropagationAssessment {
  timestamp: string;
  hfConditions: 'poor' | 'fair' | 'good' | 'excellent';
  sfiValue: number;
  kpValue: number;
  analysis: string;
  recommendedBands: string[];
}
