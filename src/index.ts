#!/usr/bin/env bun
/**
 * NOAA Space Weather MCP Server
 *
 * A Model Context Protocol server that provides access to NOAA space weather data
 * for amateur radio operators to analyze solar activity and HF propagation conditions.
 *
 * Usage:
 *   STDIO mode (default):  bun run src/index.ts
 *   HTTP mode:             bun run src/index.ts --http [--port 3000] [--host 0.0.0.0]
 */

import { DEFAULT_CACHE_CONFIG } from './cache/manager';
import type { ServerConfig } from './noaa/types';
import { runHttpServer, runStdioServer } from './server';

function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);

  const config: ServerConfig = {
    mode: 'stdio',
    cache: { ...DEFAULT_CACHE_CONFIG },
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--http':
      case '-h':
        config.mode = 'http';
        break;
      case '--stdio':
      case '-s':
        config.mode = 'stdio';
        break;
      case '--port':
      case '-p':
        config.port = parseInt(args[++i], 10);
        break;
      case '--host':
        config.host = args[++i];
        break;
      case '--cache-ttl':
        config.cache.ttlSeconds = parseInt(args[++i], 10);
        break;
      case '--cache-max':
        config.cache.maxEntries = parseInt(args[++i], 10);
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break; // unreachable but satisfies linter
      case '--version':
        console.log('noaa-space-weather-mcp v0.1.0');
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
NOAA Space Weather MCP Server

A Model Context Protocol server providing NOAA space weather data
for amateur radio HF propagation analysis.

USAGE:
  bun run src/index.ts [OPTIONS]

OPTIONS:
  --stdio, -s         Run in STDIO mode (default)
  --http, -h          Run in HTTP mode
  --port, -p <port>   HTTP port (default: 3000)
  --host <host>       HTTP host (default: 0.0.0.0)
  --cache-ttl <sec>   Cache TTL in seconds (default: 300)
  --cache-max <num>   Max cache entries (default: 100)
  --help              Show this help
  --version           Show version

EXAMPLES:
  # Run in STDIO mode for Claude Desktop
  bun run src/index.ts

  # Run HTTP server on port 8080
  bun run src/index.ts --http --port 8080

  # Run with custom cache settings
  bun run src/index.ts --http --cache-ttl 60 --cache-max 200

AVAILABLE TOOLS:
  get_space_weather_summary  Get current space weather overview
  get_xray_flux              Get solar flare (X-ray) data
  get_kp_index               Get geomagnetic activity (Kp) data
  get_solar_wind             Get real-time solar wind data
  analyze_propagation        Analyze HF propagation conditions
  get_cache_stats            Get cache statistics
  clear_cache                Clear cached data

For more information, see: https://github.com/your-repo/noaa-space-weather-mcp
  `);
}

async function main(): Promise<void> {
  const config = parseArgs();

  try {
    if (config.mode === 'http') {
      await runHttpServer(config);
    } else {
      await runStdioServer(config.cache);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
