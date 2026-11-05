import fs from 'fs';
import os from 'os';
import path from 'path';
import { Jimp } from 'jimp';
import { isAvailable } from '../ai/host/model-provider.js';
import { initializeAiHost } from '../ai/host/index.js';

// AI（LLM）による帳票・明細の読み取り。実行は Legion manifest-engine
// （ai/manifest-engine/submodule）を ai/host（hooks結線）経由で使う。
// 各機能の Manifest 定義は ai/manifests/、プロンプト文面は
// ai/prompt-templates/ にある（コードは実行の組立と検証だけを担当）。
// モデルの生成と設定読み込みは ai/host/model-provider.js（config/llms.yaml
// の llms 群）。環境変数 LLM_PROVIDER / LLM_MODEL / LLM_API_KEY /
// LLM_BASE_URL で解決済み候補を上書きできる（テスト・一時切替用）。
// APIキーが未設定の場合 isAvailable() が false となり、AI機能は無効化される
// （AIを利用しない運用の環境でも成立させるため、AI前提の処理にはしない）。
// ただし openai-compatible で baseURL があればキーなしでも利用可（ローカルLLM想定）。

export { isAvailable };

// ---- manifest 実行の共通部 ----

// PDFはそのままでは渡せないため、最初のページをPNGに変換する（略）は
// engine の添付経路で行わない: host 側で pdfToPng → 一時ファイルを
// params.chatImages に載せる（マン妹: chatImages はファイルパス配列）。
const TMP_EXT_BY_TYPE = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg'
};

const writeTempImage = async ({ data, type }) => {
  const ext = TMP_EXT_BY_TYPE[type] || 'jpg';
  const tmpPath = path.join(os.tmpdir(), `vision-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  await fs.promises.writeFile(tmpPath, data);
  return tmpPath;
};

const aiApiError = (e) => {
  const status = e && ( e.statusCode || e.status );
  const err = new Error(`AI API error${status ? `: ${status}` : ''}`);
  err.name = 'AiApiError';
  err.cause = e;
  return err;
};

// Manifest を1回実行してLLMの応答文字列を返す。旧実装の契約（AiNotConfigured
// / AiApiError）はここで整形する。画像は一時ファイルにして chatImages で渡し
// 実行後に掃除する。
const runManifest = async (manifest, { inputs = [], imageBuffers = [] }) => {
  if ( !isAvailable() ) {
    const err = new Error('AIの設定がありません（config/llms.yaml）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  const tmpPaths = [];
  try {
    await initializeAiHost();
    for ( const image of imageBuffers ) {
      tmpPaths.push(await writeTempImage(image));
    }
    const { result } = await manifest.execute({
      roles: { [manifest.name]: { name: manifest.name, manifests: { [manifest.name]: manifest } } },
      role: manifest.name,
      requests: [{ name: 'request', input: inputs.join('\n') }],
      params: tmpPaths.length > 0 ? { chatImages: { value: tmpPaths } } : {}
    });
    return result;
  } catch (e) {
    if ( e && ( e.name === 'AiApiError' ) ) {
      throw e;
    }
    if ( e && ( e.statusCode || e.status || e.name === 'AI_APICallError' || e.name === 'AI_RetryError' ) ) {
      throw aiApiError(e);
    }
    throw e;
  } finally {
    for ( const tmpPath of tmpPaths ) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (e) {
      }
    }
  }
};
export { runManifest };

// JSON部分の抽出。コードフェンスや前後文（旧実装互換）に加え、
// 配列JSONにも対応する（明細行のsalvage用）。
const extractJson = (text) => {
  if ( !text ) return null;
  const stripped = text.replace(/```(json)?/g, '');
  try {
    return JSON.parse(stripped);
  } catch (e) {
  }
  const spans = [
    [ stripped.indexOf('{'), stripped.lastIndexOf('}') ],
    [ stripped.indexOf('['), stripped.lastIndexOf(']') ]
  ];
  for ( const [ start, end ] of spans ) {
    if (( start < 0 ) || ( end < start )) continue;
    try {
      return JSON.parse(stripped.substring(start, end + 1));
    } catch (e) {
    }
  }
  return null;
};

// ---- 帳票OCR（証憑抽出） ----

