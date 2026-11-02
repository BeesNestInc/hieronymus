// 取り込んだ明細の突合と起票。
// - autoMatch: 銀行明細の行を既存の仕訳明細（銀行元帳の元データ）と突合する
// - suggestCardPayments: カード引落行を法人カード明細（支払総額+支払日）と照合する
// - bookLines: 未照合行から仕訳伝票を一括起票する（利息行はテンプレ仕訳）
// - selectForExpense: 個人カード明細の行を精算書の明細に変換する
// 起票される伝票は既存の精算フローと同じく未承認（承認待ち）で作成する。

import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {create as createCrossSlip} from './cross_slip.js';
import {deriveTaxRuleId} from './expense.js';
import {isLocked} from './fiscal-lock.js';
import {normalizeText} from './bank-statement.js';

// 利息仕訳テンプレの既定値（config/banks/*.yaml の interest 設定で上書きできる）
// incomeAccount: 受取利息。withholding: 源泉所得税（借方）。rate: 源泉徴収率
const INTEREST_DEFAULTS = {
  incomeAccount: '8000000',
  rate: 0.15315
};

// システム都合の仮入科目（x9xxxxx）。ルールに該当しない取込行は
// 一旦この科目で起票し、「後の処理」で実科目に差し替える。
// OUT: 出金行（借方でたてる）。IN: 入金行（貸方でうける）
export const TEMP_ACCOUNTS = { OUT: '1900000', IN: '3900000' };
export const isTempAccount = (account) => (
  ( account === TEMP_ACCOUNTS.OUT ) || ( account === TEMP_ACCOUNTS.IN )
);

// 重複取込の検出（通帳の断片重複運用向け）。
// 「期首から現在」「前回から月末」のように重複ありで複数回取り込む運用では、
// 同じトランザクションが複数の取込に分岐して載る。何もしないと二重起票に
// なるため、通帳は「残高」が行の識別子として一意であることを利用して
// 同一トランザクションを検出する（残高カラムのない形式は正規化摘要で代替）。
// 検出された行は「duplicate」として起票の対象から外す（行は挿入しておく。
// 取込ファイルを保全し、誤検出のときに手で戻せるようにするため）。
export const duplicateKeyFor = (line) => {
  const norm = normalizeText(line.rawDescription || line.description || '');
  const balance = ( line.balance !== undefined && line.balance !== null ) ? String(line.balance) : null;
  // nullとundefinedを纏めて空にする（生のSELECTとmodelのcreateで来方が違う）
  const amountOut = ( line.amountOut !== undefined && line.amountOut !== null ) ? String(line.amountOut) : '';
  const amountIn = ( line.amountIn !== undefined && line.amountIn !== null ) ? String(line.amountIn) : '';
  if ( balance ) {
    return `${line.date}|${amountOut}|${amountIn}|B${balance}`;
  }
  return `${line.date}|${amountOut}|${amountIn}|N${norm}`;
};

export const findExistingDuplicateKeys = async (statement) => {
  // 同じ口座（Financial）の取込行が保有するキーの集合。同口座間で
  // 重複する行（断片取り込の兼ね合い由来）を検出する
  if ( !statement.financialId ) {
    return new Set();
  }
  const statements = await models.BankStatement.findAll({
    where: {
      financialId: statement.financialId
    },
    attributes: [ 'id' ],
    raw: true
  });
  const ids = statements.map((s) => s.id);
  const rows = await models.BankStatementLine.findAll({
    where: { statementId: { [Op.in]: ids } },
    raw: true
  });
  const keys = new Set();
  for ( const row of rows ) {
    keys.add(duplicateKeyFor(row));
  }
  return keys;
};
export const isDuplicateLine = (key, keySet) => keySet.has(key);

// 取込明細の「年度内フィルタ」。画像OCRは通帳の撮影範囲が広く取り込め、
// Excelは全期一括の物が来る。処理できるのは就業中の年度に限るので、
// 期の範囲外の行は警告として落として残さない（過年度は確定済み、
// 未来は処理対象にならない）。fy{startDate, endDate}が無ければフィルタしない
export const fiscalYearFilter = (lines, fy) => {
  if ( ( !fy ) || ( !fy.startDate ) || ( !fy.endDate ) ) {
    return { kept: lines, dropped: 0, range: null };
  }
  const fmt = ( value ) => {
    if ( value instanceof Date ) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return String( value ).slice( 0, 10 );
  };
  const start = fmt( fy.startDate );
  const end = fmt( fy.endDate );
  const kept = lines.filter((line) => (
    line.date &&
    ( line.date.slice( 0, 10 ) >= start ) &&
    ( line.date.slice( 0, 10 ) <= end )
  ));
  return { kept: kept, dropped: ( lines.length - kept.length ), range: `${start}〜${end}` };
};

// 「前の行（同じ日）の伝票に合流させる」摘要はこの口座のルール（merge=true）
// で定義する（明細取込のルールモーダルで管理。mergeRules.yamlは廃止）
const isMergeable = (line, mergePatterns) => {
  const desc = normalizeText(line.description || line.rawDescription);
  if ( !desc ) {
    return false;
  }
  return mergePatterns.has(desc);
};

