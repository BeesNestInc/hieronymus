import fs from 'fs';
import os from 'os';
import path from 'path';
import { Jimp } from 'jimp';
import { generateObject, generateText, jsonSchema } from 'ai';
import { settings, isAvailable, makeModel } from '../ai/host/model-provider.js';
import { initializeAiHost } from '../ai/host/index.js';

// AI（LLM）による証憑OCR。実行は Legion manifest-engine（ai/manifest-engine/
// submodule）を ai/host（hooks結線）経由で使う。
// extract() は既に manifest 経由に置き換え済み。extractStatement() /
// suggestRuleAccounts() / draftStatementProfile() は段階的に移行する
// （Phase 2。現状 ai-sdk を直接呼ぶ旧実装のまま）。
// モデルの生成と設定読み込みは ai/host/model-provider.js に寄せている
// （設定は config/llms.yaml）。環境変数 LLM_PROVIDER / LLM_MODEL /
// LLM_API_KEY / LLM_BASE_URL でも指定できる（ファイルより優先）。
// APIキーが未設定の場合 isAvailable() が false となり、AI機能は無効化される
// （AIを利用しない運用の環境でも成立させるため、AI前提の処理にはしない）。
// ただし openai-compatible で baseURL があればキーなしでも利用可（ローカルLLM想定）。

export { isAvailable };

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

const aiApiError = (e) => {
  const status = e && ( e.statusCode || e.status );
  const err = new Error(`AI API error${status ? `: ${status}` : ''}`);
  err.name = 'AiApiError';
  err.cause = e;
  return err;
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

// 通帳・明細画像の読み取りプロンプト。全行を漏らさず入出金として読む。
// 日付は通帳に年が無いことがあるため、文脈（印字年・残高推移）から補完させる。
const STATEMENT_PROMPT = [
  'この通帳・明細画像から入出金の明細行をすべて読み取り、',
  '以下のJSON形式（配列）で出力してください:',
  '[{"date":"YYYY-MM-DD","description":"摘要","amountOut":数値,"amountIn":数値,"balance":数値,"category":"...","memo":"..."}]',
  'dateは西暦YYYY-MM-DD。「令和N」「R N」などの和暦は 西暦YYYY-MM-DD に換算して出す（令和N年=2018+N）。',
  '通帳に年が書かれていない場合は文脈から推測し、不明なら null。',
  'amountOutはお支払（出金）、amountInはお預り（入金）。該当しない側は null。',
  '通帳の種類によっては、お支払/お預りの金額欄に、金額のあとに振込先・振込元の名前が続けて印字されることがある。名前は必ず数値でない文字列として扱い、descriptionの末尾に空白区切りで付け加える（金額欄に数値と名前が並ぶ行では、金額は数値、名前はdescriptionへ）',
  'amountOut/amountInは必ず数値。名前は金額に含めない。金額欄に数値がない場合、その側は null。',
  'balanceは差引残高（なければ null）。descriptionは摘要欄の表記をそのまま。名前を付け加えた場合は「摘要 名前」の順に空白区切りで。',
  'categoryは normal / interest(利息) / fee(手数料) / transfer(振込・振替) / tax(税・国税) のいずれか。',
  'memoにメモ欄や追記があればそのまま入れる。不明項目は null。JSON以外の出力はしないこと。',
  '計算書（ECモールの支払明細など）では、最後の行に振込額（「純利益の振込み」「振込合計」等）が載ることが多い。**その行も1行として必ず出力する**（売り上げた行の内訳と混ぜず、独立した行にする。amountInに振込額を入れる）。合計行や税表記を見落とさず、明細の最終行まで読み切ること。'
].join('\n');

// 明細読み取りのスキーマ（配列。読めない項目はnullを許す）
const STATEMENT_SCHEMA = jsonSchema({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      date: { type: ['string', 'null'] },
      description: { type: ['string', 'null'] },
      amountOut: { type: ['number', 'null'] },
      amountIn: { type: ['number', 'null'] },
      balance: { type: ['number', 'null'] },
      category: { type: ['string', 'null'] },
      memo: { type: ['string', 'null'] }
    },
    required: ['date', 'description', 'amountOut', 'amountIn', 'balance', 'category', 'memo'],
    additionalProperties: false
  }
});

