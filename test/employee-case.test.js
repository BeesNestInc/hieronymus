import {assert} from 'chai';
import bcrypt from 'bcrypt';
import fs from 'fs';
import models from '../models/index.js';
import seed from './seed.js';
import {guard} from '../libs/permission.js';
import voucherRoutes from '../routes/api_voucher.js';
import expenseRoutes from '../routes/api_expense_report.js';
import bankRoutes from '../routes/api_bank_statement.js';
import crossSlipRoutes from '../routes/api_cross_slip.js';
import userRoutes from '../routes/api_user.js';

// 一般従業員（権限なし）のケーススタディ。
// 4つの保証を通しのシナリオで検証する:
//   1. 機微なデータにはアクセスできない
//   2. 自分の関係するデータの投入はできる
//   3. 自分の投入したデータを操作できる
//   4. 承認処理をされた後は自分の投入したデータは操作できない

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

const reqFor = (user, params, body, query, files) => ({
  session: { user: user, term: 1 },
  params: params || {},
  body: body || {},
  query: query || {},
  files: files || {},
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

describe('一般従業員ケース（test db）', () => {
  let data;
  let employee;        // 一般従業員（権限なし）
  let payeeMapping;
  let paymentMapping;
  let ownVoucher;      // 従業員が登録した証憑
  let floatingFile;    // 未整理の浮遊ファイル
  let report;          // 従業員の精算書
  let approvedSlip;    // 承認で起票された伝票
  const myVouchers = [];
  const myFiles = [];
  const myReports = [];
  const mySlips = [];
  let tmpPath;

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
    employee = data.creator;

    // 経費精算の承認で伝票を起票するのに必要なマスタ（expense.test.jsと同じ構成）
    const karibaraiClass = await findOrCreate(models.AccountClass, {
      field: 1, adding: 13
    }, {
      major: '資産', middle: '流動資産', minor: '仮払金', field: 1, adding: 13
    });
    await findOrCreate(models.Account, {
      accountCode: '1130000'
    }, {
      name: '仮払金', key: 'karibarai', accountClassId: karibaraiClass.id,
      accountCode: '1130000', taxClass: 0, subAccountCount: 1
    });
    await findOrCreate(models.SubAccount, {
      accountId: ( await models.Account.findOne({ where: { accountCode: '1130000' } }) ).id,
      name: 'テスト立替太郎'
    }, {
      name: 'テスト立替太郎', key: 'test-taro',
      accountId: ( await models.Account.findOne({ where: { accountCode: '1130000' } }) ).id,
      subAccountCode: 1, taxClass: 0
    });
    await findOrCreate(models.Member, {
      userId: employee.id
    }, {
      userId: employee.id, tradingName: 'テスト立替太郎'
    });
    payeeMapping = await models.ExpenseMapping.create({
      kind: 'payee', name: 'ケース取引先', companyId: data.company.id, account: '7000001'
    });
    paymentMapping = await models.ExpenseMapping.create({
      kind: 'payment', name: 'ケース個人立て替え', account: '1130000', advance: true
    });

    // multipartモック用の実ファイル
    tmpPath = '/tmp/opencode/case-receipt.png';
    fs.writeFileSync(tmpPath, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));
  });

  after(async () => {
    for ( const slip of mySlips ) {
      await models.CrossSlipDetail.destroy({ where: { crossSlipId: slip.id } });
      const found = await models.CrossSlip.findByPk(slip.id);
      if ( found ) await found.destroy();
    }
    for ( const id of myReports ) {
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: id } });
      await models.ExpenseReport.destroy({ where: { id: id } });
    }
    for ( const file of myFiles ) {
      await models.VoucherFile.destroy({ where: { id: file.id } });
    }
    for ( const voucher of myVouchers ) {
      await models.Voucher.destroy({ where: { id: voucher.id } });
    }
    await models.ExpenseMapping.destroy({ where: { id: [ payeeMapping.id, paymentMapping.id ] } });
    if ( fs.existsSync(tmpPath) ) fs.unlinkSync(tmpPath);
    await models.sequelize.close();
  });

  describe('ケース1: 機微なデータにはアクセスできない', () => {
    const sensitive = [
      [ '日記帳', 'GET', '/journal/2026/10' ],
      [ '元帳', 'GET', '/ledger/1/1000001' ],
      [ '残高', 'GET', '/remaining/1/1000001' ],
      [ '試算表', 'GET', '/trial-balance' ],
      [ '推移表', 'GET', '/changes/1/1000001' ],
      [ '学習ルール', 'GET', '/bank_statement_rule' ],
      [ '口座一覧', 'GET', '/financial' ],
      [ 'ユーザー一覧', 'GET', '/users' ],
      [ '年度の変更', 'PUT', '/term/1' ],
      [ '取込の起票', 'POST', '/bank_statement/5/book' ],
      [ '伝票の更新', 'PUT', '/cross_slip' ],
      [ '伝票の作成', 'POST', '/cross_slip' ]
    ];
    for ( const [name, method, path] of sensitive ) {
      it(`${name}（${method} ${path}）は拒否`, () => {
        assert.isFalse(guardAllowed(employee, path, method));
      });
    }

    it('他人のユーザー情報は取得できない', async () => {
      const r = await callHandler(userRoutes.get, reqFor(employee, { id: data.approver.id }));
      assert.equal(r._status, 403);
    });

    it('通帳一覧には銀行・カード口座が出ない（自分の個人カードのみ）', async () => {
      const r = await callHandler(bankRoutes.list, reqFor(employee));
      const kinds = [ ...new Set(r._json.values.map((v) => v.kind)) ];
      for ( const kind of kinds ) {
        assert.equal(kind, 'personal_card');
      }
    });
  });

  describe('ケース2: 自分の関係するデータの投入はできる', () => {
    it('証憑を登録できる', async () => {
      const r = await callHandler(voucherRoutes.post, reqFor(employee, {}, {
        issueDate: '2026-03-01',
        companyId: data.company.id,
        amount: 3000,
        description: 'ケース: 領収書'
      }));
      assert.equal(r._json.code, 0);
      ownVoucher = await models.Voucher.findByPk(r._json.voucher.id);
      assert.equal(ownVoucher.createdBy, employee.id);
      myVouchers.push(ownVoucher);
    });

    it('証憑ファイルをアップロードできる（未整理の浮遊ファイル）', async () => {
      const r = await callHandler(voucherRoutes.upload, reqFor(employee, {}, {}, {}, {
        file: { name: 'receipt.png', path: tmpPath, type: 'image/png' }
      }));
      assert.equal(r._json.code, 0);
      floatingFile = await models.VoucherFile.findByPk(r._json.file.id);
      myFiles.push(floatingFile);
    });

    it('精算書を作成できる', async () => {
      const r = await callHandler(expenseRoutes.post, reqFor(employee, {}, {
        companyId: data.company.id,
        purpose: 'ケース: 3月の立替'
      }));
      assert.isOk(r._json.id);
      report = await models.ExpenseReport.findByPk(r._json.id);
      assert.equal(report.createdBy, employee.id);
      myReports.push(report.id);
    });

    it('未整理証憑パイルにファイルを置ける', async () => {
      const r = await callHandler(
        expenseRoutes.uploadVouchers,
        reqFor(employee, { id: report.id }, {}, {}, {
          file: [ { name: 'pile.png', path: tmpPath, type: 'image/png' } ]
        }));
      assert.equal(r._json.code, 0);
      for ( const v of r._json.vouchers ) {
        const voucher = await models.Voucher.findByPk(v.id);
        myVouchers.push(voucher);
      }
    });
  });

  describe('ケース3: 自分の投入したデータを操作できる', () => {
    it('自分の証憑を更新できる', async () => {
      const r = await callHandler(voucherRoutes.update, reqFor(employee,
        { id: ownVoucher.id }, { description: 'ケース: 領収書（更新）' }));
      assert.isOk(r._json.voucher);
      const saved = await models.Voucher.findByPk(ownVoucher.id);
      assert.equal(saved.description, 'ケース: 領収書（更新）');
    });

    it('浮遊ファイルを自分の証憑にbindできる', async () => {
      const r = await callHandler(voucherRoutes.bind, reqFor(employee, {},
        { id: floatingFile.id, voucherId: ownVoucher.id }));
      assert.equal(r._json.code, 0);
      const file = await models.VoucherFile.findByPk(floatingFile.id);
      assert.equal(file.voucherId, ownVoucher.id);
    });

    it('自分の証憑にファイルを追加できる', async () => {
      const r = await callHandler(voucherRoutes.upload, reqFor(employee,
        { id: ownVoucher.id }, {}, {}, {
          file: { name: 'extra.png', path: tmpPath, type: 'image/png' }
        }));
      assert.equal(r._json.code, 0);
      myFiles.push(await models.VoucherFile.findByPk(r._json.file.id));
    });

    it('自分の証憑のファイルを削除できる', async () => {
      const target = myFiles[myFiles.length - 1];
      const r = await callHandler(voucherRoutes.deleteFile, reqFor(employee, {},
        { id: target.id }));
      assert.equal(r._json.code, 0);
      assert.isNull(await models.VoucherFile.findByPk(target.id));
      myFiles.pop();
    });

    it('自分の精算書を更新できる', async () => {
      const r = await callHandler(expenseRoutes.update, reqFor(employee, {},
        { id: report.id, purpose: 'ケース: 3月の立替（更新）' }));
      assert.isOk(r._json.id);
      const saved = await models.ExpenseReport.findByPk(report.id);
      assert.equal(saved.purpose, 'ケース: 3月の立替（更新）');
    });

    it('精算書の明細に自分の証憑を載せられる', async () => {
      const line = await models.ExpenseReportLine.create({
        expenseReportId: report.id,
        lineNo: 0,
        paymentDate: '2026-03-10',
        payeeMappingId: payeeMapping.id,
        description: '書籍代',
        amount: 3000,
        paymentMappingId: paymentMapping.id,
        voucherId: ownVoucher.id
      });
      assert.isOk(line);
    });
  });

  describe('ケース4: 承認処理をされた後は操作できない', () => {
    before(async () => {
      // 経理（会計＋承認権限）が精算書を承認する → 伝票が起票される
      const r = await callHandler(expenseRoutes.approve, reqFor(data.approver, {},
        { id: report.id, approvedAt: new Date().toISOString() }));
      assert.equal(r._json.code, 0);
      approvedSlip = await models.CrossSlip.findOne({ where: { expenseReportId: report.id } });
      assert.isOk(approvedSlip, '承認で伝票が起票されている');
      assert.ok(approvedSlip.approvedAt);
      mySlips.push(approvedSlip);
    });

    it('自分の精算書は更新できない', async () => {
      const r = await callHandler(expenseRoutes.update, reqFor(employee, {},
        { id: report.id, purpose: '書き換え' }));
      assert.equal(r._json.code, -2);
    });

    it('自分の精算書は削除できない', async () => {
      const r = await callHandler(expenseRoutes.delete, reqFor(employee, {}, { id: report.id }));
      assert.equal(r._json.code, -2);
    });

    it('承認された精算書に載った自分の証憑は更新できない', async () => {
      const r = await callHandler(voucherRoutes.update, reqFor(employee,
        { id: ownVoucher.id }, { description: '書き換え' }));
      assert.equal(r._json.code, -10);
    });

    it('承認された精算書に載った自分の証憑は削除できない', async () => {
      const r = await callHandler(voucherRoutes.delete, reqFor(employee,
        { id: ownVoucher.id }));
      assert.equal(r._json.code, -10);
      assert.isOk(await models.Voucher.findByPk(ownVoucher.id), '証憑は残っている');
    });

    it('承認された精算書に載った証憑にファイルは添付できない', async () => {
      const r = await callHandler(voucherRoutes.upload, reqFor(employee,
        { id: ownVoucher.id }, {}, {}, {
          file: { name: 'after.png', path: tmpPath, type: 'image/png' }
        }));
      assert.equal(r._json.code, -10);
    });

    it('承認された精算書に載った証憑へはbindできない', async () => {
      const r = await callHandler(voucherRoutes.bind, reqFor(employee, {},
        { id: floatingFile.id, voucherId: ownVoucher.id }));
      assert.equal(r._json.code, -10);
    });

    it('承認された精算書に載った証憑のファイルは削除できない', async () => {
      const r = await callHandler(voucherRoutes.deleteFile, reqFor(employee, {},
        { id: floatingFile.id }));
      assert.equal(r._json.code, -10);
      assert.isOk(await models.VoucherFile.findByPk(floatingFile.id), 'ファイルは残っている');
    });

    it('承認で起票された伝票は（作成者が経理なので）削除できない', async () => {
      const r = await callHandler(crossSlipRoutes.delete, reqFor(employee, {}, {
        year: approvedSlip.year,
        month: approvedSlip.month,
        day: approvedSlip.day,
        no: approvedSlip.no
      }));
      // 承認済み伝票は承認ガード（-2）が権限チェック（-10）より先に効く。
      // どちらにせよ一般従業員には削除できない
      assert.equal(r._json.code, -2);
    });

    it('承認で起票された伝票は更新もできない（許可表で会計限定）', () => {
      assert.isFalse(guardAllowed(employee, '/cross_slip', 'PUT'));
    });

    it('承認権限（会計兼承認の経理）なら承認済みの証憑を操作できる', async () => {
      // 承認済みデータの変更可否は承認権限で決まる（不承認に戻せるのは
      // 承認権限だけなので、会計権限だけでは不可。経理部員ケースで検証）
      const r = await callHandler(voucherRoutes.update, reqFor(data.approver,
        { id: ownVoucher.id }, { description: '経理による修正' }));
      assert.isOk(r._json.voucher);
      const saved = await models.Voucher.findByPk(ownVoucher.id);
      assert.equal(saved.description, '経理による修正');
    });
  });
});
