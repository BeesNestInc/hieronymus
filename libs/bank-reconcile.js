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

// mergeRules 未指定のプロファイル向けの既定（摘要パターン。手数料・利息行は
// 同じ日の主取引行の伝票に合流させる）
const DEFAULT_MERGE_PATTERNS = [ '手数料', '利息' ];

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
// 失敗しても起票自体は失敗させない
export const learnOpposite = async (bankSide, application1, oppositeSide) => {
  try {
    const pattern = makePattern(application1);
    if ( ( !pattern ) || ( !bankSide ) || ( !bankSide.account ) ||
      ( !oppositeSide ) || ( !oppositeSide.account ) ||
      ( bankSide.account === oppositeSide.account ) ||
      // 仮入科目は実科目として扱えない（仮で起票した仕訳は学習しない）
      isTempAccount(oppositeSide.account) || isTempAccount(bankSide.account) ) {
      return;
    }
    const where = {
      account: bankSide.account,
      subAccount: bankSide.sub || null,
      pattern: pattern
    };
    const existing = await models.BankStatementRule.findOne({ where: where });
    if ( existing ) {
      existing.oppositeAccount = oppositeSide.account;
      existing.oppositeSubAccount = oppositeSide.sub || null;
      existing.usageCount += 1;
      await existing.save();
    } else {
      await models.BankStatementRule.create({
        ...where,
        oppositeAccount: oppositeSide.account,
        oppositeSubAccount: oppositeSide.sub || null,
        usageCount: 1
      });
    }
  } catch (e) {
    console.log('learnOpposite failed', e.message);
  }
};

