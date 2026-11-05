// 銀行明細（Excel/CSV/通帳画像）とカード利用明細（Web明細PDF）のパーサ。
// 取込元の形式差は config/banks/*.yaml のプロファイルで吸収する:
//   type: bank|card        取込種別
//   detect:                ヘッダ署名（この語が全て含まれるファイルをこのプロファイルとみなす）
//   columns:               列名（正規化後）→ フィールド
//   categoryRules:         摘要パターン → category
//   cardPatterns:          カード明細PDF用の正規表現（合計額/支払日）
// 出力は全形式共通の { lines, periodFrom, periodTo, warnings, profile }。
// 銀行系の行: {date, rawDescription, description, amountIn, amountOut, balance, category, memo}
// カード系の行: {date, merchant, rawDescription, amount, foreignAmount, foreignCurrency, category}

import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import ExcelJS from 'exceljs';

// 銀行系の既定カテゴリ分類（プロファイルの categoryRules が優先される）
const DEFAULT_CATEGORY_RULES = [
  { pattern: '^利息|決算利息', category: 'interest' },
  { pattern: '手数料', category: 'fee' },
  { pattern: '^デビット', category: 'card_payment' },
  { pattern: '^口座振替|^振替|＊ＡＤ|\\*AD', category: 'transfer' },
  { pattern: '^国税|^税|^年金|^保険料', category: 'tax' }
];

// 「前の行（同じ日）の伝票に合流させる」摘要の設定（口座共通の「お約束」）。
// config/banks/merge-rules.yaml に1行1摘要で書く（明細取込画面の「合流摘要」
// で加除できる）。ファイルがなければ既定値を使う
export const mergeRulesPath = () => {
  const dir = process.env.BANK_CONFIG_PATH || 'config/banks';
  return path.join(dir, 'merge-rules.yaml');
};

export const loadMergeDescriptions = () => {
  try {
    const text = fs.readFileSync(mergeRulesPath(), 'utf-8');
    const data = yamlLoad(text);
    if ( Array.isArray(data) ) {
      return data.map((d) => ( ( d === null || d === undefined ) ? '' : String(d).trim() )).filter((d) => d);
    }
  } catch (e) {
    // ファイルがなければ既定値に落ちる
  }
  return [ '手数料', '振込手数料', 'ATM手数料' ];
};

export const saveMergeDescriptions = (descriptions) => {
  const list = ( descriptions || [] )
    .map((d) => ( ( d === null || d === undefined ) ? '' : String(d).trim() ))
    .filter((d) => d);
  fs.writeFileSync(mergeRulesPath(), yamlDump(list), 'utf-8');
  return list;
};

// 「既存仕訳と突合・後の処理が自動で結び付けてよい摘要」の設定（口座共通）。
// 配置は plainly merge-rules.yaml と同じく config/banks/match-rules.yaml。
// **ブラックリストではなくホワイトリスト**。ここに無い摘要は
// 自動では結び付かない（定額ビジネスなどで同一金額が乱造される世界で、
// 曖昧な自動結合を避けるため。リストに載るまで手動で突合する）
export const matchRulesPath = () => {
  const dir = process.env.BANK_CONFIG_PATH || 'config/banks';
  return path.join(dir, 'match-rules.yaml');
};

export const loadMatchDescriptions = () => {
  try {
    const text = fs.readFileSync(matchRulesPath(), 'utf-8');
    const data = yamlLoad(text);
    if ( Array.isArray(data) ) {
      return data.map((d) => ( ( d === null || d === undefined ) ? '' : String(d).trim() )).filter((d) => d);
    }
  } catch (e) {
    // ファイルがなければ空=何も自動突合しない（既定は安全側）
  }
  return [];
};

export const saveMatchDescriptions = (descriptions) => {
  const list = ( descriptions || [] )
    .map((d) => ( ( d === null || d === undefined ) ? '' : String(d).trim() ))
    .filter((d) => d);
  fs.writeFileSync(matchRulesPath(), yamlDump(list), 'utf-8');
  return list;
};

