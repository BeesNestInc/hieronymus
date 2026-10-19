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

// 利息仕訳テンプレの既定値（config/banks/*.yaml の interest 設定で上書きできる）
// incomeAccount: 受取利息。withholding: 源泉所得税（借方）。rate: 源泉徴収率
const INTEREST_DEFAULTS = {
  incomeAccount: '8000000',
  rate: 0.15315
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

// 摘要から学習用の正規化テンプレートを作る。
// 空白を潰し、数字連続を'#'に置換する（金額・番号・日付の揺れを吸収し、
// 「振込手数料」「デビット#」のような定型として覚える）
export const makePattern = (text) => {
  const s = normalizeDescription(text).replace(/[\s\u3000]+/g, '');
  if ( !s ) return '';
  return s.replace(/\d+/g, '#');
};

// 学習ルールを作成・更新する（upsert）。同じ口座×摘要パターンのルールが
// あれば適用回数を進め、なければ作る。学習は伝票起票の副作用として行い、
// 失敗しても起票自体は失敗させない
export const learnOpposite = async (bankSide, application1, oppositeSide) => {
  try {
    const pattern = makePattern(application1);
    if ( ( !pattern ) || ( !bankSide ) || ( !bankSide.account ) ||
      ( !oppositeSide ) || ( !oppositeSide.account ) ||
      ( bankSide.account === oppositeSide.account ) ) {
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
// 明細の金額は税引後（受取額）なので、源泉率から税抜額を逆算する。
// 源泉額が丸めて0になる場合は受取利息のみの1行（2側）にする。
const buildInterestDetails = async (line, statement, profile) => {
  const conf = { ...INTEREST_DEFAULTS, ...( ( profile && profile.interest ) || {} ) };
  const net = Number(( line.amountIn !== null && line.amountIn !== undefined ) ? line.amountIn : line.amountOut);
  const rate = conf.rate;
  const gross = rate > 0 ? Math.round(net / ( 1 - rate )) : net;
  const withheld = gross - net;
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
    details.push({
      debitAccount: withholdingAccount,
      debitSubAccount: withholdingSubAccount,
      debitAmount: withheld,
      debitTax: 0,
      creditAccount: conf.incomeAccount,
      creditAmount: withheld
    });
  }
  for ( const detail of details ) {
    detail.creditTax = 0;
    detail.creditTaxRuleId = null;
    detail.creditSubAccount = null;
    detail.debitTaxRuleId = null;
    detail.application1 = line.description || '利息';
    detail._date = date;
  }
  return details;
};

// 通常の経費行の仕訳。借方=支払先マッピングの科目、貸方=明細の口座。
// bookings で debitAccount/debitSubAccount の直指定もできる（カード引落の決済等）。
// 通常の明細行の仕訳。借貸の向きは行の入出金で決まる:
// 出金行（amountOut）= 借方 相手方 / 貸方 明細の口座（経費支出）
// 入金行（amountIn）  = 借方 明細の口座 / 貸方 相手方（売上等の収入）
// 相手方は booking.oppositeAccount（+oppositeSubAccount）か、旧形式の
// payeeMappingId/debitAccount で指定する。起票時に学習ルールを蓄積する
const buildLineDetails = async (line, statement, booking) => {
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
  if ( !oppositeAccount || !statement.account ) {
    const err = new Error(`${line.lineNo}行目の相手方仕訳（または明細の口座）が未設定です。`);
    err.name = 'BankReconcileError';
    throw err;
  }
  const bankSide = {
    account: statement.account,
    subAccount: statement.subAccount
  };
  const oppositeSide = {
    account: oppositeAccount,
    subAccount: oppositeSubAccount
  };
  // 税ルールは出金（経費）側だけ導出する（内税科目のみ。外税は税0で経理が調整）
  const taxRuleId = isOut ? await deriveTaxRuleId(oppositeAccount, line.date || new Date()) : null;
  // 起票のたびに学習する（次回から同じ摘要に相手方仕訳を提案する）
  await learnOpposite(bankSide, application1, oppositeSide);
  return [ isOut ? {
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
    application2: line.memo || null,
    _date: line.date || null
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
    application2: line.memo || null,
    _date: line.date || null
  } ];
};

// 未照合行を一括起票する。
// bookings: [{lineId, oppositeAccount?, oppositeSubAccount?, payeeMappingId?, debitAccount?}]
// 利息行（category='interest'）はテンプレ仕訳になる（booking指定は不要）。
// 伝票は行の日付ごとにまとめ、未承認（承認待ち）で作成する。
export const bookLines = async (statement, bookings, user, options = {}) => {
  const profiles = options.profiles || null;
  const profileName = statement.cardName || statement.account;
  const bookingMap = new Map(bookings.map((b) => [ Number(b.lineId), b ]));
  const lines = await models.BankStatementLine.findAll({
    where: {
      statementId: statement.id,
      id: { [Op.in]: bookings.map((b) => Number(b.lineId)) },
      // 未照合か、伝票削除で迷子になった起票済み（紐付なし）のみ
      [Op.or]: [
        { status: 'unmatched' },
        { status: 'booked', crossSlipDetailId: null }
      ]
    },
    order: [[ 'lineNo', 'ASC' ]]
  });
  if ( lines.length === 0 ) {
    return { slips: [] };
  }
  // 伝票明細を日付ごとにグループ化して起票する
  const groups = new Map();
  const bookedIds = [];
  for ( const line of lines ) {
    const booking = bookingMap.get(line.id) || {};
    const profile = profiles && profiles.find((p) => p.name === profileName);
    const details = ( line.category === 'interest' ) ?
      await buildInterestDetails(line, statement, profile) :
      await buildLineDetails(line, statement, booking);
    const key = toDateString(details[0]._date || new Date());
    if ( !groups.has(key) ) {
      groups.set(key, []);
    }
    for ( const detail of details ) {
      groups.get(key).push({ detail: detail, line: line });
    }
    bookedIds.push(line.id);
  }
  const created = [];
  for ( const [ key, entries ] of groups ) {
    const [ year, month, day ] = key.split('-').map(Number);
    const slip = await createCrossSlip({
      year: year,
      month: month,
      day: day,
      lines: entries.map((e) => e.detail)
    }, user, { forceUnapproved: true });
    // 起票した明細を作成順（lineNo順）で行に対応付ける
    // （利息行は1行から2明細になるが、作成順は entries の順に一致する）
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    for ( let i = 0; i < details.length; i ++ ) {
      await models.BankStatementLine.update({
        status: 'booked',
        crossSlipDetailId: details[ i ].id
      }, { where: { id: entries[ i ].line.id } });
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

// 未照合行の支払先マッピングを摘要から提案する。
// 優先順: ①プロファイルのbookRules（摘要パターン→マッピングkey/id）
//         ②マッピングのkeyが摘要に含まれる  ③マッピング名が摘要に含まれる
// 未照合行の相手方仕訳を提案する。優先順:
//   ①学習ルール（BankStatementRule。摘要パターン完全一致、適用回数順）
//   ②プロファイルのbookRules（摘要パターン→支払先マッピングkey/id）
//   ③支払先マッピングのkey/nameが摘要に含まれる
// 戻り値は {lineId, oppositeAccount, oppositeSubAccount} の配列
export const suggestOpposites = async (statement, profiles = null) => {
  const {loadProfiles} = await import('./bank-statement.js');
  const allProfiles = profiles || loadProfiles();
  const profile = allProfiles.find((p) => ( p.name === statement.profileName ));
  const bookRules = ( profile && profile.bookRules ) || [];
  const payees = await models.ExpenseMapping.findAll({
    where: { kind: 'payee' }
  });
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
    // ①学習ルール
    const learned = learnedRules.find((r) => ( r.pattern === pattern ));
    if ( learned ) {
      suggestions.push({
        lineId: line.id,
        oppositeAccount: learned.oppositeAccount,
        oppositeSubAccount: learned.oppositeSubAccount,
        learned: true
      });
      continue;
    }
    // ②bookRules / ③key・name包含 → 支払先マッピングの科目に解決する
    let mapping = null;
    for ( const rule of bookRules ) {
      try {
        if ( !new RegExp(rule.pattern).test(desc) ) continue;
      } catch (e) {
        continue;
      }
      const hit = payees.find((p) => ( p.key === rule.mappingKey ) ||
        ( String(p.id) === String(rule.mappingKey) ));
      if ( hit ) {
        mapping = hit;
        break;
      }
    }
    if ( !mapping ) {
      mapping = payees.find((p) => ( ( p.key && normalizeDescription(p.key) &&
          desc.includes(normalizeDescription(p.key)) ) ||
        ( p.name && desc.includes(normalizeDescription(p.name)) ) )) || null;
    }
    if ( mapping && mapping.account ) {
      suggestions.push({
        lineId: line.id,
        oppositeAccount: mapping.account,
        oppositeSubAccount: mapping.subAccount || null
      });
    }
  }
  return suggestions;
};

export default {
  autoMatch: autoMatch,
  suggestCardPayments: suggestCardPayments,
  suggestOpposites: suggestOpposites,
  makePattern: makePattern,
  learnOpposite: learnOpposite,
  learnFromSlip: learnFromSlip,
  bookLines: bookLines,
  selectForExpense: selectForExpense
};
