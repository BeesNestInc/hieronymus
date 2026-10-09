import models from '../models/index.js';
const Op = models.Sequelize.Op;

// 仮払金(1130000)の補助科目（立替者）別の現在高。
// AccountRemaining は締め処理時のスナップショットなので、期途中の現在高は
// 「期首残高 + 期中明細の累計」を計算して返す（元帳画面と同じ発想）。
// 未承認の伝票も含める（銀行元帳の includeUnapproved と同じ運用）。
const KARIBARAI_CODE = '1130000';

export default {
  get: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const term = parseInt(req.params.term);
      const fy = await models.FiscalYear.findOne({
        where: { term: term }
      });
      if ( !fy ) {
        res.json({ values: [] });
        return;
      }
      const karibarai = await models.Account.findOne({
        where: { accountCode: KARIBARAI_CODE },
        include: [{ model: models.SubAccount, as: 'subAccounts' }]
      });
      if ( !karibarai || !karibarai.subAccounts ) {
        res.json({ values: [] });
        return;
      }
      const values = [];
      for ( const sub of karibarai.subAccounts ) {
        const opening = await models.SubAccountRemaining.findOne({
          where: { subAccountId: sub.id, term: term }
        });
        // 借方/貸方は行単位で別々に集計する（借方側の当該補助と貸方側の当該補助）
        const debitRow = await models.CrossSlipDetail.findOne({
          attributes: [
            [ models.sequelize.fn('SUM', models.sequelize.col('CrossSlipDetail.debitAmount')), 'debit' ]
          ],
          where: {
            debitAccount: KARIBARAI_CODE,
            debitSubAccount: sub.subAccountCode
          },
          include: [{
            model: models.CrossSlip,
            as: 'crossSlip',
            where: { term: term },
            attributes: []
          }],
          raw: true
        });
        const creditRow = await models.CrossSlipDetail.findOne({
          attributes: [
            [ models.sequelize.fn('SUM', models.sequelize.col('CrossSlipDetail.creditAmount')), 'credit' ]
          ],
          where: {
            creditAccount: KARIBARAI_CODE,
            creditSubAccount: sub.subAccountCode
          },
          include: [{
            model: models.CrossSlip,
            as: 'crossSlip',
            where: { term: term },
            attributes: []
          }],
          raw: true
        });
        const debit = Number(debitRow ? ( debitRow.debit || 0 ) : 0);
        const credit = Number(creditRow ? ( creditRow.credit || 0 ) : 0);
        values.push({
          name: sub.name,
          code: sub.subAccountCode,
          debit: debit,
          credit: credit,
          balance: Number(opening ? opening.balance : 0) + debit - credit
        });
      }
      res.json({ values: values });
    } catch (e) {
      next(e);
    }
  }
};