const dayDiff = (dateA, dateB) => {
  // DATEONLY（YYYY-MM-DD文字列）とDateの両方を受けられるようにする
  const toUTC = (date) => {
    if ( typeof date === 'string' ) {
      const [ y, m, d ] = date.slice(0, 10).split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    }
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  return Math.abs(toUTC(dateA) - toUTC(dateB)) / 86400000;
};

const toDateString = (date) => {
  // YYYY-MM-DD文字列はそのまま使う（Date化によるタイムゾーンずれを避ける）
  if ( typeof date === 'string' ) {
    return date.slice(0, 10);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const normalizeDescription = (text) => {
  return String(text || '').normalize('NFKC');
};

// 摘要から学習ルール照合用の正規化文字列を作る。
// 「デビット」のような銀行の体裁語は経理的に鍵にならないため、テンプレート
// （数字の'#'置換）は使わない。NFKC正規化＋空白潰しの完全一致で覚える
// （店名や番号の違いで別取引になるべきものが別扱いになる）
export const makePattern = (text) => {
  return normalizeDescription(text).replace(/[\s\u3000]+/g, '') || '';
};

// 学習ルールを作成・更新する（upsert）。同じ口座×摘要パターンのルールが
// あれば適用回数を進め、なければ作る。学習は伝票起票の副作用として行い、
// 失敗しても起票自体は失敗させない。
// financialId: ルールの紐付先 口座（Financial）。口座が登録されていない
// 取り込みは学習しない（ルールは口座単位の施行データだが、Financialは
// 次年度以降も使う「現役ルール」として口座に紐づく）
// direction: 'out'(出金)/'in'(入金)。同じ摘要でも入金と出金で相手方が
// 異なることがある（代理店的な取引先）ため、ルールは方向単位で作る。
// direction省略は指定なし(null)=両方向に照合する旧来の書き方
export const learnOpposite = async (financialId, application1, oppositeSide, direction = null) => {
  try {
    const pattern = makePattern(application1);
    if ( ( !pattern ) || ( !financialId ) ||
      ( !oppositeSide ) || ( !oppositeSide.account ) ||
      // 仮入科目は実科目として扱えない（仮で起票した仕訳は学習しない）
      isTempAccount(oppositeSide.account) ) {
      return;
    }
    // opposite側の書き方差（sub / subAccount）を吸収する（key不一致だと
    // subAccount条件がundefinedになり、補助違いの兄弟ルールを
    // 踏む事故になる）
    const oppositeSub = ( oppositeSide.sub !== undefined ) ? oppositeSide.sub : ( oppositeSide.subAccount || null );
    // directionの受け皿。想定外の値はnullに落とす
    const dir = ( direction === 'out' || direction === 'in' ) ? direction : null;
    const where = {
      financialId: financialId,
      pattern: pattern,
      // 旧ルール(direction null。任意方向)はこのlevelでは照合しない:
      // 学習の更新は「同方向のルール」に向ける（もしなければ新規作成。
      // 旧ルールはfindLearnedRuleからだけで参照される）
      direction: dir
    };
    const existing = await models.BankStatementRule.findOne({ where: where });
    if ( existing ) {
      existing.oppositeAccount = oppositeSide.account;
      // 補助の「下げ」（既存のルールが補助を持っていて、新しい事実が補助なし）
      // は学習しない。再実行で起票した補助なし伝票の学習が、手修正で入れた
      // 補助付きの学習を消してしまうのを防ぐ（値の変更・追加は上書きする）
      if ( oppositeSub || !existing.oppositeSubAccount ) {
        existing.oppositeSubAccount = oppositeSub || null;
      }
      existing.usageCount += 1;
      await existing.save();
    } else {
      await models.BankStatementRule.create({
        ...where,
        oppositeAccount: oppositeSide.account,
        oppositeSubAccount: oppositeSub || null,
        usageCount: 1
      });
    }
  } catch (e) {
    console.log('learnOpposite failed', e.message);
  }
};

// 伝票入力からの学習。銀行科目（預金系101xxx）を含む伝票行の摘要と
// 相手方科目からルールを蓄積する（createCrossSlip/updateCrossSlipから呼ぶ）
// 学習ルールの紐付先口座を(科目+補助)から引く（法的な解決は1か所）。
// 学習は口座単位なので、伝票の銀行側科目から通帳(Financial)を突き止める
const findFinancialBySide = async (account, subAccount) => {
  return models.Financial.findOne({
    where: {
      accountCode: account,
      subAccountCode: subAccount || null
    }
  });
};

export const learnFromSlip = async (slip) => {
  try {
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id }
    });
    for ( const detail of details ) {
      let bankSide = null;
      let oppositeSide = null;
      let direction = null;
      if ( /^101/.test(detail.debitAccount || '') ) {
        // 銀行が借方=入金
        bankSide = { account: detail.debitAccount, sub: detail.debitSubAccount };
        oppositeSide = { account: detail.creditAccount, sub: detail.creditSubAccount };
        direction = 'in';
      } else if ( /^101/.test(detail.creditAccount || '') ) {
        // 銀行が貸方=出金
        bankSide = { account: detail.creditAccount, sub: detail.creditSubAccount };
        oppositeSide = { account: detail.debitAccount, sub: detail.debitSubAccount };
        direction = 'out';
      }
      if ( !oppositeSide ) continue;
      const financial = await findFinancialBySide(bankSide.account, bankSide.sub);
      if ( !financial ) {
        // 口座登録のない科目からの起票は学習しない（ルールは口座単位）
        continue;
      }
      await learnOpposite(financial.id, detail.application1, oppositeSide, direction);
    }
  } catch (e) {
    console.log('learnFromSlip failed', e.message);
  }
};

// 銀行明細の行を既存の仕訳明細と突合する。
// 口座（勘定科目+補助科目）の仕訳明細のうち、金額が一致し伝票日付が
// ±days 日以内のものを対応付ける（すでに別行の突合先になっている明細は除く）。
export const autoMatch = async (statement, options = {}) => {
  const days = ( options.days === undefined ) ? 3 : options.days;
  // 自動突合は「許可された摘要」だけが対象（口座のルール match=true の
  // 完全一致ホワイトリスト。リストに無い摘要は手動で扱う。定額請求などで
  // 同一金額が乱造される世界で、緩い自動結合が誤結合を起こさないように）
  const allowedPatterns = ( statement.financialId ) ?
    new Set(( await models.BankStatementRule.findAll({
      where: { financialId: statement.financialId, match: true },
      raw: true
    }) ).map((r) => r.pattern)) : new Set();
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, status: 'unmatched' }
  });
  if ( lines.length === 0 ) {
    return { matched: 0 };
  }
  // 突合先として既に使われている仕訳明細は対象外
  const used = await models.BankStatementLine.findAll({
    where: { crossSlipDetailId: { [Op.ne]: null } },
    attributes: [ 'crossSlipDetailId' ]
  });
  const usedIds = new Set(used.map((l) => l.crossSlipDetailId));
  const account = statement.account;
  const subAccount = statement.subAccount;
  const details = await models.CrossSlipDetail.findAll({
    include: [{ model: models.CrossSlip, as: 'crossSlip' }],
    where: {
      [Op.or]: [
        { creditAccount: account, creditSubAccount: subAccount || null },
        { debitAccount: account, debitSubAccount: subAccount || null }
      ]
    }
  });
  let matched = 0;
  for ( const line of lines ) {
    // 銀行から見て出金（貸方側に銀行が立つ明細）か入金（借方側）かで照合面を変える
    const isOut = ( line.amountOut !== null && line.amountOut !== undefined );
    const targetAmount = isOut ? line.amountOut : line.amountIn;
    if ( targetAmount === null || targetAmount === undefined || !line.date ) {
      continue;
    }
    // 許可リストに無い摘要は自動突合の対象にしない
    if ( !allowedPatterns.has(makePattern(line.rawDescription)) ) {
      continue;
    }
    const candidates = details.filter((detail) => {
      if ( usedIds.has(detail.id) ) return false;
      const amount = isOut ? detail.creditAmount : detail.debitAmount;
      if ( Number(amount) !== Number(targetAmount) ) return false;
      const sideAccount = isOut ? detail.creditAccount : detail.debitAccount;
      const sideSub = isOut ? detail.creditSubAccount : detail.debitSubAccount;
      if ( sideAccount !== account || ( sideSub || null ) !== ( subAccount || null ) ) return false;
      const slip = detail.crossSlip;
      if ( !slip ) return false;
      const slipDate = new Date(slip.year, slip.month - 1, slip.day);
      return dayDiff(slipDate, line.date) <= days;
    });
    if ( candidates.length === 0 ) {
      continue;
    }
    // 日付が最も近い明細を採用する
    candidates.sort((a, b) => {
      const da = dayDiff(new Date(a.crossSlip.year, a.crossSlip.month - 1, a.crossSlip.day), line.date);
      const db = dayDiff(new Date(b.crossSlip.year, b.crossSlip.month - 1, b.crossSlip.day), line.date);
      return da - db;
    });
    line.status = 'matched';
    line.crossSlipDetailId = candidates[0].id;
    await line.save();
    usedIds.add(candidates[0].id);
    matched ++;
  }
  return { matched: matched };
};

