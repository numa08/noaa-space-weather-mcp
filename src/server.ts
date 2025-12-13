import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CacheManager, DEFAULT_CACHE_CONFIG } from './cache/manager';
import { NoaaClient } from './noaa/client';
import type { CacheConfig, ServerConfig } from './noaa/types';
import { createToolHandlers, toolDefinitions } from './tools';

/**
 * Create and configure the MCP server
 *
 * Note: Using Server class (marked deprecated) due to Zod 4.x type compatibility issues with McpServer.
 * The Server class continues to work and is stable for production use.
 */
export function createServer(config?: Partial<CacheConfig>): {
  server: Server;
  client: NoaaClient;
} {
  const cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...config };
  const cacheManager = new CacheManager(cacheConfig);
  const noaaClient = new NoaaClient(cacheManager);
  const toolHandlers = createToolHandlers(noaaClient);

  const server = new Server(
    {
      name: 'noaa-space-weather-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name as keyof typeof toolHandlers];
    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic tool dispatch
      return await (handler as (args: any) => Promise<any>)(args ?? {});
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  return { server, client: noaaClient };
}

/**
 * Run server in STDIO mode
 *
 * Note: When running in Docker, use Dockerfile.stdio (Node.js) instead of the
 * default Dockerfile (Bun) due to Bun's stdout buffering issue.
 * See: https://github.com/oven-sh/bun/issues/15893
 */
export async function runStdioServer(config?: Partial<CacheConfig>): Promise<void> {
  const { server } = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

/**
 * Run server in HTTP mode (Streamable HTTP transport)
 *
 * This implementation uses StreamableHTTPServerTransport in stateless mode,
 * which is ideal for serverless environments (AWS Lambda, Vercel, etc.)
 * where state cannot be preserved between requests.
 */
export async function runHttpServer(serverConfig: ServerConfig): Promise<void> {
  const port = serverConfig.port ?? 3000;
  const host = serverConfig.host ?? '0.0.0.0';

  // Create shared cache and client for utility endpoints
  const cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...serverConfig.cache };
  const cacheManager = new CacheManager(cacheConfig);
  const sharedClient = new NoaaClient(cacheManager);

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    // Cache stats endpoint
    if (url.pathname === '/stats') {
      const stats = sharedClient.getCacheStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    // Root endpoint - info
    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          name: 'noaa-space-weather-mcp',
          version: '0.1.0',
          description: 'MCP server for NOAA space weather data',
          transport: 'Streamable HTTP (stateless mode)',
          endpoints: {
            '/mcp': 'MCP Streamable HTTP endpoint (POST/GET/DELETE)',
            '/health': 'Health check',
            '/stats': 'Cache statistics',
          },
        }),
      );
      return;
    }

    // MCP endpoint using StreamableHTTPServerTransport
    if (url.pathname === '/mcp') {
      try {
        // Read request body for POST requests
        let body: unknown;
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          if (rawBody) {
            body = JSON.parse(rawBody);
          }
        }

        // For stateless mode, create a new server and transport for each request
        // This is ideal for serverless environments
        const { server } = createServer(serverConfig.cache);

        // Create stateless transport (sessionIdGenerator: undefined)
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode for serverless
        });

        // Connect server to transport
        await server.connect(transport);

        // Handle the request using the transport
        await transport.handleRequest(req, res, body);
      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: error instanceof Error ? error.message : 'Internal error',
              },
              id: null,
            }),
          );
        }
      }
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  httpServer.listen(port, host, () => {
    console.error(`NOAA Space Weather MCP Server running on http://${host}:${port}`);
    console.error('Endpoints:');
    console.error('  POST/GET/DELETE /mcp - MCP Streamable HTTP endpoint');
    console.error('  GET /health - Health check');
    console.error('  GET /stats - Cache statistics');
    console.error('Mode: Stateless (suitable for serverless deployment)');
  });
}
