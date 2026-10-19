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
  const date = line.date ? new Date(line.date) : new Date();
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
const buildExpenseDetails = async (line, statement, booking) => {
  const amount = Number(line.amountOut);
  let debitAccount = booking.debitAccount || null;
  let debitSubAccount = booking.debitSubAccount || null;
  let application1 = line.description;
  if ( booking.payeeMappingId ) {
    const mapping = await models.ExpenseMapping.findByPk(booking.payeeMappingId);
    if ( !mapping || !mapping.account ) {
      const err = new Error(`支払先マッピング(id=${booking.payeeMappingId})に勘定科目が設定されていません。`);
      err.name = 'BankReconcileError';
      throw err;
    }
    debitAccount = mapping.account;
    debitSubAccount = mapping.subAccount || null;
    application1 = line.description || mapping.name;
  }
  if ( !debitAccount || !statement.account ) {
    const err = new Error(`${line.lineNo}行目の借方科目（または明細の口座）が未設定です。`);
    err.name = 'BankReconcileError';
    throw err;
  }
  const taxRuleId = await deriveTaxRuleId(debitAccount, line.date || new Date());
  return [{
    debitAccount: debitAccount,
    debitSubAccount: debitSubAccount,
    debitAmount: amount,
    debitTax: 0,
    debitTaxRuleId: taxRuleId,
    creditAccount: statement.account,
    creditSubAccount: statement.subAccount,
    creditAmount: amount,
    creditTax: 0,
    creditTaxRuleId: null,
    application1: application1,
    application2: line.memo || null,
    _date: line.date ? new Date(line.date) : null
  }];
};

// 未照合行を一括起票する。
// bookings: [{lineId, payeeMappingId?, debitAccount?, debitSubAccount?}]
// 利息行（category='interest'）はテンプレ仕訳になる（booking指定は不要）。
// 伝票は行の日付ごとにまとめ、未承認（承認待ち）で作成する。
export const bookLines = async (statement, bookings, user, options = {}) => {
  const profiles = options.profiles || null;
  const profileName = statement.cardName || statement.account;
  const bookingMap = new Map(bookings.map((b) => [ Number(b.lineId), b ]));
  const lines = await models.BankStatementLine.findAll({
    where: {
      statementId: statement.id,
      status: 'unmatched',
      id: { [Op.in]: bookings.map((b) => Number(b.lineId)) }
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
      await buildExpenseDetails(line, statement, booking);
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
      paymentDate: line.date ? toDateString(new Date(line.date)) : null,
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

export default {
  autoMatch: autoMatch,
  suggestCardPayments: suggestCardPayments,
  bookLines: bookLines,
  selectForExpense: selectForExpense
};