// PDFはそのままでは渡せないため、最初のページをPNGに変換する。
// pdf.jsをPlaywrightのページに組み込んでCanvasに描画する。
// data:application/pdfを<img>に載せる手法はブラウザがPDFを解釈できず
// onerrorになるので使えない。ライブラリはnode_modulesの実物を使う（CDNに出さない）。
const pdfToPng = async (buffer) => {
  const path = ( await import('path') );
  const url = ( await import('url') );
  const http = ( await import('http') );
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const libSrc = fs.readFileSync(path.join(here, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.min.mjs'), 'utf-8');
  const workerSrc = fs.readFileSync(path.join(here, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'), 'utf-8');
  // 日本語PDFはCIDフォント/cMapと標準フォントを必要とする。pdfjs-dist同梱の
  // cmaps/standard_fontsを一時HTTPサーバで出してブラウザに読ませる
  // （ローカル限定・使用後即閉じ。どこへも公開しない）
  const root = path.join(here, '..', 'node_modules', 'pdfjs-dist');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(String(req.url || '')).replace(/\/+$/, '');
    const filePath = path.join(root, rel.replace(/\.\./g, ''));
    if ( !filePath.startsWith(root) ) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if ( err ) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'content-type': /(\.mjs|\.js)$/.test(rel) ? 'text/javascript' : 'application/octet-stream',
        'access-control-allow-origin': '*'
      });
      res.end(data);
    });
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const dataUrl = await page.evaluate(async (args) => {
      const libUrl = URL.createObjectURL(new Blob([ args.lib ], { type: 'text/javascript' }));
      const pdfjs = await import(libUrl);
      pdfjs.GlobalWorkerOptions.workerSrc = args.workerUrl;
      const bin = atob(args.pdf);
      const bytes = new Uint8Array(bin.length);
      for ( let i = 0; i < bin.length; i ++ ) {
        bytes[ i ] = bin.charCodeAt(i);
      }
      // cMap/標準フォントはHTTPサーバから。日本語フォントがこれで描画される
      const doc = await pdfjs.getDocument({
        data: bytes,
        cMapUrl: args.baseUrl + '/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: args.baseUrl + '/standard_fonts/',
        useSystemFonts: true
      }).promise;
      const pdfPage = await doc.getPage(1);
      const viewport = pdfPage.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round( viewport.width );
      canvas.height = Math.round( viewport.height );
      const context = canvas.getContext('2d');
      await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
      return canvas.toDataURL('image/png');
    }, {
      lib: libSrc,
      workerUrl: `http://127.0.0.1:${port}/legacy/build/pdf.worker.min.mjs`,
      baseUrl: `http://127.0.0.1:${port}`,
      pdf: buffer.toString('base64')
    });
    return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  } finally {
    await browser.close();
    server.close();
  }
};

// 証憑・明細をLLMに渡せる画像へ正規化する（PDF→PNG変換と大型画像の縮小）。
// 失敗時は元のまま送る
const prepareImage = async (buffer, mimeType) => {
  let data = buffer;
  let type = mimeType || '';
  if ( type === 'application/pdf' ) {
    data = await pdfToPng(buffer);
    type = 'image/png';
  }
  // 大きい画像は縮小して送る（送信量・トークンの削減。領収書の可読性は保たれる）。
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
  return { data: data, type: type };
};

