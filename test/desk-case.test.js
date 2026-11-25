import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import * as taxcalc from '../libs/tax-calc.js';
import {create as createCrossSlip} from '../libs/cross_slip.js';
import {guard} from '../libs/permission.js';
import voucherRoutes from '../routes/api_voucher.js';
import expenseRoutes from '../routes/api_expense_report.js';
import journalRoutes from '../routes/api_journal.js';
import crossSlipRoutes from '../routes/api_cross_slip.js';
import companyRoutes from '../routes/api_company.js';
import memberRoutes from '../routes/api_member.js';
import userRoutes from '../routes/api_user.js';

// 経理デスク（経理の偉い人）のケーススタディ。原則:
//   * 承認ができる
//   * 全会計データにアクセスできる
//   * 顧客情報が操作できる
//   * 人事情報の参照ができる
// できてはいけない: AI環境（aiManage）・人事の操作（personnelManagement）・
// 在庫（inventoryManagement）
// フラグ構成: 会計+承認+顧客管理+人事閲覧

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

describe('経理デスクケース（test db）', () => {
  let data;
  let desk;          // 経理デスク（会計+承認+顧客管理+人事閲覧）
  let rule;
  let lineOf = () => null;
  let draftSlip;    // 従業員が起票した未承認伝票
  let draftVoucher; // 承認済み伝票が参照する証憑（従業員の投入）
  let myCompany;    // デスクが作った取引先
  let myMember;     // 人事参照用の役職員
  let slipCountBefore;
  const myVouchers = [];
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

    // 経理デスク: 会計+承認+顧客管理+人事閲覧。
    // 管理・人事管理・AI管理・在庫管理は持たない
    desk = await findOrCreate(models.User, {
      name: 'desk'
    }, {
      name: 'desk',
      hashPassword: bcrypt.hashSync('secret', 10),
      accounting: true,
      approvable: true,
      companyManagement: true,
      personnelBrowsing: true,
      administrable: false,
      fiscalBrowsing: false,
      personnelManagement: false,
      inventoryManagement: false,
      aiManage: false
    });

    const ctx = await taxcalc.loadTaxContext(2026, 6);
    rule = ctx.taxRules.find((r) => ( r.taxClass === 2 ));
    lineOf = (extra = {}) => ({
      debitAccount: '7000001', debitAmount: 5000, debitTaxRuleId: rule.id,
      creditAccount: '1000001', creditAmount: 5500,
      ...extra
    });

    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 6 } });
    slipCountBefore = ml ? ml.slipCount : 0;
  });

  after(async () => {
    for ( const id of mySlipIds ) {
      await models.CrossSlipDetail.destroy({ where: { crossSlipId: id } });
      await models.CrossSlip.destroy({ where: { id: id } });
    }
    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 6 } });
    if ( ml ) {
      ml.slipCount = slipCountBefore;
      await ml.save();
    }
    for ( const voucher of myVouchers ) {
      await models.Voucher.destroy({ where: { id: voucher.id } });
    }
    if ( myCompany ) {
      await models.Company.destroy({ where: { id: myCompany.id } });
    }
    if ( myMember ) {
      await models.Member.destroy({ where: { id: myMember.id } });
    }
    await models.sequelize.close();
  });

  describe('ケース1: 承認ができる', () => {
    before(async () => {
      // 従業員の証憑が載った未承認伝票（従業員は承認権限を持たないので
      // 起票は必ず未承認になる）
      draftVoucher = await models.Voucher.create({
        issueDate: '2026-06-01',
        companyId: data.company.id,
        amount: 5000,
        description: '経理デスクケース: 従業員の証憑',
        createdBy: data.creator.id
      });
      myVouchers.push(draftVoucher);

      draftSlip = await createCrossSlip({
        year: 2026, month: 6, day: 3, term: 1,
        lines: [ lineOf({ debitVoucherId: draftVoucher.id }) ]
      }, data.creator);
      mySlipIds.push(draftSlip.id);
      assert.isNotOk(draftSlip.approvedAt, '承認権限のない起票は未承認');
    });

    it('伝票の承認は許可表を通る', () => {
      assert.isTrue(guardAllowed(desk, '/cross_slip/approve', 'PUT'));
    });

    it('他人の未承認伝票を承認できる', async () => {
      const r = await callHandler(crossSlipRoutes.approve, reqFor(desk, {}, {
        year: 2026, month: 6, no: draftSlip.no,
        approvedAt: new Date().toISOString()
      }));
      assert.equal(r._json.code, 0);
      const saved = await models.CrossSlip.findByPk(draftSlip.id);
      assert.ok(saved.approvedAt);
      assert.equal(saved.approvedBy, desk.id);
    });

    it('精算書の承認も（権限ゲートを）通る', async () => {
      // 実在しない精算書。承認権限チェック(-10)を通過した上で
      // record not found(-1)になることで、承認権があることを検証する
      const r = await callHandler(expenseRoutes.approve, reqFor(desk, {},
        { id: 999999, approvedAt: new Date().toISOString() }));
      assert.equal(r._json.code, -1);
    });

    it('承認済み伝票が参照する証憑は承認権限なので操作できる（原則の帰結）', async () => {
      const r = await callHandler(voucherRoutes.update, reqFor(desk,
        { id: draftVoucher.id }, { description: 'デスクによる修正' }));
      assert.isOk(r._json.voucher);
    });

    it('不承認→修正→再承認のサイクルが回る', async () => {
      const r0 = await callHandler(crossSlipRoutes.approve, reqFor(desk, {}, {
        year: 2026, month: 6, no: draftSlip.no, approvedAt: null
      }));
      assert.equal(r0._json.code, 0);
      const r1 = await callHandler(crossSlipRoutes.update, reqFor(desk, {}, {
        year: 2026, month: 6, no: draftSlip.no,
        day: 3, lines: [ lineOf({ debitVoucherId: draftVoucher.id }) ]
      }));
      assert.equal(r1._json.code, 0);
      const r2 = await callHandler(crossSlipRoutes.approve, reqFor(desk, {}, {
        year: 2026, month: 6, no: draftSlip.no,
        approvedAt: new Date().toISOString()
      }));
      assert.equal(r2._json.code, 0);
    });
  });

  describe('ケース2: 全会計データにアクセスできる', () => {
    it('会計帳簿はすべて参照できる', () => {
      for ( const path of [
        '/journal/2026/6', '/ledger/1/1000001', '/remaining/1/1000001',
        '/trial-balance', '/changes/1/1000001'
      ] ) {
        assert.isTrue(guardAllowed(desk, path, 'GET'), path);
      }
    });

    it('日記帳には他人の伝票も出る', async () => {
      const r = await callHandler(journalRoutes.get,
        reqFor(desk, { year: '2026', month: '6' }));
      const nos = r._json.journal.map((s) => s.no);
      assert.include(nos, draftSlip.no);
    });

    it('証憑一覧には他人の証憑も出る', async () => {
      const r = await callHandler(voucherRoutes.get,
        reqFor(desk, {}, {}, { month: '2026-06' }));
      const ids = r._json.vouchers.map((v) => v.id);
      assert.include(ids, draftVoucher.id);
    });
  });

  describe('ケース3: 顧客情報が操作できる', () => {
    it('取引先を登録できる', async () => {
      const r = await callHandler(companyRoutes.post, reqFor(desk, {},
        { name: '経理デスクケース商事' }));
      assert.isOk(r._json.id);
      myCompany = await models.Company.findByPk(r._json.id);
    });

    it('取引先を更新できる', async () => {
      const r = await callHandler(companyRoutes.update, reqFor(desk,
        { id: myCompany.id }, { name: '経理デスクケース商事（改）' }));
      assert.isOk(r._json.company || r._json.id);
      const saved = await models.Company.findByPk(myCompany.id);
      assert.equal(saved.name, '経理デスクケース商事（改）');
    });

    it('取引先を削除できる', async () => {
      const r = await callHandler(companyRoutes.delete, reqFor(desk, {},
        { id: myCompany.id }));
      assert.equal(r._json.code, 0);
      assert.isNull(await models.Company.findByPk(myCompany.id));
    });

    it('取引・案件（companyManagement）も許可表を通る', () => {
      assert.isTrue(guardAllowed(desk, '/transaction', 'GET'));
      assert.isTrue(guardAllowed(desk, '/task', 'POST'));
      assert.isTrue(guardAllowed(desk, '/project/5', 'PUT'));
      assert.isTrue(guardAllowed(desk, '/item/5', 'PUT'));
    });
  });

  describe('ケース4: 人事情報の参照ができる（操作はできない）', () => {
    before(async () => {
      myMember = await models.Member.create({
        legalName: '経理デスクケース太郎'
      });
    });

    it('役職員一覧が読める', async () => {
      assert.isTrue(guardAllowed(desk, '/member', 'GET'));
      const r = await callHandler(memberRoutes.get, reqFor(desk));
      const names = r._json.members ? r._json.members.map((m) => m.legalName) : [];
      assert.include(names, '経理デスクケース太郎');
    });

    it('他人のユーザー情報が読める', async () => {
      const r = await callHandler(userRoutes.get, reqFor(desk,
        { id: data.approver.id }));
      assert.isNotOk(r._status);
    });

    it('ユーザー一覧が読める', async () => {
      assert.isTrue(guardAllowed(desk, '/users', 'GET'));
      assert.isTrue(guardAllowed(desk, '/users/member', 'GET'));
    });

    it('役職員の登録はできない', () => {
      assert.isFalse(guardAllowed(desk, '/member', 'POST'));
    });

    it('役職員の更新・削除はできない', () => {
      assert.isFalse(guardAllowed(desk, '/member/5', 'PUT'));
      assert.isFalse(guardAllowed(desk, '/member/5', 'DELETE'));
    });

    it('ユーザーの作成・権限変更・削除はできない', () => {
      assert.isFalse(guardAllowed(desk, '/user', 'POST'));
      assert.isFalse(guardAllowed(desk, '/user/5', 'PUT'));
      assert.isFalse(guardAllowed(desk, '/user/5', 'DELETE'));
    });
  });

  describe('ケース5: できてはいけないもの', () => {
    it('AI設定・プロンプト（aiManage）は不可', () => {
      assert.isFalse(guardAllowed(desk, '/admin/llms', 'GET'));
      assert.isFalse(guardAllowed(desk, '/prompts', 'GET'));
      assert.isFalse(guardAllowed(desk, '/prompts/ocr-statement', 'PUT'));
    });

    it('バックアップ等の管理領域は不可', () => {
      assert.isFalse(guardAllowed(desk, '/admin/backup', 'POST'));
    });

    it('年度の確定は管理権限のみ（前ケースの限定）', () => {
      assert.isFalse(guardAllowed(desk, '/term/1/lock', 'PUT'));
    });

    it('ユーザー権限の変更（handler）もできない', async () => {
      const r = await callHandler(userRoutes.update, reqFor(desk,
        { id: data.creator.id }, { accounting: true }));
      assert.equal(r._json.status, 'NG');
    });
  });
});
