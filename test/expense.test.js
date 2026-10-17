import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import {createSlipForReport, pickPayeeMapping} from '../libs/expense.js';
import {create as createCrossSlip} from '../libs/cross_slip.js';
import {normalizePileVouchers} from '../routes/api_expense_report.js';
import apiExpenseReport from '../routes/api_expense_report.js';

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
    const slipId = report ?
      ( await models.CrossSlip.findOne({ where: { expenseReportId: report.id } }) )?.id : null;
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
      const slip = result.slips[0];
      assert.equal(result.slips.length, 1);
      assert.equal(result.slipApproved, true);
      const saved = await models.CrossSlip.findByPk(slip.id);
      assert.ok(saved);
      assert.ok(saved.approvedAt);
      assert.equal(saved.approvedBy, data.approver.id);
      assert.equal(saved.createdBy, data.approver.id);
      // 1:n紐付け: 伝票側のexpenseReportIdで紐付く
      const linked = await models.CrossSlip.findByPk(slip.id);
      assert.equal(linked.expenseReportId, report.id);

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
      const saved = await models.CrossSlip.findByPk(result.slips[0].id);
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
      const details = await models.CrossSlipDetail.findAll({ where: { crossSlipId: result.slips[0].id } });
      assert.equal(details.length, 1);
      assert.equal(details[0].debitVoucherId, voucher.id);
      assert.equal(details[0].creditVoucherId, null);
    } finally {
      await cleanup(report);
      await voucher.destroy();
    }
  });

  it('仮払金の補助科目: 出金元マッピング名（椋立替等）を優先して解決する', async () => {
    // 仮払金に補助「テスト椋」を追加し、「テスト椋立替」マッピングを作る。
    // 提出者はテスト立替太郎（creator）だが、マッピング名が立替者を示すため
    // 貸方補助は「テスト椋」になるべき
    await findOrCreate(models.SubAccount, {
      accountId: karibarai.id,
      name: 'テスト椋'
    }, {
      name: 'テスト椋',
      key: 'test-muku',
      accountId: karibarai.id,
      subAccountCode: 2,
      taxClass: 0
    });
    const mukuMapping = await models.ExpenseMapping.create({
      kind: 'payment',
      name: 'テスト椋立替',
      account: '1130000',
      advance: true
    });
    const report = await buildReport(data.creator.id);
    await buildLine(report, { paymentMappingId: mukuMapping.id });
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const result = await createSlipForReport(report, lines, approverNoAcct);
    try {
      const details = await models.CrossSlipDetail.findAll({
        where: { crossSlipId: result.slips[0].id }
      });
      assert.equal(details.length, 1);
      // 貸方補助はテスト椋（マッピング名由来。提出者のテスト立替太郎ではない）
      const muku = await models.SubAccount.findOne({ where: { accountId: karibarai.id, name: 'テスト椋' } });
      assert.equal(Number(details[0].creditSubAccount), muku.subAccountCode);
    } finally {
      await cleanup(report);
      await mukuMapping.destroy();
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

  it('再承認時、未承認の紐付伝票は作り直される（番号は変わる）', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    let lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    // 会計権限なしの承認者で未承認伝票を作る
    const first = await createSlipForReport(report, lines, approverNoAcct);
    try {
      assert.equal(first.slips.length, 1);
      const firstSlip = first.slips[0];

      // 精算書の明細を修正して再承認
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: report.id } });
      await buildLine(report, { amount: 4500 });
      lines = await models.ExpenseReportLine.findAll({
        where: { expenseReportId: report.id },
        order: [['lineNo', 'ASC']]
      });
      const second = await createSlipForReport(report, lines, approverNoAcct);
      assert.equal(second.slips.length, 1);
      const secondSlip = second.slips[0];
      // 未承認は作り直し（idが変わる）
      assert.notEqual(secondSlip.id, firstSlip.id);
      assert.isNull(await models.CrossSlip.findByPk(firstSlip.id));
      // 会計権限なしにより approvedAt は null のまま
      const reloaded = await models.CrossSlip.findByPk(secondSlip.id);
      assert.equal(reloaded.approvedAt, null);
      assert.equal(reloaded.expenseReportId, report.id);
      const details = await models.CrossSlipDetail.findAll({ where: { crossSlipId: reloaded.id } });
      assert.equal(details.length, 1);
      assert.equal(Number(details[0].debitAmount), 4500);
    } finally {
      await cleanup(report);
    }
  });

  it('再承認時、会計権限の承認者は作り直した伝票を同時承認する', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    let lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    // 会計権限なしで未承認伝票を作っておく
    const first = await createSlipForReport(report, lines, approverNoAcct);
    try {
      assert.equal(first.slips.length, 1);
      // 会計権限ありで明細修正＋再承認→作り直した伝票が承認される
      await models.ExpenseReportLine.destroy({ where: { expenseReportId: report.id } });
      await buildLine(report, { amount: 4500 });
      lines = await models.ExpenseReportLine.findAll({
        where: { expenseReportId: report.id },
        order: [['lineNo', 'ASC']]
      });
      const second = await createSlipForReport(report, lines, data.approver);
      assert.equal(second.slips.length, 1);
      assert.notEqual(second.slips[0].id, first.slips[0].id);
      assert.equal(second.slipApproved, true);
      const reloaded = await models.CrossSlip.findByPk(second.slips[0].id);
      assert.ok(reloaded.approvedAt);
      assert.equal(reloaded.approvedBy, data.approver.id);
    } finally {
      await cleanup(report);
    }
  });

  it('支払日・出金元が同じ明細は1伝票にまとまり、違うと分割される', async () => {
    const report = await buildReport(data.creator.id);
    // 同日・同出金元×2 + 別日×1
    await buildLine(report, { amount: 1000, paymentDate: '2026-03-10' });
    await buildLine(report, { amount: 2000, paymentDate: '2026-03-10' });
    await buildLine(report, { amount: 3000, paymentDate: '2026-03-12' });
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const result = await createSlipForReport(report, lines, approverNoAcct);
    try {
      assert.equal(result.slips.length, 2);
      // 伝票日付は組の支払日
      const slips = result.slips.slice().sort((a, b) => ( a.day - b.day ));
      assert.equal(slips[0].day, 10);
      assert.equal(slips[1].day, 12);
      const d0 = await models.CrossSlipDetail.findAll({ where: { crossSlipId: slips[0].id }, order: [[ 'lineNo', 'ASC' ]] });
      assert.equal(d0.length, 2);
      const d1 = await models.CrossSlipDetail.findAll({ where: { crossSlipId: slips[1].id } });
      assert.equal(d1.length, 1);
      // 借方合計＝通帳突合の想定（同日の合算）
      assert.equal(Number(d0[0].debitAmount) + Number(d0[1].debitAmount), 3000);
      // 行に「どの伝票に載ったか」が記録される（伝票単位のグループ表示用）
      const grouped = await models.ExpenseReportLine.findAll({
        where: { expenseReportId: report.id },
        order: [['lineNo', 'ASC']]
      });
      const ids = grouped.map((l) => l.crossSlipId);
      assert.deepEqual([...ids].sort((a, b) => ( a - b )), [slips[0].id, slips[0].id, slips[1].id].sort((a, b) => ( a - b )));
    } finally {
      await cleanup(report);
    }
  });

  it('noBundleの支払先は同日でも1行1伝票に分離される', async () => {
    const report = await buildReport(data.creator.id);
    // 同日・同出金元×2（1件はnoBundle支払先）
    await buildLine(report, { amount: 1000, paymentDate: '2026-03-10' });
    const isolatedMapping = await models.ExpenseMapping.create({
      kind: 'payee',
      name: 'テスト分離先',
      companyId: data.company.id,
      account: '7000001',
      noBundle: true
    });
    await buildLine(report, { amount: 2000, paymentDate: '2026-03-10', payeeMappingId: isolatedMapping.id });
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const result = await createSlipForReport(report, lines, approverNoAcct);
    try {
      // 通常行1伝票 + noBundle行1伝票 = 2伝票
      assert.equal(result.slips.length, 2);
      const samples = await models.CrossSlipDetail.findAll({
        where: { crossSlipId: { [models.Sequelize.Op.in]: result.slips.map((s) => s.id) } }
      });
      assert.equal(samples.length, 2);
    } finally {
      await cleanup(report);
    }
  });

  it('紐付伝票の削除: 対象指定（slipId）で1件だけ消せる', async () => {
    const report = await buildReport(data.creator.id);
    await buildLine(report, { amount: 1000, paymentDate: '2026-03-10' });
    await buildLine(report, { amount: 2000, paymentDate: '2026-03-12' });
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    const result = await createSlipForReport(report, lines, approverNoAcct);
    try {
      assert.equal(result.slips.length, 2);
      const target = result.slips.sort((a, b) => ( a.day - b.day ))[0];
      const r = await callDeleteSlip(report.id, approverNoAcct, target.id);
      assert.equal(r.body.code, 0);
      // 残るのは1件
      const remaining = await models.CrossSlip.findAll({ where: { expenseReportId: report.id } });
      assert.equal(remaining.length, 1);
      assert.notEqual(remaining[0].id, target.id);
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

  // deleteSlipハンドラを直接呼ぶ（API層のテスト用モック）
  const callDeleteSlip = async (reportId, user, slipId) => {
    const req = { body: { id: reportId, slipId: slipId }, session: { user: user } };
    let status = 200;
    let body = null;
    const res = {
      set: () => {},
      status: (c) => { status = c; return res; },
      json: (o) => { body = o; return res; }
    };
    let nextErr = null;
    await apiExpenseReport.deleteSlip(req, res, (e) => { nextErr = e; });
    return { status: status, body: body, nextErr: nextErr };
  };

  const buildApprovedReport = async (approver) => {
    const report = await buildReport(data.creator.id);
    await buildLine(report);
    const lines = await models.ExpenseReportLine.findAll({
      where: { expenseReportId: report.id },
      order: [['lineNo', 'ASC']]
    });
    await createSlipForReport(report, lines, approver);
    return report;
  };

  it('紐付伝票の削除: 未承認伝票は消せる', async () => {
    const report = await buildApprovedReport(approverNoAcct);
    const slipId = ( await models.CrossSlip.findOne({ where: { expenseReportId: report.id } }) ).id;
    assert.ok(slipId);
    try {
      const result = await callDeleteSlip(report.id, approverNoAcct);
      assert.equal(result.body.code, 0);
      assert.equal(result.body.slipWasApproved, false);
      assert.isNull(await models.CrossSlip.findByPk(slipId));
      const reloaded = await models.ExpenseReport.findByPk(report.id);
      const remaining = await models.CrossSlip.findAll({ where: { expenseReportId: report.id } });
      assert.equal(remaining.length, 0);
    } finally {
      await cleanup(report);
    }
  });

  it('紐付伝票の削除: 承認済み伝票は会計権限で取消＋削除できる', async () => {
    const report = await buildApprovedReport(data.approver);
    const slipId = ( await models.CrossSlip.findOne({ where: { expenseReportId: report.id } }) ).id;
    const saved = await models.CrossSlip.findByPk(slipId);
    assert.ok(saved.approvedAt);
    try {
      const result = await callDeleteSlip(report.id, data.approver);
      assert.equal(result.body.code, 0);
      assert.equal(result.body.slipWasApproved, true);
      assert.isNull(await models.CrossSlip.findByPk(slipId));
      const reloaded = await models.ExpenseReport.findByPk(report.id);
      const remaining = await models.CrossSlip.findAll({ where: { expenseReportId: report.id } });
      assert.equal(remaining.length, 0);
    } finally {
      await cleanup(report);
    }
  });

  it('紐付伝票の削除: 承認済み伝票は非会計では消せない', async () => {
    const report = await buildApprovedReport(data.approver);
    try {
      const result = await callDeleteSlip(report.id, approverNoAcct);
      assert.equal(result.status, 422);
      assert.ok(await models.CrossSlip.findOne({ where: { expenseReportId: report.id } }));
    } finally {
      await cleanup(report);
    }
  });

  it('紐付伝票の削除: 精算書が承認済みの場合は消せない', async () => {
    const report = await buildApprovedReport(approverNoAcct);
    report.approvedAt = new Date();
    await report.save();
    try {
      const result = await callDeleteSlip(report.id, data.approver);
      assert.equal(result.status, 422);
      assert.ok(await models.CrossSlip.findOne({ where: { expenseReportId: report.id } }));
    } finally {
      await cleanup(report);
    }
  });
describe('expense (voucher settled)', () => {
  const callUpdate = async (user, body, paramsId) => {
    const apiVoucher = ( await import('../routes/api_voucher.js') ).default;
    const req = { body: { ...body, id: paramsId || body.id }, params: paramsId ? { id: paramsId } : {}, session: { user: user } };
    let status = 200;
    let bodyOut = null;
    const res = {
      set: () => {},
      status: (c) => { status = c; return res; },
      json: (o) => { bodyOut = o; return res; }
    };
    let nextErr = null;
    await apiVoucher.update(req, res, (e) => { nextErr = e; });
    return { status: status, body: bodyOut, nextErr: nextErr };
  };

  it('settled: trueでOK済みになり、監査列（誰・いつ）がサーバ側で入る', async () => {
    const voucher = await models.Voucher.create({
      issueDate: '2026-03-10',
      createdBy: data.creator.id,
      updatedBy: data.creator.id
    });
    try {
      const r = await callUpdate(data.creator, { settled: true }, voucher.id);
      assert.equal(r.body.code, undefined); // 成功は voucher を返す
      const saved = await models.Voucher.findByPk(voucher.id, {
        include: [{ model: models.User, as: 'settleUser' }]
      });
      assert.ok(saved.settledAt);
      assert.equal(saved.settledBy, data.creator.id);
      assert.equal(saved.settleUser.name, data.creator.name);
    } finally {
      await voucher.destroy();
    }
  });

  it('settled: falseで解除される（両列がnull）', async () => {
    const voucher = await models.Voucher.create({
      issueDate: '2026-03-10',
      settledAt: new Date(),
      settledBy: data.creator.id,
      createdBy: data.creator.id,
      updatedBy: data.creator.id
    });
    try {
      await callUpdate(data.creator, { settled: false }, voucher.id);
      const saved = await models.Voucher.findByPk(voucher.id);
      assert.isNull(saved.settledAt);
      assert.isNull(saved.settledBy);
    } finally {
      await voucher.destroy();
    }
  });

  it('settledなしの部分更新は監査列に触れない', async () => {
    const at = new Date(Date.now() - 86400000);
    const voucher = await models.Voucher.create({
      issueDate: '2026-03-10',
      settledAt: at,
      settledBy: data.creator.id,
      createdBy: data.creator.id,
      updatedBy: data.creator.id
    });
    try {
      await callUpdate(data.creator, { description: 'メモ' }, voucher.id);
      const saved = await models.Voucher.findByPk(voucher.id);
      assert.equal(saved.description, 'メモ');
      // updatedAtの精度差を許容して比較
      assert.ok(Math.abs(saved.settledAt.getTime() - at.getTime()) < 2000);
      assert.equal(saved.settledBy, data.creator.id);
    } finally {
      await voucher.destroy();
    }
  });
});
});

describe('expense (pickPayeeMapping)', () => {
  // 同一会社に説明違いのマッピングが複数あるケースの照合
  const amazonBooks = { id: 1, name: 'Amazon書籍', companyId: 2, description: '書籍,本,コミック' };
  const amazonGoods = { id: 2, name: 'Amazon事務用品', companyId: 2, description: '事務用品,文具' };
  const amazonDefault = { id: 3, name: 'Amazon', companyId: 2, description: null };
  const other = { id: 4, name: 'よそ', companyId: 99, description: 'その他' };

  it('候補が1件だけなら説明に関係なくそれを使う', () => {
    assert.equal(pickPayeeMapping([ other ], 99, '何でも'), other);
  });

  it('OCR説明文がキーワードを含むマッピングに振り分ける', () => {
    const payees = [ amazonBooks, amazonGoods, amazonDefault ];
    assert.equal(pickPayeeMapping(payees, 2, '書籍 「テスト駆動開発」').id, 1);
    assert.equal(pickPayeeMapping(payees, 2, '事務用品 レジ妙紙 A4').id, 2);
  });

  it('どのキーワードにも合わなければ説明が空のマッピング（デフォルト）を使う', () => {
    const payees = [ amazonBooks, amazonGoods, amazonDefault ];
    assert.equal(pickPayeeMapping(payees, 2, 'ケーブルタイ').id, 3);
  });

  it('デフォルトがなければ先頭を使う', () => {
    const payees = [ amazonBooks, amazonGoods ];
    assert.equal(pickPayeeMapping(payees, 2, 'ケーブルタイ').id, 1);
  });

  it('OCR説明文が空ならキーワード照合を飛ばしてデフォルト', () => {
    const payees = [ amazonBooks, amazonGoods, amazonDefault ];
    assert.equal(pickPayeeMapping(payees, 2, null).id, 3);
  });

  it('候補がなければnull', () => {
    assert.isNull(pickPayeeMapping([ other ], 2, '書籍'));
  });
});

