# NOAA Space Weather MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

アマチュア無線家向けのNOAA宇宙気象データMCPサーバーです。太陽活動データを分析し、HF（短波）のDX伝搬状況を予測するためのツールを提供します。

## 特徴

- 🌞 **太陽活動データ**: 太陽フレア（X線フラックス）、Kp指数、太陽風データをリアルタイムで取得
- 📡 **伝搬分析**: 現在の宇宙気象に基づいたHF伝搬状況の分析と推奨バンドの提案
- 💾 **スマートキャッシュ**: NOAAサーバーへの負荷を軽減するキャッシュ機構
- 🔍 **クエリ機能**: 大きなJSONデータから必要な情報のみを抽出してコンテキストを節約
- 🐳 **Docker対応**: コンテナでの簡単なデプロイ

## インストール

### 前提条件

- [Bun](https://bun.sh/) 1.1以上
- Docker（コンテナ利用時）

### ローカル開発

```bash
# リポジトリをクローン
git clone https://github.com/numa08/noaa-space-weather-mcp.git
cd noaa-space-weather-mcp

# 依存関係のインストール
bun install

# 開発サーバー起動（STDIO）
bun run dev

# HTTP サーバーとして起動
bun run dev:http
```

### Docker

```bash
# HTTPモード用イメージのビルド（Bun）
docker build -t numa08/noaa-space-weather-mcp:http .

# STDIOモード用イメージのビルド（Node.js）
docker build -f Dockerfile.stdio -t numa08/noaa-space-weather-mcp:stdio .

# コンテナの起動（HTTPモード）
docker run -p 3000:3000 numa08/noaa-space-weather-mcp:http

# コンテナの起動（STDIOモード）
docker run -i numa08/noaa-space-weather-mcp:stdio
```

#### Docker Hubからの利用

```bash
# HTTPモード
docker pull numa08/noaa-space-weather-mcp:http
docker run -p 3000:3000 numa08/noaa-space-weather-mcp:http

# STDIOモード
docker pull numa08/noaa-space-weather-mcp:stdio
docker run -i numa08/noaa-space-weather-mcp:stdio
```

> **Note**: STDIOモードではNode.jsランタイムを使用しています。
> これはBunのstdoutバッファリング問題（[oven-sh/bun#15893](https://github.com/oven-sh/bun/issues/15893)）を
> 回避するためです。HTTPモードではBunを使用し、高速な起動とレスポンスを実現しています。

## MCPサーバーのセットアップ

### 方法1: STDIOトランスポート（ローカル実行）

ローカル環境でClaude DesktopやClaude Codeと連携する場合に推奨される方法です。

#### Claude Desktop

`claude_desktop_config.json` に以下を追加:

```json
{
  "mcpServers": {
    "noaa-space-weather": {
      "command": "bun",
      "args": ["run", "/path/to/noaa-space-weather-mcp/src/index.ts"]
    }
  }
}
```

#### Claude Code

`.claude/settings.json` に以下を追加:

```json
{
  "mcpServers": {
    "noaa-space-weather": {
      "command": "bun",
      "args": ["run", "/path/to/noaa-space-weather-mcp/src/index.ts"]
    }
  }
}
```

### 方法2: HTTPトランスポート（リモート/Docker）

サーバーレス環境やDockerコンテナでの運用に推奨される方法です。
Streamable HTTPトランスポート（ステートレスモード）を使用します。

#### サーバーの起動

```bash
# ローカルで起動
bun run start:http --port 3000

# Dockerで起動
docker run -p 3000:3000 numa08/noaa-space-weather-mcp:http
```

#### エンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/mcp` | POST/GET/DELETE | MCP Streamable HTTPエンドポイント |
| `/health` | GET | ヘルスチェック |
| `/stats` | GET | キャッシュ統計 |

#### Claude Code（HTTP接続）

`.claude/settings.json` に以下を追加:

```json
{
  "mcpServers": {
    "noaa-space-weather": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

#### 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# MCP初期化リクエスト（Streamable HTTP）
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'

# ツール一覧の取得
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
```

## 利用可能なツール

| ツール名 | 説明 |
|---------|------|
| `get_space_weather_summary` | 現在の宇宙気象サマリーを取得 |
| `get_xray_flux` | 太陽フレア（X線フラックス）データを取得 |
| `get_kp_index` | 地磁気活動（Kp指数）データを取得 |
| `get_solar_wind` | 太陽風データを取得 |
| `analyze_propagation` | HF伝搬状況を分析 |
| `get_cache_stats` | キャッシュ統計を表示 |
| `clear_cache` | キャッシュをクリア |

### クエリの例

```
# 過去24時間のKp指数を取得（最新10件）
get_kp_index: { "hours": 24, "limit": 10 }

# 特定期間のX線フラックスを取得
get_xray_flux: { "query": "startTime=2024-01-01&endTime=2024-01-07&limit=20" }

# 20mバンドの伝搬分析
analyze_propagation: { "targetBand": "20m" }
```

## アマチュア無線と宇宙気象

### Kp指数の解釈

| Kp値 | 状態 | HF伝搬への影響 |
|-----|------|--------------|
| 0-2 | 静穏 | 良好な伝搬条件 |
| 3-4 | 不安定 | 軽微な乱れの可能性 |
| 5+ | 磁気嵐 | 高緯度で伝搬悪化 |

### 太陽フレアの分類

| クラス | 強度 | 短波通信への影響 |
|-------|-----|----------------|
| A, B | 背景レベル | 影響なし |
| C | 小規模 | 軽微な影響 |
| M | 中規模 | 昼側でフェードアウト |
| X | 大規模 | 大規模ブラックアウト |

## 開発

```bash
# テストの実行
bun run test

# 静的解析
bun run lint

# 型チェック
bun run typecheck

# すべてのチェックを実行
bun run check
```

## ライセンス

MIT License

## 参考リンク

- [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Bun](https://bun.sh/)