// 銀行明細のうちカード引落と思われる行を、法人カード明細（支払総額・支払日）と照合する。
// 総額一致+支払日が行日付の±days以内で候補とする。起票に必要な未払金の
// 科目はカード明細のプロファイル（paymentAccount/paymentSubAccount）から取る。
export const suggestCardPayments = async (statement, profiles = null) => {
  const {loadProfiles} = await import('./bank-statement.js');
  const allProfiles = profiles || loadProfiles();
  const cards = await models.BankStatement.findAll({
    where: { kind: 'corporate_card' }
  });
  if ( cards.length === 0 ) {
    return [];
  }
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, status: 'unmatched' }
  });
  const suggestions = [];
  for ( const line of lines ) {
    const desc = normalizeDescription(line.rawDescription);
    for ( const card of cards ) {
      const cardName = ( card.cardName || '' ).normalize('NFKC');
      if ( !cardName || !desc.includes(cardName) ) {
        continue;
      }
      const diff = card.payDate ? dayDiff(new Date(card.payDate), line.date) : 999;
      if ( Number(card.total) === Number(line.amountOut) && diff <= 3 ) {
        const profile = allProfiles.find((p) => ( p.name === cardName || ( p.cardName || '' ).includes(cardName) ));
        suggestions.push({
          lineId: line.id,
          cardStatementId: card.id,
          payDate: card.payDate,
          total: card.total,
          debitAccount: ( profile && profile.paymentAccount ) || null,
          debitSubAccount: ( profile && profile.paymentSubAccount ) || null
        });
      }
    }
  }
  return suggestions;
};

// 利息行の仕訳（受取利息+源泉所得税+普通預金）。
// 源泉徴収額の決め方:
// - 同じ日の「国税」明細行（category=tax。国税=源泉徴収額が別行として載る
//   通帳向け）があればその出金額を源泉額にする。このとき利息行の金額は
//   税込（総額）として扱うので、普通預金の借方は「利息額−源泉額」になる
// - 国税行がなければ利息行の金額を税引後とみなし、源泉率から税抜額を逆算する
// 源泉額が丸めて0になる場合は受取利息のみの1行（2側）にする。
const buildInterestDetails = async (line, statement, profile, taxLine = null) => {
  const conf = { ...INTEREST_DEFAULTS, ...( ( profile && profile.interest ) || {} ) };
  const amountIn = Number(( line.amountIn !== null && line.amountIn !== undefined ) ? line.amountIn : line.amountOut);
  let gross;
  let withheld;
  if ( taxLine ) {
    gross = amountIn;
    withheld = Number(taxLine.amountOut) || 0;
  } else {
    // 国税行がなければ明細の利息額を税引後とみなし、源泉率から税抜額を逆算する
    const rate = conf.rate;
    gross = rate > 0 ? Math.round(amountIn / ( 1 - rate )) : amountIn;
    withheld = gross - amountIn;
  }
  const net = gross - withheld;
  const date = line.date || toDateString(new Date());
  // 源泉所得税の科目は補助科目「源泉」（key=gensen）を既定とする。
  // プロファイルに withholding.account/subAccount があればそれを使う
  let withholdingAccount = conf.account || null;
  let withholdingSubAccount = conf.subAccount || null;
  if ( !withholdingAccount ) {
    const sub = await models.SubAccount.findOne({ where: { key: 'gensen' } });
    if ( sub ) {
      const account = await models.Account.findByPk(sub.accountId);
      withholdingAccount = account ? account.accountCode : null;
      withholdingSubAccount = sub.subAccountCode;
    }
  }
  const bankSide = {
    debitAccount: statement.account,
    debitSubAccount: statement.subAccount,
    debitAmount: net,
    debitTax: 0,
    creditAccount: conf.incomeAccount,
    creditAmount: net
  };
  const details = [ bankSide ];
  if ( withheld > 0 && withholdingAccount ) {
    // 伝票は借貸ペアで構成するため、源泉分を「借方 源泉所得税 / 貸方 受取利息」
    // の独立行にする（受取利息の貸方合計が税抜額になる）
    const gensenDetail = {
      debitAccount: withholdingAccount,
      debitSubAccount: withholdingSubAccount,
      debitAmount: withheld,
      debitTax: 0,
      creditAccount: conf.incomeAccount,
      creditAmount: withheld
    };
    // 国税行がソースならその行をこの明細に対応させる
    if ( taxLine ) {
      gensenDetail.statementLineId = taxLine.id;
    }
    details.push(gensenDetail);
  }
  for ( const detail of details ) {
    if ( detail.statementLineId === undefined ) {
      detail.statementLineId = line.id;
    }
    detail.creditTax = 0;
    detail.creditTaxRuleId = null;
    detail.creditSubAccount = null;
    detail.debitTaxRuleId = null;
    detail.application1 = line.description || '利息';
    detail._date = date;
  }
  return details;
};

