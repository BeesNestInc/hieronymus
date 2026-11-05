import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engineHooks from '../manifest-engine/hooks.js';
import * as modelProvider from './model-provider.js';

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

let initialized = false;
export const initializeAiHost = async () => {
  if ( initialized ) {
    return;
  }
  initialized = true;
  // modelProvider: (name) => Promise<LanguageModel>。config/llms.yaml の単一モデル
  engineHooks.setModelProvider(modelProvider.modelProvider);
  // structuredOutput 可否等の制御。現行は全モデルで generateObject を試し、
  // 失敗時に engine が generateText+JSON解析へフォールバックする（request.js）
  engineHooks.setModelConfigResolver((name) => modelProvider.settings());
  // host のツール群（Phase 3 で拡張）
  engineHooks.setToolTable({});
  // MCP群の束ね（Phase 3 で voucher-mcp / expense-mcp を接続）
  engineHooks.setMcpTools({});
  // 履歴なしの方針。Legion の workspace 走査（bulk archive 用）は持たない
  engineHooks.setHistoriesDirsFinder(() => []);
  engineHooks.setWorkerHistoriesDirsFinder(() => []);
};
