import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import {guard, lintRoutes} from '../libs/permission.js';
import apiRouter from '../routes/api.js';
import voucherRoutes from '../routes/api_voucher.js';
import expenseRoutes from '../routes/api_expense_report.js';

// ---- guard直叩きのマトリクステスト（DB不要） ----

const request = (user, path, method) => ({
  session: { user: user },
  path: path,
  method: method,
  headers: {}
});

const resMock = () => {
  const r = {};
  Object.assign(r, {
    status(code) { r._status = code; return r; },
    json(body) { r._json = body; },
    set() { return r; }
  });
  return r;
};

const allowed = (user, path, method) => {
  let called = false;
  guard(request(user, path, method), resMock(), () => { called = true; });
  return called;
};

const users = {
  plain: { id: 2, name: 'plain' },
  accounting: { id: 3, accounting: true },
  approvable: { id: 4, approvable: true },
  admin: { id: 5, administrable: true },
  aiManage: { id: 6, aiManage: true },
  personnel: { id: 7, personnelManagement: true }
};

describe('API許可表（guardマトリクス）', () => {
  // [説明, ユーザー, メソッド, パス, 通るか]
  const cases = [
    ['伝票の新規作成は一般ユーザーに拒否', 'plain', 'POST', '/cross_slip', false],
    ['伝票の新規作成は会計に許可', 'accounting', 'POST', '/cross_slip', true],
    ['伝票の新規作成は承認権限に許可', 'approvable', 'POST', '/cross_slip', true],
    ['伝票の更新は承認権限だけでは拒否', 'approvable', 'PUT', '/cross_slip', false],
    ['伝票の読み取りは承認権限にも許可（承認のために中身を見る）', 'approvable', 'GET', '/cross_slip/2026/10/1', true],
    ['伝票の更新は会計に許可', 'accounting', 'PUT', '/cross_slip', true],
    ['伝票の承認は承認権限に許可', 'approvable', 'PUT', '/cross_slip/approve', true],
    ['伝票の承認は会計だけでは拒否', 'accounting', 'PUT', '/cross_slip/approve', false],
    ['伝票の削除は表ではANY（handlerが承認/作成者に絞り込む）', 'plain', 'DELETE', '/cross_slip', true],
    ['出金仮統合の候補一覧は表を通る（handlerで会計/承認に絞り込み。以前は未登録の403石碑）', 'plain', 'GET', '/expense_report/merge_candidates', true],
    ['出金仮統合の実行も表を通る', 'plain', 'POST', '/expense_report/5/merge_spend', true],
    ['日記帳は一般に拒否', 'plain', 'GET', '/journal/2026/10', false],
    ['日記帳は会計に許可', 'accounting', 'GET', '/journal/2026/10', true],
    ['取込の起票は一般に拒否', 'plain', 'POST', '/bank_statement/5/book', false],
    ['取込の起票は会計に許可', 'accounting', 'POST', '/bank_statement/5/book', true],
    ['通帳の対応待ち一覧は会計にのみ許可', 'accounting', 'GET', '/bank_statement/pending', true],
    ['通帳の対応待ち一覧は一般に拒否', 'plain', 'GET', '/bank_statement/pending', false],
    ['通帳の対応待ち一覧は承認権限だけでは拒否', 'approvable', 'GET', '/bank_statement/pending', false],
    ['年度の変更は一般に拒否', 'plain', 'PUT', '/term/5', false],
    ['年度の変更は会計に許可', 'accounting', 'PUT', '/term/5', true],
    ['年度の確定は会計にも拒否（管理権限のみ）', 'accounting', 'PUT', '/term/5/lock', false],
    ['年度の確定は承認権限にも拒否', 'approvable', 'PUT', '/term/5/lock', false],
    ['年度の確定は管理権限に許可', 'admin', 'PUT', '/term/5/lock', true],
    ['バックアップは一般に拒否', 'plain', 'POST', '/admin/backup', false],
    ['バックアップは管理権限に許可', 'admin', 'POST', '/admin/backup', true],
    ['プロンプトはAI管理権限に許可', 'aiManage', 'GET', '/prompts', true],
    ['プロンプトは管理権限だけでは拒否', 'admin', 'GET', '/prompts', false],
    ['付箋はログイン済み全員に許可', 'plain', 'POST', '/sticky', true],
    ['パスワード変更は（自分のなので）許可', 'plain', 'PUT', '/user/password', true],
    ['ユーザーの削除は一般に拒否', 'plain', 'DELETE', '/user/5', false],
    ['ユーザーの削除は管理権限に許可', 'admin', 'DELETE', '/user/5', true],
    ['担当者候補（社員のid+名前）は全員に読める', 'plain', 'GET', '/users/member', true],
    ['役職員の一覧は人事管理権限に許可', 'personnel', 'GET', '/member', true],
    ['役職員の登録は人事管理権限に許可', 'personnel', 'POST', '/member', true],
    ['役職員の管理は管理者でも直接は拒否（ユーザー権限操作との分離）', 'admin', 'POST', '/member', false],
    ['口座の編集は一般に拒否', 'plain', 'PUT', '/financial/5', false],
    ['学習ルールの閲覧は一般に拒否', 'plain', 'GET', '/bank_statement_rule', false],
    ['証憑の更新は表ではANY（handlerが作成者/会計に絞り込む）', 'plain', 'PUT', '/voucher', true],
    ['証憑の添付は表ではANY（handlerが作成者/会計に絞り込む）', 'plain', 'POST', '/voucher/upload/5', true]
  ];

  for ( const [desc, userKey, method, path, expect] of cases ) {
    it(`${desc}（${method} ${path}）`, () => {
      assert.equal(allowed(users[userKey], path, method), expect);
    });
  }
});