// 学習ルールを摘要パターンで引く（bookLinesの相手方指定が無い行向け）。
// 正規化後の完全一致。口座単位（subAccountはnull許容）＋方向（'in'/'out'。
// direction null の旧ルールは両方向に照合する）。
// 口座補助（住信SBIなど）が一致するルールを最優先にする。補助なしの
// 口座のルールから、摘要に一致するものを引く（メモリ内選択）。
// 方向なしの旧ルール（両方向に照合する）があれば同方向の次に優先。
// 補助の分離は口座（Financial）が担うのでルール側の判定はここまで
const findLearnedRule = (rules, application1, direction = null) => {
  const pattern = makePattern(application1);
  if ( !pattern ) {
    return null;
  }
  const candidates = rules
    .filter((r) => ( r.pattern === pattern ))
    .filter((r) => ( !r.direction || r.direction === direction ))
    .sort((a, b) => ( ( b.usageCount || 0 ) - ( a.usageCount || 0 ) ));
  return candidates[ 0 ] || null;
};

// 通常の経費行の仕訳。借方=支払先マッピングの科目、貸方=明細の口座。
// bookings で debitAccount/debitSubAccount の直指定もできる（カード引落の決済等）。
// 通常の明細行の仕訳。借貸の向きは行の入出金で決まる:
// 出金行（amountOut）= 借方 相手方 / 貸方 明細の口座（経費支出）
// 入金行（amountIn）  = 借方 明細の口座 / 貸方 相手方（売上等の収入）
// 相手方は booking.oppositeAccount（+oppositeSubAccount）か、旧形式の
// payeeMappingId/debitAccount で指定する。指定がなければ学習ルールを引く。
// それでも決まらなければ仮入科目（出金仮/入金仮）で起票し、後の処理で
// 他の証憑との突合によって差し替える（仮科目の仕訳は学習しない）。
// detail に statementLineId を入れて、起票済み伝票の更新で紐付けを復元できるようにする
const buildLineDetails = async (line, statement, booking, options = {}) => {
  // 適用して保存: ユーザーが選んだルールがあればusageCountに頼らずそれを使う
  const forcedRule = options.forcedRule || null;
  // カード系の行は利用額(amount)のみ。金額カラムの見た目は「出金」
  const isCard = ( statement.kind === 'corporate_card' );
  const isOut = ( line.amountOut !== null && line.amountOut !== undefined ) ||
    ( isCard && line.amount !== null && line.amount !== undefined );
  const amount = Number(isOut ? ( ( line.amountOut !== null && line.amountOut !== undefined ) ? line.amountOut : line.amount ) : line.amountIn);
  let oppositeAccount = booking.oppositeAccount || booking.debitAccount || null;
  let oppositeSubAccount = ( booking.oppositeSubAccount !== undefined ) ?
    booking.oppositeSubAccount : booking.debitSubAccount || null;
  let application1 = line.description || line.rawDescription;
  if ( booking.payeeMappingId ) {
    const mapping = await models.ExpenseMapping.findByPk(booking.payeeMappingId);
    if ( !mapping || !mapping.account ) {
      const err = new Error(`支払先マッピング(id=${booking.payeeMappingId})に勘定科目が設定されていません。`);
      err.name = 'BankReconcileError';
      throw err;
    }
    oppositeAccount = mapping.account;
    oppositeSubAccount = mapping.subAccount || null;
    application1 = line.description || mapping.name;
  }
  // 口座の勘定科目は、statementの写し（account）が無ければ口座(Financial)から引く
  const bankAccount = statement.account || ( ( statement.financial ) ? statement.financial.accountCode : null );
  if ( !bankAccount ) {
    const err = new Error(`${line.lineNo}行目の明細に口座（勘定科目）が設定されていません。`);
    err.name = 'BankReconcileError';
    throw err;
  }
  const bankSide = {
    account: bankAccount,
    subAccount: statement.subAccount
  };
  // この行の貸方。ルールに貸方の指定があればそれ、なければ口座の科目
  let creditAccount = null;
  let creditSubAccount = null;
  // この口座のルール（bookLinesから一括で渡る）
  const financialRules = options.financialRules || [];
  let oppositeSide = null;
  if ( !oppositeAccount ) {
    // ルールも指定もない → 学習ルールを引き、それも無ければ仮入科目で起票する
    const rule = ( forcedRule && makePattern(forcedRule.pattern) === makePattern(application1) ) ?
      forcedRule : findLearnedRule(financialRules, application1, isOut ? 'out' : 'in');
    if ( rule && !isTempAccount(rule.oppositeAccount) ) {
      oppositeAccount = rule.oppositeAccount;
      oppositeSubAccount = rule.oppositeSubAccount || null;
      // ルールに貸方の指定があれば口座の科目の代わりにそれを使う
      // （キャッシングリボ→短期借入金など。指定なしなら口座の科目）
      if ( rule.creditAccount ) {
        creditAccount = rule.creditAccount;
        creditSubAccount = rule.creditSubAccount || null;
      }
      if ( options.onRule ) {
        options.onRule(rule);
      }
    }
  }
  if ( !oppositeAccount ) {
    oppositeAccount = isOut ? TEMP_ACCOUNTS.OUT : TEMP_ACCOUNTS.IN;
    oppositeSubAccount = null;
  }
  oppositeSide = {
    account: oppositeAccount,
    subAccount: oppositeSubAccount
  };
  // 税ルールは出金（経費）側だけ導出する（内税科目のみ。外税は税0で経理が調整）。
  // 仮入科目でのお預かりは税.Rulesを付けない（後の処理での差し替えに任せる）
  const taxRuleId = ( isOut && !isTempAccount(oppositeAccount) ) ?
    await deriveTaxRuleId(oppositeAccount, line.date || new Date()) : null;
  // 実科目で起票するときは学習する（仮入科目は学習対象にしない）。
  // 学習は口座（Financial）単位。口座が登録されている取り込みのみが対象
  if ( statement.financialId && !isTempAccount(oppositeAccount) ) {
    await learnOpposite(statement.financialId, application1, oppositeSide, isOut ? 'out' : 'in');
  }
  // 貸方の指定が未定なら口座の科目。税ルールは貸方の指定があっても借方（経費側）基準
  if ( !creditAccount ) {
    creditAccount = bankSide.account;
    creditSubAccount = bankSide.subAccount;
  }
  const detail = isOut ? {
    debitAccount: oppositeAccount,
    debitSubAccount: oppositeSubAccount,
    debitAmount: amount,
    debitTax: 0,
    debitTaxRuleId: taxRuleId,
    creditAccount: creditAccount,
    creditSubAccount: creditSubAccount,
    creditAmount: amount,
    creditTax: 0,
    creditTaxRuleId: null,
    application1: application1,
    application2: line.memo || null
  } : {
    debitAccount: bankSide.account,
    debitSubAccount: bankSide.subAccount,
    debitAmount: amount,
    debitTax: 0,
    debitTaxRuleId: null,
    creditAccount: oppositeAccount,
    creditSubAccount: oppositeSubAccount,
    creditAmount: amount,
    creditTax: 0,
    creditTaxRuleId: null,
    application1: application1,
    application2: line.memo || null
  };
  detail._date = line.date || null;
  detail.statementLineId = line.id;
  return [ detail ];
};

