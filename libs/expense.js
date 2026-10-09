import models from '../models/index.js';
const Op = models.Sequelize.Op;
import * as taxcalc from './tax-calc.js';
import {create as createCrossSlip} from './cross_slip.js';

// 提出者（立替者）から仮払金の補助科目を解決する。
// User → Member → 氏名照合（tradingName / legalName）で仮払金の補助科目（SubAccount）を特定する。
// 仕訳パターン上、仮払金の補助科目は立替者ごとに存在する（例: 1130000/1=生越, 1130000/2=椋）。
const resolveAdvanceSubAccount = async (report, accountCode) => {
  const user = await models.User.findByPk(report.submittedBy, {
    include: [{ model: models.Member, as: 'member' }]
  });
  if ( !user || !user.member ) {
    return null;
  }
  const names = [user.member.tradingName, user.member.legalName].filter((n) => n);
  if ( names.length === 0 ) {
    return null;
  }
  const account = await models.Account.findOne({
    where: { accountCode: accountCode }
  });
  if ( !account ) {
    return null;
  }
  const subs = await models.SubAccount.findAll({
    where: { accountId: account.id }
  });
  for ( const name of names ) {
    // 完全一致（「生越」「生越氏」）の後、氏名の部分一致（補助「生越」⊂ 氏名「生越昌己」等）で照合する
    const sub = subs.find((s) => ( s.name === name ) || ( s.name === `${name}氏` )) ||
      subs.find((s) => ( s.name && ( name.includes(s.name) || s.name.includes(name) ) ));
    if ( sub ) {
      return sub;
    }
  }
  return null;
};

// 勘定科目の税区分（taxClass）から、有効な消費税ルールを導出する。
// 会計知識の無いユーザーに税率を選択させる代わりに、科目が持つ税区分を使う。
// 明細の支払金額は証憑（領収書）の金額、すなわち税込額である。
// そのため内税科目（taxClass 1: 内税抽出）のときだけルールを導出する。
// 外税科目（taxClass 2）は既存の伝票入力が「貸方に税込額を手入力」する前提であり、
// 税込額をそのまま導出すると貸借不一致になるため、ここでは導出しない（税額は0、経理が伝票で調整）。
const deriveTaxRuleId = async (accountCode, date) => {
  const account = await models.Account.findOne({
    where: { accountCode: accountCode }
  });
  if ( !account || ( account.taxClass !== 1 ) ) {
    return null;
  }
  const rules = await models.TaxRule.findAll({
    where: {
      taxClass: account.taxClass,
      [Op.and]: [
        { [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: date } }] },
        { [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: date } }] }
      ]
    },
    order: [[ 'rate', 'DESC' ]]
  });
  return rules.length > 0 ? rules[0].id : null;
};