// 証憑ファイル（Buffer + mimeType）から帳票情報を抽出する。
// options.companies（[{id, name}]）と options.payeeMappings
// （[{id, name, companyName, description}]）を渡すと、候補から
// companyId・payeeMappingId まで一発で選ぶ。
// 実行は Legion manifest-engine の ocr-voucher manifest（ai/manifests/）。
// 読み取り指示・判定ルールの文面は ai/prompt-templates/ocr-voucher.md（.mdだけ
// で調整できる）、候補などの動的データはリクエスト本文に載せる。帳票画像は
// prepareImage で正規化して一時ファイルに書き、params.chatImages（ファイルパス）
// で渡す。戻り値は帳票情報のJSON（旧実装と同じ項目）。
export const extract = async (buffer, mimeType, options = {}) => {
  if ( !isAvailable() ) {
    const err = new Error('AIの設定がありません（config/llms.yaml）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  const prepared = await prepareImage(buffer, mimeType);
  const ext = prepared.type === 'image/png' ? 'png' :
    prepared.type === 'image/webp' ? 'webp' :
    prepared.type === 'image/gif' ? 'gif' : 'jpg';
  const tmpPath = path.join(os.tmpdir(), `ocr-voucher-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  await fs.promises.writeFile(tmpPath, prepared.data);
  try {
    await initializeAiHost();
    // 自社名（支払う側）は会社名の誤認防止のため文脈に載せる（読取失敗時は付けない）
    let selfName = '';
    try {
      const { default: myCompany } = await import('./my-company.js');
      const self = await myCompany();
      if ( self && self.name ) {
        selfName = self.name;
      }
    } catch (e) {
    }
    const sections = [];
    if ( selfName ) {
      sections.push(`[自社]\n${selfName}`);
    }
    const companies = ( options.companies || [] ).filter((c) => ( c && c.name ));
    if ( companies.length > 0 ) {
      sections.push(`[取引先候補]\n${companies.map((c) => `${c.id}: ${c.name}`).join('\n')}`);
    }
    const mappings = ( options.payeeMappings || [] ).filter((m) => ( m && m.name ));
    if ( mappings.length > 0 ) {
      sections.push(`[支払先マッピング候補]\n${mappings.map((m) =>
        `${m.id}: ${m.name}${m.companyName ? `（${m.companyName}）` : ''}${m.description ? ` — ${m.description}` : ''}`
      ).join('\n')}`);
    }
    // メモリー（振り返りで蓄えた定番パターン）があれば文脈に載せる
    // （options.memoryUserId を渡した場合のみ）
    if ( options.memoryUserId ) {
      const { memoryText } = await import('../ai/host/memory.js');
      const notes = await memoryText(options.memoryUserId);
      if ( notes ) {
        sections.push(notes);
      }
    }
    const input = [
      '帳票画像を1枚添付します。この帳票から会計仕訳情報を読み取ってください。',
      ...sections
    ].join('\n');
    const { createOcrVoucher } = await import('../ai/manifests/ocr-voucher.js');
    const manifest = createOcrVoucher();
    const { result } = await manifest.execute({
      roles: { 'ocr-voucher': { name: 'ocr-voucher', manifests: { 'ocr-voucher': manifest } } },
      role: 'ocr-voucher',
      requests: [{ name: 'request', input: input }],
      params: { chatImages: { value: [tmpPath] } }
    });
    return JSON.parse(result);
  } catch (e) {
    // 旧実装と同じ整形: API呼び出し自体の失敗は AiApiError として送出する。
    // manifest-engine 内でのフォールバック・リトライは engine 側の設計に任せる
    if ( e && ( e.name === 'AiApiError' ) ) {
      throw e;
    }
    if ( e && ( e.statusCode || e.status || e.name === 'AI_APICallError' || e.name === 'AI_RetryError' ) ) {
      throw aiApiError(e);
    }
    throw e;
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (e) {
    }
  }
};

// 明細行の正規化（接近: AIは和暦を西暦のままの小さい数にすることがある）
const normalizeStatementLines = (object) => {
  return ( object || [] ).map((line) => ({
    date: fixEraDate(line.date),
    rawDescription: line.description || '',
    merchant: line.description || '',
    amountOut: ( line.amountOut === null || line.amountOut === undefined ) ? null : Number(line.amountOut),
    amountIn: ( line.amountIn === null || line.amountIn === undefined ) ? null : Number(line.amountIn),
    balance: ( line.balance === null || line.balance === undefined ) ? null : Number(line.balance),
    memo: line.memo || null
  }));
};

// 画像・PDFの通帳から入出金明細を配列で抽出する（bank-statement.js から使う）。
// 実行は ocr-statement manifest（ai/manifests/）。文面は
// ai/prompt-templates/ocr-statement.md。添付画像（PDF経由の正規化含む）は
// chatImages で渡す。応答の配列JSONはサルベージで解析する（旧実装と同じ検便秘）。

// 日付の補正。AIは通帳の和暦（令和）を西暦のままの小さい数にすることがある
// （令和7年 → 7-05-10 など。令和元年=2019なので令和N年=2018+N）。20未満の年は
// +2018 して西暦に直す（平成は現行の通帳に紐付かず、かつ西暦20〜39=2020〜2039が
// 実日付とぶつかるので触らない）
export const fixEraDate = (text) => {
  if ( typeof text !== 'string' ) {
    return null;
  }
  const match = text.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})/);
  if ( !match ) {
    return null;
  }
  let year = parseInt(match[1]);
  const month = match[2];
  const day = match[3];
  // 20未満は「令和N」に化けたものとして2018を足す（令和元年=2019）。
  // 西暦下2桁(20〜39=2020〜2039)が直近の現実の日付と一致するので
  // 平成(1988+N)この範囲に勝手に適用しない
  if ( year < 20 ) {
    year += 2018;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
export const extractStatement = async (buffer, mimeType) => {
  const prepared = await prepareImage(buffer, mimeType);
  const { createOcrStatement } = await import('../ai/manifests/ocr-statement.js');
  const result = await runManifest(createOcrStatement(), {
    inputs: [
      '通帳・明細の画像を1枚添付します。この画像から入出金の明細行をすべて読み取ってください。',
    ],
    imageBuffers: [ prepared ]
  });
  return { lines: normalizeStatementLines(extractJson(result)), warnings: [] };
};

// 候補（[{pattern, direction, count}]）に対して相手方（借方）の提案を返す。
// options.catalog は7番台の [{accountCode, name, subAccounts:[{subAccountCode, name}]}]、
// options.examples は同じ口座の既存ルール [{pattern, account, sub}]（分類の慣行を
// 踏襲させるfew-shot）。options.financialName は口座名（通帳・カードの種別の文脈）。
// 戻り値は [{pattern, account, subAccount, reason}]。
// 実行は rule-accounts manifest（ai/manifests/）。文面は
// ai/prompt-templates/rule-accounts.md。カタログ等の動的データはリクエスト本文に
// 載せる。応答はカタログの検証に通す（幻覚で存在しない科目コードを出しても落とす）。
export const suggestRuleAccounts = async (candidates, options = {}) => {
  const catalog = ( options.catalog || [] ).filter((a) => ( a && a.accountCode ));
  const examples = ( options.examples || [] ).filter((r) => ( r && r.pattern && r.account ));
  const inputs = [
    `口座: ${options.financialName || '不明'}`,
    '科目カタログ（提案はここから選ぶ）:',
    ...catalog.map((a) => {
      const subs = ( a.subAccounts || [] ).map((s) => ( s ? `${s.subAccountCode} ${s.name}` : '' )).filter(Boolean);
      return `  ${a.accountCode} ${a.name}${subs.length > 0 ? `（補助: ${subs.join('、')}）` : ''}`;
    }),
    ...( examples.length > 0 ? [
      'この口座の既存の仕分け例（踏襲すること）:',
      ...examples.map((r) => `  ${r.pattern} → ${r.account}${r.sub ? `（補助${r.sub}）` : ''}`)
    ] : [] ),
    '摘要一覧（pattern, direction, count）:',
    JSON.stringify(candidates.map((c) => ({ pattern: c.pattern, direction: c.direction, count: c.count })))
  ];
  const { createRuleAccounts } = await import('../ai/manifests/rule-accounts.js');
  const result = await runManifest(createRuleAccounts(), { inputs: inputs });
  let object = null;
  try {
    object = JSON.parse(result);
  } catch (e) {
    object = extractJson(result);
  }
  const codes = new Set(catalog.map((a) => String(a.accountCode)));
  const subCodes = new Map(catalog.map((a) => [
    String(a.accountCode),
    new Set(( a.subAccounts || [] ).map((s) => Number(s.subAccountCode)))
  ]));
  return ( ( object && object.proposals ) || [] )
    .filter((p) => ( p && p.pattern && codes.has(String(p.account)) ))
    .filter((p) => (
      p.subAccount === null || p.subAccount === undefined ||
      ( subCodes.get(String(p.account)) || new Set() ).has(Number(p.subAccount))
    ))
    .map((p) => ({
      pattern: String(p.pattern),
      account: String(p.account),
      subAccount: ( p.subAccount === null || p.subAccount === undefined ) ? null : Number(p.subAccount),
      reason: p.reason || ''
    }));
};

// 明細の書式からプロファイルyamlを起草させる（AI読取の次の一手）。
// 「書式が増えるたびパーサーを追従させる」をやめる仕組み:
// AIが読めたら、同じ書式を次回以降は決定的に解析できるyamlを書かせる。
// 実行は statement-profile manifest（ai/manifests/）。文面は
// ai/prompt-templates/statement-profile.md。kindHint・取り込みデータ・AI読取
// 結果はリクエスト本文に載せる。
// 出来上がったプロファイルの検証は呼び出し側が行う（同じファイルを
// プロファイルで再解析し、AIの読みと一致すること。壊れたyamlは保存しない）
export const draftStatementProfile = async (evidence, options = {}) => {
  const inputs = [
    `書式の種類のヒント: ${options.kindHint || '不明'}`,
    '取り込みデータの材料（先頭から）:',
    String(evidence || '').slice(0, 12000),
    'AI読取の結果（列の意味の根拠。これと同じことが決定的に取れるようにする）:',
    JSON.stringify(( options.aiLines || [] ).slice(0, 40))
  ];
  const { createStatementProfile } = await import('../ai/manifests/statement-profile.js');
  const result = await runManifest(createStatementProfile(), { inputs: inputs });
  let object = null;
  try {
    object = JSON.parse(result);
  } catch (e) {
    object = extractJson(result);
  }
  // サルベージ経路: プロファイルは生のyamlとして返ることがある
  // （engine のフォールバックは {reply: 生テキスト} に格納する）
  const profile = ( object && object.profile !== undefined ) ? object.profile :
    ( object && object.reply !== undefined ) ? object.reply : result;
  return { yaml: String(profile || '') };
};

export default {
  isAvailable: isAvailable,
  extract: extract,
  extractStatement: extractStatement,
  suggestRuleAccounts: suggestRuleAccounts,
  draftStatementProfile: draftStatementProfile,
  fixEraDate: fixEraDate
};
