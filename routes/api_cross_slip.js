import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {create as createCrossSlip, update as updateCrossSlip} from '../libs/cross_slip.js';
import {releaseStatementLines, reconcilePlaceholders} from '../libs/bank-reconcile.js';
import * as taxcalc from '../libs/tax-calc.js';
import {isLocked, findFiscalYearForTerm} from '../libs/fiscal-lock.js';

// 経費精算書に紐付いた伝票は精算書側から管理する（承認・修正・削除とも）。
// 伝票側から触れると精算書との乖離や「伝票だけ勝手に承認」が起きるため。
// accessは「紐付きなし/no access」を区別せずtrue/falseのみ返す。
const linkedExpenseReport = (slip) => {
  if (( !slip ) || ( !slip.expenseReportId )) {
    return Promise.resolve(null);
  }
  return models.ExpenseReport.findByPk(slip.expenseReportId);
};

const LINKED_MESSAGE = 'この伝票は経費精算書に紐付いています。精算書の画面から承認・修正してください。';

const recalcReject = (req, res) => {
  const body = req.body;
  const year = parseInt(body.year);
  const month = parseInt(body.month);
  const day = parseInt(body.day);
  return (async () => {
    const dayErr = taxcalc.validateDay(year, month, day);
    if ( dayErr ) {
      res.status(422).json({ code: -2, message: dayErr });
      return null;
    }
    const ctx = await taxcalc.loadTaxContext(year, month);
    if ( !ctx.fy ) {
      res.status(422).json({ code: -2, message: 'date error' });
      return null;
    }
    if ( isLocked(ctx.fy) ) {
      res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: ctx.fy.term });
      return null;
    }
    const lines = taxcalc.recalcSlipLines(body.lines, ctx);
    const err = taxcalc.validateLines(lines, ctx) || taxcalc.validateBalanced(lines);
    if ( err ) {
      res.status(422).json({ code: -2, message: err });
      return null;
    }
    body.lines = lines;
    body.term = ctx.fy.term;
    return body;
  })();
};

