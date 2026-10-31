import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {isLocked} from './fiscal-lock.js';
import {releaseStatementLines, learnFromSlip} from './bank-reconcile.js';

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
    application2: line.application2,
    // 取込明細行との紐付け（明細取込からの起票で渡る）
    statementLineId: line.statementLineId || null
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
        // termの指定がない起票（明細取込のbookLinesなど）は会計年度から補う
        term: body.term || fy.term,
        expenseReportId: body.expenseReportId || null,
        createdBy: user.id,
        approvedAt: approvedAt,
        approvedBy: approvedBy
      }, { transaction: t });
      await ml.save({ transaction: t });

      let lines = [];
      const detailIds = [];
      for ( let i = 0; i < body.lines.length ; i ++ ) {
        let line = body.lines[i];
        const detailRow = await models.CrossSlipDetail.create({
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
          application2: line.application2,
          // 取込明細行との紐付け（明細取込からの起票で渡る）
          statementLineId: line.statementLineId || null
        }, { transaction: t });
        detailIds.push(detailRow.id);
        lines.push(line);
      }
      await t.commit();
      // 取込明細から起票した行（statementLineIdを持つ明細）は、取り込行を
      // 「起票済み」に紐付ける（明細取込からのドラフト起票: 伝票画面の
      // 「登録」で伝票ができるタイミングで取り込行も確定する）
      for ( let i = 0; i < body.lines.length ; i ++ ) {
        if ( body.lines[ i ].statementLineId && detailIds[ i ] ) {
          await models.BankStatementLine.update({
            status: 'booked',
            crossSlipDetailId: detailIds[ i ]
          }, { where: {
            id: body.lines[ i ].statementLineId,
            crossSlipDetailId: null
          } });
        }
      }
      // 銀行科目を含む伝票から摘要→相手方仕訳のルールを学習する（副作用。失敗しない）
      await learnFromSlip(slip);
      return  ({
        id: slip.id,
        year: body.year,
        month: body.month,
        day: body.day,
        term: slip.term,
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
  // 明細を組み替える前に、この伝票の明細と取込明細行の対応を控える。
  // 伝票の更新は明細の再作成（destroy→create）になるので、行側の
  // crossSlipDetailId が古いIDを指してしまう。対応を控えておき、
  // 再作成後に明細行を新しい明細に付け替える（明細数が変わったときは
  // 対応を維持できないので解放する）
  const oldDetails = await models.CrossSlipDetail.findAll({
    where: { crossSlipId: slip.id },
    order: [[ 'lineNo', 'ASC' ]]
  });
  const oldBindings = [];
  for ( const oldDetail of oldDetails ) {
    const bound = await models.BankStatementLine.findOne({
      where: { crossSlipDetailId: oldDetail.id }
    });
    oldBindings.push({ lineId: bound ? bound.id : null, oldLineId: oldDetail.statementLineId || null });
  }
  const detailCountChanged = oldDetails.length !== body.lines.length;
  if ( detailCountChanged ) {
    // 明細を組み替える前に、この伝票の明細を突合先にしていた取込明細を解放する
    await releaseStatementLines(oldDetails.map((d) => d.id));
  }
  await models.CrossSlipDetail.destroy({
    where: {
      crossSlipId: slip.id
    }
  });
  for ( let i = 0; i < body.lines.length ; i ++ ) {
    let line = body.lines[i];
    // 明細数が変わっていなければ、控えていた対応を明細に引き継ぐ
    if ( ( !detailCountChanged ) && oldBindings[ i ] ) {
      line.statementLineId = oldBindings[ i ].lineId || oldBindings[ i ].oldLineId || null;
    }
    await createDetail(line, slip.id, i);
  }
  // 取込明細行を新しい明細に付け替える（解放済みのときは対象外）
  for ( let i = 0; i < oldBindings.length ; i ++ ) {
    if ( detailCountChanged ) break;
    try {
      const binding = oldBindings[ i ];
      const lineId = Number(binding.lineId || binding.oldLineId);
      if ( !lineId ) continue;
      const newDetail = await models.CrossSlipDetail.findOne({
        where: { crossSlipId: slip.id, lineNo: i }
      });
      if ( newDetail && newDetail.statementLineId === lineId ) {
        await models.BankStatementLine.update({
          status: 'booked',
          crossSlipDetailId: newDetail.id
        }, { where: { id: lineId } });
      }
    } catch (e) {
      // 紐付けの復元に失敗しても伝票更新は成功させる（解放される）
    }
  }
  // 銀行科目を含む伝票から摘要→相手方仕訳のルールを学習する（副作用。失敗しない）
  await learnFromSlip(slip);
}