// プロファイル読み込み。テスト時は LLM_CONFIG_PATH 同様 BANK_CONFIG_PATH で指せる
export const loadProfiles = () => {
  const dir = process.env.BANK_CONFIG_PATH || 'config/banks';
  const profiles = [];
  try {
    for ( const name of fs.readdirSync(dir) ) {
      if ( !/\.ya?ml$/i.test(name) ) {
        continue;
      }
      try {
        const text = fs.readFileSync(path.join(dir, name), 'utf-8');
        const profile = yamlLoad(text);
        if ( profile && profile.name ) {
          profiles.push(profile);
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    // ディレクトリがなければプロファイルなしで動く（既定ルールのみ）
  }
  return profiles;
};

// 全角・空白を潰した正規化テキスト（ヘッダ署名や正規表現照合に使う）
export const normalizeText = (text) => {
  if ( !text ) return '';
  return String(text).normalize('NFKC').replace(/[\s\u3000]+/g, '');
};

// Excelシリアル値→日付（1899-12-30起算。exceljsはDate化してくるが数値のことがある）
const excelSerialToDate = (value) => {
  const n = Number(value);
  if ( !Number.isFinite(n) ) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400 * 1000));
};

// 日付はYYYY-MM-DD文字列で扱う（Date型はタイムゾーンで日付がずれるため）。
// exceljsのDate型・シリアル値・文字列（YYYY-MM-DD等）に対応
const parseDate = (value) => {
  if ( value instanceof Date ) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if ( typeof value === 'number' ) {
    return parseDate(excelSerialToDate(value));
  }
  const s = String(value || '').trim();
  if ( !s ) return null;
  const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if ( m ) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  // 銀行CSVにある「6-10-15」「R6.10.15」等はここでは扱わない（プロファイル拡張で対応）
  return null;
};

const toNumber = (value) => {
  if ( value === null || value === undefined || value === '' ) return null;
  const s = String(value).normalize('NFKC').replace(/[,\\¥\s]/g, '');
  if ( !/^-?\d+(\.\d+)?$/.test(s) ) return null;
  return Number(s);
};

// プロファイル判定。行配列の先頭数行（ヘッダ候補）に detect 語が全て含まれるか
const detectProfile = (headers, profiles) => {
  const joined = headers.map((h) => normalizeText(h)).join('');
  for ( const profile of profiles ) {
    const detect = profile.detect || [];
    if ( detect.length > 0 && detect.every((kw) => joined.includes(normalizeText(kw))) ) {
      return profile;
    }
  }
  return null;
};

// 列名→フィールドの割り当て。プロファイルが無ければ既定の名寄せ表を使う
const DEFAULT_COLUMNS = {
  date: ['日付', '取引日', '年月日', 'ご利用日', 'date'],
  description: ['内容', '摘要', '詳細', 'ご利用店名', '説明'],
  amountOut: ['出金金額', '出金額', 'お支払金額', '支払額', 'お支払い金額'],
  amountIn: ['入金金額', '入金額', 'お預り金額', '預け入れ額', 'お預かり金額'],
  balance: ['残高', '差引残高', '残高(円)'],
  amount: ['ご利用金額', '利用金額'],
  merchant: ['ご利用店名', '利用店名', '店名'],
  memo: ['メモ', '備考']
};

// 列名→フィールドの割り当て。プロファイルが無ければ既定の名寄せ表を使う。
// 「出金金額(円)」のような括弧付き単位は括弧を外して照合する
const assignColumns = (headers, profile) => {
  const map = {};
  const given = ( profile && profile.columns ) || {};
  const stripParens = (name) => name.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '');
  headers.forEach((header, index) => {
    const name = stripParens(normalizeText(header));
    const tryMatch = ( candidates ) => {
      for ( const c of candidates ) {
        const candidate = stripParens(normalizeText(c));
        if ( candidate && ( name === candidate ||
          ( name.startsWith(candidate) && candidate.length >= 3 ) ) ) {
          return true;
        }
      }
      return false;
    };
    for ( const [ field, candidates ] of Object.entries(given) ) {
      if ( tryMatch( Array.isArray(candidates) ? candidates : [ candidates ] ) ) {
        map[index] = field;
        return;
      }
    }
    for ( const [ field, candidates ] of Object.entries(DEFAULT_COLUMNS) ) {
      if ( tryMatch(candidates) ) {
        map[index] = field;
        return;
      }
    }
  });
  return map;
};

// カテゴリ判定。プロファイルのルール（正規表現文字列）を既定ルールより優先する
export const classifyCategory = (description, profile) => {
  const target = normalizeText(description);
  const rules = [ ...( ( profile && profile.categoryRules ) || [] ), ...DEFAULT_CATEGORY_RULES ];
  for ( const rule of rules ) {
    try {
      if ( new RegExp(rule.pattern).test(target) ) {
        return rule.category;
      }
    } catch (e) {
      // 不正な正規表現は無視（設定ミスに備える）
    }
  }
  return 'normal';
};

// テーブル行（2次元配列）→ 明細行オブジェクト群
const rowsToLines = (rows, profile) => {
  const lines = [];
  let columnMap = null;
  for ( const row of rows ) {
    const cells = ( row || [] ).map((cell) => ( cell === undefined || cell === null ? '' : cell ));
    if ( !columnMap ) {
      columnMap = assignColumns(cells, profile);
      continue;
    }
    const get = (field) => {
      for ( const [ index, field2 ] of Object.entries(columnMap) ) {
        if ( field2 === field ) {
          return cells[index];
        }
      }
      return '';
    };
    const rawDescription = String(get('description') || '');
    const date = parseDate(get('date'));
    const amountIn = toNumber(get('amountIn'));
    const amountOut = toNumber(get('amountOut'));
    const amount = toNumber(get('amount'));
    // 空行（日付も金額も無い）はスキップ
    if ( !date || ( amountIn === null && amountOut === null && amount === null ) ) {
      continue;
    }
    lines.push({
      date: date,
      rawDescription: rawDescription,
      merchant: String(get('merchant') || '') || rawDescription,
      amountIn: amountIn,
      amountOut: amountOut,
      balance: toNumber(get('balance')),
      amount: amount,
      memo: String(get('memo') || '') || null
    });
  }
  return lines;
};

const parseExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const rows = [];
  sheet.eachRow((row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = ( cell.result !== undefined ) ? cell.result : cell.value;
    });
    rows.push(cells);
  });
  return rows;
};

// CSVはUTF-8のみ対応（実運用はExcel保存経路なのでxlsxが主。銀行直接CSVのSJISは要望があれば拡張）
const parseCsv = (buffer) => {
  const text = buffer.toString('utf-8');
  const rows = [];
  let fields = [];
  let field = '';
  let inQuote = false;
  for ( let i = 0; i < text.length; i ++ ) {
    const c = text[i];
    if ( inQuote ) {
      if ( c === '"' && text[i + 1] === '"' ) {
        field += '"';
        i ++;
      } else if ( c === '"' ) {
        inQuote = false;
      } else {
        field += c;
      }
    } else if ( c === '"' ) {
      inQuote = true;
    } else if ( c === ',' ) {
      fields.push(field);
      field = '';
    } else if ( c === '\n' || c === '\r' ) {
      if ( c === '\r' && text[i + 1] === '\n' ) i ++;
      fields.push(field);
      rows.push(fields);
      fields = [];
      field = '';
    } else {
      field += c;
    }
  }
  if ( ( field !== '' ) || ( fields.length > 0 ) ) {
    fields.push(field);
    rows.push(fields);
  }
  return rows;
};