// 伝票入力からの学習。銀行科目（預金系101xxx）を含む伝票行の摘要と
// 相手方科目からルールを蓄積する（createCrossSlip/updateCrossSlipから呼ぶ）
export const learnFromSlip = async (slip) => {
  try {
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id }
    });
    for ( const detail of details ) {
      let bankSide = null;
      let oppositeSide = null;
      if ( /^101/.test(detail.debitAccount || '') ) {
        bankSide = { account: detail.debitAccount, sub: detail.debitSubAccount };
        oppositeSide = { account: detail.creditAccount, sub: detail.creditSubAccount };
      } else if ( /^101/.test(detail.creditAccount || '') ) {
        bankSide = { account: detail.creditAccount, sub: detail.creditSubAccount };
        oppositeSide = { account: detail.debitAccount, sub: detail.debitSubAccount };
      }
      if ( !oppositeSide ) continue;
      await learnOpposite(bankSide, detail.application1, oppositeSide);
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
// 正規化後の完全一致。口座単位（subAccountはnull許容）
const findLearnedRule = async (statement, application1) => {
  const pattern = makePattern(application1);
  if ( !pattern || !statement.account ) {
    return null;
  }
  return models.BankStatementRule.findOne({
    where: {
      account: statement.account,
      pattern: pattern,
      [Op.or]: [
        { subAccount: statement.subAccount || null },
        { subAccount: null }
      ]
    },
    order: [[ 'usageCount', 'DESC' ]]
  });
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
  const isOut = ( line.amountOut !== null && line.amountOut !== undefined );
  const amount = Number(isOut ? line.amountOut : line.amountIn);
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
  // 銀行科目（口座）は必須
  if ( !statement.account ) {
    const err = new Error(`${line.lineNo}行目の明細に口座（勘定科目）が設定されていません。`);
    err.name = 'BankReconcileError';
    throw err;
  }
  const bankSide = {
    account: statement.account,
    subAccount: statement.subAccount
  };
  let oppositeSide = null;
  if ( !oppositeAccount ) {
    // ルールも指定もない → 学習ルールを引き、それも無ければ仮入科目で起票する
    const rule = await findLearnedRule(statement, application1);
    if ( rule && !isTempAccount(rule.oppositeAccount) ) {
      oppositeAccount = rule.oppositeAccount;
      oppositeSubAccount = rule.oppositeSubAccount || null;
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
  // 実科目で起票するときは学習する（仮入科目は学習対象にしない）
  if ( !isTempAccount(oppositeAccount) ) {
    await learnOpposite(bankSide, application1, oppositeSide);
  }
  const detail = isOut ? {
    debitAccount: oppositeAccount,
    debitSubAccount: oppositeSubAccount,
    debitAmount: amount,
    debitTax: 0,
    debitTaxRuleId: taxRuleId,
    creditAccount: bankSide.account,
    creditSubAccount: bankSide.subAccount,
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

// mergeRules の1要素を正規化する。
// string（'手数料'）→ {pattern, target:'main'}: 同日の主取引行（その日最初の
// グループ）に合流する。object（{pattern, target}）→ target は合流先の
// category（'interest' 等）。その日そのcategoryの先頭行の伝票に合流する。
// いずれも合流先がなければ自分の伝票になる
const mergeRuleFor = (line, profile) => {
  const desc = normalizeText(line.description || line.rawDescription);
  if ( !desc ) {
    return null;
  }
  const patterns = ( profile && profile.mergeRules ) || DEFAULT_MERGE_PATTERNS;
  for ( const rule of patterns ) {
    const pattern = ( typeof rule === 'string' ) ? rule : ( rule.pattern || '' );
    if ( !pattern ) continue;
    try {
      if ( new RegExp(pattern).test(desc) ) {
        return {
          target: ( typeof rule === 'object' && rule.target ) ? String(rule.target) : 'main'
        };
      }
    } catch (e) {
      // 不正な正規表現は無視する
    }
  }
  return null;
};

// 未照合行を一括起票する。
// bookings は null でいい（相手方の決定はルール→仮入科目に落ちる）。
// mergeRules 該当行（手数料・利息等）は同じ日の合流先伝票に合流する。
// mergeRulesのstringは主取引行（同日最初のグループ）、objectのtargetは
// category指定（同日のそのcategoryの先頭行）。該当しない行は行ごとに
// 個別の伝票になる（後の処理で行単位に差し替え可能にするため）。
// 利息行（category='interest'）はテンプレ仕訳になる（booking指定は不要）。
// 伝票は未承認（承認待ち）で作成する。
export const bookLines = async (statement, bookings, user, options = {}) => {
  const profiles = options.profiles || null;
  const profileName = statement.cardName || statement.account;
  const bookingMap = new Map(( bookings || [] ).map((b) => [ Number(b.lineId), b ]));
  const where = { statementId: statement.id };
  if ( ( bookings || [] ).length > 0 ) {
    where.id = { [Op.in]: bookings.map((b) => Number(b.lineId)) };
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
  // mergeRules 該当行は同じ日の合流先伝票（string=主取引行、target=category指定）に
  // 合流する。主取引行がなければ自分の伝票になる
  const groups = [];
  const groupsByDate = new Map();
  const bookedIds = [];
  // 利息行に同じ日の「国税」行（category=tax。源泉徴収額）が添わる通帳向け。
  // 国税行は利息仕訳の源泉分として飲み込まれ、自分の伝票にはならない
  const taxPool = new Map();
  const consumed = new Set();
  for ( const line of lines ) {
    if ( ( line.category !== 'tax' ) || ( Number(line.amountOut) <= 0 ) ) {
      continue;
    }
    const key = toDateString(line.date || new Date());
    if ( !taxPool.has(key) ) {
      taxPool.set(key, []);
    }
    taxPool.get(key).push(line);
  }
  for ( const pool of taxPool.values() ) {
    pool.sort((a, b) => a.lineNo - b.lineNo);
  }
  // 国税行のサニティ: 納税の振替が誤って源泉として扱われないよう、
  // 利息額叩きの小 Dana 額に限定する(2 x 利息額, 上限1万円)
  const pickTaxLine = (interestLine, key) => {
    const net = Number(( interestLine.amountIn !== null && interestLine.amountIn !== undefined ) ?
      interestLine.amountIn : interestLine.amountOut);
    const candidates = ( taxPool.get(key) || [] ).filter((tax) => (
      !consumed.has(tax.id) &&
      Number(tax.amountOut) <= Math.max(2 * net, 100) &&
      Number(tax.amountOut) < 10000
    ));
    return candidates[ 0 ] || null;
  };
  for ( const line of lines ) {
    if ( consumed.has(line.id) ) {
      continue;
    }
    const booking = bookingMap.get(line.id) || {};
    let detailEntries = [];
    if ( line.category === 'interest' ) {
      const key = toDateString(line.date || new Date());
      const taxLine = pickTaxLine(line, key);
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
      detailEntries = ( await buildLineDetails(line, statement, booking) ).map((detail) => ({ detail: detail, line: line }));
    }
    const key = toDateString(line.date || detailEntries[ 0 ].detail._date || new Date());
    // mergeRulesの合流先を探す。stringルール('main')は同日最初のグループ、
    // target指定は同日のそのcategoryを持つ行から始まるグループ
    const rule = mergeRuleFor(line, profile);
    let group = null;
    if ( rule ) {
      const candidates = groupsByDate.get(key) || [];
      group = candidates.find((g) => ( rule.target === 'main' || g.anchorCategory === rule.target )) || null;
    }
    if ( !group ) {
      group = { date: key, anchorCategory: line.category, entries: [] };
      groups.push(group);
      if ( !groupsByDate.has(key) ) {
        groupsByDate.set(key, []);
      }
      groupsByDate.get(key).push(group);
    }
    for ( const entry of detailEntries ) {
      group.entries.push(entry);
    }
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
export const suggestOpposites = async (statement, profiles = null) => {
  const learnedRules = statement.account ? await models.BankStatementRule.findAll({
    where: {
      account: statement.account,
      [Op.or]: [
        { subAccount: statement.subAccount || null },
        { subAccount: null }
      ]
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
    const learned = learnedRules.find((r) => ( r.pattern === pattern ));
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
  const temps = tempCandidates.filter((detail) => (
    detail.crossSlip && !detail.crossSlip.approvedAt && !detail.crossSlip.expenseReportId
  ));
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
    // 差し替えた時点で摘要→相手方を覚える
    await learnOpposite(
      isOut ? { account: temp.creditAccount, sub: temp.creditSubAccount }
            : { account: temp.debitAccount, sub: temp.debitSubAccount },
      temp.application1,
      isOut ? { account: source.debitAccount, sub: source.debitSubAccount }
            : { account: source.creditAccount, sub: source.creditSubAccount }
    );
  }
  return { replaced: replaced };
};

// 「再実行」。ルール追加や手作業修正の後に、取込から起票した未承認伝票を
// 解放して現行ルールで起票し直す。承認済み（確定）伝票・精算書由来伝票・
// 佩戴中（会計年度ロック中）の伝票は決して触らない
export const rebookStatement = async (statement, user) => {
  const lines = await models.BankStatementLine.findAll({
    where: {
      statementId: statement.id,
      crossSlipDetailId: { [Op.ne]: null },
      status: 'booked'
    }
  });
  const result = { rebooked: 0, skipped: 0 };
  for ( const line of lines ) {
    const detail = await models.CrossSlipDetail.findByPk(line.crossSlipDetailId);
    const slip = detail ? await models.CrossSlip.findByPk(detail.crossSlipId) : null;
    if ( !slip ) {
      // 伝票が消えていれば解放だけする
      line.status = 'unmatched';
      line.crossSlipDetailId = null;
      await line.save();
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
    // 行を解放して伝票を消す
    line.status = 'unmatched';
    line.crossSlipDetailId = null;
    await line.save();
    await models.CrossSlipDetail.destroy({ where: { crossSlipId: slip.id } });
    await slip.destroy();
    result.rebooked ++;
  }
  // 現行ルールで再起票する（mergeRules も施行される）
  await bookLines(statement, null, user);
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
