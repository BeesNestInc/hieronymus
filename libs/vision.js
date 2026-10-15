import fs from 'fs';
import { generateObject, generateText, jsonSchema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// AI（LLM）による証憑OCR。Vercel AI SDKを使う。
// vision用途に固定した単一モデルを使う（自動切替はしない）。
// 設定は config/llms.json（Sequelize用の config.json とは別ファイル）:
//   {
//     "provider": "gemini",          // gemini / openai-compatible
//     "model": "gemini-2.0-flash",
//     "apiKey": "...",
//     "baseURL": "https://api.openai.com/v1"   // openai-compatible のみ。ローカルは http://localhost:1234/v1 等
//   }
// 環境変数 LLM_PROVIDER / LLM_MODEL / LLM_API_KEY / LLM_BASE_URL でも指定できる（ファイルより優先）。
// APIキーが未設定の場合 isAvailable() が false となり、AI機能は無効化される
// （AIを利用しない運用の環境でも成立させるため、AI前提の処理にはしない）。
// ただし openai-compatible で baseURL があればキーなしでも利用可（ローカルLLM想定）。

const loadConfig = () => {
  try {
    return JSON.parse(fs.readFileSync('config/llms.json', 'utf-8'));
  } catch (e) {
    return {};
  }
};

const settings = () => {
  const llms = loadConfig();
  return {
    provider: process.env.LLM_PROVIDER || llms.provider || 'gemini',
    model: process.env.LLM_MODEL || llms.model || 'gemini-2.0-flash',
    apiKey: process.env.LLM_API_KEY || llms.apiKey || '',
    baseURL: process.env.LLM_BASE_URL || llms.baseURL || ''
  };
};

export const isAvailable = () => {
  const setting = settings();
  if ( setting.provider === 'openai-compatible' ) {
    // ローカルLLM等、キーなし運用を許す。接続先がなければ無効
    return Boolean(setting.baseURL);
  }
  return Boolean(setting.apiKey);
};

// AIに渡すプロンプト。抽出結果はJSON（不明項目はnull）。
const PROMPT = [
  'この帳票から 会社名/発行日/支払日/金額/消費税/税率/請求番号/取引内容 を読み取り、',
  '以下のJSON形式で出力してください:',
  '{"company":"...","issueDate":"...","paymentDate":"...","amount":...,"tax":...,"taxRate":...,"invoiceNo":"...","description":"..."}',
  '不明な項目は null。金額は数値。日付は YYYY-MM-DD 形式。JSON以外の出力はしないこと。'
].join('\n');

// 抽出スキーマ（構造化出力用。読めない項目はnullを許す）
const VOUCHER_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    company: { type: ['string', 'null'] },
    issueDate: { type: ['string', 'null'] },
    paymentDate: { type: ['string', 'null'] },
    amount: { type: ['number', 'null'] },
    tax: { type: ['number', 'null'] },
    taxRate: { type: ['number', 'null'] },
    invoiceNo: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] }
  }
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

// 設定からAI SDKのモデルを作る。固定の単一モデル（切替なし）
const makeModel = (setting) => {
  switch ( setting.provider ) {
    case 'gemini':
      // isAvailable() がキーを保証する。キーはプロバイダ生成時に渡す
      return createGoogleGenerativeAI({ apiKey: setting.apiKey })(setting.model);
    case 'openai-compatible': {
      if ( !setting.baseURL ) {
        const err = new Error('openai-compatible の接続先がありません（config/llms.json の baseURL）。');
        err.name = 'AiNotConfigured';
        throw err;
      }
      const provider = createOpenAICompatible({
        baseURL: setting.baseURL,
        ...(setting.apiKey ? { apiKey: setting.apiKey } : {}),
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
export const extract = async (buffer, mimeType) => {
  const setting = settings();
  if ( !isAvailable() ) {
    const err = new Error('AIの設定がありません（config/llms.json）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  let data = buffer;
  let type = mimeType || '';
  if ( type === 'application/pdf' ) {
    data = await pdfToPng(buffer);
    type = 'image/png';
  }
  const model = makeModel(setting);
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: PROMPT },
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