// 残高整合チェック（前残+入-出=次残）。崩れ行を警告として返す
export const validateBalances = (lines) => {
  const warnings = [];
  let prev = null;
  lines.forEach((line, index) => {
    if ( line.balance === null || line.balance === undefined ) return;
    if ( prev !== null ) {
      const expected = prev + ( line.amountIn || 0 ) - ( line.amountOut || 0 );
      if ( Math.abs(expected - line.balance) > 0.009 ) {
        warnings.push(`${index + 1}行目: 残高が一致しません（帳${prev} → 期待${expected} 実際${line.balance}）`);
      }
    }
    prev = line.balance;
  });
  return warnings;
};

// カード明細PDF（pdfjsのテキストアイテム）をY座標で行に束ねる
const pdfItemsToLines = (items) => {
  const byLine = new Map();
  for ( const item of items ) {
    if ( !item.str || !item.transform ) continue;
    const y = Math.round(item.transform[5] / 2) * 2;
    if ( !byLine.has(y) ) {
      byLine.set(y, []);
    }
    byLine.get(y).push(item);
  }
  return [ ...byLine.keys() ].sort((a, b) => b - a).map((y) => {
    const itemsInLine = byLine.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
    return {
      y: y,
      text: itemsInLine.map((i) => i.str).join(''),
      tokens: itemsInLine.map((i) => i.str.trim()).filter((s) => s)
    };
  });
};

// 日付トークン。Web明細は「26/04/02」（YY/MM/DD）、発行会社の郵送明細書
// （カードご利用代金明細書）は「2025/08/16」（YYYY/MM/DD）の4桁年。
const parseCardDate = (token) => {
  let m = String(token || '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if ( m ) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  m = String(token || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if ( !m ) return null;
  return `20${m[1]}-${m[2]}-${m[3]}`;
};

// 金額トークン（半角3桁以上、桁区切りカンマ許容）。区分・回数（全角数字）や
// 換算レート（小数）を金額と誤認しないための判定
const isAmountToken = (token) => {
  return /^\d{1,3}(,\d{3})+$|^\d{3,}$/.test(String(token || ''));
};

// カード明細PDFのテキスト行から利用行を組み立てる。
// 店名が折り返して複数行に分断されることがあるため、日付行の前後（±8px以内で
// 日付・金額を含まない行）を店名の断片として統合する
const cardRowsToLines = (pdfLines, profile) => {
  const startsWithDate = (tokens) => parseCardDate(tokens[0]) !== null;
  const hasAmount = (tokens) => tokens.some(isAmountToken);
  const isHeader = (tokens) => {
    const joined = normalizeText(tokens.join(''));
    return /ご利用日|ご利用店名|支払い金額/.test(joined);
  };
// 「カードご利用代金明細書」様式（JCB発行等）の注記行。店名の断片ではない
// （実質年率・支払方法変更・区分/回数の単独表記。回数の由来は郵送明細書の
// 支払区分欄で、行の間に独立したYで印字される）。これらは断片として
// 吸収しない（走査を打ち切る）
const isFragmentNoise = (text) => (
  /^(実質年率|支払方法変更|リボ|支払区分|回数|[０-９]{1,2}回|ボ[０-９]+$|海Ｃ|Ｓ[０-９])/.test(String(text || ''))
);

// 折り返し断片の集約（pdfLinesはY降順。上断片→日付行→下断片の順に並ぶ）。
// 断片は日付トークンを壊さないよう、行オブジェクトの別枠に控える
  const merged = pdfLines.map((pdfLine) => {
    return { tokens: [ ...pdfLine.tokens ], y: pdfLine.y, upper: [], lower: [] };
  });
  const attachFragments = (pdfLines) => {
    for ( let i = 0; i < pdfLines.length; i ++ ) {
      const row = pdfLines[ i ];
      if ( !startsWithDate(row.tokens) || !hasAmount(row.tokens) ) continue;
      // 上側: 日付行の直上にある「日付なし・金額なし」の行を店名の断片にする
      let upperY = row.y;
      for ( let j = i - 1; j >= 0; j -- ) {
        const up = pdfLines[ j ];
        if ( startsWithDate(up.tokens) || hasAmount(up.tokens) || isHeader(up.tokens) || isFragmentNoise(up.tokens.join('')) ) break;
        if ( up.y - upperY > 8 ) break;
        row.upper.unshift(up.tokens.join(''));
        upperY = up.y;
        up.tokens = [];
      }
      // 下側: 直下にある「日付なし・金額なし」の行を店名の断片にする
      let lowerY = row.y;
      for ( let j = i + 1; j < pdfLines.length; j ++ ) {
        const down = pdfLines[ j ];
        if ( startsWithDate(down.tokens) || hasAmount(down.tokens) || isHeader(down.tokens) || isFragmentNoise(down.tokens.join('')) ) break;
        if ( lowerY - down.y > 8 ) break;
        row.lower.push(down.tokens.join(''));
        lowerY = down.y;
        down.tokens = [];
      }
    }
    return pdfLines.filter((l) => l.tokens.length > 0);
  };
  const lines = [];
  for ( const pdfLine of attachFragments(merged) ) {
    const tokens = pdfLine.tokens;
    if ( tokens.length < 2 ) continue;
    const date = parseCardDate(tokens[0]);
    if ( !date ) continue;
    // 日付の次のトークンから最初の金額トークンまでを店名とみなす（上下の断片を統合）
    let amountIndex = tokens.findIndex((t, i) => ( i > 0 ) && isAmountToken(t));
    if ( amountIndex < 0 ) continue;
    const merchant = [ ...pdfLine.upper, tokens.slice(1, amountIndex).join(''), ...pdfLine.lower ].join('');
    if ( !merchant ) continue;
    // お支払い金額は行末側の金額トークン（利用金額と同じ値になる。回数は全角なので除外）
    const amounts = tokens.filter(isAmountToken);
    const amount = toNumber(amounts[amounts.length - 1]);
    if ( amount === null ) continue;
    // 外貨明細（例: 22.00 USD 165.206）があれば控える
    const currencyIndex = tokens.findIndex((t) => /^[A-Z]{3}$/.test(t));
    lines.push({
      date: date,
      rawDescription: merchant,
      merchant: merchant,
      amount: amount,
      foreignAmount: ( currencyIndex >= 0 && currencyIndex > 0 ) ? toNumber(tokens[currencyIndex - 1]) : null,
      foreignCurrency: ( currencyIndex >= 0 ) ? tokens[currencyIndex] : null,
      memo: null
    });
  }
  return lines;
};

// カード明細PDFの解析（支払日・支払総額をプロファイルの正規表現で抽出）
// PDFの全ページのテキスト行（計算書の決定的解析に使う）
export const pdfTextLinesOf = async (buffer) => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const doc = await loadingTask.promise;
  try {
    const out = [];
    for ( let p = 1; p <= doc.numPages; p ++ ) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      out.push(...pdfItemsToLines(content.items));
    }
    return out;
  } finally {
    await loadingTask.destroy();
  }
};

