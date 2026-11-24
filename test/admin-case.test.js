import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import {guard} from '../libs/permission.js';
import voucherRoutes from '../routes/api_voucher.js';
import expenseRoutes from '../routes/api_expense_report.js';
import userRoutes from '../routes/api_user.js';
import stickyRoutes from '../routes/api_sticky.js';
import menuRoutes from '../routes/api_menu.js';

// 管理者（administrableのみ）のケーススタディ。原則:
//   * 「管理者」としてできるのはユーザー権限の操作（と管理領域の運用）
//   * 個々の具体的な操作（会計・承認・取込・AI設定・顧客管理の実務）は
//     それ自身の権限（会計・承認・顧客管理…）を持っていなければできない
//   * 現実には自分に権限を与えればできるが、それは「権限操作」経由であって
//     administrable単体ではできない

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

describe('管理者ケース（test db）', () => {
  let data;
  let admin;        // 純粋な管理者（administrableのみ）
  let target;      // 権限操作の対象になる使い捨てユーザー
  let othersVoucher;
  let othersReport;
  const myVouchers = [];
  const myReports = [];

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

    // 純粋な管理者: administrableのみ。会計・承認・人事・AI管理等は持たない
    admin = await findOrCreate(models.User, {
      name: 'pureadmin'
    }, {
      name: 'pureadmin',
      hashPassword: bcrypt.hashSync('secret', 10),
      administrable: true,
      accounting: false,
      approvable: false,
      fiscalBrowsing: false,
      companyManagement: false,
      personnelManagement: false,
      personnelBrowsing: false,
      inventoryManagement: false,
      aiManage: false
    });
    // 前回実行の残り（自己付与テストで権限が付いたままの可能性）を掃除
    admin.accounting = false;
    await admin.save();

    othersVoucher = await models.Voucher.create({
      issueDate: '2026-08-01',
      companyId: data.company.id,
      amount: 1000,
      description: '管理者ケース: 従業員の証憑',
      createdBy: data.creator.id
    });
    myVouchers.push(othersVoucher);
    othersReport = await models.ExpenseReport.create({
      submittedBy: data.creator.id,
      submittedAt: new Date(2026, 7, 10),
      companyId: data.company.id,
      purpose: '管理者ケース: 従業員の精算書',
      createdBy: data.creator.id,
      updatedBy: data.creator.id
    });
    myReports.push(othersReport.id);
  });

  after(async () => {
    admin.accounting = false;
    await admin.save();
    for ( const id of myReports ) {
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: id } });
      await models.ExpenseReport.destroy({ where: { id: id } });
    }
    for ( const voucher of myVouchers ) {
      await models.Voucher.destroy({ where: { id: voucher.id } });
    }
    if ( target ) {
      await models.User.destroy({ where: { id: target.id } });
    }
    await models.sequelize.close();
  });

  describe('ケース1: ユーザー権限の操作はできる', () => {
    it('ユーザー一覧・他人のユーザー情報が読める', () => {
      assert.isTrue(guardAllowed(admin, '/users', 'GET'));
      assert.isTrue(guardAllowed(admin, '/users/member', 'GET'));
    });

    it('他人のユーザー情報を取得できる（handler）', async () => {
      const r = await callHandler(userRoutes.get, reqFor(admin,
        { id: data.creator.id }));
      assert.isNotOk(r._status);
    });

    it('他人のユーザー権限を変更できる', async () => {
      // 使い捨てユーザーに会計権限を与える
      target = await models.User.create({
        name: 'flag-target',
        hashPassword: bcrypt.hashSync('secret', 10)
      });
      const r = await callHandler(userRoutes.update, reqFor(admin,
        { id: target.id }, { accounting: true }));
      assert.equal(r._json.code, 0);
      const saved = await models.User.findByPk(target.id);
      assert.isTrue(saved.accounting);
    });

    it('ユーザーを削除できる', async () => {
      const r = await callHandler(userRoutes.remove || userRoutes.delete,
        reqFor(admin, { id: target.id }));
      const saved = await models.User.findByPk(target.id);
      assert.isNull(saved);
    });

    it('役職員マスタは直接はできない（人事管理権限が必要。分離）', () => {
      assert.isFalse(guardAllowed(admin, '/member', 'GET'));
      assert.isFalse(guardAllowed(admin, '/member', 'POST'));
      assert.isFalse(guardAllowed(admin, '/member/5', 'PUT'));
      assert.isFalse(guardAllowed(admin, '/member/5', 'DELETE'));
    });

    it('バックアップ・年度の確定/取り消し（管理運用）はできる', () => {
      assert.isTrue(guardAllowed(admin, '/admin/backup', 'POST'));
      assert.isTrue(guardAllowed(admin, '/term/1/lock', 'PUT'));
      assert.isTrue(guardAllowed(admin, '/term/1/unlock', 'PUT'));
    });
  });

  describe('ケース2: 個別の具体的な操作はできない', () => {
    it('会計帳簿は読めない', () => {
      for ( const path of [
        '/journal/2026/8', '/ledger/1/1000001', '/remaining/1/1000001',
        '/trial-balance', '/changes/1/1000001', '/closing/1'
      ] ) {
        assert.isFalse(guardAllowed(admin, path, 'GET'), path);
      }
    });

    it('伝票の読み取り・作成・更新・承認はできない', () => {
      assert.isFalse(guardAllowed(admin, '/cross_slip/2026/8/1', 'GET'));
      assert.isFalse(guardAllowed(admin, '/cross_slip', 'POST'));
      assert.isFalse(guardAllowed(admin, '/cross_slip', 'PUT'));
      assert.isFalse(guardAllowed(admin, '/cross_slip/approve', 'PUT'));
      assert.isFalse(guardAllowed(admin, '/cross-slip-detail/5', 'GET'));
    });

    it('取込・突合・学習ルール・口座はできない', () => {
      assert.isFalse(guardAllowed(admin, '/bank_statement/5/book', 'POST'));
      assert.isFalse(guardAllowed(admin, '/bank_statement/5/settle', 'POST'));
      assert.isFalse(guardAllowed(admin, '/bank_statement_rule', 'GET'));
      assert.isFalse(guardAllowed(admin, '/financial', 'POST'));
      assert.isFalse(guardAllowed(admin, '/karibarai/1', 'GET'));
      assert.isFalse(guardAllowed(admin, '/tax-rule/', 'PUT'));
    });

    it('年度の内容変更（会計操作）はできない。確定はできる（対比）', () => {
      assert.isFalse(guardAllowed(admin, '/term/1', 'PUT'));
    });

    it('顧客管理の実務もできない（companyManagementが必要）', () => {
      assert.isFalse(guardAllowed(admin, '/company', 'POST'));
      assert.isFalse(guardAllowed(admin, '/transaction', 'GET'));
      assert.isFalse(guardAllowed(admin, '/task', 'POST'));
      assert.isFalse(guardAllowed(admin, '/item/5', 'POST'));
      assert.isFalse(guardAllowed(admin, '/project/5', 'PUT'));
    });

    it('AI設定・プロンプトはaiManageがないとできない（管理領域でも）', () => {
      assert.isFalse(guardAllowed(admin, '/prompts', 'GET'));
      assert.isFalse(guardAllowed(admin, '/admin/llms', 'GET'));
    });

    it('証憑一覧・精算書一覧には他人の分は出ない（自分の分だけ）', async () => {
      const r = await callHandler(voucherRoutes.get,
        reqFor(admin, {}, {}, { month: '2026-08' }));
      const ids = r._json.vouchers.map((v) => v.id);
      assert.notInclude(ids, othersVoucher.id);
      const r2 = await callHandler(expenseRoutes.list,
        reqFor(admin, {}, {}, { type: 'all' }));
      const ids2 = r2._json.map((rep) => rep.id);
      assert.notInclude(ids2, othersReport.id);
    });
  });

  describe('ケース3: su原則（管理者でも他人の私的なデータは覗かない）', () => {
    let othersSticky;
    let othersMenu;
    const myStickies = [];
    const myMenus = [];

    before(async () => {
      // 従業員宛ての付箋と従業員のマイページ
      othersSticky = await models.Sticky.create({
        authorId: data.creator.id,
        kind: 'memo',
        message: '管理者ケース: 従業員のメモ'
      });
      await models.StickyStatus.create({
        stickyId: othersSticky.id,
        receiverId: data.creator.id
      });
      myStickies.push(othersSticky);
      othersMenu = await models.Menu.create({
        title: '管理者ケース: 従業員のマイページ',
        userId: data.creator.id,
        displayOrder: 99
      });
      myMenus.push(othersMenu);
    });

    after(async () => {
      for ( const sticky of myStickies ) {
        await models.StickyStatus.destroy({ where: { stickyId: sticky.id } });
        await models.Sticky.destroy({ where: { id: sticky.id } });
      }
      for ( const menu of myMenus ) {
        await models.Menu.destroy({ where: { id: menu.id } });
      }
    });

    it('付箋（他人宛てのメッセージ）の一覧には他人の分は出ない', async () => {
      // 付箋はreceiverId=meで絞り込まれており、管理者バイパスは無い
      const r = await callHandler(stickyRoutes.list, reqFor(admin));
      const ids = r._json.stickies.map((s) => s.id);
      assert.notInclude(ids, othersSticky.id);
    });

    it('付箋の既読も削除も（他人の分は）できない', async () => {
      const r = await callHandler(stickyRoutes.read, reqFor(admin,
        { id: othersSticky.id }));
      assert.equal(r._status, 403);
      const r2 = await callHandler(stickyRoutes.delete, reqFor(admin,
        { id: othersSticky.id }));
      assert.equal(r2._json.code, -2, '作者でないので本体削除もできない');
    });

    it('他人のマイページは（管理者でも）読めない・書けない・消せない', async () => {
      const r = await callHandler(menuRoutes.get, reqFor(admin,
        { id: othersMenu.id }));
      assert.equal(r._status, 403);
      const r2 = await callHandler(menuRoutes.update, reqFor(admin,
        { id: othersMenu.id }, { title: '書き換え' }));
      assert.equal(r2._status, 403);
      const r3 = await callHandler(menuRoutes.delete, reqFor(admin,
        { id: othersMenu.id }));
      assert.equal(r3._status, 403);
      const saved = await models.Menu.findByPk(othersMenu.id);
      assert.isOk(saved, 'ページは残っている');
    });

    it('自分のマイページとテンプレートは（管理者として）扱える', async () => {
      // テンプレートの管理は管理者の正当な領域
      const template = await models.Menu.create({
        title: '管理者ケース: テンプレート',
        userId: null,
        displayOrder: 99
      });
      myMenus.push(template);
      const r = await callHandler(menuRoutes.get, reqFor(admin,
        { id: template.id }));
      assert.isOk(r._json.menu, 'テンプレートは読める');
      const r2 = await callHandler(menuRoutes.update, reqFor(admin,
        { id: template.id }, { displayOrder: 98 }));
      assert.isOk(r2._json.menu, 'テンプレートは更新できる');
    });
  });

  describe('ケース4: 権限操作を経由すればできる（仕様上容認の抜け道）', () => {
    it('自分に会計権限を与えれば会計ができるようになる', async () => {
      // 「現実には自分に操作権を与えればできる」——その経路の実証。
      // administrable単体ではできないが、権限操作（自分への付与）で可能になる
      const r = await callHandler(userRoutes.update, reqFor(admin,
        { id: admin.id }, { accounting: true }));
      assert.equal(r._json.code, 0);
      const saved = await models.User.findByPk(admin.id);
      assert.isTrue(saved.accounting);
      // 付与後は会計帳簿が読める
      assert.isTrue(guardAllowed(
        { id: saved.id, administrable: true, accounting: saved.accounting },
        '/journal/2026/8', 'GET'));
      // 後始末: 権限を外す（afterでも念のため掃除）
      saved.accounting = false;
      await saved.save();
      assert.isFalse(guardAllowed(admin, '/journal/2026/8', 'GET'));
    });
  });
});
