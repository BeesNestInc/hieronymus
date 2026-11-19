import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import { settleStatement, findDepositMergeCandidates, mergeSettlementIntoDeposit, linkDepositToSettlement, makePattern } from '../libs/bank-reconcile.js';

// 計算書伝票 ↔ 通帳側の入金仮伝票の統合（deposit merge）のテスト（DB使用）。
// 通帳取り込みで仮登録された伝票（借: 銀行科目 / 貸: 入金仮）と、計算書から
// 起票した複合伝票が同じ取引なら、通帳側の伝票に計算書の中身を移してひとつに
// する（通帳側の番号・日付・紐付けを生かす。同じ取引の二重伝票を防ぐ）。

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

const SETTLE_LINES = [
  { date: '2026-07-29', rawDescription: '売上 商品代金', amountIn: 125881, amountOut: null, memo: null },
  { date: '2026-07-29', rawDescription: '売上 税金', amountIn: 12796, amountOut: null, memo: null },
  { date: '2026-07-29', rawDescription: '売上 配送料', amountIn: 3091, amountOut: null, memo: null },
  { date: '2026-07-29', rawDescription: '支出 手数料', amountIn: null, amountOut: 103500, memo: null },
  { date: '2026-07-29', rawDescription: '純利益の振込み', amountIn: 38268, amountOut: null, memo: '銀行振込ID 今回の送金 : SLR1U769R1VMF6JPGBIH。' }
];