// 未照合行を一括起票する。
// bookings は null でいい（相手方の決定はルール→仮入科目に落ちる）。
// 合流摘要（merge-rules.yamlに完全一致。手数料など）の行は「前の行と同じ伝票」
// （同じ日が条件）に合流する。該当しない行は行ごとに個別の伝票になる
// （後の処理で行単位に差し替え可能にするため）。
// 利息行（category='interest'）はテンプレ仕訳になる（booking指定は不要）。
// 利息行の次の行が国税（category='tax'。源泉徴収額が別行として載る通帳向け）
// なら、その行を源泉分として飲み込む（自分の伝票にはしない）。
// 伝票は未承認（承認待ち）で作成する。
export const bookLines = async (statement, bookings, user, options = {}) => {
  const profiles = options.profiles || null;
  // 「適用して保存」で選ばれたルール。usageCountに頼らずこれを強制適用する
  // （再実行経由ではoptions.forcedRuleに渡ってくる）
  const forcedRule = options.forcedRule || ( options.applyRuleId ?
    await models.BankStatementRule.findByPk(parseInt(options.applyRuleId, 10)) : null );
  // この口座のルールを一括で読む（合流判定/相手方解決はメモリ内で行う）
  const financialRules = statement.financialId ?
    await models.BankStatementRule.findAll({ where: { financialId: statement.financialId } }) : [];
  const mergePatterns = new Set(financialRules
    .filter((r) => r.merge)
    .map((r) => normalizeText(r.pattern)));
  const profileName = statement.cardName || statement.account;
  const bookingMap = new Map(( bookings || [] ).map((b) => [ Number(b.lineId), b ]));
  const where = { statementId: statement.id };
  let targetIds = ( bookings || [] ).map((b) => Number(b.lineId));
  if ( targetIds.length > 0 ) {
    // 「摘要から適用」(options.includeMergeAfter): 指定行の直後に続く
    // 合流摘要行（同じ日の手数料など）も一緒に起票の対象にする
    // （主取引行だけ載せると、手数料が別伝票で仮起票になってしまう）
    if ( options.includeMergeAfter ) {
      const allLines = await models.BankStatementLine.findAll({
        where: { statementId: statement.id },
        order: [[ 'lineNo', 'ASC' ]]
      });
      for ( const targetId of [ ...targetIds ] ) {
        const target = allLines.find((l) => ( l.id === targetId ));
        if ( !target ) {
          continue;
        }
        const index = allLines.indexOf(target);
        for ( let i = index + 1; i < allLines.length; i ++ ) {
          const follower = allLines[ i ];
          if ( toDateString(follower.date || '') !== toDateString(target.date || '') ) {
            break;
          }
          if ( !isMergeable(follower, mergePatterns) || follower.status !== 'unmatched' ) {
            break;
          }
          if ( !targetIds.includes(follower.id) ) {
            targetIds.push(follower.id);
          }
        }
      }
    }
    where.id = { [Op.in]: targetIds };
  } else {
    // bookings 未指定は全未照合（+伝票削除で迷子になった起票済み）を対象にする
    where[Op.or] = [
      { status: 'unmatched' },
      { status: 'booked', crossSlipDetailId: null }
    ];
  }
  const lines = await models.BankStatementLine.findAll({
    where: where,
    order: [[ 'lineNo', 'ASC' ]]
  });
  if ( lines.length === 0 ) {
    return { slips: [] };
  }
  const profile = profiles && profiles.find((p) => p.name === profileName);
  // 合流摘要の行は「前の行（同じ日）の伝票」に合流する。
  // 前の行がなければ/日付が違えば自分の伝票になる
  const groups = [];
  const bookedIds = [];
  // 利息行の次の行の「国税」（category=tax。源泉徴収額）を飲み込む通帳向け。
  // 飲み込まれた国税行は利息仕訳の源泉明細になり、自分の伝票にはならない
  const consumed = new Set();
  // 国税行のサニティ: 納税の振替が誤って源泉として扱われないよう、
  // 利息額比の小额に限定する（2 x 利息額（下限100円）、上限1万円）
  const pickTaxLine = (interestLine, nextLine) => {
    if ( !nextLine || ( nextLine.category !== 'tax' ) || ( Number(nextLine.amountOut) <= 0 ) ) {
      return null;
    }
    if ( toDateString(interestLine.date || new Date()) !== toDateString(nextLine.date || new Date()) ) {
      return null;
    }
    const net = Number(( interestLine.amountIn !== null && interestLine.amountIn !== undefined ) ?
      interestLine.amountIn : interestLine.amountOut);
    if ( ( Number(nextLine.amountOut) > Math.max(2 * net, 100) ) || ( Number(nextLine.amountOut) >= 10000 ) ) {
      return null;
    }
    return nextLine;
  };
  let prevGroup = null;
  let prevDate = null;
  for ( let idx = 0; idx < lines.length; idx ++ ) {
    const line = lines[ idx ];
    if ( consumed.has(line.id) ) {
      continue;
    }
    const booking = bookingMap.get(line.id) || {};
    let detailEntries = [];
    if ( line.category === 'interest' ) {
      const taxLine = pickTaxLine(line, lines[ idx + 1 ] || null);
      const details = await buildInterestDetails(line, statement, profile, taxLine);
      // 国税行を源泉明細に結び付けられたときだけ、その行を飲み込む
      if ( taxLine && details.some((detail) => ( Number( detail.statementLineId ) === Number( taxLine.id ) )) ) {
        consumed.add(taxLine.id);
        detailEntries = details.map((detail) => (
          { detail: detail, line: ( Number(detail.statementLineId) === Number(taxLine.id) ) ? taxLine : line }
        ));
      } else {
        detailEntries = details.map((detail) => ({ detail: detail, line: line }));
      }
    } else {
      detailEntries = ( await buildLineDetails(line, statement, booking, { forcedRule: forcedRule, financialRules: financialRules }) ).map((detail) => ({ detail: detail, line: line }));
    }
    const key = toDateString(line.date || detailEntries[ 0 ].detail._date || new Date());
    // 完全一致の合流摘要なら前の行（同じ日）の伝票に合流する
    let group = null;
    if ( isMergeable(line, mergePatterns) && prevGroup && ( prevDate === key ) ) {
      group = prevGroup;
    } else {
      group = { date: key, entries: [] };
      groups.push(group);
    }
    for ( const entry of detailEntries ) {
      group.entries.push(entry);
    }
    prevGroup = group;
    prevDate = key;
    if ( !consumed.has(line.id) ) {
      bookedIds.push(line.id);
    }
  }
  const created = [];
  for ( const group of groups ) {
    const [ year, month, day ] = group.date.split('-').map(Number);
    const slip = await createCrossSlip({
      year: year,
      month: month,
      day: day,
      lines: group.entries.map((e) => e.detail)
    }, user, { forceUnapproved: true });
    // 起票した明細を statementLineId で行に対応付ける
    // （1行から2明細になる利息行は同じ行に対応する。1行1明細を優先するため、
    // 同じ行への2つ目以降の対応は上書きしない）
    const processed = new Set();
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    for ( const detail of details ) {
      if ( !detail.statementLineId || processed.has(Number(detail.statementLineId)) ) {
        continue;
      }
      processed.add(Number(detail.statementLineId));
      await models.BankStatementLine.update({
        status: 'booked',
        crossSlipDetailId: detail.id
      }, { where: { id: detail.statementLineId } });
    }
    created.push(slip);
  }
  return { slips: created, bookedIds: bookedIds };
};

