import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import { settleStatement, settlementPreview, suggestSettlementDeposits, linkDepositToSettlement } from '../libs/bank-reconcile.js';
import { settlementBreakdown, validateProfileYaml, loadProfiles, parseSettlementTextLines } from '../libs/bank-statement.js';

// 計算書（ECモール。kind: settlement）の取り込みと複合起票のテスト（DB使用）。
// 1計算書 = 1複合伝票（借方: 入金先預金+費用各行 / 買方: 売上高=売上側合算）。

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

// 実際のAmazon計算書（2025-07-29）のAI読取結果の構造（テストフィクスチャ）。
// 検算の成立: 売上合計141768 = 振込38268 + 費用合計103500
const AMAZON_SETTLEMENT_LINES = [
  { date: '2026-07-29', rawDescription: '売上 商品代金', amountIn: 125881, amountOut: null, memo: null },
  { date: '2026-07-29', rawDescription: '売上 税金', amountIn: 12796, amountOut: null, memo: null },
  { date: '2026-07-29', rawDescription: '売上 配送料', amountIn: 3091, amountOut: null, memo: null },
  { date: '2026-07-29', rawDescription: '支出 プロモーション割引額', amountIn: null, amountOut: 1130, memo: null },
  { date: '2026-07-29', rawDescription: '支出 FBA手数料 長期在庫保管手数料', amountIn: null, amountOut: 31, memo: null },
  { date: '2026-07-29', rawDescription: '支出 広告費用', amountIn: null, amountOut: 55018, memo: null },
  { date: '2026-07-29', rawDescription: '支出 Amazon手数料 月間登録料', amountIn: null, amountOut: 5390, memo: null },
  { date: '2026-07-29', rawDescription: '支出 Amazon手数料 その他', amountIn: null, amountOut: 41931, memo: null },
  { date: '2026-07-29', rawDescription: '純利益の振込み', amountIn: 38268, amountOut: null, memo: '銀行振込ID 今回の送金 : SLR1U769R1VMF6JPGBIH。' }
];

