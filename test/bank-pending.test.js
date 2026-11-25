import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import bankRoutes from '../routes/api_bank_statement.js';

// ホームの「通帳の対応待ち」: 未照合と仮起票の行の一覧（会計権限のみ）。
// 仮起票 = 出金仮1900000/入金仮3900000の明細に載っている booked 行

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

describe('通帳の対応待ち一覧（test db）', () => {
  let data;
  let financial;
  let statement;
  let slip;
  const myLines = [];
  const mySlipIds = [];
  const mySettlementStatementIds = [];
  let slipCountBefore;

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

    financial = await findOrCreate(models.Financial, {
      name: '対応待ちテスト銀行'
    }, {
      name: '対応待ちテスト銀行', kind: 'bank', accountCode: '1000001'
    });

    statement = await models.BankStatement.create({
      kind: 'bank', financialId: financial.id, account: '1000001',
      lineCount: 4, periodFrom: '2026-11-01', periodTo: '2026-11-30',
      createdBy: data.approver.id
    });

    // 未照合の行（対応待ちに出る）
    myLines.push(await models.BankStatementLine.create({
      statementId: statement.id, lineNo: 1, date: '2026-11-05',
      rawDescription: '対応待ち未照合テスト', description: '対応待ち未照合テスト',
      amountOut: 1000, category: 'normal', status: 'unmatched'
    }));

    // 仮起票の行: 出金仮1900000の明細を持つ伝票に booked
    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 11 } });
    slipCountBefore = ml ? ml.slipCount : 0;
    slip = await models.CrossSlip.create({
      year: 2026, month: 11, day: 6, no: ( slipCountBefore + 1 ),
      term: 1, lineCount: 1, createdBy: data.approver.id
    });
    mySlipIds.push(slip.id);
    const detail = await models.CrossSlipDetail.create({
      crossSlipId: slip.id, lineNo: 0,
      debitAccount: '1900000', debitAmount: 2000,
      creditAccount: '1000001', creditAmount: 2000
    });
    myLines.push(await models.BankStatementLine.create({
      statementId: statement.id, lineNo: 2, date: '2026-11-06',
      rawDescription: '対応待ち仮起票テスト', description: '対応待ち仮起票テスト',
      amountOut: 2000, category: 'normal', status: 'booked',
      crossSlipDetailId: detail.id, crossSlipId: slip.id
    }));

    // 対応不要の行たち
    myLines.push(await models.BankStatementLine.create({
      statementId: statement.id, lineNo: 3, date: '2026-11-07',
      rawDescription: '対応待ち対象外', description: '対応待ち対象外',
      amountOut: 3000, category: 'normal', status: 'ignored'
    }));
    // 計算書（kind: settlement）の未照合行は一覧に出さない
    // （計算書は計算書仕訳パネルで処理するもので、行単位の
    // 突合・起票の対象ではないため）
    const settlementStatement = await models.BankStatement.create({
      kind: 'settlement', financialId: financial.id, account: '1000001',
      lineCount: 1, periodFrom: '2026-11-01', periodTo: '2026-11-30',
      createdBy: data.approver.id
    });
    mySettlementStatementIds.push(settlementStatement.id);
    myLines.push(await models.BankStatementLine.create({
      statementId: settlementStatement.id, lineNo: 1, date: '2026-11-09',
      rawDescription: '計算書の未照合行', description: '計算書の未照合行',
      amountOut: 9000, category: 'normal', status: 'unmatched'
    }));
    const realSlip = await models.CrossSlip.create({
      year: 2026, month: 11, day: 8, no: ( slipCountBefore + 2 ),
      term: 1, lineCount: 1, createdBy: data.approver.id
    });
    mySlipIds.push(realSlip.id);
    const realDetail = await models.CrossSlipDetail.create({
      crossSlipId: realSlip.id, lineNo: 0,
      debitAccount: '7000001', debitAmount: 4000,
      creditAccount: '1000001', creditAmount: 4000
    });
    myLines.push(await models.BankStatementLine.create({
      statementId: statement.id, lineNo: 4, date: '2026-11-08',
      rawDescription: '実科目起票済み', description: '実科目起票済み',
      amountOut: 4000, category: 'normal', status: 'booked',
      crossSlipDetailId: realDetail.id, crossSlipId: realSlip.id
    }));
  });

  after(async () => {
    for ( const line of myLines ) {
      await models.BankStatementLine.destroy({ where: { id: line.id } });
    }
    for ( const id of mySlipIds ) {
      await models.CrossSlipDetail.destroy({ where: { crossSlipId: id } });
      await models.CrossSlip.destroy({ where: { id: id } });
    }
    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 11 } });
    if ( ml ) {
      ml.slipCount = slipCountBefore;
      await ml.save();
    }
    for ( const id of mySettlementStatementIds ) {
      await models.BankStatement.destroy({ where: { id: id } });
    }
    await models.BankStatement.destroy({ where: { id: statement.id } });
    await models.Financial.destroy({ where: { id: financial.id } });
    await models.sequelize.close();
  });

  it('未照合と仮起票だけが出る（対象外・実科目起票済みは出ない）', async () => {
    const r = await callHandler(bankRoutes.pending, reqFor(data.approver));
    assert.equal(r._json.code, 0);
    const mine = r._json.values.filter((l) => ( l.statementId === statement.id ));
    assert.equal(mine.filter((l) => ( l.kind === 'unmatched' )).length, 1);
    assert.equal(mine.filter((l) => ( l.kind === 'tentative' )).length, 1);
    const kinds = mine.map((l) => l.kind);
    assert.notInclude(kinds, 'ignored');
    // 実科目の起票済み行は含まない
    assert.isFalse(mine.some((l) => ( l.description === '実科目起票済み' )));
    // 計算書の行は含まない
    assert.isFalse(r._json.values.some((l) => ( l.description === '計算書の未照合行' )));
    // 仮起票行に口座名が付いている
    const tentative = mine.find((l) => ( l.kind === 'tentative' ));
    assert.equal(tentative.financialName, '対応待ちテスト銀行');
  });

  it('会計権限のないユーザーにはhandlerが拒否される', async () => {
    const r = await callHandler(bankRoutes.pending, reqFor(data.creator));
    assert.equal(r._json.code, -10);
  });
});