// 個人カード明細の選択行を精算書の明細に変換する。
// 科目（payeeMappingId）は選択時に確定していれば添える（未確定なら精算画面で選ぶ）。
export const selectForExpense = async (statement, selections, report, user) => {
  const lineIds = selections.map((s) => Number(s.lineId));
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, id: { [Op.in]: lineIds } }
  });
  const created = [];
  for ( const line of lines ) {
    const selection = selections.find((s) => ( Number(s.lineId) === line.id ));
    if ( line.status === 'booked' || line.status === 'selected' ) {
      continue;
    }
    const reportLine = await models.ExpenseReportLine.create({
      expenseReportId: report.id,
      lineNo: 0,
      paymentDate: line.date || null,
      payeeMappingId: ( selection && selection.payeeMappingId ) || null,
      description: line.description || line.merchant || line.rawDescription,
      amount: Number(line.amount),
      note: `個人カード明細より(${statement.cardName || statement.fileName})`
    });
    // 明細番号を詰め直す（既存の明細の末尾に追加する）
    const count = await models.ExpenseReportLine.count({
      where: { expenseReportId: report.id }
    });
    reportLine.lineNo = count;
    await reportLine.save();
    line.status = 'selected';
    line.expenseReportLineId = reportLine.id;
    await line.save();
    created.push(reportLine);
  }
  return { lines: created };
};

// 仕訳明細が削除・再構築されたときに、それを突合先/起票先としていた
// 取込明細の状態を「未照合」に戻す（伝票を消したのに「起票済」が残るのを防ぐ）
export const releaseStatementLines = async (detailIds) => {
  const ids = ( detailIds || [] ).map(Number).filter((id) => id);
  if ( ids.length === 0 ) {
    return;
  }
  await models.BankStatementLine.update({
    status: 'unmatched',
    crossSlipDetailId: null
  }, {
    where: { crossSlipDetailId: { [Op.in]: ids } }
  });
};

// 未照合行の相手方仕訳の候補を表示用に返す（起票時の仮入科目に置かれる前の
// 判断材料。学習ルールに完全一致する行だけを対象にする）
// 戻り値は {lineId, oppositeAccount, oppositeSubAccount, learned:true} の配列
// ルール候補の生成（承認制）。
// この取り込の行を正規化摘要+方向でグルーピングし、まだルールの無い
// 摘要を候補として返す。相手方の提案は「同じ口座側に載る過去の仕訳明細
// （application1の正規化一致）の最も新しいもの」から引く（判じものではなく
// 候補提示。ユーザーが確認して登録する）
export const suggestRuleCandidates = async (statement) => {
  if ( !statement.financialId ) {
    return [];
  }
  const financial = statement.financial ||
    await models.Financial.findByPk(statement.financialId);
  if ( !financial ) {
    return [];
  }
  const rules = await models.BankStatementRule.findAll({
    where: { financialId: statement.financialId }
  });
  const ruledPatterns = new Set(rules.map((r) => ( r.pattern )));
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id }
  });
  // 未処理の行（未照合・仮起票）だけが候補のネタになる
  const groups = new Map();
  for ( const line of lines ) {
    if ( line.status === 'matched' || line.status === 'ignored' || line.status === 'selected' ) {
      continue;
    }
    const pattern = makePattern(line.rawDescription || line.description);
    if ( !pattern || ruledPatterns.has(pattern) ) {
      continue;
    }
    const isOut = ( line.amountOut !== null && line.amountOut !== undefined ) ||
      ( statement.kind !== 'bank' && line.amount !== null && line.amount !== undefined );
    const key = `${pattern}|${isOut ? 'out' : 'in'}`;
    if ( !groups.has(key) ) {
      groups.set(key, { pattern: pattern, direction: isOut ? 'out' : 'in', count: 0 });
    }
    groups.get(key).count += 1;
  }
  // 提案元: この口座側の科目で載っている過去の仕訳明細（直近300件）。
  // 出金行なら貸方が口座、入金行なら借方が口座
  const recentDetails = await models.CrossSlipDetail.findAll({
    where: {
      [Op.or]: [
        { creditAccount: financial.accountCode },
        { debitAccount: financial.accountCode }
      ]
    },
    order: [[ 'id', 'DESC' ]],
    limit: 300
  });
  const candidates = [];
  for ( const group of groups.values() ) {
    const isOut = ( group.direction === 'out' );
    const sideAccountAttribute = isOut ? 'creditAccount' : 'debitAccount';
    const counterpartAttribute = isOut ? 'debitAccount' : 'creditAccount';
    const counterpartSub = isOut ? 'debitSubAccount' : 'creditSubAccount';
    // 過去の仕訳に同じ摘要があるか（正規化一致）。あればその相手方を提案。
    // **仮起票（仮入科目で載っている未確定の明細）は実績として使わない**
    // （仮を相手方に学習すると、そのルールで永遠に仮のままになる）
    const history = recentDetails.find((detail) => (
      ( detail[sideAccountAttribute] === financial.accountCode ) &&
      makePattern(detail.application1) === group.pattern &&
      detail[counterpartAttribute] &&
      !isTempAccount(detail[counterpartAttribute])
    ));
    candidates.push({
      pattern: group.pattern,
      direction: group.direction,
      count: group.count,
      suggestAccount: history ? history[counterpartAttribute] : null,
      suggestSubAccount: history ? ( history[counterpartSub] || null ) : null
    });
  }
  return candidates;
};

