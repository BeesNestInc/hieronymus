import fs from 'fs';
import { load as yamlLoad } from 'js-yaml';
import { Jimp } from 'jimp';
import { generateObject, generateText, jsonSchema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// AI（LLM）による証憑OCR。Vercel AI SDKを使う。
// vision用途に固定した単一モデルを使う（自動切替はしない）。
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

const loadConfig = () => {
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

const settings = () => {
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

// AIに渡すプロンプト。抽出結果はJSON（不明項目はnull）。
// 会社名は請求元・領収書の発行者（支払先）。「お支払者名」「お客様名」
// 「ご契約者」欄の名前（支払う側・自社）は会社名にしない。
const PROMPT_BASE = [
  'この帳票から 会社名/発行日/支払日/金額/消費税/税率/請求番号/取引内容 を読み取り、',
  '以下のJSON形式で出力してください:',
  '{"company":"...","companyId":...,"issueDate":"...","paymentDate":"...","amount":...,"tax":...,"taxRate":...,"invoiceNo":"...","description":"..."}',
  '不明な項目は null。金額は数値（金額は税込の合計額、その内訳が消費税）。日付は YYYY-MM-DD 形式。JSON以外の出力はしないこと。',
  '会社名は請求元・帳票の発行者（お金を支払う相手）とする。',
  '「お支払者名」「お客様名」「ご契約者」「お名前」欄に書かれた名前（支払う側）は会社名にしないこと。'
].join('\n');

// 自社名を取得してプロンプトに除外指定を足す（読取失敗時は付けない）。
// 例: 電気料金受領証の「お支払者名 BeesNest合同会社」を会社名にしない。
// companies（[{id, name}]）があれば候補一覧を載せ、companyIdまで一発で
// 選ばせる（表記ゆれはモデルに吸収させる。2ステップに分けない）。
const buildPrompt = async (companies) => {
  const lines = [ PROMPT_BASE ];
  try {
    const { default: myCompany } = await import('./my-company.js');
    const self = await myCompany();
    if ( self && self.name ) {
      lines.push(`「${self.name}」は自社（支払う側）なので会社名にしないこと。`);
    }
  } catch (e) {
  }
  const list = ( companies || [] ).filter((c) => ( c && c.name ));
  if ( list.length > 0 ) {
    lines.push(
      '以下の取引先候補の中から、この帳票の支払先（請求元）に該当するものを選び、',
      'companyId にそのIDを入れること。表記ゆれ（株式会社/㈱、事業/局、',
      '略称、英語表記など）は同一とみなす。該当がなければ companyId は null とし、',
      'company には帳票に書かれた表記をそのまま入れること。',
      '候補:',
      ...list.map((c) => `${c.id}: ${c.name}`)
    );
  }
  return lines.join('\n');
};

// 抽出スキーマ（構造化出力用。読めない項目はnullを許す）
const VOUCHER_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    company: { type: ['string', 'null'] },
    companyId: { type: ['number', 'null'] },
    issueDate: { type: ['string', 'null'] },
    paymentDate: { type: ['string', 'null'] },
    amount: { type: ['number', 'null'] },
    tax: { type: ['number', 'null'] },
    taxRate: { type: ['number', 'null'] },
    invoiceNo: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] }
  },
  required: ['company', 'companyId', 'issueDate', 'paymentDate', 'amount', 'tax', 'taxRate', 'invoiceNo', 'description'],
  additionalProperties: false
});

// JSON部分の抽出（コードフェンスや前後の説明文の混入対策）
const extractJson = (text) => {
  if ( !text ) return null;
  const stripped = text.replace(/```(json)?/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (( start < 0 ) || ( end < start )) {
    return null;
  }
  try {
    return JSON.parse(stripped.substring(start, end + 1));
  } catch (e) {
    return null;
  }
};

// PDFはそのままでは渡せないため、最初のページをPNGに変換する（Playwright）。
const pdfToPng = async (buffer) => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 });
    await page.setContent('<html><body style="margin:0;"></body></html>');
    const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
    await page.evaluate(async (url) => {
      const img = document.createElement('img');
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      document.body.appendChild(img);
    }, dataUrl);
    await page.waitForTimeout(500);
    const png = await page.screenshot({ fullPage: true });
    return png;
  } finally {
    await browser.close();
  }
};

const aiApiError = (e) => {
  const status = e && ( e.statusCode || e.status );
  const err = new Error(`AI API error${status ? `: ${status}` : ''}`);
  err.name = 'AiApiError';
  err.cause = e;
  return err;
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
const makeModel = (setting) => {
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

// 証憑ファイル（Buffer + mimeType）から帳票情報を抽出する。
// options.companies（[{id, name}]）を渡すと、候補からcompanyIdまで一発で選ぶ。
export const extract = async (buffer, mimeType, options = {}) => {
  const setting = settings();
  if ( !isAvailable() ) {
    const err = new Error('AIの設定がありません（config/llms.yaml）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  let data = buffer;
  let type = mimeType || '';
  if ( type === 'application/pdf' ) {
    data = await pdfToPng(buffer);
    type = 'image/png';
  }
  // 大きい画像は縮小して送る（送信量・トークンの削減。領収書の可読性は保たれる）。
  // 失敗時は元のまま送る
  try {
    const img = await Jimp.read(data);
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const m = Math.max(w, h);
    const OCR_MAX_DIM = 1600;
    if ( m > OCR_MAX_DIM ) {
      const s = OCR_MAX_DIM / m;
      img.resize({ w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) });
      type = ( /^image\/jpe?g$/i.test(type) ) ? 'image/jpeg' : 'image/png';
      data = await img.getBuffer(type);
    }
  } catch (e) {
  }
  const model = makeModel(setting);
  const prompt = await buildPrompt(options.companies);
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image', image: `data:${type};base64,${data.toString('base64')}` }
    ]
  }];
  // 第一経路: 構造化出力。失敗したらテキスト+サルベージに落とす。
  // リトライは1回まで（プロバイダ切替はしない。失敗時は再認識ボタンで再実行）
  try {
    const result = await generateObject({ model: model, schema: VOUCHER_SCHEMA, messages: messages, maxRetries: 1 });
    return result.object;
  } catch (e) {
    // API呼び出し自体の失敗は即時送出（リトライ・切替はしない）
    if ( e && (( e.name === 'AI_APICallError' ) || e.statusCode || e.status )) {
      throw aiApiError(e);
    }
    try {
      const result = await generateText({ model: model, messages: messages, maxRetries: 1 });
      return extractJson(result.text);
    } catch (e2) {
      throw aiApiError(e2);
    }
  }
};

export default {
  isAvailable: isAvailable,
  extract: extract
};