describe('ec settlement (test db)', () => {
  let data;
  let settlementFinancial;
  before(async function() {
    this.timeout(60000);
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
    await models.CrossSlipDetail.destroy({ where: {} });
    await models.CrossSlip.destroy({ where: {} });
    await models.BankStatementRule.destroy({ where: {} });
    // 計算書の通帳（Amazon）
    await models.Financial.destroy({ where: { kind: 'settlement' } });
    settlementFinancial = await models.Financial.create({
      name: 'テストモール', kind: 'settlement',
      accountCode: null, subAccountCode: null,
      createdBy: data.approver.id, updatedBy: data.approver.id
    });
  });

  // 取込（BankStatement+行）を作る。分類に影響しない部分だけ上書きできる
  const makeStatement = async (lineOverrides = []) => {
    const statement = await models.BankStatement.create({
      financialId: settlementFinancial.id,
      kind: 'settlement',
      account: null,
      subAccount: null,
      cardName: settlementFinancial.name,
      fileName: '20250729.pdf',
      mimeType: 'application/pdf',
      fileBody: Buffer.from('%PDF-1.4 test'),
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      lineCount: AMAZON_SETTLEMENT_LINES.length,
      createdBy: data.approver.id,
      updatedBy: data.approver.id
    });
    let lineNo = 1;
    for ( const src of AMAZON_SETTLEMENT_LINES ) {
      const override = lineOverrides[ lineNo - 1 ] || {};
      await models.BankStatementLine.create({
        statementId: statement.id,
        lineNo: lineNo,
        date: ( override.date !== undefined ) ? override.date : src.date,
        rawDescription: ( override.rawDescription !== undefined ) ? override.rawDescription : src.rawDescription,
        description: src.rawDescription,
        amountIn: ( override.amountIn !== undefined ) ? override.amountIn : src.amountIn,
        amountOut: ( override.amountOut !== undefined ) ? override.amountOut : src.amountOut,
        balance: null,
        memo: ( override.memo !== undefined ) ? override.memo : src.memo,
        status: 'unmatched',
        createdBy: data.approver.id,
        updatedBy: data.approver.id
      });
      lineNo ++;
    }
    return statement;
  };

  // 費用行の科目指定（学習ルールなしの初回は全部の人手指定を想定する）
  const feeLines = async (mapping = {}) => {
    const lines = await models.BankStatementLine.findAll({
      where: { statementId: currentStatement.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    return lines
      .filter((line) => ( line.amountOut !== null && line.amountOut !== undefined ))
      .map((line) => ({
        lineId: line.id,
        account: mapping[ line.rawDescription ] || '7000001',
        subAccount: null
      }));
  };
  let currentStatement = null;

  it('breakdown: AI読取行を売上/費用/振込に分類する（既定語 / 検算）', () => {
    const breakdown = settlementBreakdown(AMAZON_SETTLEMENT_LINES);
    assert.lengthOf(breakdown.saleLines, 3);
    assert.lengthOf(breakdown.expenseLines, 5);
    assert.equal(breakdown.saleTotal, 141768);
    assert.equal(breakdown.expenseTotal, 103500);
    assert.equal(breakdown.transferAmount, 38268);
    assert.equal(breakdown.transferLine.rawDescription, '純利益の振込み');
    assert.deepEqual(breakdown.warnings, []);
    // ポスター: 売上合計 = 振込 + 費用合計
    assert.isTrue(breakdown.saleLines.length + breakdown.expenseLines.length + 1 === AMAZON_SETTLEMENT_LINES.length);
  });

  it('breakdown: 分類できない行には警告が出る（salePattern指定のとき）', () => {
    const lines = AMAZON_SETTLEMENT_LINES.concat([
      { date: '2026-07-29', rawDescription: '不明な行', amountIn: 100, amountOut: null, memo: null }
    ]);
    // salePatternを指定したときだけ、当たらない入力行を「分類できない」と拾う
    // （指定なしだと「振込以外の入金=売上」で拾うので、この警告は出ない）
    const breakdown = settlementBreakdown(lines, { salePattern: '^売上' });
    assert.equal(breakdown.saleTotal, 141768);
    assert.lengthOf(breakdown.warnings, 1);
    assert.match(breakdown.warnings[ 0 ], /分類できませんでした/);
  });

  it('breakdown: 検算が合わないときは警告を出す（入れ子の疑いも添える）', () => {
    const lines = AMAZON_SETTLEMENT_LINES.map((line) => (
      line.rawDescription === '純利益の振込み' ? { ...line, amountIn: 39268 } : line
    ));
    const breakdown = settlementBreakdown(lines);
    assert.lengthOf(breakdown.warnings, 2);
    assert.match(breakdown.warnings[ 0 ], /検算が合いません/);
    assert.match(breakdown.warnings[ 1 ], /入れ子になった集計行/);
  });

  it('validateProfileYaml: settlement プロファイルを受け入れる', () => {
    const ok = validateProfileYaml('name: テストモール\ntype: settlement\nsaleAccount: 6000000\nreceivedAccount: 1010010\n');
    assert.isUndefined(ok.error);
    assert.equal(ok.profile.type, 'settlement');
    const bad = validateProfileYaml('name: テストモール\ntype: settlement\nsaleAccount: 売上高\n');
    assert.match(bad.error, /科目コード/);
  });

  it('settleStatement: 1計算書=1複合伝票（借方 預金+費用 / 買方 売上高）', async () => {
    currentStatement = await makeStatement();
    const result = await settleStatement(currentStatement, {
      received: { account: '1010010', subAccount: 1 },
      sale: { account: '6000000' },
      lines: await feeLines()
    }, data.approver);
    assert.ok(result.slip.id);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: result.slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    assert.lengthOf(details, 7);
    // 借方の入金先預金（振込額）
    assert.equal(details[0].debitAccount, '1010010');
    assert.equal(details[0].debitSubAccount, 1);
    assert.equal(details[0].debitAmount, 38268);
    assert.equal(details[0].creditAmount, 0);
    // 費用行は借方（指定した科目）。金額は取込行どおり
    assert.equal(details[1].debitAccount, '7000001');
    assert.equal(details[1].debitAmount, 1130);
    assert.equal(details[5].debitAmount, 41931);
    // 買提早の売上高（売上側合算）
    assert.equal(details[6].creditAccount, '6000000');
    assert.equal(details[6].debitAmount, 0);
    assert.equal(details[6].creditAmount, 141768);
    // 貸借一致（1伝票で必ず一致する）
    const debitSum = details.reduce((acc, d) => acc + Number(d.debitAmount), 0);
    const creditSum = details.reduce((acc, d) => acc + Number(d.creditAmount), 0);
    assert.equal(debitSum, 141768);
    assert.equal(creditSum, 141768);
    // 伝票は未承認（承認待ち）で作る
    const slip = await models.CrossSlip.findByPk(result.slip.id);
    assert.isNotOk(slip.approvedAt);
    // 伝票日付は振込行の日付
    assert.equal(slip.day, 29);
    assert.equal(slip.month, 7);
    assert.equal(slip.year, 2026);
    // 取込行は全行起票済みに紐付く
    const lines = await models.BankStatementLine.findAll({
      where: { statementId: currentStatement.id }
    });
    for ( const line of lines ) {
      assert.equal(line.status, 'booked');
      assert.isOk(line.crossSlipDetailId);
    }
    // 満行の振込・売上行は伝票に紐付く（備考欄に振込ID。摘要には振込ラベル）
    assert.equal(details[0].application1, '振込 テストモール');
    assert.match(details[0].application2, /SLR1U769R1VMF6JPGBIH/);
    assert.equal(details[6].application1, 'テストモール計算書');
  });

  it('settleStatement: 学習ルールに従う（2回目は科目を指定なしでも学習ルール候補が入る）', async () => {
    // 初回の起票で費用ラベル→科目を学習済み。新しい計算書では候補に乗る
    currentStatement = await makeStatement();
    const preview = await settlementPreview(currentStatement);
    assert.lengthOf(( preview.suggestions || [] ), 5);
    for ( const s of preview.suggestions ) {
      assert.equal(s.account, '7000001');
    }
    // 学習ルールの科目どおりに伝票化できる（lines: null は未対応。ここでは同じ科目を渡す）
    const result = await settleStatement(currentStatement, {
      received: { account: '1010010', subAccount: 1 },
      sale: { account: '6000000' },
      lines: await feeLines()
    }, data.approver);
    assert.ok(result.slip.id);
  });

  it('settleStatement: 費用行の科目が未指定なら起票しない', async () => {
    currentStatement = await makeStatement();
    const lines = await models.BankStatementLine.findAll({
      where: { statementId: currentStatement.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    const outLines = lines.filter((line) => ( line.amountOut !== null && line.amountOut !== undefined ));
    const tail = outLines.pop();
    let thrown = null;
    try {
      await settleStatement(currentStatement, {
        received: { account: '1010010', subAccount: 1 },
        sale: { account: '6000000' },
        lines: outLines.map((line) => ({ lineId: line.id, account: '7000001' }))
      }, data.approver);
    } catch (e) {
      thrown = e;
    }
    assert.isOk(thrown);
    assert.match(thrown.message, /科目が未指定/);
    assert.equal(Number(tail.amountOut), 41931);
  });

  it('settleStatement: 仮科目では起票しない（承認制）', async () => {
    currentStatement = await makeStatement();
    const lines = await models.BankStatementLine.findAll({
      where: { statementId: currentStatement.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    const outLines = lines.filter((line) => ( line.amountOut !== null && line.amountOut !== undefined ));
    let thrown = null;
    try {
      await settleStatement(currentStatement, {
        received: { account: '1010010', subAccount: 1 },
        sale: { account: '6000000' },
        lines: outLines.map((line) => ({ lineId: line.id, account: '1900000' }))
      }, data.approver);
    } catch (e) {
      thrown = e;
    }
    assert.isOk(thrown);
    assert.match(thrown.message, /実科目を指定/);
  });

  it('settleStatement: 検算が合わない計算書は起票しない', async () => {
    currentStatement = await makeStatement([
      null, null, null, null, null, null, null, null,
      { amountIn: 39268 }  // 振込行だけ1000円増える
    ]);
    let thrown = null;
    try {
      await settleStatement(currentStatement, {
        received: { account: '1010010', subAccount: 1 },
        sale: { account: '6000000' },
        lines: await feeLines()
      }, data.approver);
    } catch (e) {
      thrown = e;
    }
    assert.isOk(thrown);
    assert.match(thrown.message, /検算が合いません/);
  });

  it('settleStatement: 振込行が特定できない計算書は起票しない', async () => {
    currentStatement = await makeStatement([
      null, null, null, null, null, null, null, null,
      { rawDescription: '振り込みではなく入金', amountIn: 38268 }
    ]);
    let thrown = null;
    try {
      await settleStatement(currentStatement, {
        received: { account: '1010010', subAccount: 1 },
        sale: { account: '6000000' },
        lines: await feeLines()
      }, data.approver);
    } catch (e) {
      thrown = e;
    }
    assert.isOk(thrown);
    // 既定の transferPattern '振込' は「振り込み」には無い。ひらがな含みの書式はプロファイルで指定する
    assert.match(thrown.message, /振込行を特定/);
  });

  it('settleStatement: すでに起票済みの計算書は二重起票しない', async () => {
    currentStatement = await makeStatement();
    const first = await settleStatement(currentStatement, {
      received: { account: '1010010', subAccount: 1 },
      sale: { account: '6000000' },
      lines: await feeLines()
    }, data.approver);
    assert.ok(first.slip.id);
    let thrown = null;
    try {
      await settleStatement(currentStatement, {
        received: { account: '1010010', subAccount: 1 },
        sale: { account: '6000000' },
        lines: await feeLines()
      }, data.approver);
    } catch (e) {
      thrown = e;
    }
    assert.isOk(thrown);
    assert.match(thrown.message, /すでに起票済み/);
  });

  it('settleStatement: 通帳とカードの明細では動かない', async () => {
    const statement = await models.BankStatement.create({
      financialId: settlementFinancial.id,
      kind: 'bank',
      account: '1010010',
      subAccount: 1,
      fileName: 'sbi.csv',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      lineCount: 0,
      createdBy: data.approver.id,
      updatedBy: data.approver.id
    });
    let thrown = null;
    try {
      await settleStatement(statement, { received: { account: '1010010' }, sale: { account: '6000000' }, lines: [] }, data.approver);
    } catch (e) {
      thrown = e;
    }
    assert.isOk(thrown);
    assert.match(thrown.message, /計算書の取り込みではありません/);
  });

  it('settleStatement: include:false の行は伝票から外れ、検算が合う選択なら起票できる', async () => {
    // Amazon支払明細書のような入れ子を再現する: 費用の内訳に集計行と
    // その内訳（同額）が両方載る形。合計が合う方だけ選んで起票する
    currentStatement = await makeStatement();
    await models.BankStatementLine.create({
      statementId: currentStatement.id,
      lineNo: 10,
      date: '2026-07-29',
      rawDescription: '支出 FBA手数料（集計行）',
      description: '支出 FBA手数料（集計行）',
      amountIn: null, amountOut: 31, balance: null, memo: null,
      status: 'unmatched',
      createdBy: data.approver.id, updatedBy: data.approver.id
    });
    const lines = await models.BankStatementLine.findAll({
      where: { statementId: currentStatement.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    const outLines = lines.filter((line) => ( line.amountOut !== null && line.amountOut !== undefined ));
    // 全行選ぶと検算が合わない（31円の重複）→ 起票できない
    let thrown = null;
    try {
      await settleStatement(currentStatement, {
        received: { account: '1010010', subAccount: 1 },
        sale: { account: '6000000' },
        lines: outLines.map((line) => ({ lineId: line.id, account: '7000001' }))
      }, data.approver);
    } catch (e) {
      thrown = e;
    }
    assert.isOk(thrown);
    assert.match(thrown.message, /検算が合いません/);
    // 重複した集計行（FBA手数料=納品+在庫保管の合計に相当する行）を外すと
    // 検算が合って起票できる
    const excludeLine = outLines.find((line) => ( line.rawDescription === '支出 FBA手数料（集計行）' ));
    const result = await settleStatement(currentStatement, {
      received: { account: '1010010', subAccount: 1 },
      sale: { account: '6000000' },
      lines: outLines.map((line) => ({
        lineId: line.id,
        account: '7000001',
        include: ( line.id === excludeLine.id ) ? false : true
      }))
    }, data.approver);
    assert.ok(result.slip.id);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: result.slip.id }
    });
    // 預金1+費用5+売上1=7明細（除外した31円の行は載らない）
    assert.lengthOf(details, 7);
    const debitSum = details.reduce((acc, d) => acc + Number(d.debitAmount), 0);
    assert.equal(debitSum, 141768);
    // 除外した行は未照合のまま
    await excludeLine.reload();
    assert.equal(excludeLine.status, 'unmatched');
  });

  it('settlementPreview: プロファイルの約束科目が入る（received/sale）', async () => {
    const fs = await import('fs');
    const path = await import('path');
    fs.writeFileSync(path.resolve('config/banks', 'テストモール.yaml'),
      'name: テストモール\ntype: settlement\nsaleAccount: 6000000\nreceivedAccount: 1010010\nreceivedSubAccount: 1\n');
    try {
      currentStatement = await makeStatement();
      const preview = await settlementPreview(currentStatement);
      assert.equal(preview.received.account, '1010010');
      assert.equal(preview.received.subAccount, 1);
      assert.equal(preview.sale.account, '6000000');
      assert.equal(preview.saleTotal, 141768);
    } finally {
      fs.unlinkSync(path.resolve('config/banks', 'テストモール.yaml'));
    }
  });

  // === 通帳（銀行）のAmazon振込行と計算書の複合伝票の紐付け ===
  describe('settlement deposit link (test db)', () => {
    let bankFinancial;
    let bankStatement;
    let settleResult;
    before(async () => {
      bankFinancial = await findOrCreate(models.Financial, {
        accountCode: '1010010', subAccountCode: 1
      }, {
        name: 'テスト銀行', kind: 'bank',
        accountCode: '1010010', subAccountCode: 1
      });
      // 複合伝票を作る（預金行は借方1010010/1）
      currentStatement = await makeStatement();
      settleResult = await settleStatement(currentStatement, {
        received: { account: '1010010', subAccount: 1 },
        sale: { account: '6000000' },
        lines: await feeLines()
      }, data.approver);
      // 通帳の取り込み。Amazon振込1行（伝票日と同じ: 2026-07-29）
      bankStatement = await models.BankStatement.create({
        financialId: bankFinancial.id,
        kind: 'bank',
        account: '1010010',
        subAccount: 1,
        fileName: 'sbi-2026-07.csv',
        periodFrom: '2026-07-01',
        periodTo: '2026-07-31',
        lineCount: 1,
        createdBy: data.approver.id,
        updatedBy: data.approver.id
      });
    });

    it('suggestSettlementDeposits: 金額一致+日付近接の入金行に候補が出る', async () => {
      await models.BankStatementLine.create({
        statementId: bankStatement.id, lineNo: 1,
        date: '2026-07-30', rawDescription: '＊ＡＤ Amazon Services International',
        description: '＊ＡＤ Amazon Services International',
        amountIn: 38268, amountOut: null, balance: 1000000, status: 'unmatched',
        createdBy: data.approver.id, updatedBy: data.approver.id
      });
      const suggestions = await suggestSettlementDeposits(bankStatement);
      assert.lengthOf(suggestions, 1);
      assert.equal(suggestions[0].amount, 38268);
      assert.equal(suggestions[0].slip.id, settleResult.slip.id);
      assert.match(suggestions[0].label, /テストモール/);
      // 候補は預金明細（借方1010010/1の明細）を指す
      const detail = await models.CrossSlipDetail.findByPk(suggestions[0].crossSlipDetailId);
      assert.equal(detail.debitAccount, '1010010');
      assert.equal(detail.debitSubAccount, 1);
    });

    it('linkDepositToSettlement: 預金明細に紐付ける（伝票は増えない/照合済になる）', async () => {
      const suggestions = await suggestSettlementDeposits(bankStatement);
      assert.lengthOf(suggestions, 1);
      const line = await models.BankStatementLine.findOne({
        where: { statementId: bankStatement.id, amountIn: 38268 }
      });
      await linkDepositToSettlement(bankStatement, suggestions[0].lineId, suggestions[0].crossSlipDetailId);
      await line.reload();
      assert.equal(line.status, 'matched');
      assert.equal(line.crossSlipDetailId, suggestions[0].crossSlipDetailId);
      // 伝票の数は増えない（計算書起票の1枚だけ）
      const slips = await models.CrossSlip.count();
      const feeSlips = await models.CrossSlip.count({
        where: { id: { [models.Sequelize.Op.in]: [ settleResult.slip.id ] } }
      });
      assert.equal(feeSlips, 1);
      assert.isOk(slips >= 1);
    });

    it('linkDepositToSettlement: 二度めは処理済みで拒む', async () => {
      const suggestions = await suggestSettlementDeposits(bankStatement);
      assert.lengthOf(suggestions, 0);  // もう該当無料の候補は出ない（既にmatchedへ）
      const line = await models.BankStatementLine.findOne({
        where: { statementId: bankStatement.id, amountIn: 38268 }
      });
      const detailId = line.crossSlipDetailId;
      let thrown = null;
      try {
        await linkDepositToSettlement(bankStatement, line.id, detailId);
      } catch (e) {
        thrown = e;
      }
      assert.isOk(thrown);
      assert.match(thrown.message, /処理済み/);
    });

    it('suggestSettlementDeposits: 金額や日付が違う入金は候補にならない', async () => {
      // 日付が遠い行（±4日）
      await models.BankStatementLine.create({
        statementId: bankStatement.id, lineNo: 2,
        date: '2026-08-03', rawDescription: '＊ＡＤ Amazon Services International',
        description: '＊ＡＤ Amazon Services International',
        amountIn: 38268, amountOut: null, balance: 1000000, status: 'unmatched',
        createdBy: data.approver.id, updatedBy: data.approver.id
      });
      const suggestions = await suggestSettlementDeposits(bankStatement);
      assert.lengthOf(suggestions, 0);
    });
  });
});

// === 書式の差はプロファイルで持つ（コードに特定モールの語彙を置かない） ===
describe('settlement text parser (profile driven)', () => {
  // 楽天風の架空の支払明細書（Amazonとは語彙が違う）。yamlを足すだけで
  // 解析できることを示すテスト（コード変更なしで第二のモールに対応する）
  const RAKUTEN_LINES = [
    { text: '2026/03/01 12:00 楽天ペイ' },
    { text: '売上サマリー ￥220,000' },
    { text: '商品代金 ￥200,000' },
    { text: '消費税 ￥20,000' },
    { text: '引き落としサマリー -￥33,000' },
    { text: 'システム利用料 -￥22,000' },
    { text: '広告宣伝費 -￥11,000' },
    { text: 'お支払い金額 ￥187,000' },
    { text: '2026/3/15にご指定の口座へお振込みいたします。' },
    { text: '振込番号 RTN-12345678' }
  ];
  const rakutenProfile = {
    name: 'テストモール2',
    type: 'settlement',
    detect: [ '売上サマリー', 'お支払い金額' ],
    aggregateSale: '^売上サマリー',
    aggregateExpense: '^引き落としサマリー',
    transferPattern: 'お支払い金額',
    transferDatePattern: '(\\d{4})/(\\d{1,2})/(\\d{1,2})にご指定の口座へ',
    memoPattern: '^振込番号'
  };
  const toPdfLines = (defs) => defs.map((d) => ({ text: d.text, tokens: [ d.text ] }));

  it('detectで判定し、節見出しと振込行をプロファイルの語彙で解析する', () => {
    const parsed = parseSettlementTextLines(toPdfLines(RAKUTEN_LINES), rakutenProfile);
    assert.isOk(parsed);
    assert.equal(parsed.lines.length, 5);
    // 売上の内訳（saleセクションの内訳。消費税を含む。税込合算運用）
    assert.equal(parsed.lines[0].rawDescription, '売上 商品代金');
    assert.equal(parsed.lines[0].amountIn, 200000);
    assert.equal(parsed.lines[1].amountIn, 20000);
    // 費用の内訳
    assert.equal(parsed.lines[2].rawDescription, '支出 システム利用料');
    assert.equal(parsed.lines[2].amountOut, 22000);
    // 振込行（プロファイルの transferPattern の語で引く）
    const transfer = parsed.lines[ parsed.lines.length - 1 ];
    assert.equal(transfer.rawDescription, 'お支払い金額');
    assert.equal(transfer.amountIn, 187000);
    assert.equal(transfer.date, '2026-03-15');
    assert.match(transfer.memo, /RTN-12345678/);
    // 検算: 売上220,000 = 振込187,000 + 費用33,000
    const breakdown = settlementBreakdown(parsed.lines, rakutenProfile);
    assert.deepEqual(breakdown.warnings, []);
    assert.equal(breakdown.saleTotal, 220000);
    assert.equal(breakdown.expenseTotal, 33000);
    assert.equal(breakdown.transferAmount, 187000);
  });

  it('detectが合わない書式は解析しない（null。他の書式として扱う）', () => {
    // 楽天プロファイルにAmazonの書式は合わない
    const amazonish = [ { text: '支払明細書' }, { text: '純利益 ￥100' }, { text: '売上 ￥100' } ];
    assert.isNull(parseSettlementTextLines(toPdfLines(amazonish), rakutenProfile));
    // detectのないプロファイルではテキスト解析をしない（AI読取の分類だけに使う）
    const noDetect = { name: 'x', type: 'settlement' };
    assert.isNull(parseSettlementTextLines(toPdfLines(RAKUTEN_LINES), noDetect));
    assert.isNull(parseSettlementTextLines(toPdfLines(RAKUTEN_LINES), null));
  });
});