// === 計算書（ECモールの支払明細書系。テキスト層のあるPDF）の決定的解析 ===
// 「テキスト層が読める計算書」をカード明細のパーサが拾ってしまうのを防ぐ
// （振込説明の文章だけが行になり、AIフォールバックも発火しない事故）。
// 書式の差はプロファイル（type: settlement）に持たせる。**コードに特定モールの
// 語彙は置かない**（新しいモール=新しいyaml。アドホックなパーサー追従を
// やめるための原則どおりの受け皿）:
//   detect:              [シグネチャ語...] テキストに全て含まれるときこの書式とみなす
//   aggregateSale:       売上の集計行のパターン（省略時 '^売上\s*￥'）
//   aggregateExpense:    支出の集計行のパターン（省略時 '^支出\s*￥'）
//   transferPattern:     振込行のラベル（省略時 DEFAULT_TRANSFER_PATTERN）
//   transferDatePattern: 振込日の書かれた文（省略時は 日付+口座への文）
//   memoPattern:         振込ID等のメモ行（省略時 '^銀行振込ID'）
// 行の文法（「ラベル（数字なし）￥額」の集計・内訳・行末金額）はモール共通の
// 想定としてコード側で担う。detectに合わなければ null（別の書式扱い）。
// 期首残高の行はどこに書かれても無視する
export const parseSettlementTextLines = (pdfLines, profile = null) => {
  const detect = ( profile && Array.isArray(profile.detect) && profile.detect.length > 0 ) ?
    profile.detect : null;
  if ( !detect ) {
    return null;
  }
  const lines = pdfLines.map((l) => normalizeText(l.text)).filter((t) => t);
  const flat = lines.join('');
  for ( const term of detect ) {
    if ( !flat.includes(normalizeText(term)) ) {
      return null;
    }
  }
  // normalizeText は NFKC（全角￥→半角¥、全角数字→半角）がかかった行に使う。
  // 学習・起草で yaml に書かれた pattern（全角￥表記が混ざる）も同じ前提に
  // 揃えるため、pattern 側の ￥（U+FFE5 U+00A5の混在）と全角ハイフン、全角
  // 数字は正規化してから使う。これが無いと学習直後に諸々のヘッダ一致が
  // 崩れて、明細が1行も取れなくなる（2026-11-04発覚）
  const normPattern = (src) => String(src || '')
    .replace(/[￥]/g, '¥')          // 全角円→半角
    .replace(/[－ー―]/g, '-')      // 全角/長音ハイフン→ASCIIハイフン
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
  const saleHeader = new RegExp(normPattern(( profile && profile.aggregateSale ) || '^売上\\s*[\\u00a5￥]'));
  const expenseHeader = new RegExp(normPattern(( profile && profile.aggregateExpense ) || '^支出\\s*[\\u00a5￥-]'));
  const transferPatternSafe = (v) => String(v || '').trim() || DEFAULT_TRANSFER_PATTERN;
  const transferPattern = normPattern(transferPatternSafe(( profile && profile.transferPattern ) || DEFAULT_TRANSFER_PATTERN));
  const datePattern = ( profile && profile.transferDatePattern ) || '(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})に、.*?口座へ';
  const memoPattern = ( profile && profile.memoPattern ) || '^銀行振込ID';
  const tryLabel = (text, pattern) => {
    try {
      return new RegExp(pattern).test(text);
    } catch (e) {
      return false;
    }
  };
  const out = [];
  const warnings = [];
  const pickAmount = (s) => {
    const m = s.match(/[\u00a5￥]?-?([\d,]+)/);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };
  // 純利益・売上・支出の集計行と、そこに続く内訳の行を整理する
  // 売上 ￥177,941 → 集計（スキップ）。商品代金 ￥158,998 → 売上行
  // 支出 -￥66,223 → 集計（スキップ）。プロモーション割引額 -￥1,240 → 費用行
  let section = null;   // 'sale' | 'expense'
  let transferLine = null;
  let transferDate = null;
  let transferAmount = null;
  let bankMemo = null;
  for ( const raw of lines ) {
    const line = raw;
    if ( /^期首残高/.test(line) ) {
      continue;
    }
  // 集計行の判定: ヘッダ語（売上/支出。プロファイルの aggregate*）に続くのが
  // 「￥額」だけで、内訳ラベルが続かない行だけを集計行とみなす。
  // これが無いと「学習した pattern が '^売上' のみ」ときに、內訳行
  // （売上 商品代金 など）まで集計として飲み込まれ、1行しか出てこなくなる
  const aggregateOnly = (line, header) => {
    const m = line.match(header);
    if ( !m )  {
      return null;
    }
    const rest = line.slice(m[0].length).trim();
    // 借りた ￥ の有無は学習直前で低下しやすい。金額以外の語が続くなら内訳
    if  ( !( /^[\-–]?[\u00a5￥]?([\d,]+)\s*$/.test(rest) ) )  {
      return null;
    }
    return pickAmount(line);
  };
  if ( saleHeader.test(line) ) {
    section = 'sale';
    // 集計行（「売上 ￥177,941」）も計算書の行として読む。pick & place の
    // 伝票ビューでは、内訳ではなく集計行そのものを貸方に置くこともできる。
    // 集計の金額が読めない場合（＝内訳行など）は従来どおり集計行を捨てて
    // 後段の内訳解析に回す
    const agg = aggregateOnly(line, saleHeader);
    if ( agg !== null ) {
      out.push({
        date: null,
        rawDescription: '売上',
        merchant: '売上',
        amountIn: agg,
        amountOut: null,
        balance: null,
        category: 'aggregate',
        memo: null
      });
    }
    continue;
  }
  if ( expenseHeader.test(line) ) {
    section = 'expense';
    // 集計行（「支出 -￥66,223」）も計算書の行として読む（同上）。
    // 内訳行（支出 プロモーション割引額 -￥1,240 など）が乗ってきたときは
    // 集計として飲まず、あとの内訳解析に回す
    const agg = aggregateOnly(line, expenseHeader);
    if ( agg !== null ) {
      out.push({
        date: null,
        rawDescription: '支出',
        merchant: '支出',
        amountIn: null,
        amountOut: agg,
        balance: null,
        category: 'aggregate',
        memo: null
      });
    }
    continue;
  }
    // 振込行。**行末が￥額の行だけ**を対象にする（「…の振込みが予定され
    // ています」のような説明文も振込の語を含むため、文法で弾かないと
    // 説明文を振込行として拾ってしまう）
    const transferEnds = line.match(/^([^0-9\u00a5￥]*?)[\s]*[\u00a5￥][\d,]+$/);
    if ( transferEnds && tryLabel(line, transferPattern) ) {
      transferAmount = pickAmount(line);
      if ( transferAmount === null ) {
        warnings.push('純利益（振込額）の金額が読めませんでした。');
        continue;
      }
      // 金額とラベルを分離する（純利益 ￥111,718 → 摘要=純利益）
      const label = transferEnds[1].replace(/[\-–\s]+$/, '').trim() || '純利益';
      transferLine = {
        date: transferDate,
        rawDescription: label,
        merchant: label,
        amountIn: transferAmount,
        amountOut: null,
        balance: null,
        memo: null
      };
      continue;
    }
    const repayment = line.match(new RegExp(datePattern));
    if ( repayment ) {
      const yy = Number(repayment[1]);
      const mm = String(Number(repayment[2])).padStart(2, '0');
      const dd = String(Number(repayment[3])).padStart(2, '0');
      transferDate = `${yy}-${mm}-${dd}`;
      if ( transferLine ) {
        transferLine.date = transferDate;
      }
      continue;
    }
    if ( new RegExp(memoPattern).test(line) ) {
      bankMemo = ( bankMemo ? bankMemo + ' ' : '' ) + raw.trim();
      if ( transferLine ) {
        transferLine.memo = bankMemo;
      }
      continue;
    }
    // 内訳行（ラベル ￥額 / ラベル -￥額）。売上・支出それぞれの集計の後。
    // 文章の残骸（振込日程の文・URLなど）に数字つきのものがあり、拾って
    // しまうと検算が壊れる。ラベル（数字を含まない）+行末に￥額の形だけを
    // 内訳として採用する
    if ( section ) {
      const item = line.match(/^([^0-9\-\u00a5￥\/:]+?)[\s]*[\-–][\u00a5￥][\d,]+$|^(.+?)[\s]*[\u00a5￥][\d,]+$/);
      const label = ( item ? ( item[1] || item[2] ).replace(/[\-–\s]+$/, '').trim() : null );
      const amountAtEnd = line.match(/([\-–]?[\u00a5￥][\d,]+)$/);
      if ( !label || !amountAtEnd ) {
        continue;
      }
      const negative = /^[\-–]/.test(amountAtEnd[1]);
      const amount = pickAmount(line);
      if ( amount === null ) {
        continue;
      }
      if ( section === 'expense' && !negative ) {
        // 支出の内訳はマイナス表記が原則。正向きの数字は別の文書領域の残骸
        continue;
      }
      out.push({
        date: null,
        rawDescription: `${section === 'sale' ? '売上' : '支出'} ${label}`,
        merchant: `${section === 'sale' ? '売上' : '支出'} ${label}`,
        amountIn: section === 'sale' ? amount : null,
        amountOut: section === 'expense' ? amount : null,
        balance: null,
        category: section === 'sale' ? 'normal' : 'fee',
        memo: null
      });
      continue;
    }
  }
  if ( !transferLine ) {
    return null;
  }
  // 振込予定文（2025/8/12に…振込み）が取れたら全行の日付を振込日に。
  // 計算書の伝票日付は振込日（送金の動く日）が暦として正
  if ( transferDate ) {
    for ( const line of out ) {
      line.date = transferDate;
    }
  } else {
    warnings.push('振込日の記載が読めませんでした（伝票日付は画面で指定してください）。');
  }
  return {
    lines: out.concat([ transferLine ]),
    total: transferAmount,
    payDate: transferDate,
    warnings: warnings,
    profileName: null
  };
};

