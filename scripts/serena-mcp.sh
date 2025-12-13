#!/bin/bash
# scripts/serena-mcp.sh
# Serena MCP server wrapper for git worktree environments

# スクリプトの場所からリポジトリルートを取得（worktreeでも正しく動作）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

exec uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
    --context claude-code \
    --project "$PROJECT_ROOT" \
    --enable-web-dashboard False