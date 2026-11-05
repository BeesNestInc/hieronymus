import fs from 'fs';
import { load as yamlLoad } from 'js-yaml';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// LLM設定の読み込みとモデル生成。Legion manifest-engine（ai/manifest-engine）
// を Hieronymus で使うための host 固有実装（engine hooks に modelProvider と
// modelConfigResolver として注入する）。
// vision.js などの AI機能はこのモジュール経由でモデルを得る。
//
// 設定は config/llms.yaml（なければ config/llms.json。Sequelize用の
// config.json とは別ファイル）:
//   provider: gemini          # gemini / openai / openai-compatible
//   model: gemini-2.0-flash
//   apiKey: "..."
//   baseURL: https://api.openai.com/v1   # openai系のみ
//   headers: {}               # 任意。openai系のリクエストに付与する追加ヘッダ
// gemini以外はOpenAI互換API（/chat/completions）。`openai` は厳密な構造化出力に
// 対応したモデル用（muse-spark等。Legionも同様に使い分けている）。
// 環境変数 LLM_PROVIDER / LLM_MODEL / LLM_API_KEY / LLM_BASE_URL でも指定できる（ファイルより優先）。
// APIキーが未設定の場合 isAvailable() が false となり、AI機能は無効化される
// （AIを利用しない運用の環境でも成立させるため、AI前提の処理にはしない）。
// ただし openai-compatible で baseURL があればキーなしでも利用可（ローカルLLM想定）。

export const loadConfig = () => {
  // テスト時は LLM_CONFIG_PATH でfixtureを指せる（拡張子でyaml/jsonを判別）
  const paths = process.env.LLM_CONFIG_PATH ?
    [ process.env.LLM_CONFIG_PATH ] :
    [ 'config/llms.yaml', 'config/llms.json' ];
  for ( const path of paths ) {
    try {
      const text = fs.readFileSync(path, 'utf-8');
      if ( /\.ya?ml$/i.test(path) ) {
        return yamlLoad(text) || {};
      }
      return JSON.parse(text);
    } catch (e) {
      continue;
    }
  }
  return {};
};

export const settings = () => {
  const llms = loadConfig();
  return {
    provider: process.env.LLM_PROVIDER || llms.provider || 'gemini',
    model: process.env.LLM_MODEL || llms.model || 'gemini-2.0-flash',
    apiKey: process.env.LLM_API_KEY || llms.apiKey || '',
    baseURL: process.env.LLM_BASE_URL || llms.baseURL || '',
    headers: llms.headers || {}
  };
};

export const isAvailable = () => {
  const setting = settings();
  if (( setting.provider === 'openai-compatible' ) || ( setting.provider === 'openai' )) {
    // ローカルLLM等、キーなし運用を許す。接続先がなければ無効
    return Boolean(setting.baseURL);
  }
  return Boolean(setting.apiKey);
};

// openai-compatible用の追加ヘッダ。config/llms.yaml の headers を素通しし、
// opencode.aiゲートウェイ向けに x-opencode-session を自動付与する
// （ゲートウェイのルーティングに必須。Legionも同様に付与している）。
const openaiHeaders = (setting) => {
  const headers = { ...(setting.headers || {}) };
  try {
    if ( new URL(setting.baseURL).hostname.includes('opencode.ai') &&
      !headers['x-opencode-session'] ) {
      headers['x-opencode-session'] = `hieronymus-${process.pid}-${Date.now().toString(36)}`;
    }
  } catch (e) {
    // baseURL不正は接続時にエラーになるためここでは無視
  }
  return headers;
};

// 設定からAI SDKのモデルを作る。固定の単一モデル（切替なし）
export const makeModel = (setting) => {
  switch ( setting.provider ) {
    case 'gemini':
      // isAvailable() がキーを保証する。キーはプロバイダ生成時に渡す
      return createGoogleGenerativeAI({ apiKey: setting.apiKey })(setting.model);
    case 'openai':
    case 'openai-compatible': {
      if ( !setting.baseURL ) {
        const err = new Error('接続先がありません（config/llms.yaml の baseURL）。');
        err.name = 'AiNotConfigured';
        throw err;
      }
      // muse-spark系は互換プロトコルでは動かないため完全なOpenAIプロバイダを使う
      const strict = ( setting.provider === 'openai' ) || String(setting.model).includes('muse-spark');
      const build = strict ? createOpenAI : createOpenAICompatible;
      const provider = build({
        baseURL: setting.baseURL,
        ...(setting.apiKey ? { apiKey: setting.apiKey } : {}),
        headers: openaiHeaders(setting),
        name: 'hieronymus'
      });
      return provider(setting.model);
    }
    default: {
      const err = new Error(`未対応のAIプロバイダ: ${setting.provider}`);
      err.name = 'AiApiError';
      throw err;
    }
  }
};

// engine hooks の modelProvider 形（name → Promise<LanguageModel>）。
// config/llms.yaml は単一モデルの設定なので名前は無視する（複数モデルを
// 指したくなったら entries の増設で対応）。
export const modelProvider = async (name) => {
  return makeModel(settings());
};
