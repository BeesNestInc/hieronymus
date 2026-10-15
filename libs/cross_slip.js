import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {isLocked} from './fiscal-lock.js';

const createDetail = (line, slipId, lineNo) => {
  return models.CrossSlipDetail.create({
    crossSlipId: slipId,
    lineNo: lineNo,
    debitAccount: line.debitAccount,
    debitSubAccount: line.debitSubAccount,
    debitAmount: line.debitAmount,
    debitTax: line.debitTax,
    debitVoucherId: line.debitVoucherId,
    debitTaxRuleId: line.debitTaxRuleId,
    creditAccount: line.creditAccount,
    creditSubAccount: line.creditSubAccount,
    creditAmount: line.creditAmount,
    creditTax: line.creditTax,
    creditVoucherId: line.creditVoucherId,
    creditTaxRuleId: line.creditTaxRuleId,
    projectId: line.projectId,
    application1: line.application1,
    application2: line.application2
  });
}

// options.forceUnapproved: true の場合、作成者が承認権限を持っていても未承認で登録する
// （経費精算の承認時自動起票など、確定は別の承認フローで行う用途向け）
export const create = async (body, user, options = {}) => {
  const MAX_RETRIES = 5;
  let lastError;
  for ( let attempt = 0; attempt < MAX_RETRIES; attempt ++ ) {
    const t = await models.sequelize.transaction();
    try {
      let fy = await models.FiscalYear.findOne({
        where: {
          startDate: {
            [Op.lte]: new Date(body.year, body.month - 1, 2)
          },
          endDate: {
            [Op.gte]: new Date(body.year, body.month - 1, 2)
          }
        },
        transaction: t
      });
      //console.log('fy', fy);
      if  ( !fy ) {
        await t.rollback();
        return;
      }
      if  ( isLocked(fy) ) {
        // rollbackは外側のcatchに任せる（二重rollbackすると元エラーが隠れる）
        const err = new Error('fiscal year is locked');
        err.name = 'FiscalYearLocked';
        err.term = fy.term;
        throw err;
      }
      let ml = await models.MonthlyLog.findOne({
        where: {
          term: fy.term,
          month: body.month
        },
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      if	( !ml )	{
        try {
          ml = await models.MonthlyLog.create({
            term: fy.term,
            month: body.month,
            slipCount: 0,
            voucherCount: 0
          }, { transaction: t });
        } catch (e) {
          // 初回作成レース（term, month の unique 制約）→ 取得し直してリトライ
          if ( e && e.name === 'SequelizeUniqueConstraintError' ) {
            await t.rollback();
            lastError = e;
            continue;
          }
          throw e;
        }
      }
      //console.log('ml', ml);
      ml.slipCount += 1;

      let approvedAt;
      let approvedBy;
      if	( user.approvable && !options.forceUnapproved )	{
        approvedAt = new Date();
        approvedBy = user.id;
      }
      let slip = await models.CrossSlip.create({
        year: body.year,
        month: body.month,
        day: body.day,
        no: ml.slipCount,
        lineCount: body.lines.length,
        createdBy: user.id,
        approvedAt: approvedAt,
        approvedBy: approvedBy,
        term: body.term
      }, { transaction: t });
      await ml.save({ transaction: t });

      let lines = [];
      for ( let i = 0; i < body.lines.length ; i ++ ) {
        let line = body.lines[i];
        await models.CrossSlipDetail.create({
          crossSlipId: slip.id,
          lineNo: i,
          debitAccount: line.debitAccount,
          debitSubAccount: line.debitSubAccount,
          debitAmount: line.debitAmount,
          debitTax: line.debitTax,
          debitVoucherId: line.debitVoucherId,
          debitTaxRuleId: line.debitTaxRuleId,
          creditAccount: line.creditAccount,
          creditSubAccount: line.creditSubAccount,
          creditAmount: line.creditAmount,
          creditTax: line.creditTax,
          creditVoucherId: line.creditVoucherId,
          creditTaxRuleId: line.creditTaxRuleId,
          projectId: line.projectId,
          application1: line.application1,
          application2: line.application2
        }, { transaction: t });
        lines.push(line);
      }
      await t.commit();
      return  ({
        id: slip.id,
        year: body.year,
        month: body.month,
        day: body.day,
        no: slip.no,
        lines: lines
      });
    } catch (e) {
      await t.rollback();
      // 伝票番号重複（year, month, no の unique 制約）→ 採番をやり直す
      if ( e && e.name === 'SequelizeUniqueConstraintError' ) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  const err = new Error('slip number conflict. please retry.');
  err.name = 'SequelizeUniqueConstraintError';
  err.cause = lastError;
  throw err;
}

// options.keepUnapproved: 既存の未承認伝票の「更新」に使う（経費精算書の再承認時の
// 伝票再利用など）。approvedAt/approvedBy をいかなる場合も変更せず、伝票番号も
// 採番せずに slip.day/updatedBy と明細だけを差し替える
export const update = async (slip, body, user, options = {}) => {
  const fy = await models.FiscalYear.findOne({
    where: {
      term: slip.term
    }
  });
  if  ( fy && isLocked(fy) ) {
    const err = new Error('fiscal year is locked');
    err.name = 'FiscalYearLocked';
    err.term = fy.term;
    throw err;
  }
  slip.lineCount = body.lines.length;
  slip.day = body.day;
  slip.updatedBy = user.id;
  if	(( user.approvable ) && ( !options.keepUnapproved ))	{
    slip.approvedAt = new Date();
    slip.approvedBy = user.id;
  }
  await slip.save();
  await models.CrossSlipDetail.destroy({
    where: {
      crossSlipId: slip.id
    }
  });
  for ( let i = 0; i < body.lines.length ; i ++ ) {
    let line = body.lines[i];
    await createDetail(line, slip.id, i);
  }
}