// 画像・PDFの通帳から入出金明細を配列で抽出する（bank-statement.js から使う）。
// 証憑OCR（extract）と同じく、構造化出力→テキスト+サルベージの2段構え。

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
  const setting = settings();
  if ( !isAvailable() ) {
    const err = new Error('AIの設定がありません（config/llms.yaml）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  const prepared = await prepareImage(buffer, mimeType);
  const model = makeModel(setting);
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: STATEMENT_PROMPT },
      { type: 'image', image: `data:${prepared.type};base64,${prepared.data.toString('base64')}` }
    ]
  }];
  const normalize = (object) => {
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
  try {
    const result = await generateObject({ model: model, schema: STATEMENT_SCHEMA, messages: messages, maxRetries: 1 });
    return { lines: normalize(result.object), warnings: [] };
  } catch (e) {
    if ( e && (( e.name === 'AI_APICallError' ) || e.statusCode || e.status ) ) {
      throw aiApiError(e);
    }
    try {
      const result = await generateText({ model: model, messages: messages, maxRetries: 1 });
      return { lines: normalize(extractJson(result.text)), warnings: [] };
    } catch (e2) {
      throw aiApiError(e2);
    }
  }
};

// ルール候補に付けるAI提案。正規化済みの摘要（未ルールの行をグルーピングした
// もの）を売上原価系（勘定科目コードが7番台）の科目に分類させる。
// 提案は候補として人の確認（登録）を経るので多少大胆さは許されるが、
// 姿勢としては「よくわからないものは提案しない」を入れておく（精度>楽）。
// カタログは提案の選択肢そのものを絞る（経費の分類を7番台に任せる）。
const RULE_SUGGEST_PROMPT = [
  'これは通帳・カード明細から取り込んだ摘要（正規化済み）の一覧です。',
  '各摘要を、最もふさわしい経費科目（売上原価系。勘定科目コードが7で始まるもの）に分類してください。',
  '以下のルールに従ってください:',
  '- 科目は提示したカタログの中から選ぶこと（存在しない科目コードを作らないこと）。',
  '- カタログに補助科目がある場合は、内容に最も合う補助科目を選ぶこと（合うものがなければ null）。',
  '- 仕分け例があればそれを踏襲すること（似た摘要は同じ科目）。',
  '- わからない・自信がない・当てはまる科目がカタログに無い場合は提案しないこと（その摘要を proposals に入れない）。',
  '- reasonには、その科目にした理由を日本語で一行（12〜30字程度）書くこと。',
  'JSON以外の出力はしないこと。'
].join('\n');

// 提案のスキーマ（構造化出力用）
const RULE_SUGGEST_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          account: { type: 'string' },
          subAccount: { type: ['number', 'null'] },
          reason: { type: 'string' }
        },
        required: ['pattern', 'account', 'subAccount', 'reason'],
        additionalProperties: false
      }
    }
  },
  required: ['proposals'],
  additionalProperties: false
});

