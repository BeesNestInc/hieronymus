# OpenCode 連携メモ（manifest-engine 取込構成での扱い方）

> 目的: kaikei（hieronymus）側で OpenCode を「ちゃんと扱える程度」までの
> 情報を揃える。実装はまだ Route A の土台のみ。実装着手時は本書を更新していく。

## OpenCode とは

- CLI 駆動の AI エージェント/コーディングランタイム（npm: `opencode-ai`、SDK: `@opencode-ai/sdk`）
- `opencode serve` で OpenAI 互換の HTTP エンドポイントを出す。この名前でモデル実行・
  セッション管理（session/message/prompt）がおこなえる
- Legion（~/git/Legion）では「作業側の本体（conductor/worker）」として採用しており、
  chat 役の LLM（engine 側の executeLLM）と役割分担している:
    chat（会話フロント・engine）→ delegate → worker（OpenCode daemon・Legion側）。

## 現状の取り込み状態（kaikei）

| 項目 | 状態 |
|---|---|
| manifest-engine（LLM実行メカニズム） | 取込済: `ai/manifest-engine`（submodule、`Legion/src/engine` と同物） |
| OpenCode 実行系（serve 起動・worker・mailbox） | **未実装**。node_modules に `@opencode-ai/sdk` も無い |
| LLM provider 設定 | `package.json` に `@ai-sdk/google` `@ai-sdk/openai` `@ai-sdk/openai-compatible` あり |

## 参考実装（Legion）の構成

| Legion パス | 役割 |
|---|---|
| `src/gateway/daemon.js` (`initiateCoding` / daemon ループ) | `opencode serve` の spawn・port 確保/解放（`fuser -k`）・`Worker.open` 接続・ネットワーク/上流エラーでの serve 張り直し |
| `src/workers/opencode/client.js` | `OpenCodeWorker`: @opencode-ai/sdk（v1+v2 併用）でのセッション実行・retry・reply 抽出 |
| `src/workers/opencode/setup.js` | role → opencode 設定への変換（prompt/権限/skills/personal ストア）。`OPENCODE_CONFIG_CONTENT` に JSON を渡す |
| `src/workers/opencode/variant.js` | caution（low/normal/high）→ opencode variant の組替 |
| `src/workers/opencode/reply-extract.js` | reply から作業報告の本体を抽出 |
| `src/workers/index.js` | worker 種別のルート（`Worker.open('opencode', …)`） |
| `src/core/usage.js` | OpenCode Zen の usage 枠 API（キープール → engine `setRetryStrategy` へ） |
| `workers/opencode/<persona>.json` | opencode CLI へ渡す provider/models/instructions 設定（ Legion 固有） |

### serve 起動時に渡している環境変数（daemon.js 956-973 参照）

```
OPENCODE_API_KEY      先頭1本（serve 互換用）
OPENCODE_API_KEYS     [{name, key, threshold}] JSON（順序＝優先。serve 側回転用）
OPENCODE_USAGE_THRESHOLD / _CACHE_TTL_MS / _TIMEOUT_MS
OPENCODE_URL          既定 https://opencode.ai/zen/go/v1（Zenクラウド。local serve なら不要）
OPENCODE_CONFIG_CONTENT  JSON 文字列（<persona>.json 相当）
OPENAI_API_KEY / GEMINI_API_KEY  provider 生成用（.json 内から参照される）
HOME=/tmp（sandbox 起動時）
```

### <persona>.json の形（キー値は本書に書かない）

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["/personas/<id>/profile.md", "/personas/<id>/world.md"],
  "provider": {
    "<provider-key>": {
      "npm": "@ai-sdk/google",
      "name": "Google Gemini",
      "options": { "apiKey": "..." },
      "models": { "<model-id>": { "name": "<群名（chat_text 等）>" } }
    }
  }
}
```
`models` の `name` に Legion の llms 群名を付け、client が群名でモデルを選べる設計。

## kaikei での導入ルート

### Route A — LLM 実行系として使う（最小・推奨の最初の一歩）

engine（`ai/manifest-engine`）の `setModelProvider` に、opencode serve が公開する
OpenAI 互換エンドポイントを指すモデルを注入するだけ。

1. opencode CLI を入手して serve 起動（プロセス管理は kaikei 側で）
   ```sh
   npm i -g opencode-ai      # or npx opencode-ai
   opencode serve --hostname 0.0.0.0 --port 4098
   ```
2. engine hooks に注入（`@ai-sdk/openai-compatible` は導入済み）:
   ```js
   import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
   import { setModelProvider } from '../ai/manifest-engine/hooks.js';
   const provider = createOpenAICompatible({
     name: 'opencode-local',
     baseURL: 'http://127.0.0.1:4098/v1',
     apiKey: process.env.OPENCODE_API_KEY || 'local',
   });
   setModelProvider(async (name) => provider(name));
   ```
3. `setRetryStrategy`（キープール）を注入しない場合、engine はポリシーなしの
   単発試行（失敗で即エラー）。kaikei はキー枠制御が無いのでそれでよい。

最小 harness: `test/engine.test.js`（dry run まで確認済み）。

### Route B — worker/conductor として使う（未実装・将来）

delegate/mailbox/HITL/ファンアウト等の機構が前提。engine の守備範囲外であり、
Legion の `src/gateway/daemon.js` + `src/workers/**` を移植する形になる。
必要物の目安:
- `@opencode-ai/sdk`（Legion は ^1.18.21）
- mailbox（ファイル規約）+ 起動ループ（Legion `src/core/mail-box.js` 相当）
- role 定義資産（`roles/`, `workers/opencode/<persona>.json`）

着手する場合は本書にルートを追記していく。

## 注意点（Legion で事故った点の要点）

- **reasoningEffort**: GLM 系は reasoning を無効化できず 400 になる。
  engine では `setReasoningMandatory` hook で対象外strippingを実装（Legion model.js から注入）。
  kaikei が GLM 系を使うなら必須
- **セッションは使い捨て**: opencode の session ID 折り返し問題があるため
  （knowledge: lessons-from-session-wrap.md）。resume は TTL で掃除（Legion: `PENDING_SESSION_TTL_MS`）
- **ポートの孤児**: serve 張り直し前にポートを掴んだ孤児プロセスを解放する
  （`fuser -k <port>/tcp`）。放置すると guard.db 等のロック保持で後続起動が
  ハングすることがある（2026-11-04 の phase1 ハング事例）
- **ステータス系エラーの分類**: 429/5xx/`[server_error]`/`No function call found`,
  410 ModelDeprecated で再試行戦略が変わる（engine の `classifyRetryable`/`buildRetryPairs`）。
  詳細は knowledge: lessons-from-llm-fallback.md
- **キーはコミットしない**: `<persona>.json` は provider 設定で apiKey を含みうる。
  Legion では素材は `secrets/apiKeys.yaml`（gitignore 済）から展開している。
  kaikei は既存 `.env` + dotenv の流儀を使うこと

## 参照リンク

- engine README（hooks 一覧・standalone 使い方）: `ai/manifest-engine/README.md`
- engine hooks 実装: `ai/manifest-engine/hooks.js`
- Legion 側 hooks 供給形（参照実装）: `~/git/Legion/src/core/{manifest,request,llm-strategy}.js`
- 知識ベース: `knowledge/wiki/software-development/{lessons-from-llm-fallback,lessons-from-session-wrap,lessons-from-fanin}.md`
