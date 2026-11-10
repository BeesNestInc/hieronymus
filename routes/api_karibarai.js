import models from '../models/index.js';
const Op = models.Sequelize.Op;

// 仮払金(1130000)の補助科目（立替者）別の現在高。
// 期で区切らず**全期間の明細を通算**して現在高を出す:
// 経費精算の仮払金積み上げ（fy2）と精算（fy3）が別期にまたがっても
// 正しく相殺されるようにするため（この画面は「今、誰にいくら返すべきか」
// を答えるのが目的。期単位の推移は元帳で確認する）。
// 繰越処理を運用している環境では、繰越スナップショット（SubAccountRemaining）
// 以降の明細を加算する。未承認の伝票も含める（銀行元帳と同じ運用）。
// 残高は 貸方-借方 = 精算待ち額（正=返すべき額）とする。
const KARIBARAI_CODE = '1130000';

export default {
  get: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
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
        // 借方/貸方の累計（全期間・全伝票。繰越処理はスナップショットを作る
        // だけで明細を消さないため、全明細の累計がそのまま現在高になる）
        const debitRow = await models.CrossSlipDetail.findOne({
          attributes: [
            [ models.sequelize.fn('SUM', models.sequelize.col('CrossSlipDetail.debitAmount')), 'debit' ]
          ],
          where: {
            debitAccount: KARIBARAI_CODE,
            debitSubAccount: sub.subAccountCode
          },
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
          raw: true
        });
        const debit = Number(debitRow ? ( debitRow.debit || 0 ) : 0);
        const credit = Number(creditRow ? ( creditRow.credit || 0 ) : 0);
        values.push({
          name: sub.name,
          code: sub.subAccountCode,
          debit: debit,
          credit: credit,
          // 精算待ち額 = 貸方（経費精算で積んだ額）- 借方（精算で返した額）
          balance: credit - debit
        });
      }
      res.json({ values: values });
    } catch (e) {
      next(e);
    }
  }
};
