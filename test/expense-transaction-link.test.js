import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import expenseRoutes from '../routes/api_expense_report.js';
import transactionRoutes from '../routes/api_transaction_document.js';

// 精算書の取引文書化: 案件が設定された精算書は「精算書」種別の取引文書として
// 投影され、取引管理の案件・顧客の文書一覧に出る。
// 取引管理からは編集・削除できない（精算書側で編集）。

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

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

describe('精算書の取引文書化（test db）', () => {
  let data;
  let task;
  let seisanKind;
  let txManager;   // 取引管理権限（companyManagement）のユーザー
  const myReports = [];
  const myTasks = [];
  const myTxIds = [];

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

    seisanKind = await models.TransactionKind.findOne({
      where: { label: '精算書', linked: true }
    });
    assert.isOk(seisanKind, 'マイグレーションで「精算書」種別が入っている');

    txManager = await findOrCreate(models.User, {
      name: 'txmanager'
    }, {
      name: 'txmanager',
      hashPassword: bcrypt.hashSync('secret', 10),
      companyManagement: true,
      accounting: false,
      approvable: false,
      administrable: false
    });

    task = await findOrCreate(models.Task, {
      subject: '取引文書化テスト案件'
    }, {
      subject: '取引文書化テスト案件',
      issueDate: '2026-09-01',
      companyId: data.company.id
    });
    myTasks.push(task.id);

    // 前回実行の残りを掃除（連携行が孤立していないか）
    const stale = await models.TransactionDocument.findAll({
      where: { expenseReportId: { [models.Sequelize.Op.ne]: null } }
    });
    for ( const tx of stale ) {
      const report = await models.ExpenseReport.findByPk(tx.expenseReportId);
      if ( !report ) {
        await tx.destroy();
      }
    }
  });

  after(async () => {
    for ( const id of myTxIds ) {
      await models.TransactionDetail.destroy({ where: { transactionDocumentId: id } });
      await models.TransactionDocument.destroy({ where: { id: id } });
    }
    for ( const id of myReports ) {
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: id } });
      await models.ExpenseReport.destroy({ where: { id: id } });
    }
    for ( const id of myTasks ) {
      await models.Task.destroy({ where: { id: id } });
    }
    await models.sequelize.close();
  });

  const linkedTx = async (reportId) => {
    return models.TransactionDocument.findOne({
      where: { expenseReportId: reportId }
    });
  };

  it('案件ありの精算書を作ると「精算書」種別の取引文書ができる', async () => {
    const r = await callHandler(expenseRoutes.post, reqFor(data.creator, {}, {
      companyId: data.company.id,
      taskId: task.id,
      purpose: '取引文書化テストの精算',
      lines: [ { amount: 1000 }, { amount: 2000 } ]
    }));
    const reportId = r._json.id;
    myReports.push(reportId);
    const tx = await linkedTx(reportId);
    assert.isOk(tx, '連携行ができている');
    myTxIds.push(tx.id);
    assert.equal(tx.kindId, seisanKind.id);
    assert.equal(tx.taskId, task.id);
    assert.equal(tx.companyId, data.company.id);
    assert.equal(tx.subject, '取引文書化テストの精算');
    assert.equal(Number(tx.amount), 3000);
    assert.equal(tx.expenseReportId, reportId);
  });

  it('案件なしの精算書には連携行ができない', async () => {
    const r = await callHandler(expenseRoutes.post, reqFor(data.creator, {}, {
      companyId: data.company.id,
      purpose: '案件なしの精算',
      lines: [ { amount: 500 } ]
    }));
    const reportId = r._json.id;
    myReports.push(reportId);
    assert.isNull(await linkedTx(reportId));
  });

  it('精算書を更新すると連携行も同期する', async () => {
    const reportId = myReports[0];
    await callHandler(expenseRoutes.update, reqFor(data.creator, {},
      {
        id: reportId,
        purpose: '目的を書き換えた',
        lines: [ { amount: 1000 }, { amount: 2000 }, { amount: 4000 } ]
      }));
    const tx = await linkedTx(reportId);
    assert.equal(tx.subject, '目的を書き換えた');
    assert.equal(Number(tx.amount), 7000);
  });

  it('案件を外すと連携行は削除される', async () => {
    const reportId = myReports[0];
    await callHandler(expenseRoutes.update, reqFor(data.creator, {},
      { id: reportId, taskId: null, purpose: '案件を外した' }));
    assert.isNull(await linkedTx(reportId), '連携行が消えている');
  });

  it('案件を付け直すと連携行が復活する', async () => {
    const reportId = myReports[0];
    await callHandler(expenseRoutes.update, reqFor(data.creator, {},
      { id: reportId, taskId: task.id, purpose: '案件を付け直した' }));
    const tx = await linkedTx(reportId);
    assert.isOk(tx);
    myTxIds.push(tx.id);
    assert.equal(tx.subject, '案件を付け直した');
  });

  it('取引管理からは連携行を編集できない', async () => {
    const tx = await linkedTx(myReports[0]);
    const r = await callHandler(transactionRoutes.update, reqFor(txManager,
      { id: tx.id }, { subject: '取引側から書き換え' }));
    assert.equal(r._status, 422);
    assert.match(r._json.message, /精算書側で編集/);
    const saved = await models.TransactionDocument.findByPk(tx.id);
    assert.equal(saved.subject, '案件を付け直した');
  });

  it('取引管理からは連携行を削除できない', async () => {
    const tx = await linkedTx(myReports[0]);
    const r = await callHandler(transactionRoutes.delete, reqFor(txManager,
      { id: tx.id }));
    assert.equal(r._status, 422);
    assert.isOk(await models.TransactionDocument.findByPk(tx.id), '連携行は残っている');
  });

  it('精算書を削除すると連携行も消える', async () => {
    const reportId = myReports[0];
    const r = await callHandler(expenseRoutes.delete, reqFor(data.creator, {},
      { id: reportId }));
    assert.equal(r._json.code, 0);
    assert.isNull(await linkedTx(reportId));
  });

  it('種別一覧には「精算書」がlinked付きで載る（手動作成の選択肢からは除外される）', async () => {
    const r = await callHandler(transactionRoutes.kindsGet, reqFor(data.approver));
    const kind = r._json.values.find((k) => ( k.label === '精算書' ));
    assert.isOk(kind);
    assert.isTrue(kind.linked);
  });
});