const parseCardPdf = async (buffer, profile) => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const pdfLines = pdfItemsToLines(content.items);
    const flat = pdfLines.map((l) => normalizeText(l.text)).join('');
    const patterns = ( profile && profile.cardPatterns ) || {};
    let total = null;
    let payDate = null;
    const totalMatch = flat.match(new RegExp(patterns.total || '(?:支払い合計額|今回のお支払金額総合計|今回のお支払金額合計)([\\d,]+)(?!口)'));
    if ( totalMatch ) {
      total = toNumber(totalMatch[1]);
    }
    const dateMatch = flat.match(new RegExp(patterns.payDate || '(?:支払い日|今回のお支払日)(\\d{4})年(\\d{1,2})月(\\d{1,2})日'));
    if ( dateMatch ) {
      payDate = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
    }
    const lines = cardRowsToLines(pdfLines, profile);
    const warnings = [];
    // 支払総額と利用行の合計を照合するのはやめる。
    // Web明細PDFは昔の利用明細も同じページに載ることがあり（複数回請求が
    // 混在する）、合計が支払総額と一致するとは限らない。
    // 支払総額の用途は銀行側の引落行との照合（suggestCardPayments）で、
    // 合わなければ照合候補が出ないだけ（誤照合はしない）。
    if ( total === null ) {
      warnings.push('支払総額を読み取れませんでした。銀行側の引落行との自動照合は行われません。');
    }
    if ( lines.length === 0 ) {
      warnings.push('利用明細行を読み取れませんでした。');
    }
    return { lines: lines, total: total, payDate: payDate, warnings: warnings };
  } finally {
    await loadingTask.destroy();
  }
};

