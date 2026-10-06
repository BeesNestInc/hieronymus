import fs from 'fs';

// AI（LLM）による証憑OCR。
// config.llms（config/config.json）で設定する:
//   "llms": {
//     "provider": "gemini",
//     "model": "gemini-2.0-flash",
//     "apiKey": "..."
//   }
// apiKey は環境変数 LLM_API_KEY でも指定できる（config より優先）。
// APIキーが未設定の場合 isAvailable() が false となり、AI機能は無効化される
// （AIを利用しない運用の環境でも成立させるため、AI前提の処理にはしない）。

const loadConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  try {
    const jsonData = JSON.parse(fs.readFileSync('config/config.json', 'utf-8'));
    return jsonData[env] || {};
  } catch (e) {
    return {};
  }
};

const settings = () => {
  const config = loadConfig();
  const llms = config.llms || {};
  return {
    provider: process.env.LLM_PROVIDER || llms.provider || 'gemini',
    model: process.env.LLM_MODEL || llms.model || 'gemini-2.0-flash',
    apiKey: process.env.LLM_API_KEY || llms.apiKey || ''
  };
};

export const isAvailable = () => {
  return Boolean(settings().apiKey);
};

// AIに渡すプロンプト。抽出結果はJSON（不明項目はnull）。
const PROMPT = [
  'この帳票から 会社名/発行日/支払日/金額/消費税/税率/請求番号/取引内容 を読み取り、',
  '以下のJSON形式で出力してください:',
  '{"company":"...","issueDate":"...","paymentDate":"...","amount":...,"tax":...,"taxRate":...,"invoiceNo":"...","description":"..."}',
  '不明な項目は null。金額は数値。日付は YYYY-MM-DD 形式。JSON以外の出力はしないこと。'
].join('\n');

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

// Gemini API (generativelanguage) による画像/PDF読み取り
const geminiExtract = async (buffer, mimeType, setting) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${setting.model}:generateContent`;
  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType: mimeType, data: buffer.toString('base64') } }
      ]
    }]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': setting.apiKey
    },
    body: JSON.stringify(body)
  });
  if ( !res.ok ) {
    const err = new Error(`AI API error: ${res.status}`);
    err.name = 'AiApiError';
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  return extractJson(text);
};

// 証憑ファイル（Buffer + mimeType）から帳票情報を抽出する。
export const extract = async (buffer, mimeType) => {
  const setting = settings();
  if ( !setting.apiKey ) {
    const err = new Error('AIの設定がありません（config.llms）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  let data = buffer;
  let type = mimeType || '';
  if ( type === 'application/pdf' ) {
    data = await pdfToPng(buffer);
    type = 'image/png';
  }
  switch ( setting.provider ) {
    case 'gemini':
      return geminiExtract(data, type, setting);
    default:
      const err = new Error(`未対応のAIプロバイダ: ${setting.provider}`);
      err.name = 'AiApiError';
      throw err;
  }
};

export default {
  isAvailable: isAvailable,
  extract: extract
};
