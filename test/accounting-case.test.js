import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import * as taxcalc from '../libs/tax-calc.js';
import {create as createCrossSlip} from '../libs/cross_slip.js';
import {guard} from '../libs/permission.js';
import voucherRoutes from '../routes/api_voucher.js';
import expenseRoutes from '../routes/api_expense_report.js';
import bankRoutes from '../routes/api_bank_statement.js';
import journalRoutes from '../routes/api_journal.js';
import crossSlipRoutes from '../routes/api_cross_slip.js';
import crossSlipDetailRoutes from '../routes/api_cross_slip_detail.js';
import userRoutes from '../routes/api_user.js';

// 経理部員（会計権限あり・承認権限なし）のケーススタディ。原則:
//   1. 全経理データを参照できる
//   2. 全伝票と証憑の投入/修正/削除ができるが、承認はできない
//   3. 承認後はそれに関係するデータは一切操作ができない
// 演繹: 承認済みデータ（とそれが参照するデータ）を変更できるのは
// 承認権限だけ（承認を戻せるのは承認権限だけだから）。

const callHandler = (handler, req) => new Promise((resolve) => {
  const r = {};
  Object.assign(r, {
    status(code) { r._status = code; return r; },
    set() { return r; },
    json(body) { if ( !r._json ) { r._json = body; resolve(r); } },
    send() { resolve(r); }
  });
  Promise.resolve(handler(req, r, () => resolve(r)));
});

const reqFor = (user, params, body, query) => ({
  session: { user: user, term: 1 },
  params: params || {},
  body: body || {},
  query: query || {},
  files: {},
  headers: {}
});

const guardAllowed = (user, path, method) => {
  let called = false;
  const res = {};
  Object.assign(res, {
    status(code) { res._status = code; return res; },
    json() {}
  });
  guard({ session: { user: user }, path: path, method: method, headers: {} }, res, () => { called = true; });
  return called;
};

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

