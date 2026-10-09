import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import {createSlipForReport} from '../libs/expense.js';
import {create as createCrossSlip} from '../libs/cross_slip.js';

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

  it('承認時の自動起票: 未承認伝票が作られ仮払金の補助科目（立替者）が解決される', async () => {
    const report = await buildReport(data.creator.id);
    const line = await buildLine(report);
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const slip = await createSlipForReport(report, lines, data.approver);
    try {
      const saved = await models.CrossSlip.findByPk(slip.id);
      assert.ok(saved);
      assert.equal(saved.approvedAt, null);
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
    const slip = await createSlipForReport(report, lines, data.approver);
    try {
      const details = await models.CrossSlipDetail.findAll({ where: { crossSlipId: slip.id } });
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

  it('承認権限を持つユーザーでもforceUnapprovedなら未承認で登録される', async () => {
    const slip = await createCrossSlip({
      year: 2026, month: 3, day: 15, term: 1,
      lines: [{
        debitAccount: '7000001', debitAmount: 1000, debitTax: 0,
        creditAccount: '1000001', creditAmount: 1000, creditTax: 0
      }]
    }, data.approver, { forceUnapproved: true });
    try {
      const saved = await models.CrossSlip.findOne({ where: { year: 2026, month: 3, no: slip.no } });
      assert.ok(saved);
      assert.equal(saved.approvedAt, null);
    } finally {
      const saved = await models.CrossSlip.findOne({ where: { year: 2026, month: 3, no: slip.no } });
      if ( saved ) {
        await models.CrossSlipDetail.destroy({ where: { crossSlipId: saved.id } });
        await saved.destroy();
      }
    }
  });
});
