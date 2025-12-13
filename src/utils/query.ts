import type { QueryOptions } from '../noaa/types';

/**
 * Parse query string into QueryOptions
 */
export function parseQueryString(queryString: string): QueryOptions {
  const options: QueryOptions = {};

  // Parse key=value pairs
  const parts = queryString.split('&').filter(Boolean);

  for (const part of parts) {
    const [key, value] = part.split('=').map((s) => s.trim());
    if (!key || !value) continue;

    switch (key.toLowerCase()) {
      case 'start':
      case 'starttime':
      case 'from':
        options.startTime = value;
        break;
      case 'end':
      case 'endtime':
      case 'to':
        options.endTime = value;
        break;
      case 'limit':
      case 'count':
        options.limit = parseInt(value, 10);
        break;
      case 'sort':
      case 'sortby':
        options.sortBy = value;
        break;
      case 'order':
      case 'sortorder':
        options.sortOrder = value.toLowerCase() === 'asc' ? 'asc' : 'desc';
        break;
      default:
        // Custom filter
        if (!options.filter) options.filter = {};
        options.filter[key] = parseValue(value);
    }
  }

  return options;
}

/**
 * Parse string value to appropriate type
 */
function parseValue(value: string): unknown {
  // Boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'null') return null;

  // Number
  const num = parseFloat(value);
  if (!Number.isNaN(num) && value.match(/^-?\d*\.?\d+$/)) {
    return num;
  }

  // String
  return value;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString();
  } catch {
    return dateString;
  }
}

/**
 * Calculate time ago string
 */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

/**
 * Interpret Kp index for radio propagation
 */
export function interpretKp(kp: number): {
  level: string;
  description: string;
  hfImpact: string;
} {
  if (kp < 2) {
    return {
      level: 'Quiet',
      description: 'Geomagnetic field is quiet',
      hfImpact: 'Good HF propagation conditions',
    };
  }
  if (kp < 4) {
    return {
      level: 'Unsettled',
      description: 'Geomagnetic field is unsettled',
      hfImpact: 'Generally good HF conditions, minor disturbances possible',
    };
  }
  if (kp < 5) {
    return {
      level: 'Active',
      description: 'Geomagnetic field is active',
      hfImpact: 'HF propagation may be affected, especially at high latitudes',
    };
  }
  if (kp < 6) {
    return {
      level: 'Minor Storm (G1)',
      description: 'Minor geomagnetic storm',
      hfImpact: 'HF radio may experience fading at higher latitudes',
    };
  }
  if (kp < 7) {
    return {
      level: 'Moderate Storm (G2)',
      description: 'Moderate geomagnetic storm',
      hfImpact: 'HF radio fadeouts likely at high latitudes, possible at mid-latitudes',
    };
  }
  if (kp < 8) {
    return {
      level: 'Strong Storm (G3)',
      description: 'Strong geomagnetic storm',
      hfImpact: 'HF radio blackouts may extend to mid-latitudes',
    };
  }
  if (kp < 9) {
    return {
      level: 'Severe Storm (G4)',
      description: 'Severe geomagnetic storm',
      hfImpact: 'HF radio communications significantly degraded',
    };
  }
  return {
    level: 'Extreme Storm (G5)',
    description: 'Extreme geomagnetic storm',
    hfImpact: 'HF radio communications may be impossible on most frequencies',
  };
}

/**
 * Interpret Solar Flux Index for propagation
 */
export function interpretSfi(sfi: number): {
  level: string;
  description: string;
  bands: string[];
} {
  if (sfi < 70) {
    return {
      level: 'Very Low',
      description: 'Solar activity is very low',
      bands: ['40m', '80m', '160m'],
    };
  }
  if (sfi < 90) {
    return {
      level: 'Low',
      description: 'Solar activity is low',
      bands: ['20m', '40m', '80m'],
    };
  }
  if (sfi < 120) {
    return {
      level: 'Moderate',
      description: 'Solar activity is moderate',
      bands: ['15m', '20m', '40m'],
    };
  }
  if (sfi < 150) {
    return {
      level: 'High',
      description: 'Solar activity is high',
      bands: ['10m', '15m', '20m'],
    };
  }
  return {
    level: 'Very High',
    description: 'Solar activity is very high',
    bands: ['10m', '12m', '15m', '17m'],
  };
}

/**
 * Convert X-ray flux value (W/m²) to flare class string
 * A: < 1e-7, B: 1e-7 to 1e-6, C: 1e-6 to 1e-5, M: 1e-5 to 1e-4, X: >= 1e-4
 */
export function fluxToClass(flux: number): string {
  if (flux < 1e-7) {
    const level = (flux / 1e-8).toFixed(1);
    return `A${level}`;
  }
  if (flux < 1e-6) {
    const level = (flux / 1e-7).toFixed(1);
    return `B${level}`;
  }
  if (flux < 1e-5) {
    const level = (flux / 1e-6).toFixed(1);
    return `C${level}`;
  }
  if (flux < 1e-4) {
    const level = (flux / 1e-5).toFixed(1);
    return `M${level}`;
  }
  const level = (flux / 1e-4).toFixed(1);
  return `X${level}`;
}

/**
 * Interpret X-ray flux for solar flares
 * Accepts either flux value (W/m²) or class string
 */
export function interpretXrayFlux(fluxOrClass: number | string): {
  class: string;
  category: string;
  description: string;
  radioImpact: string;
} {
  const flareClass = typeof fluxOrClass === 'number' ? fluxToClass(fluxOrClass) : fluxOrClass;
  const classLetter = flareClass.charAt(0).toUpperCase();

  switch (classLetter) {
    case 'A':
    case 'B':
      return {
        class: flareClass,
        category: 'Background',
        description: 'Background X-ray flux levels',
        radioImpact: 'No impact on HF radio',
      };
    case 'C':
      return {
        class: flareClass,
        category: 'Small',
        description: 'Small solar flare',
        radioImpact: 'Minor impact on HF radio at low frequencies',
      };
    case 'M':
      return {
        class: flareClass,
        category: 'Medium',
        description: 'Medium solar flare',
        radioImpact: 'Moderate to strong HF radio fadeouts on sunlit side',
      };
    case 'X':
      return {
        class: flareClass,
        category: 'Major',
        description: 'Major solar flare',
        radioImpact: 'Strong to complete HF radio blackouts on sunlit side',
      };
    default:
      return {
        class: flareClass,
        category: 'Unknown',
        description: 'Unknown flare classification',
        radioImpact: 'Unknown',
      };
  }
}

/**
 * @deprecated Use interpretXrayFlux instead
 */
export function interpretXrayClass(flareClass: string) {
  const result = interpretXrayFlux(flareClass);
  return {
    category: result.category,
    description: result.description,
    radioImpact: result.radioImpact,
  };
}
