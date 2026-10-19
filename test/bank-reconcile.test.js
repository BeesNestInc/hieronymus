import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import {create as createCrossSlip} from '../libs/cross_slip.js';
import {autoMatch, bookLines, selectForExpense, suggestPayees} from '../libs/bank-reconcile.js';

// 取り込んだ明細の突合・起票のテスト（DB使用。*_test のみで実行可）

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

describe('bank-reconcile (test db)', () => {
  let data;
  let bankAccount;
  let payeeMapping;
  let approver;

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
    // 前回実行の残データを掃除する（依存の順に削除）
    await models.BankStatementLine.destroy({ where: {} });
    await models.BankStatement.destroy({ where: {} });
    await models.ExpenseReportLine.destroy({ where: {} });
    await models.ExpenseReport.destroy({ where: {} });
    await models.CrossSlipDetail.destroy({ where: {} });
    await models.CrossSlip.destroy({ where: {} });
    await models.ExpenseMapping.destroy({ where: {} });
    // 銀行口座（普通預金）
    bankAccount = await findOrCreate(models.Account, {
      accountCode: '1010010'
    }, {
      name: '普通預金',
      key: 'bank',
      accountClassId: data.expense.accountClassId,
      accountCode: '1010010',
      taxClass: 0,
      subAccountCount: 0
    });
    // 経費の支払先マッピング
    payeeMapping = await models.ExpenseMapping.create({
      kind: 'payee',
      name: 'テスト取引先',
      companyId: data.company.id,
      account: '7000001'
    });
    // 利息仕訳テンプレ用（受取利息と源泉所得税=預り金の補助「源泉」）
    const income = await findOrCreate(models.Account, {
      accountCode: '8000000'
    }, {
      name: '受取利息',
      key: 'interest-income',
      accountClassId: data.expense.accountClassId,
      accountCode: '8000000',
      taxClass: 0,
      subAccountCount: 0
    });
    const gensenParent = await findOrCreate(models.Account, {
      accountCode: '3730000'
    }, {
      name: '預り金',
      key: 'azukari',
      accountClassId: data.expense.accountClassId,
      accountCode: '3730000',
      taxClass: 0,
      subAccountCount: 1
    });
    await findOrCreate(models.SubAccount, {
      accountId: gensenParent.id,
      key: 'gensen'
    }, {
      name: '源泉所得税',
      key: 'gensen',
      accountId: gensenParent.id,
      subAccountCode: 1,
      taxClass: 0
    });
    approver = data.approver;
  });

  const createStatement = async (kind, lines, profileName = null) => {
    const statement = await models.BankStatement.create({
      kind: kind,
      account: ( kind === 'bank' ) ? '1010010' : null,
      subAccount: null,
      cardName: ( kind === 'bank' ) ? null : 'テストカード',
      profileName: profileName,
      lineCount: lines.length
    });
    const created = [];
    for ( let i = 0; i < lines.length; i ++ ) {
      created.push(await models.BankStatementLine.create({
        statementId: statement.id,
        lineNo: i + 1,
        status: 'unmatched',
        category: 'normal',
        ...lines[ i ]
      }));
    }
    return { statement: statement, lines: created };
  };

  it('autoMatch: 金額一致+日付±3日の既存明細と突合する', async () => {
    // 既存伝票（銀行からの出金: 貸方 普通預金 29,544）
    const slip = await createCrossSlip({
      year: 2026, month: 8, day: 3,
      lines: [{
        debitAccount: '7000001', debitAmount: 29544,
        creditAccount: '1010010', creditSubAccount: null, creditAmount: 29544,
        application1: 'デビット'
      }]
    }, approver, { forceUnapproved: true });
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-08-02', rawDescription: 'デビット　４８３３３９', amountOut: 29544 },
      { date: '2026-08-20', rawDescription: 'デビット　４８３３３９', amountOut: 99999 }
    ]);
    const result = await autoMatch(statement);
    assert.equal(result.matched, 1);
    await lines[0].reload();
    assert.equal(lines[0].status, 'matched');
    assert.isNotNull(lines[0].crossSlipDetailId);
    await lines[1].reload();
    assert.equal(lines[1].status, 'unmatched');
  });

  it('bookLines: 支払先マッピングを指定して未照合行を一括起票する', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-08-05', rawDescription: '振込＊テスト取引先', amountOut: 10000 },
      { date: '2026-08-06', rawDescription: 'ＡＴＭ手数料', amountOut: 140 },
      { date: '2026-08-07', rawDescription: '利息', amountIn: 126, category: 'interest' }
    ]);
    const result = await bookLines(statement, [
      { lineId: lines[0].id, payeeMappingId: payeeMapping.id },
      { lineId: lines[1].id, payeeMappingId: payeeMapping.id },
      { lineId: lines[2].id }
    ], approver);
    assert.lengthOf(result.slips, 3);
    await lines[0].reload();
    assert.equal(lines[0].status, 'booked');
    assert.isNotNull(lines[0].crossSlipDetailId);
    // 起票された明細の科目と税ルール導出を確認する
    const detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(detail.debitAccount, '7000001');
    assert.equal(detail.creditAccount, '1010010');
    assert.equal(Number(detail.debitAmount), 10000);
  });

  it('bookLines: 利息行は受取利息+源泉所得税のテンプレで起票する', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-09-14', rawDescription: '利息', amountIn: 126, category: 'interest' }
    ]);
    const result = await bookLines(statement, [
      { lineId: lines[0].id }
    ], approver);
    assert.lengthOf(result.slips, 1);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: result.slips[0].id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    // 源泉あり: 借方 普通預金(126) + 借方 源泉所得税(23) / 貸方 受取利息(149)
    assert.lengthOf(details, 2);
    const bank = details[0];
    assert.equal(bank.debitAccount, '1010010');
    assert.equal(Number(bank.debitAmount), 126);
    assert.equal(bank.creditAccount, '8000000');
    assert.equal(Number(bank.creditAmount), 126);
    const gensen = details[1];
    assert.equal(Number(gensen.debitAmount), 23);
    assert.equal(gensen.creditAccount, '8000000');
    assert.equal(Number(gensen.creditAmount), 23);
    await lines[0].reload();
    assert.equal(lines[0].status, 'booked');
  });

  it('bookLines: 利息の極小額（源泉0円）は受取利息のみ', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-09-21', rawDescription: '利息', amountIn: 1, category: 'interest' }
    ]);
    const result = await bookLines(statement, [ { lineId: lines[0].id } ], approver);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: result.slips[0].id }
    });
    assert.lengthOf(details, 1);
    assert.equal(Number(details[0].debitAmount), 1);
    assert.equal(Number(details[0].creditAmount), 1);
  });

  it('suggestPayees: bookRulesとマッピングkey/nameの一致で支払先を提案する', async () => {
    // key付きマッピング（手数料用）
    const feeMapping = await models.ExpenseMapping.create({
      kind: 'payee',
      key: 'tesuuryou',
      name: '送金手数料',
      account: '7000001'
    });
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-08-06', rawDescription: '振込手数料', amountOut: 140 },
      { date: '2026-08-06', rawDescription: '振込＊テスト取引先', amountOut: 20000 },
      { date: '2026-08-07', rawDescription: '謎の入金', amountIn: 500 }
    ], 'テスト銀行');
    // bookRules（プロファイル）あり: 摘要パターン→マッピングkey
    const ruleProfiles = [ { name: 'テスト銀行', bookRules: [
      { pattern: '手数料$', mappingKey: 'tesuuryou' }
    ] } ];
    const ruled = await suggestPayees(statement, ruleProfiles);
    // ルール命中（振込手数料→送金手数料マッピング）+ name包含（テスト取引先）
    assert.lengthOf(ruled, 2);
    assert.deepEqual(ruled.map((s) => ( s.lineId )).sort((a, b) => a - b),
      [ lines[0].id, lines[1].id ].sort((a, b) => a - b));
    const fee = ruled.find((s) => ( s.lineId === lines[0].id ));
    assert.equal(fee.payeeMappingId, feeMapping.id);
    // プロファイルなしでも key/name 包含で提案する
    const plain = await suggestPayees(statement, [ { name: 'テスト銀行' } ]);
    assert.lengthOf(plain, 1);
    assert.equal(plain[0].lineId, lines[1].id);
  });

  it('selectForExpense: 個人カード明細の選択行を精算書の明細にする', async () => {
    const report = await models.ExpenseReport.create({
      submittedBy: data.creator.id,
      purpose: 'テスト精算'
    });
    const { statement, lines } = await createStatement('personal_card', [
      { date: '2026-08-10', rawDescription: 'ＧＯＯＧＬＥ＊ＣＬＯＵＤ', amount: 5561 },
      { date: '2026-08-11', rawDescription: '個人利用の店', amount: 3000 }
    ]);
    const result = await selectForExpense(statement, [
      { lineId: lines[0].id, payeeMappingId: payeeMapping.id }
    ], report, data.creator);
    assert.lengthOf(result.lines, 1);
    const reportLine = result.lines[0];
    assert.equal(reportLine.expenseReportId, report.id);
    assert.equal(reportLine.payeeMappingId, payeeMapping.id);
    assert.equal(reportLine.description, 'ＧＯＯＧＬＥ＊ＣＬＯＵＤ');
    assert.equal(Number(reportLine.amount), 5561);
    await lines[0].reload();
    assert.equal(lines[0].status, 'selected');
    assert.equal(lines[0].expenseReportLineId, reportLine.id);
    // 未選択の行はそのまま
    await lines[1].reload();
    assert.equal(lines[1].status, 'unmatched');
  });
});
