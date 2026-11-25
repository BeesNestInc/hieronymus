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
import crossSlipRoutes from '../routes/api_cross_slip.js';
import companyRoutes from '../routes/api_company.js';
import userRoutes from '../routes/api_user.js';

// 営業のケーススタディ。原則:
//   * 顧客管理ができる（companyManagement）
//   * 在庫管理ができる（inventoryManagement）
//   * 会計や人事のデータにはアクセスできない
// 営業は「従業員でもある」ので、自分の経費精算・証憑は一般従業員と同じく
// 使える（他人の分は見えない）。

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

describe('営業ケース（test db）', () => {
  let data;
  let sales;          // 営業（顧客管理+在庫管理のみ）
  let rule;
  let othersVoucher;  // 従業員の証憑
  let othersReport;    // 従業員の精算書
  let othersDraft;     // 従業員の未承認伝票
  let bankFinancial;  // 銀行口座（見えてはいけない）
  let bankStatement;  // 銀行の取込（見えてはいけない）
  let myCompany;       // 営業が登録した取引先
  let ownVoucher;      // 営業の自分の証憑
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

    // 営業: 顧客管理+在庫管理。会計・承認・人事・AI管理・管理は持たない
    sales = await findOrCreate(models.User, {
      name: 'sales'
    }, {
      name: 'sales',
      hashPassword: bcrypt.hashSync('secret', 10),
      companyManagement: true,
      inventoryManagement: true,
      accounting: false,
      approvable: false,
      fiscalBrowsing: false,
      administrable: false,
      personnelManagement: false,
      personnelBrowsing: false,
      aiManage: false
    });

    const ctx = await taxcalc.loadTaxContext(2026, 7);
    rule = ctx.taxRules.find((r) => ( r.taxClass === 2 ));

    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 7 } });
    slipCountBefore = ml ? ml.slipCount : 0;

    // 他人（従業員）のデータ
    othersVoucher = await models.Voucher.create({
      issueDate: '2026-07-01',
      companyId: data.company.id,
      amount: 1000,
      description: '営業ケース: 従業員の証憑',
      createdBy: data.creator.id
    });
    othersReport = await models.ExpenseReport.create({
      submittedBy: data.creator.id,
      submittedAt: new Date(2026, 6, 15),
      companyId: data.company.id,
      purpose: '営業ケース: 従業員の精算書',
      createdBy: data.creator.id,
      updatedBy: data.creator.id
    });
    myReports.push(othersReport.id);
    othersDraft = await createCrossSlip({
      year: 2026, month: 7, day: 3, term: 1,
      lines: [{
        debitAccount: '7000001', debitAmount: 1000, debitTaxRuleId: rule.id,
        creditAccount: '1000001', creditAmount: 1100
      }]
    }, data.creator);
    mySlipIds.push(othersDraft.id);
    bankFinancial = await models.Financial.create({
      name: '営業ケース銀行', kind: 'bank'
    });
    bankStatement = await models.BankStatement.create({
      kind: 'bank',
      financialId: bankFinancial.id,
      name: '営業ケース銀行 7月'
    });
  });

  after(async () => {
    for ( const id of mySlipIds ) {
      await models.CrossSlipDetail.destroy({ where: { crossSlipId: id } });
      await models.CrossSlip.destroy({ where: { id: id } });
    }
    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 7 } });
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
    if ( myCompany ) {
      await models.Company.destroy({ where: { id: myCompany.id } });
    }
    await models.BankStatement.destroy({ where: { id: bankStatement.id } });
    await models.Financial.destroy({ where: { id: bankFinancial.id } });
    await models.Voucher.destroy({ where: { id: othersVoucher.id } });
    await models.sequelize.close();
  });

  describe('ケース1: 顧客管理ができる', () => {
    it('取引先を登録できる', async () => {
      const r = await callHandler(companyRoutes.post, reqFor(sales, {},
        { name: '営業ケース商事' }));
      assert.isOk(r._json.id);
      myCompany = await models.Company.findByPk(r._json.id);
    });

    it('取引先を更新できる', async () => {
      const r = await callHandler(companyRoutes.update, reqFor(sales,
        { id: myCompany.id }, { name: '営業ケース商事（改）' }));
      assert.isOk(r._json.company || r._json.id);
      const saved = await models.Company.findByPk(myCompany.id);
      assert.equal(saved.name, '営業ケース商事（改）');
    });

    it('取引先を削除できる', async () => {
      const r = await callHandler(companyRoutes.delete, reqFor(sales, {},
        { id: myCompany.id }));
      assert.equal(r._json.code, 0);
      assert.isNull(await models.Company.findByPk(myCompany.id));
    });

    it('案件・取引・品目・プロジェクト（companyManagement）も操作できる', () => {
      assert.isTrue(guardAllowed(sales, '/task', 'GET'));
      assert.isTrue(guardAllowed(sales, '/task', 'POST'));
      assert.isTrue(guardAllowed(sales, '/transaction', 'GET'));
      assert.isTrue(guardAllowed(sales, '/transaction/5', 'PUT'));
      assert.isTrue(guardAllowed(sales, '/item/5', 'POST'));
      assert.isTrue(guardAllowed(sales, '/projects', 'GET'));
      assert.isTrue(guardAllowed(sales, '/project/5', 'PUT'));
      assert.isTrue(guardAllowed(sales, '/labels', 'GET'));
      assert.isTrue(guardAllowed(sales, '/label', 'POST'));
      assert.isTrue(guardAllowed(sales, '/document/5', 'PUT'));
    });
  });

  describe('ケース2: 在庫管理の権限を持つ', () => {
    it('在庫管理フラグが付与されている（在庫APIは未実装・ロードマップ）', () => {
      assert.isTrue(sales.inventoryManagement);
    });
  });

  describe('ケース3: 会計データにはアクセスできない', () => {
    it('会計帳簿はすべて拒否', () => {
      for ( const path of [
        '/journal/2026/7', '/ledger/1/1000001', '/remaining/1/1000001',
        '/trial-balance', '/changes/1/1000001', '/closing/1'
      ] ) {
        assert.isFalse(guardAllowed(sales, path, 'GET'), path);
      }
    });

    it('伝票の読み取り・作成・更新・承認・削除は拒否', () => {
      assert.isFalse(guardAllowed(sales, '/cross_slip/2026/7/1', 'GET'));
      assert.isFalse(guardAllowed(sales, '/cross_slip', 'POST'));
      assert.isFalse(guardAllowed(sales, '/cross_slip', 'PUT'));
      assert.isFalse(guardAllowed(sales, '/cross_slip/approve', 'PUT'));
      // DELETEは表ではANY（handlerが承認/会計/作成者に絞り込む）
      assert.isFalse(guardAllowed(sales, '/cross-slip-detail/5', 'GET'));
      assert.isFalse(guardAllowed(sales, '/cross-slip-detail', 'PUT'));
    });

    it('他人の伝票は削除できない（handler）', async () => {
      const r = await callHandler(crossSlipRoutes.delete, reqFor(sales, {}, {
        year: 2026, month: 7, day: 3, no: othersDraft.no
      }));
      assert.equal(r._json.code, -10);
    });

    it('証憑一覧には他人の証憑は出ない（自分の分だけ）', async () => {
      const r = await callHandler(voucherRoutes.get,
        reqFor(sales, {}, {}, { month: '2026-07' }));
      const ids = r._json.vouchers.map((v) => v.id);
      assert.notInclude(ids, othersVoucher.id);
    });

    it('承認待ち伝票の一覧にも他人の伝票は出ない', async () => {
      const r = await callHandler(crossSlipRoutes.list,
        reqFor(sales, { type: 'not_approved' }));
      const nos = r._json.map((s) => s.no);
      assert.notInclude(nos, othersDraft.no);
    });

    it('精算書の一覧には他人の精算書は出ない', async () => {
      const r = await callHandler(expenseRoutes.list,
        reqFor(sales, {}, {}, { type: 'all' }));
      const ids = r._json.map((rep) => rep.id);
      assert.notInclude(ids, othersReport.id);
    });

    it('通帳一覧には銀行・カード口座は出ない', async () => {
      const r = await callHandler(bankRoutes.list, reqFor(sales));
      const ids = r._json.values.map((v) => v.id);
      assert.notInclude(ids, bankFinancial.id);
    });

    it('銀行の取込明細は読めない（handler）', async () => {
      const r = await callHandler(bankRoutes.get, reqFor(sales,
        { id: bankStatement.id }));
      assert.equal(r._json.code, -10);
    });

    it('取込・突合・学習ルール・口座・年度の操作は拒否', () => {
      assert.isFalse(guardAllowed(sales, '/bank_statement/5/book', 'POST'));
      assert.isFalse(guardAllowed(sales, '/bank_statement/5/settle', 'POST'));
      assert.isFalse(guardAllowed(sales, '/bank_statement_rule', 'GET'));
      assert.isFalse(guardAllowed(sales, '/financial', 'POST'));
      assert.isFalse(guardAllowed(sales, '/term/1', 'PUT'));
      assert.isFalse(guardAllowed(sales, '/karibarai/1', 'GET'));
      assert.isFalse(guardAllowed(sales, '/tax-rule/', 'PUT'));
      assert.isFalse(guardAllowed(sales, '/expense_mapping', 'PUT'));
    });
  });

  describe('ケース4: 人事データにはアクセスできない', () => {
    it('役職員・ユーザー一覧は拒否', () => {
      assert.isFalse(guardAllowed(sales, '/member', 'GET'));
      assert.isFalse(guardAllowed(sales, '/member/5', 'PUT'));
      assert.isFalse(guardAllowed(sales, '/users', 'GET'));
      assert.isFalse(guardAllowed(sales, '/user/5', 'PUT'));
    });

    it('他人のユーザー情報は拒否（handler）', async () => {
      const r = await callHandler(userRoutes.get, reqFor(sales,
        { id: data.approver.id }));
      assert.equal(r._status, 403);
    });

    it('ただし担当者候補（社員のid+名前）は読める（案件・取引の担当選択に必要）', async () => {
      // 案件・取引管理ページの「担当」selectが引いているリスト。
      // id+名前しか返さないので人事データではない（GET /userのid+名前と同じ）
      assert.isTrue(guardAllowed(sales, '/users/member', 'GET'));
      const r = await callHandler(userRoutes.members, reqFor(sales));
      const entry = r._json.users.find((u) => ( u.id === data.creator.id ));
      assert.isOk(entry, '社員の候補が出ている');
      assert.deepEqual(Object.keys(entry).sort(), [ 'id', 'name' ],
        'idと名前以外は返さない');
    });
  });

  describe('ケース5: 従業員としての自分の経費は使える（ハイブリッド）', () => {
    it('自分の証憑を登録できる', async () => {
      const r = await callHandler(voucherRoutes.post, reqFor(sales, {}, {
        issueDate: '2026-07-20',
        companyId: data.company.id,
        amount: 2000,
        description: '営業ケース: 自分の証憑'
      }));
      assert.isOk(r._json.voucher);
      ownVoucher = await models.Voucher.findByPk(r._json.voucher.id);
      assert.equal(ownVoucher.createdBy, sales.id);
      myVouchers.push(ownVoucher);
    });

    it('証憑一覧には自分の証憑は出る', async () => {
      const r = await callHandler(voucherRoutes.get,
        reqFor(sales, {}, {}, { month: '2026-07' }));
      const ids = r._json.vouchers.map((v) => v.id);
      assert.include(ids, ownVoucher.id);
      assert.notInclude(ids, othersVoucher.id);
    });

    it('自分の精算書を作れる', async () => {
      const r = await callHandler(expenseRoutes.post, reqFor(sales, {}, {
        companyId: data.company.id,
        purpose: '営業ケース: 自分の精算書'
      }));
      assert.isOk(r._json.id);
      const report = await models.ExpenseReport.findByPk(r._json.id);
      assert.equal(report.createdBy, sales.id);
      myReports.push(report.id);
    });

    it('他人の証憑・精算書は操作できない', async () => {
      const r = await callHandler(voucherRoutes.update, reqFor(sales,
        { id: othersVoucher.id }, { description: '書き換え' }));
      assert.equal(r._json.code, -10);
      const r2 = await callHandler(expenseRoutes.update, reqFor(sales, {},
        { id: othersReport.id, purpose: '書き換え' }));
      assert.equal(r2._status, 403);
    });
  });
});