export const suggestOpposites = async (statement, profiles = null) => {
  const learnedRules = statement.financialId ? await models.BankStatementRule.findAll({
    where: {
      financialId: statement.financialId
    },
    order: [[ 'usageCount', 'DESC' ]]
  }) : [];
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, status: 'unmatched' }
  });
  const suggestions = [];
  for ( const line of lines ) {
    const desc = normalizeDescription(line.rawDescription);
    if ( !desc ) continue;
    const pattern = makePattern(desc);
    // 学習候補は方向も一致させる（同摘要でも入金と出金で相手方が違う）
    const lineDirection = ( line.amountOut !== null && line.amountOut !== undefined ) ? 'out' : 'in';
    const learned = learnedRules.find((r) => (
      r.pattern === pattern &&
      ( ( !r.direction ) || ( r.direction === lineDirection ) )
    ));
    if ( learned ) {
      suggestions.push({
        lineId: line.id,
        oppositeAccount: learned.oppositeAccount,
        oppositeSubAccount: learned.oppositeSubAccount,
        learned: true
      });
    }
  }
  return suggestions;
};

// 「後の処理」。仮入科目（出金仮/入金仮）で起票した未承認伝票を、
// 後から入力された実科目の仕訳（請求書・領収書等の経理処理由来）と突合して
// 仮科目を差し替える。デビット・振込は必ず対応する他証憑があるという前提。
// 条件: 金額一致 + 伝票日付が ±days 以内。自動で適用する（完全自動運用）。
// 差し替えたときに「隙あらば学習」する（次回から同じ摘要は正科目で起票できる）。
// 確定（承認済み）伝票・精算書由来伝票は触らない。
export const reconcilePlaceholders = async (options = {}) => {
  const days = ( options.days === undefined ) ? 3 : options.days;
  // 「後の処理」も許可された摘要だけが対象（口座のルール match=true。
  // 「金額一致+±3日」は緩い条件なので、予定外の摘要では誤って結び付けて
  // 別の取引を食う恐れがある。載っていない摘要は手動に回す）。
  // 仮の銀行側（out=credit/in=debit）から口座を解決し、その口座の許可摘要で絞る
  // 仮科目を含む仕訳明細（未承認・精算書由来は除く）
  const tempCandidates = await models.CrossSlipDetail.findAll({
    include: [{ model: models.CrossSlip, as: 'crossSlip' }],
    where: {
      [Op.or]: [
        { debitAccount: TEMP_ACCOUNTS.OUT },
        { creditAccount: TEMP_ACCOUNTS.IN }
      ]
    }
  });
  const temps = [];
  const matchPatternsByFinancial = new Map();
  for ( const detail of tempCandidates ) {
    if ( ( !detail.crossSlip ) || detail.crossSlip.approvedAt || detail.crossSlip.expenseReportId ) {
      continue;
    }
    const isOut = ( detail.debitAccount === TEMP_ACCOUNTS.OUT );
    const financial = await findFinancialBySide(
      isOut ? detail.creditAccount : detail.debitAccount,
      isOut ? detail.creditSubAccount : detail.debitSubAccount
    );
    if ( !financial ) {
      continue;
    }
    if ( !matchPatternsByFinancial.has(financial.id) ) {
      matchPatternsByFinancial.set(financial.id, new Set(
        ( await models.BankStatementRule.findAll({
          where: { financialId: financial.id, match: true },
          raw: true
        }) ).map((r) => r.pattern)
      ));
    }
    if ( matchPatternsByFinancial.get(financial.id).has(makePattern(detail.application1)) ) {
      temps.push(detail);
    }
  }
  if ( temps.length === 0 ) {
    return { replaced: 0 };
  }
  // 差し替えの「来源明細」。既に取込行の突合先・起票先になっている明細は除外する
  // （その明細はすでに銀行側の伝票として存在するため、重複して役目を負わせない）
  const used = await models.BankStatementLine.findAll({
    where: { crossSlipDetailId: { [Op.ne]: null } },
    attributes: [ 'crossSlipDetailId' ]
  });
  const usedIds = new Set(used.map((l) => l.crossSlipDetailId));
  const allDetails = await models.CrossSlipDetail.findAll({
    include: [{ model: models.CrossSlip, as: 'crossSlip' }]
  });
  let replaced = 0;
  for ( const temp of temps ) {
    const isOut = ( temp.debitAccount === TEMP_ACCOUNTS.OUT );
    const amount = Number(isOut ? temp.debitAmount : temp.creditAmount);
    if ( !amount || !temp.crossSlip ) continue;
    const candidates = allDetails.filter((detail) => {
      if ( detail.crossSlip === undefined || detail.crossSlip === null ) return false;
      if ( usedIds.has(detail.id) ) return false;
      if ( isTempAccount(detail.debitAccount) || isTempAccount(detail.creditAccount) ) {
        return false;
      }
      const side = isOut ? 'debit' : 'credit';
      if ( Number(detail[`${side}Amount`]) !== amount ) return false;
      const account = detail[`${side}Account`];
      // 銀行科目や仮科目そのもの、預金系は「実科目」ではない
      if ( !account || isTempAccount(account) || /^101/.test(account) ) return false;
      const slip = detail.crossSlip;
      if ( slip.expenseReportId ) return false;
      const slipDate = new Date(slip.year, slip.month - 1, slip.day);
      const tempDate = new Date(temp.crossSlip.year, temp.crossSlip.month - 1, temp.crossSlip.day);
      return dayDiff(slipDate, tempDate) <= days;
    });
    if ( candidates.length === 0 ) {
      continue;
    }
    // 日付が最も近い明細を採用する
    candidates.sort((a, b) => {
      const da = dayDiff(new Date(a.crossSlip.year, a.crossSlip.month - 1, a.crossSlip.day),
        new Date(temp.crossSlip.year, temp.crossSlip.month - 1, temp.crossSlip.day));
      const db = dayDiff(new Date(b.crossSlip.year, b.crossSlip.month - 1, b.crossSlip.day),
        new Date(temp.crossSlip.year, temp.crossSlip.month - 1, temp.crossSlip.day));
      return da - db;
    });
    const source = candidates[0];
    const side = isOut ? 'debit' : 'credit';
    temp[`${side}Account`] = source[`${side}Account`];
    temp[`${side}SubAccount`] = source[`${side}SubAccount`] || null;
    // 証憑が紐付いた明細であれば、仮起票伝票側にも証憑を残す
    const voucherId = source[`${side}VoucherId`];
    if ( voucherId ) {
      temp[`${side}VoucherId`] = voucherId;
    }
    await temp.save();
    usedIds.add(source.id);
    replaced ++;
    // このままでは学習が効かない（learnFromSlip は伝票作成/更新時フック）ので、
    // 差し替えた時点で摘要→相手方を覚える。学習は口座単位:
    // 仮側の反対（銀行側=101）で口座を引く（カードは203側が口座）
    const sideFinancial = await findFinancialBySide(
      isOut ? temp.creditAccount : temp.debitAccount,
      isOut ? temp.creditSubAccount : temp.debitSubAccount
    );
    if ( sideFinancial ) {
      await learnOpposite(
        sideFinancial.id,
        temp.application1,
        isOut ? { account: source.debitAccount, sub: source.debitSubAccount }
              : { account: source.creditAccount, sub: source.creditSubAccount },
        isOut ? 'out' : 'in'
      );
    }
  }
  return { replaced: replaced };
};