const periodOf = (lines) => {
  const dates = lines.map((l) => l.date).filter((d) => d).sort();
  return {
    periodFrom: dates[0] || null,
    periodTo: dates[dates.length - 1] || null
  };
};

// 形式を自動判別して明細行を解析する。
// mimeType: xlsx/CSV/PDF/画像。options.profiles でプロファイルを上書き可（テスト用）
export const parseStatement = async (buffer, mimeType, options = {}) => {
  const profiles = options.profiles || loadProfiles();
  const type = String(mimeType || '').toLowerCase();
  let parsed = null;
  let profile = null;
  let settlementPdf = false;
  let settlementProfileName = null;
  if ( /pdf/.test(type) ) {
    // 計算書（ECモールの支払明細書系）はテキスト層が読めるものがある。
    // **書式の判定・解析はプロファイル（type: settlement の detect）で行う**
    // （特定モールの語彙はコードに置かない。新しいモール=新しいyaml）。
    // テキスト層のないPDFはカード明細の経路→AI読取フォールバックに落ちる
    let pdfLines = null;
    try {
      pdfLines = await pdfTextLinesOf(buffer);
    } catch (e) {
      // テキスト層が無い/破損PDFは従来の経路へ落ちる
    }
    if ( pdfLines ) {
      for ( const p of profiles.filter((p2) => ( p2.type === 'settlement' && Array.isArray(p2.detect) && p2.detect.length > 0 )) ) {
        const settlementText = parseSettlementTextLines(pdfLines, p);
        if ( settlementText ) {
          parsed = settlementText;
          settlementPdf = true;
          settlementProfileName = p.name;
          break;
        }
      }
    }
    if ( !settlementPdf ) {
      // カード明細PDF。プロファイルは全カード分から検出に使える
      profile = profiles.find((p) => ( p.type === 'card' )) || null;
      parsed = await parseCardPdf(buffer, profile);
      // テキスト層が実質ないPDF（ベクタ字形・数字だけのエポスカード等）は
      // 利用行が組み立てられない。AIが使えるなら画像へ落として通帳OCRにまわす。
      // また「行がほとんど取れないPDF」（未対応の計算書など。振込説明の
      // 文章だけが行になる等）も明細としては壊れているのでAIに譲る。
      // 計算書のプロファイル（detect）を書けば次回から決定的に解析できる
      if ( parsed.lines.length < 2 ) {
        const vision = await import('./vision.js');
        if ( vision.isAvailable() ) {
          const ocr = await vision.extractStatement(buffer, mimeType);
          if ( ocr.lines.length >= parsed.lines.length ) {
            const cardWarnings = parsed.warnings;
            parsed = { lines: ocr.lines, total: null, payDate: null,
              warnings: [ ...cardWarnings, ...ocr.warnings ] };
            parsed.warnings.push('PDFのテキストが明細として足りないため、画像としてAI読み取りしました。');
          } else {
            parsed.warnings.push('AI読み取りの結果がテキスト解析より少なかったため、テキスト解析の結果を使います。');
          }
        } else if ( parsed.lines.length === 0 ) {
          parsed.warnings.push('PDFのテキストが取れず、AIも未設定のため読み取れません（config/llms.yaml）。');
        }
      }
    }
  } else if ( /^image\//.test(type) ) {
    // 通帳スキャン等はAI読取（libs/vision.js）
    const vision = await import('./vision.js');
    parsed = await vision.extractStatement(buffer, mimeType);
    profile = null;
  } else {
    const rows = ( /excel|spreadsheet|sheet/.test(type) || ( buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b ) )
      ? await parseExcel(buffer) : parseCsv(buffer);
    const headerCandidates = rows.slice(0, 5).flat().map(String);
    profile = detectProfile(headerCandidates, profiles.filter((p) => ( ( p.type || 'bank' ) === 'bank' ) || ( p.type === 'settlement' )));
    const lines = rowsToLines(rows, profile);
    parsed = { lines: lines, warnings: [], payDate: null, total: null };
  }
  for ( const line of parsed.lines ) {
    line.category = classifyCategory(line.rawDescription || line.merchant, profile);
  }
  const period = periodOf(parsed.lines);
  if ( ( profile && ( profile.type || 'bank' ) === 'bank' ) || ( !profile && !/pdf|^image\//.test(type) ) ) {
    parsed.warnings.push(...validateBalances(parsed.lines));
  }
  if ( parsed.lines.length === 0 && parsed.warnings.length === 0 ) {
    parsed.warnings.push('明細行を読み取れませんでした。');
  }
  return {
    kind: settlementPdf ? 'settlement' : ( profile && profile.type === 'card' ) ? 'corporate_card' : ( profile && profile.type === 'settlement' ) ? 'settlement' : 'bank',
    profileName: settlementProfileName || ( ( profile && profile.name ) || null ),
    lines: parsed.lines,
    total: parsed.total,
    payDate: parsed.payDate,
    periodFrom: period.periodFrom,
    periodTo: period.periodTo,
    warnings: parsed.warnings || []
  };
};

// === AIによるプロファイル起草（書式学習。承認制） ===
// 「アドホックなパーサー追従をやめる」ための仕組み。
// 取込をAIで読めたら、その書式のyamlプロファイル（config/banks/*.yamlの
// 形）をAIに起草させる。起草したプロファイルで**同じファイルを決定的に
// 再解析**し、AIの読みと1行も違わなければ候補（一致判定は自動）。
// 人が確認して保存 → 次回以降はAIなしで高速・無料に読める。

// プロファイルの再解析に使う「材料」。テキスト層のある書式
// （PDF/Excel/CSV）だけが対象。画像はプロファイル化の材料にならない
const EVIDENCE_MAX_LINES = 150;
export const evidenceText = async (buffer, mimeType) => {
  const type = String(mimeType || '').toLowerCase();
  if ( /pdf/.test(type) ) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const doc = await loadingTask.promise;
    try {
      const out = [];
      for ( let p = 1; p <= Math.min(doc.numPages, 5); p ++ ) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        for ( const pdfLine of pdfItemsToLines(content.items) ) {
          if ( pdfLine.text.trim() ) {
            out.push(pdfLine.text);
          }
        }
      }
      return out.slice(0, EVIDENCE_MAX_LINES).join('\n');
    } finally {
      await loadingTask.destroy();
    }
  }
  // Excel/CSVは表のまま渡す（プロファイルのdetect/columnsの材料になる順序）
  const rows = ( /excel|spreadsheet|sheet/.test(type) || ( buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b ) )
    ? await parseExcel(buffer) : parseCsv(buffer);
  return rows.slice(0, EVIDENCE_MAX_LINES).map((row) => row.map((cell) => ( cell === null || cell === undefined ) ? '' : String(cell)).join('\t')).join('\n');
};