// 経費精算の明細から仕訳伝票の明細行を組み立てる。
// 借方 = 支払先マッピングの経費科目（+補助科目）、貸方 = 出金元マッピングの科目。
// 出金元が「個人立て替え」（advance=true）の場合、貸方補助科目は提出者から動的に解決する。
const buildSlipLines = async (report, lines) => {
  const mappingIds = [...new Set(
    lines.map((l) => l.payeeMappingId).filter((id) => id)
      .concat(lines.map((l) => l.paymentMappingId).filter((id) => id))
  )];
  const mappings = ( mappingIds.length > 0 ) ?
    await models.ExpenseMapping.findAll({
      where: { id: { [Op.in]: mappingIds } }
    }) : [];
  const voucherIds = [...new Set(lines.map((l) => l.voucherId).filter((id) => id))];
  const vouchers = ( voucherIds.length > 0 ) ?
    await models.Voucher.findAll({
      where: { id: { [Op.in]: voucherIds } },
      include: [{ model: models.VoucherClass, as: 'voucherClass' }]
    }) : [];

  const slipLines = [];
  for ( const line of lines ) {
    if ( !line.amount ) {
      continue;
    }
    const payee = mappings.find((m) => ( m.id == line.payeeMappingId ));
    if ( !payee || !payee.account ) {
      const name = payee ? payee.name : '未選択';
      const err = new Error(`支払先「${name}」のマッピングが未登録です。経理担当者に連絡してください。`);
      err.name = 'ExpenseMappingNotFound';
      throw err;
    }
    const payment = mappings.find((m) => ( m.id == line.paymentMappingId ));
    if ( !payment || !payment.account ) {
      const err = new Error('出金元が未選択、または出金元のマッピングが未登録です。');
      err.name = 'ExpenseMappingNotFound';
      throw err;
    }
    let creditSubAccount = payment.subAccount;
    if ( payment.advance ) {
      const sub = await resolveAdvanceSubAccount(report, payment.account);
      if ( !sub ) {
        const err = new Error('仮払金の補助科目（立替者）を解決できませんでした。提出者に対応する補助科目が登録されているか確認してください。');
        err.name = 'ExpenseSubAccountNotFound';
        throw err;
      }
      creditSubAccount = sub.subAccountCode;
    }
    // 証憑の紐付け先は既存の伝票入力と同じルール:
    // VoucherClass.send が true（差出）なら貸方側、false なら借方側に紐付ける
    const voucher = vouchers.find((v) => ( v.id == line.voucherId ));
    const toCredit = Boolean(voucher && voucher.voucherClass && voucher.voucherClass.send);
    const taxDate = line.paymentDate || report.submittedAt || new Date();
    const taxRuleId = line.taxRuleId || await deriveTaxRuleId(payee.account, taxDate);
    slipLines.push({
      debitAccount: payee.account,
      debitSubAccount: payee.subAccount,
      debitAmount: line.amount,
      debitTax: 0,
      debitVoucherId: toCredit ? null : line.voucherId,
      debitTaxRuleId: taxRuleId,
      creditAccount: payment.account,
      creditSubAccount: creditSubAccount,
      creditAmount: line.amount,
      creditTax: 0,
      creditVoucherId: toCredit ? line.voucherId : null,
      creditTaxRuleId: null,
      application1: line.description,
      application2: line.note
    });
  }
  return slipLines;
};

// 経費精算書の承認時に仕訳伝票を自動起票する。
// 伝票は未承認（承認待ち）で作成され、確定は既存の伝票承認フローで行う。
// 伝票日付は提出日（未入力なら最初の支払日）。
export const createSlipForReport = async (report, lines, approver) => {
  if ( !lines || lines.length === 0 ) {
    const err = new Error('明細がありません。');
    err.name = 'ExpenseValidation';
    throw err;
  }
  let slipLines = await buildSlipLines(report, lines);
  if ( slipLines.length === 0 ) {
    const err = new Error('金額の入力された明細がありません。');
    err.name = 'ExpenseValidation';
    throw err;
  }
  const date = report.submittedAt ?
    new Date(report.submittedAt) :
    ( lines[0].paymentDate ? new Date(lines[0].paymentDate) : new Date() );
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const ctx = await taxcalc.loadTaxContext(year, month);
  if ( !ctx.fy ) {
    const err = new Error('提出日の属する会計年度がありません。');
    err.name = 'ExpenseValidation';
    throw err;
  }
  slipLines = taxcalc.recalcSlipLines(slipLines, ctx);
  const validateErr = taxcalc.validateLines(slipLines, ctx) || taxcalc.validateBalanced(slipLines);
  if ( validateErr ) {
    const err = new Error(validateErr);
    err.name = 'ExpenseValidation';
    throw err;
  }
  const slip = await createCrossSlip({
    year: year,
    month: month,
    day: day,
    lines: slipLines,
    term: ctx.fy.term
  }, approver, { forceUnapproved: true });
  report.crossSlipId = slip.id;
  await report.save();
  return slip;
};

export default {
  createSlipForReport: createSlipForReport
};
