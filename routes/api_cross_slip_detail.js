import models from '../models/index.js';
const Op = models.Sequelize.Op;
import CrossSlipDetails from '../libs/crossslipdetails.js';
import {isLocked, findFiscalYearForTerm} from '../libs/fiscal-lock.js';

export default {
  get: (req, res, next) => {
    let id = req.params.id;

    models.CrossSlipDetail.findOne({
      where: {
        id: id
      }
    }).then((detail) => {
      res.json(detail);
    });
  },
  all: (req, res, next) => {
    models.FiscalYear.findOne({
      where: {
        term: req.params.term
      }
    }).then((fy) => {
  		if	( req.params.sub )	{
      	CrossSlipDetails.all(fy, req.params.acc, paseInt(req.params.sum)).then((result) => {
        	res.json({
          	details: result
        	})
      	});
    	} else {
      	CrossSlipDetails.all(fy. req.params.acc).then((result) => {
          res.json({
            details: result
          })
        })
    	}
    });
  },
  update: (req, res, next) => {
    let detail = req.body;
    console.log('update', detail);
    models.CrossSlipDetail.findOne({
      where: {
        id: detail.id
      }
    }).then(async (result) => {
      if ( result ) {
        const slip = await models.CrossSlip.findByPk(result.crossSlipId);
        if ( slip ) {
          // 承認済み伝票の明細は直接変更できない（本体の更新（PUT /cross_slip）
          // と同じく、不承認に戻してから。承認済みは承認権限者にも不変）
          if ( slip.approvedAt ) {
            res.json({ code: -2, message: 'this slip was approved' });
            return;
          }
          const fy = await findFiscalYearForTerm(slip.term);
          if ( fy && isLocked(fy) ) {
            res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: fy.term });
            return;
          }
        }
        result.set(detail);
        result.save().then(() => {
          res.json(result);
        });
      }
    });
  }
}