// === 計算書（ECモール等）の取り込み（1計算書 = 1複合伝票） ===
// 計算書は「振込1本の内訳書」: 全行を「売上側」「費用側」「振込行」に分類し、
// 1枚の複合伝票（借方 入金先預金+費用各行 / 買方 売上高=売上側合算）にする。
// 分類の約束はプロファイル（type: settlement）の salePattern / transferPattern
// （省略時の既定語: '^売上' / '振込み'）。向きは金額の入出で決める:
//   売上行 = INのうちsalePatternに当たる行（商品代金/税金/配送料ラベル込み）
//   費用行 = OUT行すべて（広告/FBA/手数料など。科目は学習ルールで決める）
//   振込行 = INのうちtransferPatternに当たる行（取得できなければ警告して返す。
//   危うきは勝手に推測しない）
// 検算（売上合計 = 振込 + 費用合計）が合わないときは警告する（食い違いは
// 分類の想定違いの兆候。伝票は作らず人に確認させる）

// 振込行を引く既定語。Amazon計算書は「純利益の振込み」だが、AI読取の揺れで
// 「純利益」だけに切れることがある（実データ2025-07-29で発生）ので両方を見る
export const DEFAULT_TRANSFER_PATTERN = '振込|純利益';
export const settlementBreakdown = (lines, profile = null) => {
  // salePatternを指定したときだけ「売上行はこれに当たる行」と厳格に判定する
  // （指定がないときは「振込行以外の入力行=売上」で判定する。Amazon計算書の
  // ようにAI読取のラベルに揺れがある書式ではこちらが壊れにくい）
  const salePattern = ( profile && profile.salePattern ) ? String(profile.salePattern).trim() : null;
  // 振込行を引く既定語。Amazon計算書は「純利益の振込み」だが、AI読取の揺れで
  // 「純利益」だけに切れることがある（実データ2025-07-29で発生）ので両方を見る
  const transferPattern = String( ( profile && profile.transferPattern ) || DEFAULT_TRANSFER_PATTERN ).trim() || DEFAULT_TRANSFER_PATTERN;
  const labelOf = (line) => normalizeText(line.rawDescription || line.merchant || line.description || '');
  const tryPattern = (line, pattern) => {
    try {
      return new RegExp(pattern).test(labelOf(line));
    } catch (e) {
      return false;
    }
  };
  const isIn = (line) => ( line.amountIn !== null && line.amountIn !== undefined && Number(line.amountIn) !== 0 );
  const isOut = (line) => ( line.amountOut !== null && line.amountOut !== undefined && Number(line.amountOut) !== 0 );
  // 集計行（category=aggregate。売上/支出の集計）は合計に数えない（pick & place
  // の材料として行だけは出すが、内訳と二重計上になるため）。伝票に載せる
  // 集計行は明細の貸借割付で選ぶ
  const isAggregate = (line) => ( line.category === 'aggregate' );
  const inLines = lines.filter((line) => isIn(line) && !isAggregate(line));
  const transferLine = inLines.find((line) => tryPattern(line, transferPattern)) || null;
  const salableIn = inLines.filter((line) => line !== transferLine);
  const saleLines = salableIn.filter((line) => ( !salePattern || tryPattern(line, salePattern) ));
  const expenseLines = lines.filter((line) => isOut(line) && !isAggregate(line));
  // salePatternの指定があるときだけ未分類の入力行を拾う（指定なしだと
  // 「振込以外の入金はすべて売上」なので拾うべき行がない）
  const leftovers = ( salePattern ) ?
    inLines.filter((line) => !saleLines.includes(line) && ( line !== transferLine )) : [];
  const warnings = [];
  if ( !transferLine ) {
    warnings.push('振込行を特定できませんでした（計算書の振込額が分からないため伝票にできません）。');
  }
  if ( leftovers.length > 0 ) {
    warnings.push(`${leftovers.length}行が売上にも費用にも分類できませんでした。`);
  }
  const sumOf = (list, field) => list.reduce((acc, line) => acc + Number(line[ field ] || 0), 0);
  const saleTotal = sumOf(saleLines, 'amountIn');
  const expenseTotal = sumOf(expenseLines, 'amountOut');
  const transferAmount = transferLine ? Number(transferLine.amountIn) : null;
  if ( transferLine && ( Math.round(saleTotal) !== Math.round(transferAmount + expenseTotal) ) ) {
    warnings.push(`検算が合いません（売上 ${saleTotal.toLocaleString()} vs 振込 ${transferAmount.toLocaleString()} + 費用 ${expenseTotal.toLocaleString()}）。分類の想定違いがないか確認してください。`);
    if ( expenseTotal > saleTotal - transferAmount ) {
      // 費用の内訳の合計が（売上-振込）を超えていると、入れ子の集計行と
      // 内訳の両方を拾っている疑いがある（Amazonの支払明細書は、集計行
      // 「FBA 1,447」とその内訳「納品895+在庫保管552」が並んで載る）
      warnings.push('費用の内訳の合計が(売上-振込)を超えています。入れ子になった集計行（例: FBA=納品+在庫保管）を含めている可能性があります。伝票化する行を選んでください。');
    }
  }
  return {
    saleLines: saleLines,
    expenseLines: expenseLines,
    transferLine: transferLine,
    leftovers: leftovers,
    saleTotal: saleTotal,
    expenseTotal: expenseTotal,
    transferAmount: transferAmount,
    warnings: warnings
  };
};

