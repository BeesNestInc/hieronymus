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
    // 本番と同じ科目クラス構造(klass=field+adding2桁)で揃える
    const ensureClass = async (def) => {
      return findOrCreate(models.AccountClass, {
        field: def.field,
        adding: def.adding
      }, def);
    };
    const bankClass = await ensureClass({
      major: '資産', middle: '流動資産', minor: '預金', field: 1, adding: 1
    });
    const incomeClass = await ensureClass({
      major: '経常損益', middle: '営業外収益', minor: '受取利息', field: 8, adding: 0
    });
    const azukariClass = await ensureClass({
      major: '負債', middle: '流動負債', minor: '預り金(源泉)', field: 3, adding: 73
    });
    // 銀行口座（普通預金）
    bankAccount = await findOrCreate(models.Account, {
      accountCode: '1010010'
    }, {
      name: '普通預金',
      key: 'bank',
      accountClassId: bankClass.id,
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
      accountClassId: incomeClass.id,
      accountCode: '8000000',
      taxClass: 0,
      subAccountCount: 0
    });
    const gensenParent = await findOrCreate(models.Account, {
      accountCode: '3730000'
    }, {
      name: '預り金',
      key: 'azukari',
      accountClassId: azukariClass.id,
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
    const shukkinkariClass = await ensureClass({
      major: '資産', middle: '流動資産', minor: '出金仮', field: 1, adding: 90
    });
    await findOrCreate(models.Account, {
      accountCode: '1900000'
    }, {
      name: '出金仮', key: 'shukkinkari',
      accountClassId: shukkinkariClass.id,
      accountCode: '1900000', taxClass: 0, subAccountCount: 0
    });
    const nyukinkariClass = await ensureClass({
      major: '負債', middle: '流動負債', minor: '入金仮', field: 3, adding: 90
    });
    await findOrCreate(models.Account, {
      accountCode: '3900000'
    }, {
      name: '入金仮', key: 'nyukinkari',
      accountClassId: nyukinkariClass.id,
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

  it('bookLines: 手数料行は前の行（同じ日）の伝票に合流する', async () => {
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

  it('bookLines: 利息と同じ日の国税行は源泉徴収額として合算する', async () => {
    // 通帳の体裁: 利息行(総額)+国税行(源泉徴収額)。受取利息の貸方は総額、
    // 普通預金の借方は「総額−源泉額」、源泉所得税の借方は国税行の金額
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-09-22', rawDescription: '利息', amountIn: 60, category: 'interest' },
      { date: '2026-09-22', rawDescription: '国税', amountOut: 9, category: 'tax' }
    ]);
    const result = await bookLines(statement, null, approver);
    // 2行は1枚の伝票に合算される
    assert.lengthOf(result.slips, 1);
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: result.slips[0].id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    assert.lengthOf(details, 2);
    // 借方 普通預金 51 / 貸方 受取利息 51
    const bank = details[0];
    assert.equal(bank.debitAccount, '1010010');
    assert.equal(Number(bank.debitAmount), 51);
    assert.equal(bank.creditAccount, '8000000');
    assert.equal(Number(bank.creditAmount), 51);
    // 借方 源泉所得税 9 / 貸方 受取利息 9（源泉額は国税行から）
    const gensen = details[1];
    assert.equal(Number(gensen.debitAmount), 9);
    assert.equal(Number(gensen.creditAmount), 9);
    // 国税行は源泉明細に対応付けられて起票済みになる
    await lines[0].reload();
    await lines[1].reload();
    assert.equal(lines[0].status, 'booked');
    assert.equal(lines[1].status, 'booked');
    assert.equal(gensen.statementLineId, lines[1].id);
    assert.equal(bank.statementLineId, lines[0].id);
  });

  it('bookLines: 国税の納税振替は利息と合算しない（額が大きすぎ）', async () => {
    // 同じ日の国税行でも額が利息を大きく上回るなら、それは納税の振替なので
    // 普通の出金行（仮入科目）として扱う
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-09-23', rawDescription: '利息', amountIn: 8, category: 'interest' },
      { date: '2026-09-23', rawDescription: '国税', amountOut: 150000, category: 'tax' }
    ]);
    const result = await bookLines(statement, null, approver);
    assert.lengthOf(result.slips, 2);
    await reloadAll(lines);
    const interestDetail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    // 利息伝票: 借方 普通預金 8（逆算で総額9・源泉1）/ 貸方 受取利息 9
    const interestSlipDetails = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: interestDetail.crossSlipId },
      order: [[ 'lineNo', 'ASC' ]]
    });
    assert.equal(Number(interestSlipDetails[0].debitAmount), 8);
    assert.equal(Number(interestSlipDetails[0].creditAmount), 8);
    assert.equal(Number(interestSlipDetails[1].creditAmount), 1);
    const taxDetail = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    // 納税行は従来通り仮入科目で起票する
    assert.equal(taxDetail.debitAccount, '1900000');
    assert.equal(Number(taxDetail.debitAmount), 150000);
  });

  it('bookLines: 合流摘要は完全一致で判定する（類似摘要は合流しない）', async () => {
    // 完全一致なので「振込手数料」は合流するが「納付待」等の別摘要は
    // 自分の伝票になる（誤合流より定義の手間を取る）
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-09-24', rawDescription: '振込＊テスト取引先', amountOut: 100000, category: 'normal' },
      { date: '2026-09-24', rawDescription: '振込手数料', amountOut: 140, category: 'fee' },
      { date: '2026-09-24', rawDescription: '納付待', amountOut: 30000, category: 'normal' }
    ]);
    const result = await bookLines(statement, null, approver);
    // 手数料は合流、納付待は自分の伝票
    assert.lengthOf(result.slips, 2);
    await reloadAll(lines);
    const feeSlipId = ( await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId) ).crossSlipId;
    const mainSlipId = ( await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId) ).crossSlipId;
    assert.equal(feeSlipId, mainSlipId);
    const separateSlipId = ( await models.CrossSlipDetail.findByPk(lines[2].crossSlipDetailId) ).crossSlipId;
    assert.notEqual(separateSlipId, mainSlipId);
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

  it('learnOpposite: 補助の「下げ」は学習しない（再実行の補助なし学習で消えない）', async () => {
    // 手修正で補助付きの相手方を習ったあと、補助なしの起票（再実行由来の
    // 明細など）が同じルールに当たっても、既存の補助を消さない
    await models.BankStatementRule.destroy({ where: { pattern: { [models.Sequelize.Op.ne]: '利息' } } });
    await learnOpposite(
      { account: '1010010', sub: 1 },
      '振込＊テスト取引先',
      { account: '1130000', sub: 1 }
    );
    let rule = await models.BankStatementRule.findOne({ where: { pattern: '振込*テスト取引先' } });
    assert.equal(rule.oppositeSubAccount, 1);
    // 補助なしの学習 → 既存の補助を保持する
    await learnOpposite(
      { account: '1010010', sub: 1 },
      '振込＊テスト取引先',
      { account: '1130000', sub: null }
    );
    await rule.reload();
    assert.equal(rule.oppositeSubAccount, 1);
    // 補助の変更は取り込む
    await learnOpposite(
      { account: '1010010', sub: 1 },
      '振込＊テスト取引先',
      { account: '1130000', sub: 2 }
    );
    await rule.reload();
    assert.equal(rule.oppositeSubAccount, 2);
  });

  it('findLearnedRule: 口座補助が一致するルールを最優先する', async () => {
    // 住信SBI(sub1)と補助なしの兄弟ルールがあるとき、sub1の取込は
    // sub1ルールを採用する（usageCountの多さで補助なしに負けない）
    await models.BankStatementRule.destroy({ where: { pattern: { [models.Sequelize.Op.ne]: '利息' } } });
    await learnOpposite({ account: '1010010', sub: 1 },
      '振込＊リンゴさん', { account: '7000001', sub: null });
    await learnOpposite({ account: '1010010', sub: null },
      '振込＊リンゴさん', { account: '6000001', sub: null });
    // 補助なしルールを多めに使った froid状態にする
    for ( let i = 0; i < 5; i ++ ) {
      await learnOpposite({ account: '1010010', sub: null },
        '振込＊リンゴさん', { account: '6000001', sub: null });
    }
    const subRule = await models.BankStatementRule.findOne({
      where: { pattern: '振込*リンゴさん', subAccount: 1 }
    });
    const noSubRule = await models.BankStatementRule.findOne({
      where: { pattern: '振込*リンゴさん', subAccount: null }
    });
    assert.isNotNull(subRule);
    assert.isNotNull(noSubRule);
    assert.equal(subRule.oppositeAccount, '7000001');
    assert.equal(noSubRule.oppositeAccount, '6000001');
    // statement.subAccount=1 の取込はsub1ルールから取る
    const statement = await models.BankStatement.create({ kind: 'bank', account: '1010010', subAccount: 1, cardName: null, lineCount: 1 });
    await models.BankStatementLine.create({
      statementId: statement.id, lineNo: 1, status: 'unmatched',
      category: 'normal', date: '2026-11-20', rawDescription: '振込＊リンゴさん', amountOut: 1000
    });
    await bookLines(statement, null, approver);
    const line = await models.BankStatementLine.findOne({ where: { statementId: statement.id } });
    await line.reload();
    const bookedDetail = await models.CrossSlipDetail.findByPk(line.crossSlipDetailId);
    assert.equal(bookedDetail.debitAccount, '7000001');
    // 補助なしの取込は補助なしルールを取る
    const statement2 = await models.BankStatement.create({ kind: 'bank', account: '1010010', subAccount: null, cardName: null, lineCount: 1 });
    await models.BankStatementLine.create({
      statementId: statement2.id, lineNo: 1, status: 'unmatched',
      category: 'normal', date: '2026-11-21', rawDescription: '振込＊リンゴさん', amountOut: 2000
    });
    await bookLines(statement2, null, approver);
    const line2 = await models.BankStatementLine.findOne({ where: { statementId: statement2.id } });
    await line2.reload();
    const bookedDetail2 = await models.CrossSlipDetail.findByPk(line2.crossSlipDetailId);
    assert.equal(bookedDetail2.debitAccount, '6000001');
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

  it('rebookStatement(lineId): 指定行だけを解放して他の行の伝票は無傷', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-11-05', rawDescription: '振込＊testsコ', amountOut: 5000 },
      { date: '2026-11-10', rawDescription: '振込＊そのほか', amountOut: 8000 }
    ]);
    // 両方起票（別日付なので別伝票）
    await bookLines(statement, null, approver);
    await reloadAll(lines);
    const detail0 = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    const detail1 = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    assert.notEqual(detail0.crossSlipId, detail1.crossSlipId);
    // 行単位の再実行: 2行目の伝票には触らない
    const result = await rebookStatement(statement, approver, { lineId: lines[1].id });
    assert.equal(result.rebooked, 1);
    // 1行目の伝票は生きたまま
    assert.isNotNull(await models.CrossSlipDetail.findByPk(detail0.id));
    await lines[0].reload();
    assert.equal(lines[0].crossSlipDetailId, detail0.id);
    // 2行目は新しい明細・新しい伝票に付け替わる
    await lines[1].reload();
    const newDetail1 = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    assert.notEqual(newDetail1.id, detail1.id);
    assert.notEqual(newDetail1.crossSlipId, detail1.crossSlipId);
    assert.equal(newDetail1.debitAccount, '1900000');
  });

  it('rebookStatement(lineId): 合流伝票は伝票ごと解放し、合流行も一緒に作り直す', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-11-12', rawDescription: 'ＡＴＭ出金', amountOut: 30000 },
      { date: '2026-11-12', rawDescription: 'ＡＴＭ手数料', amountOut: 110 }
    ]);
    const result = await bookLines(statement, null, approver);
    assert.lengthOf(result.slips, 1);
    await reloadAll(lines);
    const mainDetail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    const feeDetail = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    assert.equal(mainDetail.crossSlipId, feeDetail.crossSlipId);
    const slipId = mainDetail.crossSlipId;
    // 主取引行を指定して再実行 → 合流行も含めて作り直される
    const rebook = await rebookStatement(statement, approver, { lineId: lines[0].id });
    assert.equal(rebook.rebooked, 1);
    // 古い伝票は消えている
    assert.isNull(await models.CrossSlip.findByPk(slipId));
    await reloadAll(lines);
    // 行は両方新しい伝票に付け替わっている
    const newMainDetail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    const newFeeDetail = await models.CrossSlipDetail.findByPk(lines[1].crossSlipDetailId);
    assert.notEqual(newMainDetail.id, mainDetail.id);
    assert.notEqual(newFeeDetail.id, feeDetail.id);
    assert.equal(newMainDetail.crossSlipId, newFeeDetail.crossSlipId);
  });

  it('rebookStatement(lineId): 承認済みの伝票に紐づく行は再実行の対象外', async () => {
    const { statement, lines } = await createStatement('bank', [
      { date: '2026-11-15', rawDescription: '振込＊approvvね', amountOut: 12000 }
    ]);
    await bookLines(statement, null, approver);
    await reloadAll(lines);
    const detail = await models.CrossSlipDetail.findByPk(lines[0].crossSlipDetailId);
    await models.CrossSlip.update({ approvedAt: new Date() }, { where: { id: detail.crossSlipId } });
    const result = await rebookStatement(statement, approver, { lineId: lines[0].id });
    assert.equal(result.rebooked, 0);
    assert.equal(result.skipped, 1);
    await lines[0].reload();
    assert.equal(lines[0].crossSlipDetailId, detail.id);
    assert.isNotNull(await models.CrossSlip.findByPk(detail.crossSlipId));
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