export default {
  list: async(req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    switch  ( req.params.type)  {
      case  'not_approved':
        let where;
        if  ( req.session.user.approvable ) {
          where = {
            approvedAt: {
              [Op.eq]: null
            }
          };
        } else {
          where = {
            approvedAt: {
              [Op.eq]: null
            },
            createdBy: req.session.user.id
          };
        }
        if  ( req.session.term )  {
          where.term = req.session.term;
        }
        let cross_slips = await models.CrossSlip.findAll({
          where: where,
          include: [
            {
              model: models.User,
              as: 'creater'
            }, {
              model: models.User,
              as: 'approver'
            }, {
              model: models.User,
              as: 'updater'
            }, {
              model: models.CrossSlipDetail,
              as: 'lines',
            }
          ],
          order: [
            [ 'year', 'ASC'],
            [ 'month', 'ASC'],
            [ 'day', 'ASC' ],
            [ 'no', 'ASC' ],
            ['lines', 'lineNo', 'ASC']
          ]
        });
        res.json(cross_slips);
        break;
      default:
        break;
    }
  },
  get: async(req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let year = req.params.year;
    let month = req.params.month;
    let no = req.params.no;

    let cross_slip = await models.CrossSlip.findOne({
      where: {
        [Op.and]: {
          year: year,
          month: month,
          no: no
        }
      },
      include: [
        {
          model: models.CrossSlipDetail,
          as: 'lines',
          include: [
            {
              model: models.Voucher,
              required: false,
              as: 'debitVoucher',
              include: [{
                model: models.VoucherFile,
                as: 'files'
              }]
            }, {
              model: models.Voucher,
              required: false,
              as: 'creditVoucher',
              include: [{
                model: models.VoucherFile,
                as: 'files'
              }]
            }, {
              model: models.TaxRule,
              as: 'debitTaxRule'
            }, {
              model: models.TaxRule,
              as: 'creditTaxRule'
            }, {
              model: models.Project,
              as: 'projectData'
            }]
          },
        {
          model: models.User,
          as: 'creater'
        },
        {
          model: models.User,
          as: 'approver'
        }
      ],
      order: [
        ['lines', 'lineNo', 'ASC']
      ]
    });
    // 紐付精算書の逆引き（権限のあるユーザーには精算書へのリンクを表示するため）
    const linked = await linkedExpenseReport(cross_slip);
    res.json({
      ...( cross_slip ? cross_slip.toJSON() : null ),
      expenseReport: linked ? {
        id: linked.id,
        purpose: linked.purpose
      } : null
    });
  },
  post: async(req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let body = await recalcReject(req, res);
    if ( !body ) return;
    try {
      let slip = await createCrossSlip(body, req.session.user);
      if  ( slip )  {
        // 「後の処理」。実科目の伝票が増えたので、仮入科目の未承認伝票を
        // 突合して差し替える（完全自動運用。失敗しても登録自体は成功）
        try {
          await reconcilePlaceholders();
        } catch (e) {
          console.error('reconcilePlaceholders failed', e);
        }
        res.json(slip);
      } else {
        res.status(422).json({
          code: -2,
          message: 'date error'
        });
      }
    } catch (e) {
      if ( e && e.name === 'FiscalYearLocked' ) {
        res.status(423).json({
          code: -423,
          message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。',
          term: e.term
        });
        return;
      }
      if ( e && e.name === 'SequelizeUniqueConstraintError' ) {
        res.status(409).json({
          code: -3,
          message: '伝票番号が重複しました。再度登録してください。'
        });
        return;
      }
      next(e);
    }
  },
  update: async(req, res, next) => {
    let body = await recalcReject(req, res);
    if ( !body ) return;
    let slip = await models.CrossSlip.findOne({
        where: {
          year: body.year,
          month: body.month,
          no: body.no
        }
      });
    if ( slip ) {
      const oldFy = await findFiscalYearForTerm(slip.term);
      if ( oldFy && isLocked(oldFy) ) {
        res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: oldFy.term });
        return;
      }
      const linked = await linkedExpenseReport(slip);
      if ( linked ) {
        res.status(422).json({
          code: -2,
          message: LINKED_MESSAGE,
          expenseReportId: linked.id
        });
        return;
      }
      if	( !slip.approvedAt )	{
        if	(( req.session.user.accounting ) ||
           ( req.session.user.id == slip.createdBy )) {
            try {
              await updateCrossSlip(slip, body, req.session.user);
              // 手作業の修正（仮科目→実科目にした場合）も学習対象になる。
              // 「後の処理」の候補増加もここで処理する
              try {
                await reconcilePlaceholders();
              } catch (e) {
                console.error('reconcilePlaceholders failed', e);
              }
            } catch (e) {
              if ( e && e.name === 'FiscalYearLocked' ) {
                res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: e.term });
                return;
              }
              throw e;
            }
            res.json({
              code: 0
            });
        } else {
        }
      } else {
        res.json({
          code: -2,
          message: 'this slip was approved'
        });
      }
    } else {
      res.json({
        code: -1,
        message: 'record not found'
      });
    }
  },
  delete: async(req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let body = req.body;
    let slip = await models.CrossSlip.findOne({
      where: {
        year: body.year,
        month: body.month,
        day: body.day,
        no: body.no
      }
    });
    if	( !slip )	{
      res.json({
        code: -1,
        message: 'record not found'
      });
      return;
    }
    if	( slip.approvedAt )	{
      res.json({
        code: -2,
        message: 'thid slip was approved'
      });
      return;
    }
    const slipFy = await findFiscalYearForTerm(slip.term);
    if ( slipFy && isLocked(slipFy) ) {
      res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: slipFy.term });
      return;
    }
    const linked = await linkedExpenseReport(slip);
    if ( linked ) {
      res.status(422).json({
        code: -2,
        message: LINKED_MESSAGE,
        expenseReportId: linked.id
      });
      return;
    }
    if	( ( !req.session.user.approvable ) &&
         ( slip.createdBy !== req.session.user.id ) )	{
      res.json({
        code: -10,
        message: 'permission denied'
      });
      return;
    }
    // この伝票の明細を突合先にしていた取込明細を「未照合」に戻す
    const detailIds = ( await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      attributes: [ 'id' ]
    }) ).map((d) => d.id);
    await releaseStatementLines(detailIds);
    await slip.destroy();
    res.json({
      code: 0,
    });
  },
  approve: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if	( req.session.user.approvable )	{
      let body = req.body;
      //console.log('update body:', body);
      try {
        const slip = await models.CrossSlip.findOne({
          where: {
            year: body.year,
            month: body.month,
            no: body.no
          }
        });
        if ( !slip ) {
          res.json({
            code: -1,
            message: 'record not found'
          });
          return;
        }
        const slipFy = await findFiscalYearForTerm(slip.term);
        if ( slipFy && isLocked(slipFy) ) {
          res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: slipFy.term });
          return;
        }
        const linked = await linkedExpenseReport(slip);
        if ( linked ) {
          res.status(422).json({
            code: -2,
            message: LINKED_MESSAGE,
            expenseReportId: linked.id
          });
          return;
        }
        slip.approvedAt = body.approvedAt;
        if	( body.approvedAt )	{
          slip.approvedBy = req.session.user.id;
        } else {
          slip.approvedBy = null;
        }
        slip.updatedBy = req.session.user.id;
        await slip.save();
        // 伝票が増えるのと同じなので「後の処理」を走らせる
        if ( body.approvedAt ) {
          try {
            await reconcilePlaceholders();
          } catch (e) {
            console.error('reconcilePlaceholders failed', e);
          }
        }
        res.json({
          code: 0,
          id: slip.id
        });
      } catch (e) {
        res.json({
          code: -1,
          message: 'record not found'
        });
      }
    } else {
      res.json({
        code: -10,
        message: 'this account can not approve'
      });
    }
  }
}
