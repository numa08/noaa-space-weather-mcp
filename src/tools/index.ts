import { z } from 'zod';
import type { NoaaClient } from '../noaa/client';
import { interpretKp, interpretXrayFlux, parseQueryString, timeAgo } from '../utils/query';

// Tool schemas using Zod
export const toolSchemas = {
  get_space_weather_summary: z.object({}),

  get_xray_flux: z.object({
    query: z
      .string()
      .optional()
      .describe(
        'Query string to filter data. Format: "startTime=2024-01-01&endTime=2024-01-02&limit=10&sortBy=time_tag&sortOrder=desc"',
      ),
    limit: z.number().optional().describe('Maximum number of records to return'),
  }),

  get_kp_index: z.object({
    query: z.string().optional().describe('Query string to filter data'),
    limit: z.number().optional().describe('Maximum number of records to return'),
    hours: z.number().optional().describe('Get data for the last N hours'),
  }),

  get_solar_wind: z.object({
    query: z.string().optional().describe('Query string to filter data'),
    limit: z.number().optional().describe('Maximum number of records to return'),
  }),

  analyze_propagation: z.object({
    targetBand: z.string().optional().describe('Target frequency band (e.g., "20m", "40m", "10m")'),
  }),

  get_cache_stats: z.object({}),

  clear_cache: z.object({}),
};