// 起草されたyamlの検証（保存前に必ず通る。壊れたyamlを書き込まない）
export const validateProfileYaml = (text) => {
  let profile = null;
  try {
    profile = yamlLoad(text);
  } catch (e) {
    return { error: `YAMLとして解釈できません: ${e.message}` };
  }
  if ( !profile || typeof profile !== 'object' ) {
    return { error: '空のプロファイルです。' };
  }
  if ( !profile.name || typeof profile.name !== 'string' ) {
    return { error: 'name（プロファイル名）が必要です。' };
  }
  if ( ![ 'bank', 'card', 'settlement' ].includes(profile.type) ) {
    return { error: `type は bank か card か settlement で指定してください（現在: ${profile.type}）。` };
  }
  if ( profile.type === 'bank' ) {
    if ( !profile.detect || !Array.isArray(profile.detect) || profile.detect.length === 0 ) {
      return { error: 'type: bank のプロファイルには detect（ヘッダ語の配列）が必要です。' };
    }
  }
  if ( profile.type === 'settlement' ) {
    // 伝票化に使う約束科目（省略可）。入るときは数字コードでしかない
    for ( const key of [ 'saleAccount', 'receivedAccount' ] ) {
      if ( profile[ key ] && !/^\d+$/.test(String(profile[ key ])) ) {
        return { error: `${key} は科目コード（数字）で指定してください。` };
      }
    }
    // テキスト層のあるPDFの決定的解析（detectは省略可。AI読取だけの
    // 分類プロファイルでもよい）
    if ( profile.detect !== undefined && ( !Array.isArray(profile.detect) || profile.detect.length === 0 ) ) {
      return { error: 'detect はシグネチャ語の配列で指定してください（省略可）。' };
    }
  }
  return { profile: profile };
};

// 決定的に保存できるプロファイルの検証: 同じファイルを起草プロファイルで
// 再解析し、AI読取の行と一致するか（日付+金額の完全一致で照合）。相違が
// あるものはおすすめしない（人は見るが、ulptutputが多い）
export const profileAgreement = (profile, parsedWithProfile, aiLines) => {
  const keyOf = (line) => (
    JSON.stringify([
      line.date || null,
      ( line.amountIn ?? line.amountOut ?? line.amount ?? null )
    ])
  );
  void profile;
  const aiKeys = new Set(aiLines.map(keyOf));
  const bothKeys = parsedWithProfile.lines.map(keyOf);
  let matched = 0;
  for ( const key of bothKeys ) {
    if ( aiKeys.has(key) ) {
      matched ++;
      aiKeys.delete(key);
    }
  }
  return {
    agree: ( bothKeys.length === aiLines.length ) && ( matched === aiLines.length ),
    matched: matched,
    ofProfile: bothKeys.length,
    ofAi: aiLines.length
  };
};

const PROFILE_DIR = () => ( process.env.BANK_CONFIG_PATH || 'config/banks' );

// ファイル名にできない文字を除く（profile.nameは取込結果にも出る名前）
const profileFileBase = (name) => (
  String(name || '').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'profile'
);

// 承認されたプロファイルをyamlとして保存する（既存ファイルは更新）。
// 書き込むのはここだけ。yamlの内容は保存前にvalidateProfileYamlを通す
export const saveProfileYaml = (yamlText) => {
  const check = validateProfileYaml(String(yamlText || ''));
  if ( check.error ) {
    return check;
  }
  const dir = PROFILE_DIR();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
  }
  const file = path.join(dir, `${profileFileBase(check.profile.name)}.yaml`);
  fs.writeFileSync(file, yamlText, 'utf-8');
  return { profile: check.profile, file: file };
};

export default {
  parseStatement: parseStatement,
  classifyCategory: classifyCategory,
  validateBalances: validateBalances,
  settlementBreakdown: settlementBreakdown,
  pdfItemsToLines: pdfItemsToLines,
  cardRowsToLines: cardRowsToLines,
  loadMergeDescriptions: loadMergeDescriptions,
  saveMergeDescriptions: saveMergeDescriptions,
  evidenceText: evidenceText,
  validateProfileYaml: validateProfileYaml,
  profileAgreement: profileAgreement,
  saveProfileYaml: saveProfileYaml,
  loadProfiles: loadProfiles
};
