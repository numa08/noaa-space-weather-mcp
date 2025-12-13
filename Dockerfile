# syntax=docker/dockerfile:1

# NOAA Space Weather MCP Server
# Multi-stage build for minimal image size

# Build stage
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies (including devDependencies for type checking and linting)
RUN bun install --frozen-lockfile

# Copy source code
COPY tsconfig.json biome.json ./
COPY src ./src

# Type check and lint
RUN bun run typecheck && bun run lint

# Build (optional - Bun can run TypeScript directly)
# RUN bun build src/index.ts --outdir dist --target bun

# Production stage
FROM oven/bun:1.1-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy package files and install production dependencies only
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Copy source from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Create cache directory with proper permissions
RUN mkdir -p /app/.cache && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV MCP_SERVER_PORT=3000
ENV MCP_CACHE_PATH=/app/.cache

# Expose HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Default to HTTP mode for containerized deployment
# Override with --stdio for STDIO mode
ENTRYPOINT ["bun", "run", "src/index.ts"]
CMD ["--http", "--port", "3000", "--host", "0.0.0.0"]
