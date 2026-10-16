import models from '../models/index.js';
const Op = models.Sequelize.Op;
import * as taxcalc from './tax-calc.js';
import {create as createCrossSlip} from './cross_slip.js';

// 仮払金の補助科目（立替者）を解決する。
// 1) 出金元マッピング名から照合する（「椋立替」→補助「椋」。提出者と立替者が
//    異なるケース＝他人の立て替えを代行提出するケースに対応）。
// 2) 解決できなければ提出者（従来動作）で照合する。
// User → Member → 氏名照合（tradingName / legalName）で仮払金の補助科目（SubAccount）を特定する。
// 仕訳パターン上、仮払金の補助科目は立替者ごとに存在する（例: 1130000/1=生越, 1130000/2=椋）。
const resolveAdvanceSubAccount = async (report, payment, accountCode) => {
  const account = await models.Account.findOne({
    where: { accountCode: accountCode }
  });
  if ( !account ) {
    return null;
  }
  const subs = await models.SubAccount.findAll({
    where: { accountId: account.id }
  });
  // マッピング名からの照合（「椋立替」「生越立替」等の立替者別マッピング）
  if ( payment && payment.name ) {
    const mappingName = payment.name.replace(/立替|立て替え/g, '').trim();
    const direct = subs.find((s) => ( s.name === mappingName )) ||
      subs.find((s) => ( s.name && ( mappingName.includes(s.name) || s.name.includes(mappingName) ) ));
    if ( direct ) {
      return direct;
    }
  }
  // 提出者からの照合（従来動作: 個人立て替えの自分精算）
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
// 戻り値は伝票行に元明細の情報を添えたもの（分割に使う）:
// { ...slipLine, key: {paymentDate, paymentMappingId}, payeeMappingId, noBundle }
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
      const sub = await resolveAdvanceSubAccount(report, payment, payment.account);
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
    // 分割用の属性を付けて伝票行を返す
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
      application2: line.note,
      // 分割キー（支払日＋出金元）と例外指定
      _paymentDate: line.paymentDate || null,
      _paymentMappingId: line.paymentMappingId,
      _payeeMappingId: line.payeeMappingId,
      _noBundle: Boolean(payee.noBundle),
      // 分割後に「この行がどの伝票に載ったか」を記録するための元明細参照
      _lineId: line.id
    });
  }
  return slipLines;
};

// 明細を伝票の組に分割する。
// 基本キー =（支払日, 出金元マッピング）。noBundle の支払先の行は1行1伝票に分離する。
//支払日が未入力の行は null キーで1つの組にまとめる（伝票日付は提出日を使う）。
const groupLines = (slipLines) => {
  const groups = [];
  const byKey = new Map();
  for ( const line of slipLines ) {
    if ( line._noBundle ) {
      groups.push({ lines: [ line ] });
      continue;
    }
    const key = `${line._paymentDate || ''}|${line._paymentMappingId || ''}`;
    if ( byKey.has(key) ) {
      byKey.get(key).lines.push(line);
    } else {
      const group = { lines: [ line ] };
      byKey.set(key, group);
      groups.push(group);
    }
  }
  return groups;
};

// 経費精算書の承認時に仕訳伝票を自動起票する（明細を支払日×出金元で分割）。
// 伝票は未承認（承認待ち）で作成され、確定は既存の伝票承認フローで行う。
// 伝票日付は組の支払日（未入力なら提出日）。
// 再承認時、未承認の紐付伝票は全て削除して作り直す（伝票番号は変わる）。
// 承認済みの伝票はそのまま残す（削除・再作成はしない）。
// 紐付けは伝票側の expenseReportId（1:n前提の逆FK）で表現する。
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
  const groups = groupLines(slipLines);
  const submittedDate = report.submittedAt ? new Date(report.submittedAt) : new Date();

  // 会計年度・税コンテキスト（各伝票日付で検証するが、参照は提出日付近で共通にする）。
  // 月をまたぐ場合は伝票ごとにctxを作る
  const prepareAndCreate = async (group) => {
    const first = group.lines.find((l) => ( l._paymentDate ));
    const date = first ? new Date(first._paymentDate) : submittedDate;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const ctx = await taxcalc.loadTaxContext(year, month);
    if ( !ctx.fy ) {
      const err = new Error(`${year}/${month} の属する会計年度がありません。`);
      err.name = 'ExpenseValidation';
      throw err;
    }
    const recalc = taxcalc.recalcSlipLines(group.lines.map((l) => {
      const { _paymentDate, _paymentMappingId, _payeeMappingId, _noBundle, ...rest } = l;
      return rest;
    }), ctx);
    const validateErr = taxcalc.validateLines(recalc, ctx) || taxcalc.validateBalanced(recalc);
    if ( validateErr ) {
      const err = new Error(validateErr);
      err.name = 'ExpenseValidation';
      throw err;
    }
    return { year: year, month: month, day: day, lines: recalc, term: ctx.fy.term };
  };

  // 承認者が会計権限を持つ場合は伝票も同時承認する（精算書の承認＝伝票の承認）。
  // 会計権限なしの承認者（上長等）の場合は従来通り未承認のまま残す。
  const simultaneous = Boolean(approver.accounting && approver.approvable);

  // 未承認の紐付伝票は作り直す（削除）。承認済みはそのまま残す
  const existingSlips = await models.CrossSlip.findAll({
    where: { expenseReportId: report.id }
  });
  for ( const slip of existingSlips ) {
    if ( slip.approvedAt ) {
      continue;
    }
    await models.CrossSlipDetail.destroy({
      where: { crossSlipId: slip.id }
    });
    await slip.destroy();
  }

  const created = [];
  for ( const group of groups ) {
    const sourceLineIds = group.lines.map((l) => ( l._lineId )).filter((id) => ( id ));
    const body = await prepareAndCreate(group);
    const slip = await createCrossSlip({
      ...body,
      expenseReportId: report.id
    }, approver, { forceUnapproved: !simultaneous });
    // 明細行に「どの伝票に載ったか」を記録する（伝票単位のグループ表示用）
    if ( sourceLineIds.length > 0 ) {
      await models.ExpenseReportLine.update({
        crossSlipId: slip.id
      }, {
        where: { id: { [Op.in]: sourceLineIds } }
      });
    }
    created.push(slip);
  }
  return { slips: created, slipApproved: simultaneous, reuse: false };
};

export default {
  createSlipForReport: createSlipForReport
};
