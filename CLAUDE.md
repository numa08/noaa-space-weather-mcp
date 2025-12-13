# NOAA Space Weather MCP Server

## Project Overview

This is an MCP (Model Context Protocol) server that provides NOAA space weather data for amateur radio operators. The primary use case is analyzing solar activity to predict HF radio propagation conditions for DX (long-distance) communication.

## Tech Stack

- **Runtime**: Bun 1.1+
- **Language**: TypeScript (strict mode)
- **MCP SDK**: @modelcontextprotocol/sdk
- **Linting/Formatting**: Biome
- **Testing**: Bun test
- **Containerization**: Docker

## Project Structure

```
noaa-space-weather-mcp/
├── src/
│   ├── index.ts           # Entry point (CLI parsing)
│   ├── server.ts          # MCP server implementation
│   ├── noaa/
│   │   ├── client.ts      # NOAA API client
│   │   └── types.ts       # TypeScript types
│   ├── cache/
│   │   └── manager.ts     # Cache management
│   ├── tools/
│   │   └── index.ts       # MCP tool definitions
│   └── utils/
│       └── query.ts       # Query utilities
├── tests/                 # Unit tests
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Key Commands

```bash
# Development
bun install              # Install dependencies
bun run dev              # Run with hot reload (STDIO)
bun run dev:http         # Run HTTP server with hot reload

# Testing & Quality
bun run test             # Run tests
bun run lint             # Run Biome linter
bun run lint:fix         # Auto-fix lint issues
bun run typecheck        # TypeScript type checking
bun run check            # All checks (typecheck + lint + test)

# Production
bun run start            # Run STDIO server
bun run start:http       # Run HTTP server

# Docker
bun run docker:build     # Build Docker image
bun run docker:run       # Run HTTP server in container
```

## MCP Tools Available

1. **get_space_weather_summary** - Quick overview of current conditions
2. **get_xray_flux** - Solar flare (X-ray) data from GOES
3. **get_kp_index** - Geomagnetic activity index
4. **get_solar_wind** - Real-time solar wind parameters
5. **analyze_propagation** - HF propagation analysis for ham radio
6. **get_cache_stats** - Cache statistics
7. **clear_cache** - Clear cached data

## NOAA API Endpoints Used

- X-ray flux: `services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json`
- Kp index: `services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
- Solar wind: `services.swpc.noaa.gov/products/solar-wind/*.json`
- And more (see `src/noaa/types.ts` for full list)

## Important Concepts for Amateur Radio

### Kp Index
- 0-2: Quiet (good HF conditions)
- 3-4: Unsettled (minor disturbances)
- 5+: Storm (degraded HF, especially at high latitudes)

### Solar Flux Index (SFI)
- <70: Very low activity (use 40m, 80m, 160m)
- 70-90: Low activity (20m, 40m work well)
- 90-120: Moderate (15m, 20m optimal)
- 120+: High activity (10m, 12m, 15m open)

### X-ray Flare Classes
- A, B: Background (no impact)
- C: Small (minor HF impact)
- M: Medium (moderate HF fadeouts)
- X: Major (significant HF blackouts)

## Coding Guidelines

1. **Type Safety**: Use strict TypeScript. Avoid `any` except where absolutely necessary.
2. **Error Handling**: Always handle fetch failures gracefully with stale cache fallback.
3. **Cache Management**: Respect NOAA servers - use appropriate TTLs.
4. **Output Formatting**: Keep tool outputs concise to avoid context overflow.
5. **Testing**: Write tests for all utility functions and data transformations.

## When Adding New Features

1. Add types to `src/noaa/types.ts`
2. Update NOAA client in `src/noaa/client.ts`
3. Add tool handler in `src/tools/index.ts`
4. Add tests in `tests/`
5. Run `bun run check` before committing

## Common Tasks

### Adding a new NOAA endpoint

1. Add endpoint URL to `NOAA_ENDPOINTS` in `types.ts`
2. Add response type interface
3. Create fetch method in `NoaaClient`
4. Add tool definition and handler
5. Write tests

### Modifying cache behavior

- Default TTL: 300 seconds (5 minutes)
- TTLs vary by data type (see `DATA_TTL` in `cache/manager.ts`)
- Cache persists to `.cache/` directory by default

### Testing HTTP server

```bash
# Start server
bun run start:http

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/stats
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Notes for AI Assistant

- This server is designed for amateur radio operators (ハム、JA○XXX callsigns)
- HF propagation depends heavily on space weather
- Context size is important - always limit output and provide query options
- Japanese users are the primary audience, but code/comments are in English
- Be careful not to overload NOAA servers - respect cache TTLs