describe('経理部員ケース（test db）', () => {
  let data;
  let accountant;      // 経理部員（会計権限のみ・承認権限なし）
  let rule;
  let lineOf = () => null;
  let othersDraft;     // 承認者が起案した未承認伝票（他人のデータ）
  let ownDraft;        // 経理部員が起案した未承認伝票
  let approvedSlip;    // 承認済み伝票
  let voucherOnSlip;   // 承認済み伝票の明細が参照する証憑（経理部員の自分の証憑）
  let othersVoucher;   // 従業員が登録した証憑
  let employeesReport; // 従業員の精算書
  let bankFinancial;   // 銀行口座（通帳一覧の対比用）
  let slipCountBefore;
  const myVouchers = [];
  const myReports = [];
  const mySlipIds = [];

  before(async () => {
    // 実DB（development等）へのテスト実行は実データを破壊するので禁止
    const dbName = models.sequelize.getDatabaseName();
    if ( !/_test$/.test(dbName) ) {
      throw new Error(`このテストは *_test データベースでのみ実行できます（現在: ${dbName}）。NODE_ENV=test を確認してください`);
    }
    try {
      await models.sequelize.authenticate();
    } catch (e) {
      delete models.sequelize.connectionManager.getConnection;
      models.sequelize.connectionManager.initPools();
      await models.sequelize.authenticate();
    }
    data = await seed();

    // 経理部員: 会計権限あり・承認権限なし
    accountant = await findOrCreate(models.User, {
      name: 'accountant'
    }, {
      name: 'accountant',
      hashPassword: bcrypt.hashSync('secret', 10),
      accounting: true,
      approvable: false,
      fiscalBrowsing: false,
      administrable: false,
      companyManagement: false,
      inventoryManagement: false,
      personnelManagement: false
    });

    // 伝票の明細（e2eと同じ形。税込みの貸借）
    const ctx = await taxcalc.loadTaxContext(2026, 5);
    rule = ctx.taxRules.find((r) => ( r.taxClass === 2 ));
    lineOf = (extra = {}) => ({
      debitAccount: '7000001', debitAmount: 5000, debitTaxRuleId: rule.id,
      creditAccount: '1000001', creditAmount: 5500,
      ...extra
    });

    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 5 } });
    slipCountBefore = ml ? ml.slipCount : 0;
  });

  after(async () => {
    for ( const id of mySlipIds ) {
      await models.CrossSlipDetail.destroy({ where: { crossSlipId: id } });
      await models.CrossSlip.destroy({ where: { id: id } });
    }
    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 5 } });
    if ( ml ) {
      ml.slipCount = slipCountBefore;
      await ml.save();
    }
    for ( const id of myReports ) {
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: id } });
      await models.ExpenseReport.destroy({ where: { id: id } });
    }
    for ( const voucher of myVouchers ) {
      await models.Voucher.destroy({ where: { id: voucher.id } });
    }
    if ( bankFinancial ) {
      await models.BankStatement.destroy({ where: { financialId: bankFinancial.id } });
      await models.Financial.destroy({ where: { id: bankFinancial.id } });
    }
    await models.sequelize.close();
  });

  describe('ケース1: 全経理データを参照できる', () => {
    before(async () => {
      // 他人（承認者）の未承認伝票と、従業員の証憑・精算書を用意する
      othersDraft = await createCrossSlip({
        year: 2026, month: 5, day: 3, term: 1, lines: [ lineOf() ]
      }, data.approver, { forceUnapproved: true });
      mySlipIds.push(othersDraft.id);

      othersVoucher = await models.Voucher.create({
        issueDate: '2026-05-01',
        companyId: data.company.id,
        amount: 1000,
        description: '経理部員ケース: 従業員の証憑',
        createdBy: data.creator.id
      });
      myVouchers.push(othersVoucher);

      employeesReport = await models.ExpenseReport.create({
        submittedBy: data.creator.id,
        submittedAt: new Date(2026, 4, 20),
        companyId: data.company.id,
        purpose: '経理部員ケース: 従業員の精算書',
        createdBy: data.creator.id,
        updatedBy: data.creator.id
      });
      myReports.push(employeesReport.id);

      // 銀行口座（一般ユーザーには出ず、経理部員には見える対比）
      bankFinancial = await models.Financial.create({
        name: '経理部員ケース銀行', kind: 'bank'
      });
    });

    it('会計帳簿はすべて参照できる（日記帳・元帳・残高・試算表・推移表）', () => {
      for ( const path of [
        '/journal/2026/5', '/ledger/1/1000001', '/remaining/1/1000001',
        '/trial-balance', '/changes/1/1000001'
      ] ) {
        assert.isTrue(guardAllowed(accountant, path, 'GET'), path);
      }
    });

    it('日記帳には他人の伝票も出る', async () => {
      const r = await callHandler(journalRoutes.get,
        reqFor(accountant, { year: '2026', month: '5' }));
      const nos = r._json.journal.map((s) => s.no);
      assert.include(nos, othersDraft.no);
    });

    it('証憑一覧には他人の証憑も出る', async () => {
      const r = await callHandler(voucherRoutes.get,
        reqFor(accountant, {}, {}, { month: '2026-05' }));
      const ids = r._json.vouchers.map((v) => v.id);
      assert.include(ids, othersVoucher.id);
    });

    it('経費精算書の一覧には他人の精算書も出る', async () => {
      const r = await callHandler(expenseRoutes.list,
        reqFor(accountant, {}, {}, { type: 'all' }));
      const ids = r._json.map((rep) => rep.id);
      assert.include(ids, employeesReport.id);
    });

    it('口座一覧・学習ルールも参照できる', () => {
      assert.isTrue(guardAllowed(accountant, '/financial', 'GET'));
      assert.isTrue(guardAllowed(accountant, '/bank_statement_rule', 'GET'));
      assert.isTrue(guardAllowed(accountant, '/bank_statement/1', 'GET'));
    });

    it('通帳一覧には銀行口座も出る（一般従業員には出ない口座）', async () => {
      const r = await callHandler(bankRoutes.list, reqFor(accountant));
      const ids = r._json.values.map((v) => v.id);
      assert.include(ids, bankFinancial.id);
    });

    it('ただしユーザー情報（人事データ）は参照できない', async () => {
      assert.isFalse(guardAllowed(accountant, '/users', 'GET'));
      const r = await callHandler(userRoutes.get, reqFor(accountant, { id: data.approver.id }));
      assert.equal(r._status, 403);
    });
  });

  describe('ケース2: 全伝票と証憑の投入/修正/削除ができるが、承認はできない', () => {
    it('伝票を新規起票できる（未承認で登録される）', async () => {
      const r = await callHandler(crossSlipRoutes.post, reqFor(accountant, {}, {
        year: 2026, month: 5, day: 5, term: 1, lines: [ lineOf() ]
      }));
      assert.isOk(r._json.id);
      ownDraft = await models.CrossSlip.findByPk(r._json.id);
      assert.equal(ownDraft.createdBy, accountant.id);
      assert.isNull(ownDraft.approvedAt, '承認権限がないので未承認のまま');
      mySlipIds.push(ownDraft.id);
    });

    it('他人の未承認伝票を修正できる', async () => {
      const r = await callHandler(crossSlipRoutes.update, reqFor(accountant, {}, {
        year: 2026, month: 5, no: othersDraft.no,
        day: 3, lines: [ lineOf() ]
      }));
      assert.equal(r._json.code, 0);
    });

    it('他人の未承認伝票を削除できる', async () => {
      const r = await callHandler(crossSlipRoutes.delete, reqFor(accountant, {}, {
        year: 2026, month: 5, day: 3, no: othersDraft.no
      }));
      assert.equal(r._json.code, 0);
      assert.isNull(await models.CrossSlip.findByPk(othersDraft.id));
    });

    it('自分の未承認伝票を削除できる', async () => {
      const r = await callHandler(crossSlipRoutes.delete, reqFor(accountant, {}, {
        year: 2026, month: 5, day: 5, no: ownDraft.no
      }));
      assert.equal(r._json.code, 0);
    });

    it('他人の証憑を修正できる', async () => {
      const r = await callHandler(voucherRoutes.update, reqFor(accountant,
        { id: othersVoucher.id }, { description: '経理部員による修正' }));
      assert.isOk(r._json.voucher);
      const saved = await models.Voucher.findByPk(othersVoucher.id);
      assert.equal(saved.description, '経理部員による修正');
    });

    it('他人の証憑を削除できる', async () => {
      const r = await callHandler(voucherRoutes.delete, reqFor(accountant,
        { id: othersVoucher.id }));
      assert.isOk(r._json.voucher !== undefined || r._json.code === 0 || r._json.code === undefined);
      assert.isNull(await models.Voucher.findByPk(othersVoucher.id));
    });

    it('伝票の承認はできない（許可表）', () => {
      assert.isFalse(guardAllowed(accountant, '/cross_slip/approve', 'PUT'));
    });

    it('精算書の承認もできない（handler）', async () => {
      const r = await callHandler(expenseRoutes.approve, reqFor(accountant, {},
        { id: employeesReport.id, approvedAt: new Date().toISOString() }));
      assert.equal(r._json.code, -10);
    });

    it('年度の確定も取り消しも管理権限 only（確定は全データを不変にするので）', () => {
      assert.isFalse(guardAllowed(accountant, '/term/1/lock', 'PUT'));
      assert.isFalse(guardAllowed(accountant, '/term/1/unlock', 'PUT'));
    });
  });

  describe('ケース3: 承認後は関係データを一切操作できない', () => {
    before(async () => {
      // 経理部員の自分の証憑を用意し、承認者の承認済み伝票の明細から
      // 参照させる（伝票ビューでの証憑直接紐付け）
      voucherOnSlip = await models.Voucher.create({
        issueDate: '2026-05-10',
        companyId: data.company.id,
        amount: 5000,
        description: '経理部員ケース: 承認済み伝票に載る自分の証憑',
        createdBy: accountant.id
      });
      myVouchers.push(voucherOnSlip);

      approvedSlip = await createCrossSlip({
        year: 2026, month: 5, day: 10, term: 1,
        lines: [ lineOf({ debitVoucherId: voucherOnSlip.id }) ]
      }, data.approver);
      mySlipIds.push(approvedSlip.id);
      const saved = await models.CrossSlip.findByPk(approvedSlip.id);
      assert.ok(saved.approvedAt, '承認者の起票なので承認済み');
      assert.equal(saved.createdBy, data.approver.id);
    });

    it('承認済み伝票は更新できない', async () => {
      const r = await callHandler(crossSlipRoutes.update, reqFor(accountant, {}, {
        year: 2026, month: 5, no: approvedSlip.no,
        day: 10, lines: [ lineOf() ]
      }));
      assert.equal(r._json.code, -2);
    });

    it('承認済み伝票の明細単位の更新もできない（-2で全員拒否）', async () => {
      // PUT /cross-slip-detailは会計権限で許可表を通るが、承認済みは
      // 本体更新と同じく不変。不承認に戻してから直す
      const detail = await models.CrossSlipDetail.findOne({
        where: { crossSlipId: approvedSlip.id }
      });
      const r = await callHandler(crossSlipDetailRoutes.update, reqFor(accountant,
        {}, { id: detail.id, application1: '書き換え' }));
      assert.equal(r._json.code, -2);
      const saved = await models.CrossSlipDetail.findByPk(detail.id);
      assert.notEqual(saved.application1, '書き換え');
    });

    it('承認済み伝票は削除できない', async () => {
      const r = await callHandler(crossSlipRoutes.delete, reqFor(accountant, {}, {
        year: 2026, month: 5, day: 10, no: approvedSlip.no
      }));
      assert.equal(r._json.code, -2);
    });

    it('承認済み伝票が参照する自分の証憑は更新できない', async () => {
      const r = await callHandler(voucherRoutes.update, reqFor(accountant,
        { id: voucherOnSlip.id }, { description: '書き換え' }));
      assert.equal(r._json.code, -10);
    });

    it('承認済み伝票が参照する自分の証憑は削除できない', async () => {
      const r = await callHandler(voucherRoutes.delete, reqFor(accountant,
        { id: voucherOnSlip.id }));
      assert.equal(r._json.code, -10);
      assert.isOk(await models.Voucher.findByPk(voucherOnSlip.id), '証憑は残っている');
    });

    it('承認権限なら承認済み伝票が参照する証憑を操作できる', async () => {
      const r = await callHandler(voucherRoutes.update, reqFor(data.approver,
        { id: voucherOnSlip.id }, { description: '承認者による修正' }));
      assert.isOk(r._json.voucher);
    });

    it('不承認に戻せば経理部員も操作できるようになる（凍結は承認に束ねられている）', async () => {
      // 承認権限者が不承認に戻す
      const r0 = await callHandler(crossSlipRoutes.approve, reqFor(data.approver, {}, {
        year: 2026, month: 5, no: approvedSlip.no, approvedAt: false
      }));
      assert.equal(r0._json.code, 0);
      // 経理部員が伝票を修正できる
      const r1 = await callHandler(crossSlipRoutes.update, reqFor(accountant, {}, {
        year: 2026, month: 5, no: approvedSlip.no,
        day: 10, lines: [ lineOf() ]
      }));
      assert.equal(r1._json.code, 0);
      // 凍結されていた証憑も操作できる
      const r2 = await callHandler(voucherRoutes.update, reqFor(accountant,
        { id: voucherOnSlip.id }, { description: '不承認後の修正' }));
      assert.isOk(r2._json.voucher);
    });
  });
});