// 候補（[{pattern, direction, count}]）に対して相手方（借方）の提案を返す。
// options.catalog は7番台の [{accountCode, name, subAccounts:[{subAccountCode, name}]}]、
// options.examples は同じ口座の既存ルール [{pattern, account, sub}]（分類の慣行を
// 踏襲させるfew-shot）。options.financialName は口座名（通帳・カードの種別の文脈）。
// 戻り値は [{pattern, account, subAccount, reason}]。
// 応答はカタログの検証に通す（幻覚で存在しない科目コードを出しても落とす）。
export const suggestRuleAccounts = async (candidates, options = {}) => {
  const setting = settings();
  if ( !isAvailable() ) {
    const err = new Error('AIの設定がありません（config/llms.yaml）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  const model = makeModel(setting);
  const catalog = ( options.catalog || [] ).filter((a) => ( a && a.accountCode ));
  const examples = ( options.examples || [] ).filter((r) => ( r && r.pattern && r.account ));
  const lines = [
    RULE_SUGGEST_PROMPT,
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
  const messages = [{ role: 'user', content: [{ type: 'text', text: lines.join('\n') }] }];
  const normalize = (object) => {
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
  try {
    const result = await generateObject({ model: model, schema: RULE_SUGGEST_SCHEMA, messages: messages, maxRetries: 1 });
    return normalize(result.object);
  } catch (e) {
    if ( e && (( e.name === 'AI_APICallError' ) || e.statusCode || e.status ) ) {
      throw aiApiError(e);
    }
    try {
      const result = await generateText({ model: model, messages: messages, maxRetries: 1 });
      return normalize(extractJson(result.text));
    } catch (e2) {
      throw aiApiError(e2);
    }
  }
};

// 明細の書式からプロファイルyamlを起草させる（AI読取の次の一手）。
// 「書式が増えるたびパーサーを追従させる」をやめる仕組み:
// AIが読めたら、同じ書式を次回以降は決定的に解析できるyamlを書かせる。
// 出来上がったプロファイルの検証は呼び出し側が行う（同じファイルを
// プロファイルで再解析し、AIの読みと一致すること。壊れたyamlは保存しない）
const PROFILE_DRAFT_PROMPT = [
  'これは明細カード（通帳・カード明細・計算書）の取り込みデータと、AIによる読取り結果です。',
  '次回以降の同じ書式の取り込みを「決定的に」解析するためのyamlプロファイルを起草してください。',
  'yamlの様式:',
  '  name: プロファイル名（銀行名やカード名。40字まで）',
  '  type: bank   # CSV/Excelの銀行明細。または card: カード明細PDF。または settlement: ECモール等の計算書',
  '  # type: bank の場合:',
  '  detect:      # ヘッダ行に全部含まれていたらこの形式とみなす語の配列',
  '    - 日付',
  '  columns:     # 列名→項目。項目は date/description/amountOut/amountIn/balance/amount/merchant/memo',
  '    date: お取引日',
  '  # type: card の場合:',
  '  cardName: ミツイスミトモカード   # 銀行側の引落摘要に含まれる名称',
  '  cardPatterns:',
  '    # 総額と支払日を取る正規表現（グループで取り出す部分だけ）',
  '    total: \'支払い合計額([\\d,]+)円\'',
  '    payDate: \'支払い日(\\d{4})年(\\d{1,2})月(\\d{1,2})日\'',
  '  # type: settlement の場合（ECモールの支払明細書など「振込1本の内訳書」）:',
  '  detect:                  # テキストに全部含まれたらこの形式とみなす語',
  '    - 支払明細書',
  '  aggregateSale: \'^売上\\s*￥\'      # 売上の集計行（この行の後ろに内訳が続く）',
  '  aggregateExpense: \'^支出\\s*￥\'   # 支出の集計行（この行の後ろに内訳が続く）',
  '  transferPattern: \'振込|純利益\'   # 振込行（入金の合計）を引くラベル',
  '  transferDatePattern: \'(\\d{4})/(\\d{1,2})/(\\d{1,2})に、.*?口座へ\'   # 振込日が書かれた文',
  '  memoPattern: \'^銀行振込ID\'      # 振込ID等のメモ行',
  'ルール:',
  '- 与えた読取り結果の各列の意味からcolumns/cardPatterns/計算書の節見出しを推定すること。',
  '- 正規表現は過度に一般化しない（この書式に合う最小限）。',
  '- total/payDateの正規表現は、数値の直前にある語（ラベル）を含めること（[([\\d,]+)]だけだと他の数値に当たる）。',
  '- settlementでは、計算書の売上・支出・振込の**見出し語そのもの**（読取り結果のラベルに現れた語）をdetect/aggregate*/transferPatternに使うこと。',
  '- settlementに saleAccount/receivedAccount（約束科目）を書いてはいけない（科目は各環境の勘定次第なので、利用者が後で足す）。',
  '- 決めない部分は省略すること（yamlのdefaultsを模倣しない）。',
  '- yamlそのものだけを出力すること（説明やコードフェンスを付けない）。'
].join('\n');

const PROFILE_DRAFT_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    profile: { type: 'string' }
  },
  required: [ 'profile' ],
  additionalProperties: false
});

// プロファイルyamlの起草。options.aiLines（AI読取の結果）と options.kindHint
// （'bank'/'card'）を渡す。evidenceは取り込みファイルから採ったテキスト。
export const draftStatementProfile = async (evidence, options = {}) => {
  const setting = settings();
  if ( !isAvailable() ) {
    const err = new Error('AIの設定がありません（config/llms.yaml）。');
    err.name = 'AiNotConfigured';
    throw err;
  }
  const model = makeModel(setting);
  const lines = [
    PROFILE_DRAFT_PROMPT,
    `書式の種類のヒント: ${options.kindHint || '不明'}`,
    `取り込みデータの材料（先頭から）:`,
    String(evidence || '').slice(0, 12000),
    'AI読取の結果（列の意味の根拠。これと同じことが決定的に取れるようにする）:',
    JSON.stringify(( options.aiLines || [] ).slice(0, 40))
  ];
  const messages = [{ role: 'user', content: [{ type: 'text', text: lines.join('\n') }] }];
  let object = null;
  try {
    const result = await generateObject({ model: model, schema: PROFILE_DRAFT_SCHEMA, messages: messages, maxRetries: 1 });
    object = result.object;
  } catch (e) {
    if ( e && (( e.name === 'AI_APICallError' ) || e.statusCode || e.status ) ) {
      throw aiApiError(e);
    }
    const result = await generateText({ model: model, messages: messages, maxRetries: 1 });
    const extracted = extractJson(result.text);
    object = ( extracted && ( extracted.profile !== undefined ) ) ? extracted : { profile: result.text };
  }
  return { yaml: String(( object && object.profile ) || '') };
};

export default {
  isAvailable: isAvailable,
  extract: extract,
  extractStatement: extractStatement,
  suggestRuleAccounts: suggestRuleAccounts,
  draftStatementProfile: draftStatementProfile,
  fixEraDate: fixEraDate
};
