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
  if ( /pdf/.test(type) ) {
    // カード明細PDF。プロファイルは全カード分から検出に使える
    profile = profiles.find((p) => ( p.type === 'card' )) || null;
    parsed = await parseCardPdf(buffer, profile);
  } else if ( /^image\//.test(type) ) {
    // 通帳スキャン等はAI読取（libs/vision.js）
    const vision = await import('./vision.js');
    parsed = await vision.extractStatement(buffer, mimeType);
    profile = null;
  } else {
    const rows = ( /excel|spreadsheet|sheet/.test(type) || ( buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b ) )
      ? await parseExcel(buffer) : parseCsv(buffer);
    const headerCandidates = rows.slice(0, 5).flat().map(String);
    profile = detectProfile(headerCandidates, profiles.filter((p) => ( p.type || 'bank' ) === 'bank'));
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
    kind: ( profile && profile.type === 'card' ) ? 'corporate_card' : 'bank',
    profileName: ( profile && profile.name ) || null,
    lines: parsed.lines,
    total: parsed.total,
    payDate: parsed.payDate,
    periodFrom: period.periodFrom,
    periodTo: period.periodTo,
    warnings: parsed.warnings || []
  };
};

export default {
  parseStatement: parseStatement,
  classifyCategory: classifyCategory,
  validateBalances: validateBalances,
  pdfItemsToLines: pdfItemsToLines,
  cardRowsToLines: cardRowsToLines,
  loadMergeDescriptions: loadMergeDescriptions,
  saveMergeDescriptions: saveMergeDescriptions
};