// 「再実行」。ルール追加や手作業修正の後に、取込から起票した未承認伝票を
// 解放して現行ルールで起票し直す。承認済み（確定）伝票・精算書由来伝票・
// 佩戴中（会計年度ロック中）の伝票は決して触らない
export const rebookStatement = async (statement, user, options = {}) => {
  // options.lineId / options.lineIds: 「摘要から適用」用。指定行だけを
  // 解放して再起票する（驚き最小。全文再実行との違い: 「後の処理」を
  // 前置で走らせない）
  const lineIds = ( options.lineIds && Array.isArray(options.lineIds) ) ?
    options.lineIds.map(Number) :
    ( options.lineId ? [ Number(options.lineId) ] : null );
  const where = {
    statementId: statement.id,
    crossSlipDetailId: { [Op.ne]: null },
    status: 'booked'
  };
  if ( lineIds ) {
    where.id = { [Op.in]: lineIds };
  }
  const lines = await models.BankStatementLine.findAll({
    where: where
  });
  const result = { rebooked: 0, skipped: 0 };
  // 解放した行（同一伝票に紐づく他の行=合流仲間もともに解放する）
  const released = new Set();
  for ( const line of lines ) {
    const detail = await models.CrossSlipDetail.findByPk(line.crossSlipDetailId);
    const slip = detail ? await models.CrossSlip.findByPk(detail.crossSlipId) : null;
    if ( !slip ) {
      // 伝票が消えていれば解放だけする
      line.status = 'unmatched';
      line.crossSlipDetailId = null;
      await line.save();
      released.add(line.id);
      continue;
    }
    if ( slip.approvedAt || slip.expenseReportId ) {
      result.skipped ++;
      continue;
    }
    const fy = await models.FiscalYear.findOne({ where: { term: slip.term } });
    if ( fy && isLocked(fy) ) {
      result.skipped ++;
      continue;
    }
    // この伝票に紐づく行をすべて解放する（伝票を消すので、合流された行も
    // 未照合に戻す。指定行と同一伝票の行=合流仲間を含む）
    const slipDetails = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      attributes: [ 'id' ],
      raw: true
    });
    const slipDetailIds = slipDetails.map((d) => d.id);
    // 紐付けをnull化する前に、伝票に紐づく行を採っておく（解放後は引けない）
    const slipLines = await models.BankStatementLine.findAll({
      where: { crossSlipDetailId: { [Op.in]: slipDetailIds } },
      raw: true
    });
    await releaseStatementLines(slipDetailIds);
    for ( const slipLine of slipLines ) {
      released.add(slipLine.id);
    }
    released.add(line.id);
    // 伝票を消す
    await models.CrossSlipDetail.destroy({ where: { crossSlipId: slip.id } });
    await slip.destroy();
    result.rebooked ++;
  }
  // 現行ルールで再起票する（合流も施行される）。行単位のときは解放した行だけ
  // （他の行の伝票に触れない。「後の処理」もここでも前置で走らせない）。
  // 「適用して保存」(options.applyRuleId)では、選ばれたルールを強制適用する
  await bookLines(statement, lineIds ? [ ...released ].map((lineId) => ({ lineId: lineId })) : null, user,
    options.applyRuleId ? { forcedRule: await models.BankStatementRule.findByPk(parseInt(options.applyRuleId, 10)) } : {});
  return result;
};

export default {
  autoMatch: autoMatch,
  suggestCardPayments: suggestCardPayments,
  suggestOpposites: suggestOpposites,
  makePattern: makePattern,
  learnOpposite: learnOpposite,
  learnFromSlip: learnFromSlip,
  bookLines: bookLines,
  selectForExpense: selectForExpense,
  reconcilePlaceholders: reconcilePlaceholders,
  rebookStatement: rebookStatement,
  TEMP_ACCOUNTS: TEMP_ACCOUNTS,
  isTempAccount: isTempAccount
};
