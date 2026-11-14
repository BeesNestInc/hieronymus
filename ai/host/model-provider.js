import fs from 'fs';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// LLM設定の読み込みとモデル生成。Legion manifest-engine（ai/manifest-engine）
// を Hieronymus で使うための host 固有実装（engine hooks に modelProvider /
// modelConfigResolver / candidateResolver として注入する）。
// vision.js などの AI機能はこのモジュール経由でモデルを得る。
//
// 設定は config/llms.yaml 1つで、Legion と同じ
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

// 設定ファイルのパス（テスト時は LLM_CONFIG_PATH でfixtureを指せる）
export const configPath = () => ( process.env.LLM_CONFIG_PATH || 'config/llms.yaml' );

export const loadConfig = () => {
  const paths = [ configPath() ];
  for ( const path of paths ) {
    try {
      return yamlLoad(fs.readFileSync(path, 'utf-8')) || {};
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

// ---------------------------------------------------------------
// 管理者ホーム「AI設定」パネル用の読み書き。編集対象は llms.standard
// 群の先頭候補のみ（他の候補・群はファイル上にそのまま保持する）。
// 書き込みはこのモジュールだけが行い、loadConfig が毎回読み直すので
// 保存は即時反映（再起動不要）。

const STANDARD_PROVIDERS = [ 'gemini', 'openai', 'openai-compatible', 'opencode_openai', 'local' ];
const ACCEPTS_KINDS = [ 'text', 'image', 'pdf' ];

const rawStandardEntries = () => {
  const llms = loadConfig().llms || {};
  return Array.isArray(llms.standard) ? llms.standard : [];
};

const firstStandardEntry = () => {
  const raw = rawStandardEntries().find((e) => ( e && typeof e === 'object' && !Array.isArray(e) ));
  return raw ? normalizeCandidate(raw, 'standard') : null;
};

const maskKey = (key) => {
  if ( !key ) return '';
  return ( String(key).length <= 4 ) ? '****' : `${String(key).slice(0, 4)}***`;
};

// 環境変数による上書きの検出（UIの見た目と解決結果がずれる可能性の警告用）
const envOverrides = () => {
  const names = [ 'LLM_PROVIDER', 'LLM_MODEL', 'LLM_API_KEY', 'LLM_BASE_URL' ];
  return names.filter((n) => ( Boolean(process.env[n]) ));
};

// パネル表示用の状態（apiKey はマスクする。生キーはブラウザへ渡さない）
export const standardCandidateInfo = () => {
  const candidate = firstStandardEntry() || { ...DEFAULT_CANDIDATE };
  const masked = maskKey(candidate.apiKey);
  return {
    candidate: {
      description: candidate.description || '',
      provider: candidate.provider,
      model: candidate.model,
      baseURL: candidate.baseURL || '',
      accepts: Array.isArray(candidate.accepts) ? candidate.accepts : [],
      structuredOutput: candidate.structuredOutput !== false,
      apiKeyMasked: masked
    },
    available: isAvailable(),
    envOverrides: envOverrides()
  };
};

// 先頭候補の入力チェック。問題がなければ null、なければ { error: "..." }
// （apiKey 必須は gemini/openai。baseURL 必須はそれ以外 — makeModel の挙動に揃える。
//   existing を渡すと「空欄 = 既存キー維持」もキー要件の判定に使える）
export const validateStandardCandidate = (patch, existing) => {
  const p = patch || {};
  if ( !STANDARD_PROVIDERS.includes(p.provider) ) {
    return { error: `未対応のAIプロバイダ: ${String(p.provider)}` };
  }
  if ( !String(p.model || '').trim() ) {
    return { error: 'モデル名が入力されていません。' };
  }
  const keepsKey = Boolean(existing && existing.apiKey) && !String(p.apiKey || '').trim();
  if (( p.provider === 'gemini' ) || ( p.provider === 'openai' )) {
    if ( !keepsKey && !String(p.apiKey || '').trim() ) {
      return { error: `${p.provider === 'gemini' ? 'Gemini' : 'OpenAI'}にはAPIキーが必要です。` };
    }
  }
  if ( p.provider !== 'gemini' && !String(p.baseURL || '').trim() ) {
    return { error: 'openai系プロバイダには接続先（baseURL）が必要です。' };
  }
  if ( p.accepts !== undefined ) {
    if ( !Array.isArray(p.accepts) ||
         ( p.accepts.some((a) => ( !ACCEPTS_KINDS.includes(a) )) ) ) {
      return { error: 'accepts は text / image / pdf の組み合わせで指定してください。' };
    }
  }
  if ( p.structuredOutput !== undefined && typeof p.structuredOutput !== 'boolean' ) {
    return { error: 'structuredOutput は真偽値で指定してください。' };
  }
  return null;
};

// ファイルのヘッダコメント（yamlダンプでコメントは消えるため毎回再生成する）
const LLMS_HEADER = `# AI（LLM）設定。管理者ホームの「AI設定」パネルから編集できる。
# llms 群形式の詳細は ai/host/index.md を参照（standard 群の先頭候補が使用される）。
`;

const buildEntry = (current, patch) => {
  // apiKey は空欄保存で既存キーを維持する（生キーをブラウザに返さない前提）
  const entry = {
    ...( current ? { description: current.description, apiKey: current.apiKey } : {} )
  };
  if ( String(patch.description || '').trim() ) {
    entry.description = String(patch.description);
  } else {
    delete entry.description;
  }
  entry.provider = patch.provider;
  entry.model = String(patch.model).trim();
  if ( String(patch.apiKey || '').trim() ) {
    entry.apiKey = String(patch.apiKey);
  }
  if ( String(patch.baseURL || '').trim() ) {
    entry.baseURL = String(patch.baseURL).trim();
  } else {
    delete entry.baseURL;
  }
  if ( patch.accepts !== undefined ) {
    if ( Array.isArray(patch.accepts) && ( patch.accepts.length > 0 ) ) {
      entry.accepts = [ ...patch.accepts ];
    } else {
      delete entry.accepts;
    }
  }
  if ( patch.structuredOutput !== undefined ) {
    // yaml上は false のときだけ書く（未書き = true の解釈）
    if ( patch.structuredOutput === false ) {
      entry.structuredOutput = false;
    } else {
      delete entry.structuredOutput;
    }
  }
  for ( const k of Object.keys(entry) ) {
    if ( entry[k] === undefined ) delete entry[k];
  }
  return entry;
};

// standard 群の先頭候補を保存する。他の候補・群・参照は書き換えない。
// 失敗時は { error }、成功時は standardCandidateInfo() と同じ形を返す
export const updateStandardCandidate = (patch) => {
  const config = loadConfig();
  const llms = ( config.llms && typeof config.llms === 'object' && !Array.isArray(config.llms) ) ?
    config.llms : {};
  const entries = Array.isArray(llms.standard) ? [ ...llms.standard ] : [];
  const currentIndex = entries.findIndex((e) => ( e && typeof e === 'object' && !Array.isArray(e) ));
  const current = ( currentIndex >= 0 ) ? normalizeCandidate(entries[currentIndex], 'standard') : null;
  const check = validateStandardCandidate(patch, current);
  if ( check ) {
    return check;
  }
  const entry = buildEntry(current, patch);
  if ( currentIndex >= 0 ) {
    // 現在の先頭オブジェクトだけを差し替える（文字列参照や後続候補は保持）
    entries[currentIndex] = entry;
  } else {
    entries.unshift(entry);
  }
  const next = { ...config, llms: { ...llms, standard: entries } };
  try {
    fs.writeFileSync(configPath(), LLMS_HEADER + yamlDump(next, { lineWidth: -1 }), 'utf-8');
  } catch (e) {
    return { error: `設定ファイルの書き込みに失敗しました（${configPath()}）。` };
  }
  // 名前の重複は保存を妨げない（既存設定由来の可能性がある）が、警告として返す。
  // validateLlmsNames の結線（Phase 3 の残留タスク）
  const dups = validateLlmsNames();
  const info = standardCandidateInfo();
  if ( dups.length > 0 ) {
    info.warnings = dups.map((d) => (
      `候補名「${d.name}」が群 ${d.groups.join(', ')} で重複しています。`
    ));
  }
  return info;
};
