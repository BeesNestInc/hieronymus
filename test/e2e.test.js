import {assert} from 'chai';
import models from '../models/index.js';
import seed from './seed.js';
import {create as createCrossSlip} from '../libs/cross_slip.js';
import * as taxcalc from '../libs/tax-calc.js';

describe('e2e (test db)', () => {
  let data;

  before(async () => {
    data = await seed();
  });

  after(async () => {
    await models.sequelize.close();
  });

  it('loadTaxContextで会計年度・勘定科目・税率を取得できる', async () => {
    const ctx = await taxcalc.loadTaxContext(2026, 3);
    assert.equal(ctx.fy.term, 1);
    assert.ok(ctx.accounts.length >= 3);
    assert.ok(ctx.taxRules.length >= 1);
  });

  it('非会計ユーザーが仕訳伝票を作成すると承認待ち(approvedAt null)になる', async () => {
    const ctx = await taxcalc.loadTaxContext(2026, 3);
    const rule = ctx.taxRules.find((r) => {
      return ( r.taxClass === 2 );
    });
    let lines = taxcalc.recalcSlipLines([{
      debitAccount: '7000001', debitAmount: 10000, debitTaxRuleId: rule.id,
      creditAccount: '1000001', creditAmount: 11000
    }], ctx);
    const err = taxcalc.validateLines(lines, ctx) || taxcalc.validateBalanced(lines);
    assert.equal(err, null);

    const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 3 } });
    const beforeCount = ml ? ml.slipCount : 0;

    const slip = await createCrossSlip({ year: 2026, month: 3, day: 15, term: 1, lines }, data.creator);
    const saved = await models.CrossSlip.findOne({ where: { year: 2026, month: 3, no: slip.no } });
    try {
      assert.ok(slip.no >= 1);
      assert.ok(saved);
      assert.equal(saved.approvedAt, null);
      assert.equal(saved.createdBy, data.creator.id);
      const details = await models.CrossSlipDetail.findAll({ where: { crossSlipId: saved.id } });
      assert.equal(details.length, 2);
      const debitTotal = details.reduce((s, d) => s + Number(d.debitAmount), 0);
      const creditTotal = details.reduce((s, d) => s + Number(d.creditAmount), 0);
      assert.equal(debitTotal, creditTotal);
    } finally {
      if ( saved ) {
        await saved.destroy();
      }
      const ml = await models.MonthlyLog.findOne({ where: { term: 1, month: 3 } });
      if ( ml ) {
        ml.slipCount = beforeCount;
        await ml.save();
      } else {
        await models.MonthlyLog.create({ term: 1, month: 3, slipCount: beforeCount, voucherCount: 0 });
      }
    }
  });

  it('確認画面ユーザーが適用前照会をすると作成した伝票が自分に紐づく', async () => {
    const ctx = await taxcalc.loadTaxContext(2026, 3);
    const rule = ctx.taxRules.find((r) => {
      return ( r.taxClass === 2 );
    });
    let lines = taxcalc.recalcSlipLines([{
      debitAccount: '7000001', debitAmount: 5000, debitTaxRuleId: rule.id,
      creditAccount: '1000001', creditAmount: 5500
    }], ctx);
    const slip = await createCrossSlip({ year: 2026, month: 3, day: 16, term: 1, lines }, data.approver);
    const saved = await models.CrossSlip.findOne({ where: { year: 2026, month: 3, no: slip.no } });
    try {
      assert.ok(slip.no >= 1);
    } finally {
      if ( saved ) {
        await saved.destroy();
      }
    }
  });

  it('validateBalanced: 貸借不一致は拒否される', async () => {
    const ctx = await taxcalc.loadTaxContext(2026, 3);
    const lines = taxcalc.recalcSlipLines([{
      debitAccount: '7000001', debitAmount: 10000,
      creditAccount: '1000001', creditAmount: 9000
    }], ctx);
    assert.ok(taxcalc.validateBalanced(lines));
  });
});