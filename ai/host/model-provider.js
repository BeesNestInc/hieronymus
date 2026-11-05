import fs from 'fs';
import { load as yamlLoad } from 'js-yaml';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// LLM設定の読み込みとモデル生成。Legion manifest-engine（ai/manifest-engine）
// を Hieronymus で使うための host 固有実装（engine hooks に modelProvider /
// modelConfigResolver / candidateResolver として注入する）。
// vision.js などの AI機能はこのモジュール経由でモデルを得る。
//
// 設定は config/llms.yaml（または config/llms.json）1つで、Legion と同じ
// `llms:` 群形式のみを扱う（未設定時は gemini の素とした挙動にフォールバック
// するので、AIを使わない運用でも isAvailable() が false に落ちて安全）:
//   llms:
//     standard:
//     - provider: gemini                # gemini / openai / openai-compatible /
//                                       # opencode_openai / local
//       model: gemini-3.5-flash-lite
//       apiKey: "..."
//       accepts: [text, image, pdf]     # 添付受容能力（input-strategy）
//       structuredOutput: false         # generateObject 不使用モデル用
//       alternate: <候補名 or 群名>      # 失敗時の代替
// 群は優先順位リスト。文字列エントリは他群候補の参照（連鎖なしのコピー）。
// 環境変数 LLM_PROVIDER / LLM_MODEL / LLM_API_KEY / LLM_BASE_URL は、解決した
// 候補の各フィールドを上書きする（テスト・一時切替の便宜的な口）。

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

// 群を候補の配列に展開する（文字列は他群候補への参照として解決。連鎖なし）
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

// config 未設定時に使う素の候補（isAvailable を通らないので AI は無効のまま）
const DEFAULT_CANDIDATE = normalizeCandidate({
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  apiKey: ''
}, 'standard');

// 環境変数による部分的な上書き（テスト・一時切替の口）
const applyEnvOverrides = (candidate) => {
  if ( !candidate ) return null;
  const out = { ...candidate };
  if ( process.env.LLM_PROVIDER ) out.provider = process.env.LLM_PROVIDER;
  if ( process.env.LLM_MODEL ) out.model = process.env.LLM_MODEL;
  if ( process.env.LLM_API_KEY ) out.apiKey = process.env.LLM_API_KEY;
  if ( process.env.LLM_BASE_URL ) out.baseURL = process.env.LLM_BASE_URL;
  return out;
};

// 名前で候補を解決する（自群の先頭候補。未定義名は standard 群、最後は素の候補）
export const resolveCandidate = (name = 'standard') => {
  for ( const key of [ String(name || 'standard'), 'standard' ] ) {
    const group = candidatesForGroup(key);
    if ( group && group.length > 0 ) {
      return applyEnvOverrides(normalizeUsed(group[0]));
    }
  }
  return applyEnvOverrides({ ...DEFAULT_CANDIDATE });
};
// 群内の copy に name を確保（参照でも名前が保たれる）
const normalizeUsed = (candidate) => ( candidate.name ? candidate : { ...candidate, name: 'standard' } );

// name の重複検出（boot 時に呼ぶ想定。Phase 3 で結線）
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

// 候補の設定オブジェクト（provider/model/apiKey/baseURL/headers へ寄せる）。
// provider 名の alias（opencode_openai / local）は makeModel に寄せる
const settingFromCandidate = (candidate) => {
  const keys = Array.isArray(candidate.keys) ? candidate.keys : null;
  return {
    provider: candidate.provider,
    model: candidate.model,
    apiKey: candidate.apiKey || ( keys ? keys[0] : '' ) || '',
    baseURL: candidate.baseURL || '',
    headers: candidate.headers || {}
  };
};

export const settings = () => {
  const candidate = resolveCandidate('standard');
  return settingFromCandidate(candidate);
};

export const isAvailable = () => {
  const setting = settings();
  if (( setting.provider === 'openai-compatible' ) || ( setting.provider === 'openai' ) ||
      ( setting.provider === 'opencode_openai' ) || ( setting.provider === 'local' )) {
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
  const provider = (( setting.provider === 'opencode_openai' ) || ( setting.provider === 'local' )) ?
    'openai-compatible' : setting.provider;
  switch ( provider ) {
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
      const strict = ( provider === 'openai' ) || String(setting.model).includes('muse-spark');
      const build = strict ? createOpenAI : createOpenAICompatible;
      const sdkProvider = build({
        baseURL: setting.baseURL,
        ...(setting.apiKey ? { apiKey: setting.apiKey } : {}),
        headers: openaiHeaders(setting),
        name: 'hieronymus'
      });
      return sdkProvider(setting.model);
    }
    default: {
      const err = new Error(`未対応のAIプロバイダ: ${setting.provider}`);
      err.name = 'AiApiError';
      throw err;
    }
  }
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
  return makeModelForCandidate(resolveCandidate(String(name || 'standard')));
};

// engine hooks modelConfigResolver: name → {structuredOutput, accepts, alternate, ...} | undefined
// （request.js の structuredOutput 判定と input-strategy の accepts/alternate 連鎖に使う）
export const modelConfig = (name) => {
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
  const group = candidatesForGroup(String(ref || ''));
  if ( !group || group.length === 0 ) {
    return null;
  }
  return group.map((c) => ({ name: c.name, accepts: c.accepts, alternate: c.alternate }));
};
