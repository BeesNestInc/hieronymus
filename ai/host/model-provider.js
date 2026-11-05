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
  if ( isGroupedConfig() ) {
    // Legion 形式: 群のいずれかの候補が使えること（キーまたは接続先）
    const group = candidatesForGroup('standard');
    return ( group || [] ).some((first) => {
      if (( first.provider === 'openai-compatible' ) || ( first.provider === 'openai' ) ||
          ( first.provider === 'opencode_openai' )) {
        return Boolean(first.baseURL);
      }
      return Boolean(first.apiKey || ( Array.isArray(first.keys) && first.keys.length > 0 ));
    });
  }
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

// engine hooks の modelProvider / modelConfigResolver / candidateResolver。
// config/llms.yaml は2つの書式を受け付ける:
//  (a) 従来のフラット形式（provider/model/apiKey/baseURL 直接。後方互換）
//  (b) Legion 形式の llms 群:
//      llms:
//        standard:          # 群=優先順位リスト（上から試す）
//        - provider: openai-compatible
//          model: muse-spark-1.3-contributor
//          apiKey: "..."
//          baseURL: https://...
//          accepts: [text, image, pdf]    # 添付受容能力（input-strategy）
//          structuredOutput: false        # generateObject 不使用モデル用
//          alternate: gemini-2.0-flash    # 失敗時の代替（候補名 or 群名）
//        - provider: gemini
//          model: gemini-2.0-flash
//          apiKey: "..."
//        vision:                          # 候補名の参照でも群を作れる
//        - standard
// 群は engine の requestLLMBare（候補フォールバック）と input-strategy
// （alternate 連鎖）から参照される。リトライ戦略（キープール回し）は未接続
// なので、群の複数候補は manifest 系の structuredOutput 失敗と添付能力
// 切替でしか消費されない（Phase 3 で setRetryStrategy を接続予定）。

const PROVIDER_ALIASES = {
  // Legion の provider 名を host の makeModel に寄せる
  'opencode_openai': 'openai-compatible',
  'local': 'openai-compatible'
};

// 設定が Legion 形式（llms 群）かどうか
export const isGroupedConfig = () => {
  const llms = loadConfig();
  return Boolean(( process.env.LLM_PROVIDER ? null : llms.llms ));
};

const normalizeCandidate = (entry, groupKey) => {
  if ( !entry || typeof entry !== 'object' || Array.isArray(entry) ) return null;
  const name = entry.name || groupKey;
  if ( !name || !entry.model ) return null;
  return { ...entry, name: String(name) };
};

// 他群で定義済みの候補を名前で流用する（裸文字列 → 定義のコピー。Legion 同様）
const findRawCandidate = (name) => {
  for ( const key of Object.keys(loadConfig().llms || {}) ) {
    const group = loadConfig().llms[key];
    if ( !Array.isArray(group) ) continue;
    for ( const raw of group ) {
      const c = normalizeCandidate(raw, key);
      if ( c && c.name === name ) return c;
    }
  }
  return null;
};

// 群を候補の配列に展開する（文字列は他群候補への参照として解決）
export const candidatesForGroup = (groupKey, depth = 0) => {
  const llms = loadConfig().llms || {};
  const group = llms[groupKey];
  if ( group === undefined ) return null;
  if ( typeof group === 'string' ) {
    if ( depth >= 3 ) return [];
    return candidatesForGroup(group, depth + 1);
  }
  const items = Array.isArray(group) ? group : [ group ];
  const out = [];
  for ( const raw of items ) {
    if ( typeof raw === 'string' ) {
      const c = findRawCandidate(raw);
      if ( c ) out.push(c);
      continue;
    }
    const c = normalizeCandidate(raw, groupKey);
    if ( c ) out.push(c);
  }
  return out;
};

// 名前で候補を解決する（自群単一エントリ or 群の先頭候補）。
// 見つからなければ null
export const resolveCandidate = (name = 'standard', depth = 0) => {
  if ( depth >= 3 ) return null;
  const group = candidatesForGroup(name);
  if ( !group || group.length === 0 ) return null;
  // 群は優先順位リスト。単発用途では最初の利用可能候補を返す
  return group[0];
};

// 全群の候補を name 重複検査して列挙
export const validateLlmsNames = () => {
  const seen = new Map();
  const dups = [];
  for ( const key of Object.keys(loadConfig().llms || {}) ) {
    for ( const c of ( candidatesForGroup(key) || [] ) ) {
      const n = c.name;
      if ( seen.has(n) ) {
        const hit = dups.find((d) => ( d.name === n ));
        if ( hit ) hit.groups.push(key);
        else dups.push({ name: n, groups: [ seen.get(n), key ] });
      } else {
        seen.set(n, key);
      }
    }
  }
  return dups;
};

// 候補の設定オブジェクト（provider/model/apiKey/baseURL/headers へ寄せる）
const settingFromCandidate = (candidate) => {
  const provider = PROVIDER_ALIASES[candidate.provider] || candidate.provider;
  const keys = Array.isArray(candidate.keys) ? candidate.keys : null;
  return {
    provider: provider,
    model: candidate.model,
    apiKey: candidate.apiKey || ( keys ? keys[0] : '' ) || '',
    baseURL: candidate.baseURL || '',
    headers: candidate.headers || {}
  };
};

const modelCache = new Map();
const makeModelForCandidate = (candidate) => {
  const setting = settingFromCandidate(candidate);
  // 同一設定の再生成を避ける（apiKey 等が変われば新しく作られる）
  const cacheKey = [ candidate.name, setting.provider, setting.model, setting.apiKey, setting.baseURL ].join('|');
  if ( !modelCache.has(cacheKey) ) {
    modelCache.set(cacheKey, makeModel(setting));
  }
  return modelCache.get(cacheKey);
};

// engine hooks modelProvider: name → LanguageModel
export const modelProvider = async (name) => {
  if ( isGroupedConfig() ) {
    const candidate = resolveCandidate(String(name || 'standard'));
    if ( candidate ) {
      return makeModelForCandidate(candidate);
    }
  }
  return makeModel(settings());
};

// engine hooks modelConfigResolver: name → {structuredOutput, accepts, alternate, ...} | undefined
// （request.js の structuredOutput 判定と input-strategy の accepts/alternate 連鎖に使う）
export const modelConfig = (name) => {
  if ( !isGroupedConfig() ) {
    return undefined;
  }
  const group = candidatesForGroup(String(name || 'standard'));
  if ( !group || group.length === 0 ) {
    return undefined;
  }
  const candidate = group[0];
  return {
    structuredOutput: candidate.structuredOutput !== false,
    accepts: candidate.accepts,
    alternate: candidate.alternate,
    ...candidate
  };
};

// engine hooks candidateResolver: ref（群名 or 候補名）→ [{name, accepts, alternate}]（順序保持）
export const candidates = (ref) => {
  if ( !isGroupedConfig() ) {
    return null;
  }
  const group = candidatesForGroup(String(ref || ''));
  if ( !group || group.length === 0 ) {
    return null;
  }
  return group.map((c) => ({ name: c.name, accepts: c.accepts, alternate: c.alternate }));
};