describe('deposit merge（計算書→入金仮の統合）', () => {
  let data;
  let bankFinancial;
  let settlementFinancial;
  const createdUsers = [];
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
    await models.BankStatementLine.destroy({ where: {} });
    await models.BankStatement.destroy({ where: {} });
    await models.CrossSlipDetail.destroy({ where: {} });
    await models.CrossSlip.destroy({ where: {} });
    await models.BankStatementRule.destroy({ where: {} });
    await models.Financial.destroy({ where: { kind: 'settlement' } });
    // 漁が同じ (accountCode+sub) のfinancialが尾灯する（テストfiの再実行で
    // 'テスト銀行'が溜まると findFinancialBySide が淘汰して古い方を返す）。
    // 学習・候補解決の整合のため、このテストのfinancialを掃除してから作る
    await models.Financial.destroy({ where: { name: 'テスト銀行' } });
    bankFinancial = await models.Financial.create({
      name: 'テスト銀行', kind: 'bank',
      accountCode: '1010010', subAccountCode: 1,
      createdBy: data.approver.id, updatedBy: data.approver.id
    });
    settlementFinancial = await models.Financial.create({
      name: 'テストモール', kind: 'settlement',
      accountCode: null, subAccountCode: null,
      createdBy: data.approver.id, updatedBy: data.approver.id
    });
  });

  // 前テストの伝票・取込は次の判定に写るので毎回掃除する
  afterEach(async () => {
    await models.BankStatementLine.destroy({ where: {} });
    await models.BankStatement.destroy({ where: {} });
    await models.CrossSlipDetail.destroy({ where: {} });
    await models.CrossSlip.destroy({ where: {} });
    await models.BankStatementRule.destroy({ where: {} });
  });

  // 通帳側の仮伝票（借: 銀行 / 貸: 入金仮）を作る（bookLines が作るのと同じ形）。
  // bankLineDate: 取込行の日付。slipDate との差が統合の許容日数になる
  const makeDepositSlip = async ({ slipDate = '2026-08-01', bankLineDate = '2026-08-01', amount = 38268, approved = false, creditAccount = '3900000' } = {}) => {
    const user = data.creator;
    const [ y, mo, d ] = slipDate.split('-').map(Number);
    // 伝票番号は (year, month, no) の unique。テスト内の連番を振る
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
      debitAccount: '1010010', debitSubAccount: 1, debitAmount: amount, debitTax: 0,
      creditAccount: creditAccount, creditSubAccount: null, creditAmount: amount, creditTax: 0,
      application1: '振込 * アマゾンジャパン（ド チ)',
      createdBy: user.id, updatedBy: user.id
    });
    // 計算書（settlement）
    const statement = await models.BankStatement.create({
      financialId: settlementFinancial.id,
      kind: 'settlement',
      cardName: settlementFinancial.name,
      fileName: `settle-${Date.now()}.pdf`,
      periodFrom: '2026-07-29', periodTo: '2026-07-29',
      lineCount: SETTLE_LINES.length,
      createdBy: user.id, updatedBy: user.id
    });
    for ( const [ i, src ] of SETTLE_LINES.entries() ) {
      await models.BankStatementLine.create({
        statementId: statement.id,
        lineNo: i + 1,
        date: src.date,
        rawDescription: src.rawDescription,
        description: src.rawDescription,
        amountIn: src.amountIn, amountOut: src.amountOut,
        memo: src.memo,
        status: 'unmatched',
        createdBy: user.id, updatedBy: user.id
      });
    }
    // 実通帳（bank）と入金行の取込行（ステータス booked で仮伝票に紐付く）
    const bankStatement = await models.BankStatement.create({
      financialId: bankFinancial.id,
      kind: 'bank',
      account: '1010010', subAccount: 1,
      cardName: bankFinancial.name,
      fileName: `bank-${Date.now()}.txt`,
      periodFrom: bankLineDate, periodTo: bankLineDate,
      lineCount: 1,
      createdBy: user.id, updatedBy: user.id
    });
    const bankLine = await models.BankStatementLine.create({
      statementId: bankStatement.id,
      lineNo: 1,
      date: bankLineDate,
      rawDescription: '振込 * アマゾンジャパン(ド /',
      description: '振込 * アマゾンジャパン(ド /',
      amountIn: amount, amountOut: null,
      status: 'booked',
      crossSlipDetailId: detail.id,
      createdBy: user.id, updatedBy: user.id
    });
    return { slip, detail, statement, bankStatement, bankLine };
  };

  const settle = async (statement, user) => {
    const lines = await models.BankStatementLine.findAll({
      where: { statementId: statement.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    console.log('SETTLE LINES', lines.length, JSON.stringify(lines.map((l) => l.rawDescription.slice(0, 10))));
    const transfer = lines.find((l) => /振込/.test(l.rawDescription));
    const sale = lines.filter((l) => /売上/.test(l.rawDescription));
    const fee = lines.find((l) => /支出/.test(l.rawDescription));
    return settleStatement(statement, {
      day: statement.periodFrom,
      draft: {
        lines: [
          {
            label: '純利益の振込み',
            debit: { rows: [ transfer.id ], account: '1010010', sub: 1 },
            credit: { rows: sale.map((l) => l.id), account: '6000000', sub: null }
          },
          {
            label: '手数料',
            debit: { rows: [ fee.id ], account: '7000001', sub: null },
            credit: { rows: [], account: null, sub: null }
          }
        ]
      }
    }, user);
  };

  // 通帳側の入金行が「未照合」のままのケースを用意するヘルパー。
  // 入金行（同額・計算書日付の±3日以内）だけを取り込んでおき、
  // 計算書の起票で入金仮が作られるかを見る
  const makeUnbookedDepositAndSettle = async () => {
    const user = data.creator;
    // 計算書（settlement）を作る
    const statement = await models.BankStatement.create({
      financialId: settlementFinancial.id,
      kind: 'settlement',
      cardName: settlementFinancial.name,
      fileName: `settle-auto-${Date.now()}.pdf`,
      periodFrom: '2026-07-29', periodTo: '2026-07-29',
      lineCount: SETTLE_LINES.length,
      createdBy: user.id, updatedBy: user.id
    });
    for ( const [ i, src ] of SETTLE_LINES.entries() ) {
      await models.BankStatementLine.create({
        statementId: statement.id,
        lineNo: i + 1,
        date: src.date,
        rawDescription: src.rawDescription,
        description: src.rawDescription,
        amountIn: src.amountIn, amountOut: src.amountOut,
        memo: src.memo,
        status: 'unmatched',
        createdBy: user.id, updatedBy: user.id
      });
    }
    // 実通帳（bank）の入金行は「未照合」のまま取り込んでおく
    const bankStatement = await models.BankStatement.create({
      financialId: bankFinancial.id,
      kind: 'bank',
      account: '1010010', subAccount: 1,
      cardName: bankFinancial.name,
      fileName: `bank-auto-${Date.now()}.txt`,
      periodFrom: '2026-08-01', periodTo: '2026-08-01',
      lineCount: 1,
      createdBy: user.id, updatedBy: user.id
    });
    const bankLine = await models.BankStatementLine.create({
      statementId: bankStatement.id,
      lineNo: 1,
      date: '2026-08-01',
      rawDescription: '振込 * アマゾンジャパン(ド /',
      description: '振込 * アマゾンジャパン(ド /',
      amountIn: 38268, amountOut: null,
      status: 'unmatched',
      createdBy: user.id, updatedBy: user.id
    });
    const result = await settle(statement, user);
    return { result: result, bankLine: bankLine, statement: statement };
  };

  // 通帳側の入金行をまだ起票していない（未照合のまま）とき、計算書の起票で
  // 同額・近い日付の未照合の入金行を入金仮で起票してから統合する
  // （計算書の日付を実際の入金日に合わせても「同じ取り引きにならない」のを防ぐ）
  it('統合: 自動起票はルールを使わず入金仮で立てる', async function () {
    this.timeout(60000);
    // 学習済みルール（振込摘要→売上高）がある状態でも、自動起票は
    // 入金仮のプレースホルダで立てる。ルールで売上高に直接起票すると
    // 計算書の複合伝票と二重起票（売上の二重計上）になるため
    await models.BankStatementRule.create({
      financialId: bankFinancial.id,
      pattern: makePattern('振込 * アマゾンジャパン(ド /'),
      direction: 'in',
      oppositeAccount: '6000000',
      usageCount: 0,
      createdBy: data.creator.id, updatedBy: data.creator.id
    });
    const settleResult = await makeUnbookedDepositAndSettle();
    assert.isTrue(settleResult.result.merged === true);
    // 統合後の伝票: 銀行明細は1つで、貸方は計算書側の売上高（入金仮が
    // 差し替わる）。ルールで立てた売上高が二重に載っていないこと
    const slip = await models.CrossSlip.findByPk(settleResult.result.slip.id);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    const bankDetails = details.filter((d) => ( d.debitAccount === '1010010' && Number(d.debitAmount) === 38268 ));
    assert.lengthOf(bankDetails, 1);
    assert.equal(bankDetails[0].creditAccount, '6000000');
  });

  it('統合: 通帳側の入金行が未照合でも計算書の起票で統合される', async function () {
    this.timeout(60000);
    const settleResult = await makeUnbookedDepositAndSettle();
    assert.isTrue(settleResult.result.merged === true);
    // 起票された通帳側の伝票に計算書の中身が統合されている
    const slip = await models.CrossSlip.findByPk(settleResult.result.slip.id);
    assert.isNotOk(slip.approvedAt);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    // 銀行側の明細（借 銀行 / 貸 売上高。入金仮が計算書側の貸方に差し替わる）
    const bankDetail = details.find((d) => ( d.debitAccount === '1010010' && Number(d.debitAmount) === 38268 ));
    assert.isOk(bankDetail);
    assert.equal(bankDetail.creditAccount, '6000000');
    // 未照合だった入金行は起票済みになり、統合後の伝票に紐付く
    await settleResult.bankLine.reload();
    assert.equal(settleResult.bankLine.status, 'booked');
    assert.equal(Number(settleResult.bankLine.crossSlipDetailId), Number(bankDetail.id));
  });

  it('統合: 通帳側の仮伝票に計算書の中身が移る（1本に）', async function () {
    this.timeout(60000);
    const deposit = await makeDepositSlip({ slipDate: '2026-08-01' });
    const result = await settle(deposit.statement, data.creator);
    // 統合が起きる（返しは通帳側の伝票になっている）
    assert.equal(result.slip.id, deposit.slip.id);
    assert.isTrue(result.merged === true);
    assert.ok(result.discarded && ( Number(result.discarded) !== Number(deposit.slip.id) ));
    // 計算書側の伝票は破棄されている
    const gone = await models.CrossSlip.findByPk(result.discarded);
    assert.isNull(gone);
    // 通帳側の伝票（93相当）に統合されている: 日付・番号は通帳側のまま
    const slip = await models.CrossSlip.findByPk(deposit.slip.id);
    assert.equal(slip.year, 2026);
    assert.equal(slip.month, 8);
    assert.equal(slip.day, 1);
    assert.equal(slip.lineCount, 2);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    assert.lengthOf(details, 2);
    // 銀行側の明細: 借 銀行 / 貸 売上高（入金仮が外れ、計算書側の貸方を引き受ける）
    assert.equal(details[0].debitAccount, '1010010');
    assert.equal(details[0].debitAmount, 38268);
    assert.equal(details[0].creditAccount, '6000000');
    assert.equal(details[0].creditAmount, 141768);
    // 費用行は移設されている
    const feeLines = details.filter((d) => ( d.debitAccount === '7000001' && Number(d.debitAmount) === 103500 ));
    assert.lengthOf(feeLines, 1);
    // 計算書側の取込行は通帳側の伝票に紐付き続ける（取込行の紐付けが維持される）
    const settleLines = await models.BankStatementLine.findAll({
      where: { statementId: deposit.statement.id },
      raw: true
    });
    for ( const line of settleLines ) {
      const targetId = line.crossSlipDetailId ? Number(line.crossSlipDetailId) : null;
      assert.ok(targetId, `取込行への紐付けが維持される（${line.rawDescription}）`);
      const target = await models.CrossSlipDetail.findByPk(targetId);
      assert.equal(target.crossSlipId, slip.id);
    }
    // 実通帳の行の紐付けも維持される
    const bankLine = await models.BankStatementLine.findByPk(deposit.bankLine.id);
    assert.equal(Number(bankLine.crossSlipDetailId), Number(details[0].id));
    // 学習: 通帳側の伝票に残った摘要から相手方を覚える
        const rule = await models.BankStatementRule.findOne({
      where: { financialId: bankFinancial.id, oppositeAccount: '6000000' }
    });
    assert.isNotNull(rule, '振込摘要→売上高を学習する');
  });

  // 学習ルールで「借: 銀行 / 貸: 売上高」と直接起票された1行伝票も統合候補に
  // なる（計算書の複合伝票と二重起票・売上の二重計上を防ぐ）
  it('統合: ルールで売上高に直接起票された1行伝票も統合先になる', async function () {
    this.timeout(60000);
    const deposit = await makeDepositSlip({ slipDate: '2026-08-01', creditAccount: '6000000' });
    const result = await settle(deposit.statement, data.creator);
    assert.isTrue(result.merged === true);
    assert.equal(result.slip.id, deposit.slip.id);
    // 通帳側の伝票に計算書の中身が統合されている（貸方は計算書側の売上高）
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: deposit.slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    assert.lengthOf(details, 2);
    assert.equal(details[0].debitAccount, '1010010');
    assert.equal(details[0].creditAccount, '6000000');
    assert.equal(Number(details[0].debitAmount), 38268);
    // 費用行も移設されている
    const feeLines = details.filter((d) => ( d.debitAccount === '7000001' && Number(d.debitAmount) === 103500 ));
    assert.lengthOf(feeLines, 1);
  });

  // 突合（linkDepositToSettlement）で、起票済みの銀行行を「銀行行だけの
  // 1行伝票」から計算書側の伝票に紐付け替える（二重伝票の解消）
  it('突合: 起票済みの銀行行を1行伝票から計算書側の伝票に紐付け替える', async function () {
    this.timeout(60000);
    // 計算書伝票(7/29)と1行伝票(8/20)が離れているので起票時の自動統合は
    // 起きない（計算書側の伝票と1行伝票が並んで残る状態を作る）
    const deposit = await makeDepositSlip({ slipDate: '2026-08-20', bankLineDate: '2026-08-20', creditAccount: '6000000' });
    const settleResult = await settle(deposit.statement, data.creator);
    assert.isNotOk(settleResult.merged);
    const settleSlip = settleResult.slip;
    const settleDetails = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: settleSlip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    const bankDetailOfSettle = settleDetails.find((d) => ( d.debitAccount === '1010010' ));
    assert.isOk(bankDetailOfSettle);
    // 突合: 銀行行を1行伝票から計算書側の伝票へ紐付け替える
    await deposit.bankLine.reload();
    assert.equal(deposit.bankLine.status, 'booked');
    const linked = await linkDepositToSettlement(
      await models.BankStatement.findByPk(deposit.bankStatement.id),
      deposit.bankLine.id,
      bankDetailOfSettle.id
    );
    assert.isOk(linked);
    await deposit.bankLine.reload();
    assert.equal(deposit.bankLine.status, 'matched');
    assert.equal(Number(deposit.bankLine.crossSlipDetailId), Number(bankDetailOfSettle.id));
    // 1行伝票は破棄されている
    const gone = await models.CrossSlip.findByPk(deposit.slip.id);
    assert.isNull(gone);
    // 計算書側の伝票は残る
    assert.isOk(await models.CrossSlip.findByPk(settleSlip.id));
  });

  it('候補が複数: 自動統合せず、計算書側の伝票を残す', async function () {
    this.timeout(60000);
    await makeDepositSlip({ slipDate: '2026-07-30' });
    await makeDepositSlip({ slipDate: '2026-07-31' });
    // 3本目（この計算書の実準）は計算書日付7/29の入金仮にもなる（候補が3つ出る
    // 意味のト番。ダサい「1つ以上ある」を検出できればよい）
    const third = await makeDepositSlip({ slipDate: '2026-07-29' });
    const result = await settle(third.statement, data.creator);
    assert.notEqual(result.slip.id, undefined);
    assert.isUndefined(result.merged, '複数候補では統合しない');
    // 候補検索は複数を返す（採用はしない）。3本 = 先に作った2本 + この計算書の
    // 実準（slipDate 7/29）の入金仮。どれ1つに絞れないので自動統合しない
    const candidates = await findDepositMergeCandidates(result.slip);
    assert.lengthOf(candidates, 3);
    const mergeCall = await mergeSettlementIntoDeposit(result.slip, data.creator, {}).catch((e) => e);
    assert.match(mergeCall.message, /候補が複数/);
    // 自動統合しないので計算書側の伝票も残る（計算書側+通帳側3本 = 4本）
    const count = await models.CrossSlip.count({ where: { year: 2026, month: 7 } });
    assert.equal(count, 4, '自動統合しないので計算書側の伝票も含め4本');
  });

  it('日付が3日を超える: 候補として出さない', async function () {
    this.timeout(60000);
    const deposit = await makeDepositSlip({ slipDate: '2026-08-05' });
    const result = await settle(deposit.statement, data.creator);
    assert.isUndefined(result.merged, '日付超過は統合しない');
    const candidates = await findDepositMergeCandidates(result.slip);
    assert.lengthOf(candidates, 0);
  });

  it('統合先が承認済み: 候補として出さない', async function () {
    this.timeout(60000);
    const deposit = await makeDepositSlip({ slipDate: '2026-08-01', approved: true });
    const result = await settle(deposit.statement, data.creator);
    assert.isUndefined(result.merged, '承認済みは統合しない');
    const candidates = await findDepositMergeCandidates(result.slip);
    assert.lengthOf(candidates, 0);
  });
});
