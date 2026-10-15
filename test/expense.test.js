import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import {createSlipForReport} from '../libs/expense.js';
import {create as createCrossSlip} from '../libs/cross_slip.js';
import {normalizePileVouchers} from '../routes/api_expense_report.js';

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

describe('expense (test db)', () => {
  let data;
  let karibarai;
  let expenseAccount;
  let payeeMapping;
  let paymentMapping;
  let approverNoAcct;

  before(async () => {
    // e2e.test.js が先に走ると接続プールがclose済みのため、必要なら再初期化する
    try {
      await models.sequelize.authenticate();
    } catch (e) {
      delete models.sequelize.connectionManager.getConnection;
      models.sequelize.connectionManager.initPools();
      await models.sequelize.authenticate();
    }
    data = await seed();
    // 前回実行の残データを掃除する（テストDBは繰り返し使われる）
    await models.ExpenseReportLine.destroy({ where: {} });
    await models.ExpenseReport.destroy({ where: {} });
    await models.ExpenseMapping.destroy({ where: {} });
    // 仮払金（taxClass 0）と補助科目（立替者）
    karibarai = await findOrCreate(models.Account, {
      accountCode: '1130000'
    }, {
      name: '仮払金',
      key: 'karibarai',
      accountClassId: data.expense.accountClassId,
      accountCode: '1130000',
      taxClass: 0,
      subAccountCount: 1
    });
    const sub = await findOrCreate(models.SubAccount, {
      accountId: karibarai.id,
      name: 'テスト立替太郎'
    }, {
      name: 'テスト立替太郎',
      key: 'test-taro',
      accountId: karibarai.id,
      subAccountCode: 1,
      taxClass: 0
    });
    // 提出者（creator）にMember（氏名）を紐付ける
    await findOrCreate(models.Member, {
      userId: data.creator.id
    }, {
      userId: data.creator.id,
      tradingName: 'テスト立替太郎'
    });
    // 外税科目（税導出なしで明細を組み立てるテスト用）
    expenseAccount = data.expense;
    payeeMapping = await models.ExpenseMapping.create({
      kind: 'payee',
      name: 'テスト取引先',
      companyId: data.company.id,
      account: '7000001',
    });
    paymentMapping = await models.ExpenseMapping.create({
      kind: 'payment',
      name: '個人立て替え',
      account: '1130000',
      advance: true,
    });
    // 会計権限なしの承認者（上長想定。伝票は未承認のまま残す）
    approverNoAcct = await findOrCreate(models.User, {
      name: 'approver-noacct'
    }, {
      name: 'approver-noacct',
      hashPassword: bcrypt.hashSync('secret', 10),
      accounting: false,
      approvable: true,
      fiscalBrowsing: false,
      administrable: false,
      companyManagement: false,
      inventoryManagement: false,
      personnelManagement: false
    });
  });

  after(async () => {
    await models.sequelize.close();
  });

  const buildReport = async (submittedBy) => {
    return models.ExpenseReport.create({
      submittedBy: submittedBy,
      submittedAt: new Date(2026, 2, 15),
      companyId: data.company.id,
      createdBy: data.creator.id,
      updatedBy: data.creator.id
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
      ...values
    });
  };

  const cleanup = async (report) => {
    const slipId = report ? report.crossSlipId : null;
    if ( report ) {
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: report.id } });
      await report.destroy();
    }
    if ( slipId ) {
      await models.CrossSlipDetail.destroy({ where: { crossSlipId: slipId } });
      const slip = await models.CrossSlip.findByPk(slipId);
      if ( slip ) {
        await slip.destroy();
      }
    }
  };

  it('承認時の自動起票: 会計権限の承認者は伝票も同時承認される', async () => {
    const report = await buildReport(data.creator.id);
    const line = await buildLine(report);
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const result = await createSlipForReport(report, lines, data.approver);
    try {
      const slip = result.slip;
      assert.equal(result.reuse, false);
      assert.equal(result.slipApproved, true);
      const saved = await models.CrossSlip.findByPk(slip.id);
      assert.ok(saved);
      assert.ok(saved.approvedAt);
      assert.equal(saved.approvedBy, data.approver.id);
      assert.equal(saved.createdBy, data.approver.id);
      assert.equal(report.crossSlipId, slip.id);

      const details = await models.CrossSlipDetail.findAll({ where: { crossSlipId: slip.id } });
      assert.equal(details.length, 1);
      const detail = details[0];
      assert.equal(detail.debitAccount, '7000001');
      assert.equal(Number(detail.debitAmount), 3000);
      assert.equal(detail.creditAccount, '1130000');
      assert.equal(Number(detail.creditSubAccount), 1);
      assert.equal(Number(detail.creditAmount), 3000);
      assert.equal(detail.debitVoucherId, line.voucherId === undefined ? null : detail.debitVoucherId);
      const debitTotal = details.reduce((s, d) => s + Number(d.debitAmount), 0);
      const creditTotal = details.reduce((s, d) => s + Number(d.creditAmount), 0);
      assert.equal(debitTotal, creditTotal);
    } finally {
      await cleanup(report);
    }
  });

  it('承認時の自動起票: 会計権限なしの承認者は従来通り未承認伝票が作られる', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const result = await createSlipForReport(report, lines, approverNoAcct);
    try {
      assert.equal(result.reuse, false);
      assert.equal(result.slipApproved, false);
      const saved = await models.CrossSlip.findByPk(result.slip.id);
      assert.ok(saved);
      assert.equal(saved.approvedAt, null);
      assert.equal(saved.createdBy, approverNoAcct.id);
    } finally {
      await cleanup(report);
    }
  });

  it('承認時の自動起票: 証憑があれば借方に紐付く', async () => {
    const report = await buildReport(data.creator.id);
    const voucher = await models.Voucher.create({
      voucherClassId: null,
      issueDate: '2026-03-10',
      companyId: data.company.id,
      amount: 3000,
      createdBy: data.creator.id,
      updatedBy: data.creator.id
    });
    const line = await buildLine(report, { voucherId: voucher.id });
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const result = await createSlipForReport(report, lines, data.approver);
    try {
      const details = await models.CrossSlipDetail.findAll({ where: { crossSlipId: result.slip.id } });
      assert.equal(details.length, 1);
      assert.equal(details[0].debitVoucherId, voucher.id);
      assert.equal(details[0].creditVoucherId, null);
    } finally {
      await cleanup(report);
      await voucher.destroy();
    }
  });

  it('仮払金の補助科目（立替者）が解決できない場合は起票がブロックされる', async () => {
    // Memberを持たないユーザー（approver）が提出者の場合
    const report = await buildReport(data.approver.id);
    await buildLine(report);
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    try {
      let error = null;
      try {
        await createSlipForReport(report, lines, data.approver);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.equal(error.name, 'ExpenseSubAccountNotFound');
    } finally {
      await cleanup(report);
    }
  });

  it('支払先のマッピングが未登録の場合は起票がブロックされる', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    // 明細作成後にマッピングを破棄すると、payeeMappingId は SET NULL で null になる
    // （支払先が未選択の状態になり、起票時にブロックされる）
    await models.ExpenseMapping.destroy({ where: { kind: 'payee' } });
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    try {
      let error = null;
      try {
        await createSlipForReport(report, lines, data.approver);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.equal(error.name, 'ExpenseMappingNotFound');
    } finally {
      await cleanup(report);
      payeeMapping = await models.ExpenseMapping.create({
        kind: 'payee',
        name: 'テスト取引先',
        companyId: data.company.id,
        account: '7000001'
      });
    }
  });

  it('再承認時、未承認の紐付伝票は伝票番号を変えずに「更新」として再利用される', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    let lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    // 会計権限なしの承認者で未承認伝票を作る（再利用の条件）
    const first = await createSlipForReport(report, lines, approverNoAcct);
    try {
      const firstSlip = first.slip;
      assert.equal(first.reuse, false);

      // 精算書の明細を修正して再承認（会計権限なし→未承認のまま再利用）
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: report.id } });
      await buildLine(report, { amount: 4500 });
      lines = await models.ExpenseReportLine.findAll({
        where: { expenseReportId: report.id },
        order: [['lineNo', 'ASC']]
      });
      const second = await createSlipForReport(report, lines, approverNoAcct);
      assert.equal(second.reuse, true);
      const secondSlip = second.slip;
      assert.equal(secondSlip.id, firstSlip.id);
      assert.equal(secondSlip.no, firstSlip.no);
      assert.equal(secondSlip.year, firstSlip.year);
      assert.equal(secondSlip.month, firstSlip.month);
      // keepUnapproved（会計権限なし）により approvedAt は変更されない
      const reloaded = await models.CrossSlip.findByPk(secondSlip.id);
      assert.equal(reloaded.approvedAt, null);
      const details = await models.CrossSlipDetail.findAll({ where: { crossSlipId: reloaded.id } });
      assert.equal(details.length, 1);
      assert.equal(Number(details[0].debitAmount), 4500);
    } finally {
      await cleanup(report);
    }
  });

  it('再承認時、会計権限の承認者は再利用伝票も同時承認する', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    let lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    // 会計権限なしで未承認伝票を作っておく
    const first = await createSlipForReport(report, lines, approverNoAcct);
    try {
      assert.equal(first.reuse, false);
      // 会計権限ありで明細修正＋再承認→同じ伝票番号のまま承認される
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: report.id } });
      await buildLine(report, { amount: 4500 });
      lines = await models.ExpenseReportLine.findAll({
        where: { expenseReportId: report.id },
        order: [['lineNo', 'ASC']]
      });
      const second = await createSlipForReport(report, lines, data.approver);
      assert.equal(second.reuse, true);
      assert.equal(second.slip.id, first.slip.id);
      assert.equal(second.slipApproved, true);
      const reloaded = await models.CrossSlip.findByPk(second.slip.id);
      assert.ok(reloaded.approvedAt);
      assert.equal(reloaded.approvedBy, data.approver.id);
    } finally {
      await cleanup(report);
    }
  });

  it('承認済み伝票が紐付いた精算書の再承認では新規伝票が起票される', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const first = await createSlipForReport(report, lines, data.approver);
    try {
      // 紐付伝票を承認済みにする
      const firstSlip = await models.CrossSlip.findByPk(first.slip.id);
      firstSlip.approvedAt = new Date();
      await firstSlip.save();

      const second = await createSlipForReport(report, lines, data.approver);
      try {
        assert.equal(second.reuse, false);
        assert.notEqual(second.slip.id, firstSlip.id);
      } finally {
        // 新規伝票の掃除
        await models.CrossSlipDetail.destroy({ where: { crossSlipId: second.slip.id } });
        const s = await models.CrossSlip.findByPk(second.slip.id);
        if ( s ) await s.destroy();
      }
    } finally {
      await cleanup(report);
    }
  });

  it('未整理証憑: パイル紐付け（expenseReportId）が明細紐付けに正規化される', async () => {
    const report = await buildReport(data.creator.id);
    try {
      const voucher = await models.Voucher.create({
        issueDate: '2026-03-10',
        expenseReportId: report.id,
        createdBy: data.creator.id,
        updatedBy: data.creator.id
      });
      const line = await buildLine(report, { voucherId: voucher.id });
      await normalizePileVouchers(report.id, [line]);
      await voucher.reload();
      assert.isNull(voucher.expenseReportId);
    } finally {
      await cleanup(report);
    }
  });

  it('未整理証憑: 精算書を削除しても証憑は残り紐付けだけが解除される', async () => {
    const report = await buildReport(data.creator.id);
    const voucher = await models.Voucher.create({
      issueDate: '2026-03-10',
      expenseReportId: report.id,
      createdBy: data.creator.id,
      updatedBy: data.creator.id
    });
    await models.ExpenseReportLine.destroy({ where: { expenseReportId: report.id } });
    await report.destroy();
    await voucher.reload();
    assert.isNull(voucher.expenseReportId);
    const remains = await models.Voucher.findByPk(voucher.id);
    assert.isNotNull(remains);
    await remains.destroy();
  });

  it('未整理証憑: 精算書のvouchers関連に含まれる', async () => {
    const report = await buildReport(data.creator.id);
    try {
      await models.Voucher.create({
        issueDate: '2026-03-10',
        expenseReportId: report.id,
        createdBy: data.creator.id,
        updatedBy: data.creator.id
      });
      await models.Voucher.create({
        issueDate: '2026-03-11',
        createdBy: data.creator.id,
        updatedBy: data.creator.id
      });
      const loaded = await models.ExpenseReport.findByPk(report.id, {
        include: [{ model: models.Voucher, as: 'vouchers' }]
      });
      assert.equal(loaded.vouchers.length, 1);
    } finally {
      await cleanup(report);
    }
  });
});
