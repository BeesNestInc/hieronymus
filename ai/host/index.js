import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engineHooks from '../manifest-engine/hooks.js';
import * as modelProvider from './model-provider.js';
import { kaikeiMcpTools } from './mcp-tools.js';

// Legion manifest-engine（ai/manifest-engine、submodule）を Hieronymus で
// 動かすための host adapter。engine 本体は host 固有実装を hooks 経由で
// 受ける設計なので、ここで modelProvider / modelConfigResolver / toolTable /
// mcpTools を注入する（README「7. hooks」参照）。
// AI機能（libs/vision.js ほか、ai/manifests/*）は本モジュールの
// initializeAiHost() を実行してから Manifest を使うこと。

const hostRoot = path.dirname(fileURLToPath(import.meta.url));
// テンプレートの既定位置。bin/www / mocha 以外の入口でも成立させるため、
// 未指定のときだけ設定する（明示指定があれば尊重）
if ( !process.env.TEMPLATE_DIR ) {
  process.env.TEMPLATE_DIR = path.resolve(hostRoot, '../prompt-templates');
}
// engine の LLM 失敗時リトライ既定（3）だと精算の再認識などの単発処理で
// 待たされる。旧 vision 実装（リトライ1回まで）に合わせる。深追いしたい
// 場合は明示的に設定して上書き
if ( process.env.LLM_MAX_RETRIES === undefined ) {
  process.env.LLM_MAX_RETRIES = '1';
}

let initialized = false;
export const initializeAiHost = async () => {
  if ( initialized ) {
    return;
  }
  initialized = true;
  // modelProvider: (name) => Promise<LanguageModel>。Legion 形式の llms 群か
  // 従来のフラット設定かを model-provider が判別して供給する
  engineHooks.setModelProvider(modelProvider.modelProvider);
  // structuredOutput 可否・accepts/alternate の供給（Legion 形式の llms 群から）
  engineHooks.setModelConfigResolver(modelProvider.modelConfig);
  // 群参照（requestLLMBare の候補フォールバックと input-strategy 候補解決）。
  // リトライ戦略（setRetryStrategy）の接続は Phase 3（キープール運用と一緒に）
  engineHooks.setCandidateResolver(modelProvider.candidates);
  // host のツール群（現状なし。built-in ツールは使わない）
  engineHooks.setToolTable({});
  // MCP群の束ね: Hieronymus 本体の voucher-mcp / expense-mcp（HTTP API 経由）
  engineHooks.setMcpTools(kaikeiMcpTools());
  // 履歴なしの方針。Legion の workspace 走査（bulk archive 用）は持たない
  engineHooks.setHistoriesDirsFinder(() => []);
  engineHooks.setWorkerHistoriesDirsFinder(() => []);
};
