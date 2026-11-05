import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import {createSlipForReport} from '../libs/expense.js';
import {findSpendMergeCandidates, mergeSpendIntoPlaceholder, autoMergeSlipAfterBook} from '../libs/bank-reconcile.js';

// 経費精算の伝票 ↔ カード取り込みの出金仮の統合（出金側 placeholder merge）。
// カード取り込みで仮登録された明細（借: 出金仮 1900000 / 貸: カード 2030000）は
// 経費精算書の承認で起票された伝票（借: 費用 / 貸: カード）と同じ取引。
// 精算書側の伝票にカード行の突合先を付け替えて、仮伝票を消す（内容の移設は不要）。

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

describe('card merge（精算書→出金仮の統合）', () => {
  let data;
  let cardFinancial;
  let payeeMapping;
  let paymentMapping;

  before(async function() {
    this.timeout(60000);
    const dbName = models.sequelize.getDatabaseName();
    if ( !/_test$/.test(dbName) ) {
      throw new Error(`このテストは *_test データベースでのみ実行できます（現在: ${dbName}）`);
    }
    try {
      await models.sequelize.authenticate();
    } catch (e) {
      delete models.sequelize.connectionManager.getConnection;
      models.sequelize.connectionManager.initPools();
      await models.sequelize.authenticate();
    }
    data = await seed();
    // 前回実行の残データを掃除する（依存の順に削除）
    await models.BankStatementLine.destroy({ where: {} });
    await models.BankStatement.destroy({ where: {} });
    await models.CrossSlipDetail.destroy({ where: {} });
    await models.CrossSlip.destroy({ where: {} });
    await models.BankStatementRule.destroy({ where: {} });
    await models.ExpenseReportLine.destroy({ where: {} });
    await models.ExpenseReport.destroy({ where: {} });
    await models.ExpenseMapping.destroy({ where: {} });
    await models.Financial.destroy({ where: { name: 'テストカード' } });
    // 出金元のカード勘定（taxcalc の検証で参照されるので実在させておく）
    const cardClass = await findOrCreate(models.AccountClass, {
      field: 1, adding: 0
    }, {
      major: '資産', middle: '流動資産', minor: 'ウェアカード',
      field: 1, adding: 0
    });
    await findOrCreate(models.Account, {
      accountCode: '2030000'
    }, {
      name: 'クレジットカード',
      key: 'card',
      accountClassId: cardClass.id,
      accountCode: '2030000',
      taxClass: 0,
      subAccountCount: 0
    });
    cardFinancial = await models.Financial.create({
      name: 'テストカード', kind: 'card',
      accountCode: '2030000', subAccountCode: null,
      createdBy: data.approver.id, updatedBy: data.approver.id
    });
    payeeMapping = await models.ExpenseMapping.create({
      kind: 'payee',
      name: 'テスト取引先',
      companyId: data.company.id,
      account: '7000001'
    });
    paymentMapping = await models.ExpenseMapping.create({
      kind: 'payment',
      name: 'テストカード',
      account: '2030000',
      subAccount: null
    });
  });

  after(async () => {
    await models.sequelize.close();
  });

  // カード取り込みの出金仮伝票（借: 出金仮 / 貸: カード）と取り込行を作る。
  // rowDate: 取込行の日付。slipDate との差が統合の許容日数になる
  const makeTempPostponed = async ({ slipDate = '2026-03-12', rowDate = '2026-03-12', amount = 3000, approved = false } = {}) => {
    const user = data.creator;
    const [ y, mo, d ] = slipDate.split('-').map(Number);
    const no = ( await models.CrossSlip.count({ where: { year: y, month: mo } }) ) + 1;
    const slip = await models.CrossSlip.create({
      year: y, month: mo, day: d,
      no: no, lineCount: 1, term: 1,
      createdBy: user.id, updatedBy: user.id,
      approvedAt: approved ? new Date() : null,
      approvedBy: approved ? user.id : null
    });
    const detail = await models.CrossSlipDetail.create({
      crossSlipId: slip.id,
      lineNo: 1,
      debitAccount: '1900000', debitSubAccount: null, debitAmount: amount, debitTax: 0,
      creditAccount: '2030000', creditSubAccount: null, creditAmount: amount, creditTax: 0,
      application1: 'DIGITAL BOOKS (ド チ)',
      createdBy: user.id, updatedBy: user.id
    });
    const statement = await models.BankStatement.create({
      financialId: cardFinancial.id,
      kind: 'card',
      cardName: cardFinancial.name,
      fileName: `card-${Date.now()}-${slip.id}.pdf`,
      mimeType: 'application/pdf',
      periodFrom: rowDate, periodTo: rowDate,
      lineCount: 1,
      createdBy: user.id, updatedBy: user.id
    });
    const row = await models.BankStatementLine.create({
      statementId: statement.id,
      lineNo: 1,
      date: rowDate,
      rawDescription: 'DIGITAL BOOKS(ド /',
      description: 'DIGITAL BOOKS(ド /',
      amountOut: amount, amountIn: null,
      status: 'booked',
      crossSlipDetailId: detail.id,
      createdBy: user.id, updatedBy: user.id
    });
    return { slip, detail, statement, row };
  };

  const buildReport = async () => {
    return models.ExpenseReport.create({
      submittedBy: data.creator.id,
      submittedAt: new Date(2026, 2, 15),
      companyId: data.company.id,
      createdBy: data.creator.id, updatedBy: data.creator.id
    });
  };

  const buildLine = (report, values = {}) => {
    return models.ExpenseReportLine.create({
      expenseReportId: report.id,
      lineNo: 0,
      paymentDate: '2026-03-10',
      payeeMappingId: payeeMapping.id,
      description: '書籍代',
      amount: 3000,
      paymentMappingId: paymentMapping.id,
      createdBy: data.creator.id, updatedBy: data.creator.id,
      ...values
    });
  };

  const resolveReportLines = async (report) => {
    return models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
  };

  afterEach(async () => {
    await models.BankStatementLine.destroy({ where: {} });
    await models.BankStatement.destroy({ where: {} });
    await models.CrossSlipDetail.destroy({ where: {} });
    await models.CrossSlip.destroy({ where: {} });
    await models.ExpenseReportLine.destroy({ where: {} });
    await models.ExpenseReport.destroy({ where: {} });
  });

  it('統合: カード行の突合先が精算書伝票に移り、仮伝票が消える', async function () {
    this.timeout(60000);
    const temp = await makeTempPostponed({ slipDate: '2026-03-12', rowDate: '2026-03-12' });
    const report = await buildReport();
    await buildLine(report, { paymentDate: '2026-03-10' });
    const result = await createSlipForReport(report, await resolveReportLines(report), data.creator);
    const slip = result.slips[0];
    assert.ok(slip.id);
    // 統合は起票の内側で自動に行われる（候補1つ）。ここでは結果を見る
    // 仮伝票は消えている
    const gone = await models.CrossSlip.findByPk(temp.slip.id);
    assert.isNull(gone);
    // カード行の突合先が精算書伝票の代表行（credit=カードの行）に変わっている
    const row = await models.BankStatementLine.findByPk(temp.row.id);
    const detail = await models.CrossSlipDetail.findByPk(Number(row.crossSlipDetailId));
    assert.equal(detail.creditAccount, '2030000');
    assert.equal(Number(detail.crossSlipId), Number(slip.id));
    // 精算書側の紐付けはそのまま
    const line = await models.ExpenseReportLine.findOne({ where: { expenseReportId: report.id } });
    assert.equal(line.crossSlipId, slip.id);
    // 候補はもうない（統合済み）
    const candidates = await findSpendMergeCandidates(slip);
    assert.lengthOf(candidates, 0);
  });

  it('候補が複数: 自動統合せず、仮伝票が残る', async function () {
    this.timeout(60000);
    await makeTempPostponed({ slipDate: '2026-03-11' });
    await makeTempPostponed({ slipDate: '2026-03-12' });
    const report = await buildReport();
    await buildLine(report);
    const result = await createSlipForReport(report, await resolveReportLines(report), data.creator);
    // createCrossSlipの返しはプレーンオブジェクトなので DBから引く
    const slip = await models.CrossSlip.findByPk(result.slips[0].id);
    const candidates = await findSpendMergeCandidates(slip);
    assert.lengthOf(candidates, 2);
    const attempt = await mergeSpendIntoPlaceholder(slip, data.creator, {}).catch((e) => e);
    assert.match(attempt.message, /候補が複数/);
    const left = await models.CrossSlip.count({ where: { year: 2026, month: 3 } });
    assert.equal(left, 3, '統合しないので仮伝票2本 + 精算書伝票1本');
  });

  it('日付が3日を超える: 候補として出さない', async function () {
    this.timeout(60000);
    await makeTempPostponed({ slipDate: '2026-03-14', rowDate: '2026-03-14' });
    const report = await buildReport();
    await buildLine(report);
    const result = await createSlipForReport(report, await resolveReportLines(report), data.creator);
    // createCrossSlipの返しはプレーンオブジェクトなので DBから引く
    const slip = await models.CrossSlip.findByPk(result.slips[0].id);
    const candidates = await findSpendMergeCandidates(slip);
    assert.lengthOf(candidates, 0);
  });

  it('仮伝票が承認済み: 候補として出さない', async function () {
    this.timeout(60000);
    await makeTempPostponed({ slipDate: '2026-03-12', approved: true });
    const report = await buildReport();
    await buildLine(report);
    const result = await createSlipForReport(report, await resolveReportLines(report), data.creator);
    // createCrossSlipの返しはプレーンオブジェクトなので DBから引く
    const slip = await models.CrossSlip.findByPk(result.slips[0].id);
    const candidates = await findSpendMergeCandidates(slip);
    assert.lengthOf(candidates, 0);
  });

  it('通帳が後から入った順: 出金仮の仮伝票が精算書伝票に後から統合される', async function () {
    // 精算書を先に承認起票する（この時点では仮伝票が無いので統合しない）
    const report = await buildReport();
    await buildLine(report, { paymentDate: '2026-03-10' });
    const result = await createSlipForReport(report, await resolveReportLines(report), data.creator);
    const slip = await models.CrossSlip.findByPk(result.slips[ 0 ].id);
    assert.ok(slip.id);
    assert.equal(await models.CrossSlip.count({ where: { year: 2026, month: 3 } }), 1);
    // カード取り込みで仮伝票が後からできる（bookLinesからの発火を想定して
    // autoMergeSlipAfterBook を呼ぶ）
    const temp = await makeTempPostponed({ slipDate: '2026-03-12', rowDate: '2026-03-12' });
    const merge = await autoMergeSlipAfterBook(temp.slip, data.creator);
    assert.ok(merge);
    assert.equal(merge.merged, true);
    // 精算書側の伝票が残り、仮伝票は消える
    assert.isNull(await models.CrossSlip.findByPk(temp.slip.id));
    assert.isOk(await models.CrossSlip.findByPk(slip.id));
    // カード行の突合先が精算書伝票に移る
    const row = await models.BankStatementLine.findByPk(temp.row.id);
    const detail = await models.CrossSlipDetail.findByPk(Number(row.crossSlipDetailId));
    assert.equal(Number(detail.crossSlipId), Number(slip.id));
  });
});