describe('未登録エンドポイント（403石碑）lint', () => {
  it('全APIエンドポイントが許可表に登録されている', () => {
    const misses = lintRoutes(apiRouter);
    assert.deepEqual(misses, [], `未登録（誰にも403）: ${misses.join(', ')}`);
  });
});

// ---- handler側の権限絞り込み（test db） ----

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
  headers: {}
});

describe('handler側の権限絞り込み（test db）', () => {
  let data;
  let voucherOther;   // approver（会計）が作った証憑
  let voucherOwn;    // creator（一般）が作った証憑
  let floatingFile;  // まだどこにも紐付いていないファイル
  let attachedFile;   // voucherOtherに紐付いたファイル
  let created = { vouchers: [], files: [] };

  before(async () => {
    // 実DBへのテスト実行は実データを破壊するので禁止
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

    voucherOther = await models.Voucher.create({
      issueDate: '2026-10-01',
      amount: 1000,
      description: 'permission-test 他人の証憑',
      createdBy: data.approver.id
    });
    voucherOwn = await models.Voucher.create({
      issueDate: '2026-10-02',
      amount: 2000,
      description: 'permission-test 自分の証憑',
      createdBy: data.creator.id
    });
    floatingFile = await models.VoucherFile.create({
      name: 'floating.png',
      mimeType: 'image/png',
      body: Buffer.from('floating'),
      voucherId: null
    });
    attachedFile = await models.VoucherFile.create({
      name: 'attached.png',
      mimeType: 'image/png',
      body: Buffer.from('attached'),
      voucherId: voucherOther.id
    });
    created.vouchers.push(voucherOther, voucherOwn);
    created.files.push(floatingFile, attachedFile);
  });

  after(async () => {
    for ( const file of created.files ) {
      await models.VoucherFile.destroy({ where: { id: file.id } });
    }
    for ( const voucher of created.vouchers ) {
      await models.Voucher.destroy({ where: { id: voucher.id } });
    }
    await models.sequelize.close();
  });

  it('証憑一覧: 一般ユーザーには自分の証憑だけ見える', async () => {
    const r = await callHandler(
      voucherRoutes.get, reqFor(data.creator, {}, {}, { month: '2026-10' }));
    const ids = r._json.vouchers.map((v) => v.id);
    assert.include(ids, voucherOwn.id);
    assert.notInclude(ids, voucherOther.id);
  });

  it('証憑一覧: 会計権限には全部見える', async () => {
    const r = await callHandler(
      voucherRoutes.get, reqFor(data.approver, {}, {}, { month: '2026-10' }));
    const ids = r._json.vouchers.map((v) => v.id);
    assert.include(ids, voucherOwn.id);
    assert.include(ids, voucherOther.id);
  });

  it('証憑の単体取得: 他人の証憑は拒否', async () => {
    const r = await callHandler(
      voucherRoutes.get, reqFor(data.creator, { id: voucherOther.id }));
    assert.equal(r._json.code, -10);
  });

  it('証憑の更新: 他人の証憑は拒否（既存動作の固定）', async () => {
    const r = await callHandler(
      voucherRoutes.update, reqFor(data.creator, { id: voucherOther.id }, { description: 'x' }));
    assert.equal(r._json.code, -10);
  });

  it('証憑の削除: 他人の証憑は拒否（既存動作の固定）', async () => {
    const r = await callHandler(
      voucherRoutes.delete, reqFor(data.creator, { id: voucherOther.id }));
    assert.equal(r._json.code, -10);
  });

  it('証憑へのファイル添付（upload）: 他人の証憑は拒否', async () => {
    const r = await callHandler(
      voucherRoutes.upload, reqFor(data.creator, { id: voucherOther.id }));
    assert.equal(r._json.code, -10);
  });

  it('証憑へのbind: 他人の証憑への割り当ては拒否', async () => {
    const r = await callHandler(
      voucherRoutes.bind,
      reqFor(data.creator, {}, { id: floatingFile.id, voucherId: voucherOther.id }));
    assert.equal(r._json.code, -10);
  });

  it('証憑へのbind: 会計権限は通る', async () => {
    const r = await callHandler(
      voucherRoutes.bind,
      reqFor(data.approver, {}, { id: floatingFile.id, voucherId: voucherOther.id }));
    assert.equal(r._json.code, 0);
  });

  it('証憑ファイルの削除: 他人の証憑のファイルは拒否', async () => {
    const r = await callHandler(
      voucherRoutes.deleteFile, reqFor(data.creator, {}, { id: attachedFile.id }));
    assert.equal(r._json.code, -10);
    // 拒否されたのでファイルは残っている
    const still = await models.VoucherFile.findByPk(attachedFile.id);
    assert.isOk(still);
  });

  it('OCR起動: 他人の証憑への起動は拒否', async () => {
    const r = await callHandler(
      expenseRoutes.ocr, reqFor(data.creator, {}, { voucherId: voucherOther.id }));
    assert.equal(r._json.code, -10);
  });
});
