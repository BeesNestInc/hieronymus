import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import {create as createCrossSlip, update as updateCrossSlip} from '../libs/cross_slip.js';
import {
  autoMatch, bookLines, selectForExpense, suggestOpposites,
  reconcilePlaceholders, rebookStatement, learnOpposite
} from '../libs/bank-reconcile.js';

// 取り込んだ明細の突合・起票のテスト（DB使用。*_test のみで実行可）
// 起票は「学習ルール → 仮入科目（出金仮1900000/入金仮3900000）」で決まり、
// 仮で起票した行は後の処理（reconcilePlaceholders）で実科目に差し替える。

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
    await models.BankStatementRule.destroy({ where: {} });
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
    // 仮入科目（マイグレーションと同じ。test DBではシード時に存在しない）
    await findOrCreate(models.AccountClass, {
      field: 1, adding: 90
    }, {
      major: '資産', middle: '流動資産', minor: '出金仮',
      field: 1, adding: 90
    });
    await findOrCreate(models.Account, {
      accountCode: '1900000'
    }, {
      name: '出金仮', key: 'shukkinkari',
      accountClassId: data.expense.accountClassId,
      accountCode: '1900000', taxClass: 0, subAccountCount: 0
    });
    await findOrCreate(models.AccountClass, {
      field: 3, adding: 90
    }, {
      major: '負債', middle: '流動負債', minor: '入金仮',
      field: 3, adding: 90
    });
    await findOrCreate(models.Account, {
      accountCode: '3900000'
    }, {
      name: '入金仮', key: 'nyukinkari',
      accountClassId: data.expense.accountClassId,
      accountCode: '3900000', taxClass: 0, subAccountCount: 0
    });
    approver = data.approver;
  });

  // bookLines/autoMatch後の行のインメモリ状態をデータベースに合わせる
  const reloadAll = async (lines) => {
    for ( const line of lines ) {
      await line.reload();
    }
  };

  const createStatement = async (kind, lines, profileName = null) => {    const statement = await models.BankStatement.create({
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

  it('bookLines: 指定の相手方（マッピング/直指定）で未照合行を起票する', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-08-05', rawDescription: '振込＊テスト取引先', amountOut: 10000 },
      { date: '2026-08-07', rawDescription: '利息', amountIn: 126, category: 'interest' }
    ]);
    const result = await bookLines(statement, [
      { lineId: lines[0].id, payeeMappingId: payeeMapping.id },
      { lineId: lines[1].id }
    ], approver);
    assert.lengthOf(result.slips, 2);
    await lines[0].reload();
    assert.equal(lines[0].status, 'booked');
    assert.isNotNull(lines[0].crossSlipDetailId);
    // 起票された明細の科目を確認する
    const detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(detail.debitAccount, '7000001');
    assert.equal(detail.creditAccount, '1010010');
    assert.equal(Number(detail.debitAmount), 10000);
    // 取込明細行との紐付け（statementLineId）が伝票側に記録される
    assert.equal(detail.statementLineId, lines[0].id);
  });

  it('bookLines: ルールと指定がない行は仮入科目（出金仮/入金仮）で起票する', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-08-10', rawDescription: 'デビット　６３８８１４', amountOut: 3300 },
      { date: '2026-08-11', rawDescription: '謎の入金', amountIn: 500 }
    ]);
    const result = await bookLines(statement, null, approver);
    assert.lengthOf(result.slips, 2);
    await reloadAll(lines);
    const outDetail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(outDetail.debitAccount, '1900000');
    assert.equal(outDetail.creditAccount, '1010010');
    assert.equal(Number(outDetail.debitAmount), 3300);
    assert.equal(outDetail.statementLineId, lines[0].id);
    const inDetail = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    assert.equal(inDetail.creditAccount, '3900000');
    assert.equal(inDetail.debitAccount, '1010010');
  });

  it('bookLines: 学習ルールに一致する行は学習済みの実科目で起票する', async () => {
    // ルール（摘要完全一致 → 相手方）を学習済みとして登録
    await learnOpposite(
      { account: '1010010', sub: null },
      '国税　納期限',
      { account: '7000001', sub: null }
    );
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-09-01', rawDescription: '国税　納期限', amountOut: 50000 },
      // 同じルールでも一致しない別摘要は仮のまま
      { date: '2026-09-02', rawDescription: 'デビット　４８３３３９', amountOut: 111 }
    ]);
    const result = await bookLines(statement, null, approver);
    await reloadAll(lines);
    const ruled = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(ruled.debitAccount, '7000001');
    const temp = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    assert.equal(temp.debitAccount, '1900000');
  });

  it('bookLines: mergeRules（手数料・利息）は同じ日の主取引行の伝票に合流する', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-08-20', rawDescription: 'ＡＴＭ出金', amountOut: 50000 },
      { date: '2026-08-20', rawDescription: 'ＡＴＭ手数料', amountOut: 110 },
      { date: '2026-08-25', rawDescription: '振込手数料', amountOut: 140 }
    ]);
    const result = await bookLines(statement, null, approver);
    // 同日の手数料は合流、別日の手数料は自分の伝票になる
    assert.lengthOf(result.slips, 2);
    await lines[0].reload();
    await lines[1].reload();
    const mainSlipId = ( await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId) ).crossSlipId;
    const feeSlipId = ( await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId) ).crossSlipId;
    assert.equal(mainSlipId, feeSlipId);
    const feeDetailOfSlip = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    assert.equal(feeDetailOfSlip.debitAccount, '1900000');
    // 別日の手数料は単独伝票
    await lines[2].reload();
    const separateSlipId = ( await models.CrossSlipDetail.findByPk(lines[2].crossSlipDetailId) ).crossSlipId;
    assert.notEqual(separateSlipId, mainSlipId);
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

  it('suggestOpposites: 学習ルールに一致する行だけを表示用に返す', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-09-02', rawDescription: '国税　納期限', amountOut: 60000 },
      { date: '2026-09-03', rawDescription: 'デビット　４３５２１０', amountOut: 999 }
    ]);
    const suggestions = await suggestOpposites(statement);
    assert.lengthOf(suggestions, 1);
    assert.equal(suggestions[0].lineId, lines[0].id);
    assert.equal(suggestions[0].oppositeAccount, '7000001');
  });

  it('伝票更新: 起票済み行の明細の対応を保持する（明細数が変わらなければ）', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-10-01', rawDescription: '国税　納期限', amountOut: 70000 }
    ]);
    const result = await bookLines(statement, null, approver);
    assert.lengthOf(result.slips, 1);
    // update はCrossSlipのレコードを要求する（createCrossSlipの戻り値は参照用）
    const slip = await models.CrossSlip.findByPk(result.slips[0].id);
    await reloadAll(lines);
    const detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    const originalDetailId = detail.id;
    // 明細を修正（科目を変更した体で再作成させる）
    await updateCrossSlip(slip, {
      year: slip.year, month: slip.month, day: slip.day,
      lines: [{
        debitAccount: '7000001', debitAmount: 70000,
        creditAccount: '1010010', creditAmount: 70000,
        application1: '国税　納期限'
      }]
    }, approver, { keepUnapproved: true });
    await lines[0].reload();
    // 行は新しい明細に付け替わる（解放されて未照合に戻らない）
    assert.equal(lines[0].status, 'booked');
    assert.isNotNull(lines[0].crossSlipDetailId);
    assert.notEqual(lines[0].crossSlipDetailId, originalDetailId);
    const newDetail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(newDetail.crossSlipId, slip.id);
    assert.equal(newDetail.debitAccount, '7000001');
  });

  it('reconcilePlaceholders: 仮起票の伝票を実科目の伝票と突合して差し替える', async () => {
    // 実科目の伝票（請求書等を後で入力した体）。銀行・仮科目を含まないもの
    const realSlip = await createCrossSlip({
      year: 2026, month: 10, day: 6,
      lines: [{
        debitAccount: '7000001', debitAmount: 2200,
        creditAccount: '6000001', creditAmount: 2200,
        application1: 'デビット　４８３３３９'
      }]
    }, approver, { forceUnapproved: true });
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-10-05', rawDescription: 'デビット　４８３３３９', amountOut: 2200 },
      { date: '2026-10-05', rawDescription: 'デビット　６３８８１４', amountOut: 800 }
    ]);
    const result = await bookLines(statement, null, approver);
    await reloadAll(lines);
    let detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(detail.debitAccount, '1900000');
    const before = await reconcilePlaceholders();
    // 日付差1・金額一致 → 金額800の行は突合結果の対象にならない
    assert.equal(before.replaced, 1);
    await lines[0].reload();
    detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(detail.debitAccount, '7000001');
    // 差し替えたときに学習する（正規化パターン: NFKCで半角化+空白潰し）
    const rule = await models.BankStatementRule.findOne({
      where: { account: '1010010', pattern: 'デビット483339' }
    });
    assert.isNotNull(rule);
    assert.equal(rule.oppositeAccount, '7000001');
    // 次回から同じ摘要はルールで起票する（仮にならない）
    const { statement: s2, lines: lines2 } = await createStatement('bank', [
      { date: '2026-10-20', rawDescription: 'デビット　４８３３３９', amountOut: 12345 }
    ]);
    await bookLines(s2, null, approver);
    await reloadAll(lines2);
    const ruled = await models.CrossSlipDetail.findByPk(lines2[0].crossSlipDetailId);
    assert.equal(ruled.debitAccount, '7000001');
  });

  it('reconcilePlaceholders: 仮科目や銀行科目を含む明細は差し替え先にならない', async () => {
    // 出金仮の明細は候補から除外される（金額一致があっても）
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-11-01', rawDescription: '振込＊謎', amountOut: 15000 }
    ]);
    await bookLines(statement, null, approver);
    await lines[0].reload();
    const detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(detail.debitAccount, '1900000');
    const result = await reconcilePlaceholders();
    assert.equal(result.replaced, 0);
    await lines[0].reload();
    const after = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(after.debitAccount, '1900000');
  });

  it('rebookStatement: 未承認の仮起票を現行ルールで作り直し、確定済みと精算書由来は守る', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-12-01', rawDescription: '振込＊テスト取引先', amountOut: 20000 }
    ]);
    // 1回目: ルール未登録 → 仮で起票
    const first = await bookLines(statement, null, approver);
    await lines[0].reload();
    const tempDetail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(tempDetail.debitAccount, '1900000');
    const destroyedSlipId = tempDetail.crossSlipId;
    // ルールを追加して再実行 → 解放して現行ルールで再起票
    await learnOpposite(
      { account: '1010010', sub: null },
      '振込＊テスト取引先',
      { account: '7000001', sub: null }
    );
    const result = await rebookStatement(statement, approver);
    assert.equal(result.rebooked, 1);
    // 古い伝票は消えている
    assert.isNull(await models.CrossSlip.findByPk(destroyedSlipId));
    await lines[0].reload();
    const detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(detail.debitAccount, '7000001');
    // 作り直した伝票は未承認のまま（確定はしない）
    const newSlip = await models.CrossSlip.findByPk(detail.crossSlipId);
    assert.isNull(newSlip.approvedAt);
    // 承認済みの伝票に紐付いた行は再実行の対象外
    await models.CrossSlip.update({ approvedAt: new Date() }, { where: { id: detail.crossSlipId } });
    const second = await rebookStatement(statement, approver);
    assert.equal(second.rebooked, 0);
    assert.equal(second.skipped, 1);
    await lines[0].reload();
    const keptDetail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    assert.equal(keptDetail.id, detail.id);
    assert.equal(keptDetail.crossSlipId, newSlip.id);
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