// Tool definitions for MCP
export const toolDefinitions = [
  {
    name: 'get_space_weather_summary',
    description:
      'Get a summary of current space weather conditions including latest Kp index, X-ray flux, and solar wind data. Best for getting a quick overview of current conditions.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_xray_flux',
    description:
      'Get X-ray flux (solar flare) data from GOES satellite. Use query parameter to filter by time range, limit results, or sort. Returns data about solar flares which can cause HF radio blackouts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Query string to filter data. Example: "startTime=2024-01-01&limit=10&sortBy=time_tag&sortOrder=desc"',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return (default: all)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_kp_index',
    description:
      'Get Kp index (geomagnetic activity) data. Kp ranges from 0-9, where 0-2 is quiet, 3-4 is unsettled, 5+ indicates geomagnetic storms. High Kp values negatively affect HF propagation, especially at high latitudes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query string to filter data',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return',
        },
        hours: {
          type: 'number',
          description: 'Get data for the last N hours (shortcut for time-based query)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_solar_wind',
    description:
      'Get real-time solar wind data including speed, density, temperature, and magnetic field components (Bx, By, Bz, Bt). Negative Bz values indicate southward IMF which can trigger geomagnetic storms.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query string to filter data',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return',
        },
      },
      required: [],
    },
  },
  {
    name: 'analyze_propagation',
    description:
      'Analyze current conditions for HF radio propagation based on space weather data. Returns assessment of propagation conditions and recommended frequency bands for amateur radio operation.',
    inputSchema: {
      type: 'object',
      properties: {
        targetBand: {
          type: 'string',
          description: 'Target frequency band (e.g., "20m", "40m", "10m")',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_cache_stats',
    description: 'Get cache statistics including number of cached entries and configuration.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'clear_cache',
    description: 'Clear all cached data. Use this to force fresh data fetch from NOAA.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Tool handlers
export function createToolHandlers(client: NoaaClient) {
  return {
    async get_space_weather_summary() {
      const result = await client.getSummary();
      if (!result.success || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
      }

      const { latestKp, latestXray, latestSolarWind } = result.data;

      let summary = '# Current Space Weather Summary\n\n';

      if (latestKp) {
        const kpInterpret = interpretKp(latestKp.kp);
        summary += `## Geomagnetic Activity (Kp Index)\n`;
        summary += `- **Value**: ${latestKp.kp} (${kpInterpret.level})\n`;
        summary += `- **Time**: ${latestKp.time_tag} (${timeAgo(latestKp.time_tag)})\n`;
        summary += `- **HF Impact**: ${kpInterpret.hfImpact}\n\n`;
      }

      if (latestXray) {
        const xrayInterpret = interpretXrayFlux(latestXray.flux);
        summary += `## Solar X-ray Flux\n`;
        summary += `- **Current Class**: ${xrayInterpret.class} (${xrayInterpret.category})\n`;
        summary += `- **Flux**: ${latestXray.flux.toExponential(2)} W/m² (${latestXray.energy})\n`;
        summary += `- **Time**: ${latestXray.time_tag} (${timeAgo(latestXray.time_tag)})\n`;
        summary += `- **Radio Impact**: ${xrayInterpret.radioImpact}\n\n`;
      }

      if (latestSolarWind) {
        summary += `## Solar Wind\n`;
        summary += `- **Speed**: ${latestSolarWind.speed.toFixed(0)} km/s\n`;
        summary += `- **Density**: ${latestSolarWind.density.toFixed(1)} p/cm³\n`;
        summary += `- **Bz**: ${latestSolarWind.bz.toFixed(1)} nT ${latestSolarWind.bz < 0 ? '(Southward - may enhance storm conditions)' : '(Northward)'}\n`;
        summary += `- **Time**: ${latestSolarWind.time_tag} (${timeAgo(latestSolarWind.time_tag)})\n\n`;
      }

      return { content: [{ type: 'text', text: summary }] };
    },

    async get_xray_flux(args: { query?: string; limit?: number }) {
      const options = args.query ? parseQueryString(args.query) : {};
      if (args.limit) options.limit = args.limit;

      const result = await client.getXrayFlux(options);
      if (!result.success || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
      }

      let output = `# X-ray Flux Data (${result.data.length} records)\n\n`;
      output += `Source: ${result.source}${result.cachedAt ? `, cached at ${new Date(result.cachedAt).toISOString()}` : ''}\n\n`;

      for (const item of result.data.slice(0, 50)) {
        // Limit output to prevent context overflow
        const interpret = interpretXrayFlux(item.flux);
        output += `- **${item.time_tag}**: ${interpret.class} (${interpret.category}) - ${item.energy}\n`;
      }

      if (result.data.length > 50) {
        output += `\n... and ${result.data.length - 50} more records (use limit parameter to control output)\n`;
      }

      return { content: [{ type: 'text', text: output }] };
    },

    async get_kp_index(args: { query?: string; limit?: number; hours?: number }) {
      const options = args.query ? parseQueryString(args.query) : {};
      if (args.limit) options.limit = args.limit;

      if (args.hours) {
        const now = new Date();
        const startTime = new Date(now.getTime() - args.hours * 60 * 60 * 1000);
        options.startTime = startTime.toISOString();
      }

      const result = await client.getKpIndex(options);
      if (!result.success || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
      }

      let output = `# Kp Index Data (${result.data.length} records)\n\n`;
      output += `Source: ${result.source}${result.cachedAt ? `, cached at ${new Date(result.cachedAt).toISOString()}` : ''}\n\n`;

      for (const item of result.data.slice(0, 50)) {
        const interpret = interpretKp(item.kp);
        output += `- **${item.time_tag}**: Kp=${item.kp.toFixed(2)} (${interpret.level})\n`;
      }

      if (result.data.length > 50) {
        output += `\n... and ${result.data.length - 50} more records\n`;
      }

      return { content: [{ type: 'text', text: output }] };
    },

    async get_solar_wind(args: { query?: string; limit?: number }) {
      const options = args.query ? parseQueryString(args.query) : {};
      if (args.limit) options.limit = args.limit;

      const result = await client.getSolarWind(options);
      if (!result.success || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
      }

      let output = `# Solar Wind Data (${result.data.length} records)\n\n`;
      output += `Source: ${result.source}\n\n`;
      output += `| Time | Speed (km/s) | Density (p/cm³) | Bz (nT) | Bt (nT) |\n`;
      output += `|------|--------------|-----------------|---------|----------|\n`;

      for (const item of result.data.slice(0, 30)) {
        output += `| ${item.time_tag} | ${item.speed.toFixed(0)} | ${item.density.toFixed(1)} | ${item.bz.toFixed(1)} | ${item.bt.toFixed(1)} |\n`;
      }

      if (result.data.length > 30) {
        output += `\n... and ${result.data.length - 30} more records\n`;
      }

      return { content: [{ type: 'text', text: output }] };
    },

    async analyze_propagation(args: { targetBand?: string }) {
      const summary = await client.getSummary();
      if (!summary.success || !summary.data) {
        return { content: [{ type: 'text', text: `Error: ${summary.error}` }] };
      }

      const { latestKp, latestXray, latestSolarWind } = summary.data;

      let analysis = '# HF Propagation Analysis\n\n';
      let overallCondition: 'poor' | 'fair' | 'good' | 'excellent' = 'excellent';
      const recommendedBands: string[] = [];

      // Analyze Kp
      if (latestKp) {
        const kpInterpret = interpretKp(latestKp.kp);
        analysis += `## Geomagnetic Conditions\n`;
        analysis += `Current Kp: ${latestKp.kp} (${kpInterpret.level})\n`;
        analysis += `${kpInterpret.hfImpact}\n\n`;

        if (latestKp.kp >= 5) overallCondition = 'poor';
        else if (latestKp.kp >= 4) overallCondition = 'fair';
        else if (latestKp.kp >= 2 && overallCondition === 'excellent') overallCondition = 'good';
      }

      // Analyze X-ray flux
      if (latestXray) {
        const xrayInterpret = interpretXrayFlux(latestXray.flux);
        analysis += `## Solar Flare Activity\n`;
        analysis += `Current: ${xrayInterpret.class} class (${xrayInterpret.category})\n`;
        analysis += `${xrayInterpret.radioImpact}\n\n`;

        if (xrayInterpret.class.startsWith('X')) overallCondition = 'poor';
        else if (xrayInterpret.class.startsWith('M') && overallCondition !== 'poor')
          overallCondition = 'fair';
        else if (xrayInterpret.class.startsWith('C') && overallCondition === 'excellent')
          overallCondition = 'good';
      }

      // Analyze solar wind
      if (latestSolarWind) {
        analysis += `## Solar Wind Conditions\n`;
        analysis += `Speed: ${latestSolarWind.speed.toFixed(0)} km/s\n`;
        analysis += `Bz: ${latestSolarWind.bz.toFixed(1)} nT\n`;

        if (latestSolarWind.bz < -10) {
          analysis += `⚠️ Strong southward Bz indicates potential for enhanced geomagnetic activity\n`;
          if (overallCondition === 'good' || overallCondition === 'excellent')
            overallCondition = 'fair';
        }
        analysis += '\n';
      }

      // Band recommendations based on conditions
      if (overallCondition === 'excellent' || overallCondition === 'good') {
        recommendedBands.push('10m', '12m', '15m', '17m', '20m');
      } else if (overallCondition === 'fair') {
        recommendedBands.push('20m', '30m', '40m');
      } else {
        recommendedBands.push('40m', '80m', '160m');
      }

      analysis += `## Overall Assessment\n`;
      analysis += `**Conditions: ${overallCondition.toUpperCase()}**\n\n`;
      analysis += `Recommended bands: ${recommendedBands.join(', ')}\n\n`;

      if (args.targetBand) {
        const targetLower = args.targetBand.toLowerCase();
        const highBands = ['10m', '12m', '15m', '17m'];
        const midBands = ['20m', '30m', '40m'];

        analysis += `### ${args.targetBand} Band Analysis\n`;
        if (highBands.includes(targetLower)) {
          if (overallCondition === 'poor') {
            analysis += `${args.targetBand} propagation is likely to be significantly degraded. Consider lower bands.\n`;
          } else {
            analysis += `${args.targetBand} should have reasonable propagation during daylight hours.\n`;
          }
        } else if (midBands.includes(targetLower)) {
          analysis += `${args.targetBand} is likely to provide reliable propagation under current conditions.\n`;
        } else {
          analysis += `${args.targetBand} (lower band) should be less affected by current space weather conditions.\n`;
        }
      }

      return { content: [{ type: 'text', text: analysis }] };
    },

    get_cache_stats() {
      const stats = client.getCacheStats();
      return {
        content: [
          {
            type: 'text',
            text: `# Cache Statistics\n\n- Entries: ${stats.size}/${stats.maxEntries}\n- Default TTL: ${stats.ttlSeconds} seconds\n`,
          },
        ],
      };
    },

    clear_cache() {
      client.clearCache();
      return {
        content: [{ type: 'text', text: 'Cache cleared successfully.' }],
      };
    },
  };
}
