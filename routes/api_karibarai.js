import models from '../models/index.js';
const Op = models.Sequelize.Op;

// 仮払金(1130000)の補助科目（立替者）別の現在高。
// 期で区切らず**全期間の明細を通算**して現在高を出す:
// 経費精算の仮払金積み上げ（fy2）と精算（fy3）が別期にまたがっても
// 正しく相殺されるようにするため（この画面は「今、誰にいくら返すべきか」
// を答えるのが目的。期単位の推移は元帳で確認する）。
// 繰越処理はスナップショットを作るだけで明細を消さないため、
// 全明細の累計がそのまま現在高になる。未承認の伝票も含める
// （銀行元帳と同じ運用）。残高は 貸方-借方 = 精算待ち額（正=返すべき額）。
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
      // 精算履歴: 仮払金に触れた明細（新着順。直近30明細）。
      // 期をまたぐ運用なので全期間対象。補助科目・相手科目名も付けて返す
      const subNameMap = {};
      for ( const sub of karibarai.subAccounts ) {
        subNameMap[sub.subAccountCode] = sub.name;
      }
      const detailRows = await models.CrossSlipDetail.findAll({
        where: {
          [Op.or]: [
            { debitAccount: KARIBARAI_CODE },
            { creditAccount: KARIBARAI_CODE }
          ]
        },
        include: [{
          model: models.CrossSlip,
          as: 'crossSlip'
        }],
        order: [
          [ { model: models.CrossSlip, as: 'crossSlip' }, 'year', 'DESC' ],
          [ { model: models.CrossSlip, as: 'crossSlip' }, 'month', 'DESC' ],
          [ { model: models.CrossSlip, as: 'crossSlip' }, 'day', 'DESC' ],
          [ { model: models.CrossSlip, as: 'crossSlip' }, 'no', 'DESC' ]
        ],
        limit: 30
      });
      // 相手科目名の解決（科目+補助科目）
      const counterCodes = [];
      for ( const d of detailRows ) {
        const counter = ( d.debitAccount === KARIBARAI_CODE ) ? d.creditAccount : d.debitAccount;
        if ( counter && !counterCodes.includes(counter) ) {
          counterCodes.push(counter);
        }
      }
      const counterAccounts = counterCodes.length ?
        await models.Account.findAll({
          where: { accountCode: counterCodes },
          include: [{ model: models.SubAccount, as: 'subAccounts' }]
        }) : [];
      const accountMap = {};
      for ( const a of counterAccounts ) {
        const subMap = {};
        for ( const s of ( a.subAccounts || [] ) ) {
          subMap[s.subAccountCode] = s.name;
        }
        accountMap[a.accountCode] = { name: a.name, subs: subMap };
      }
      const history = [];
      for ( const d of detailRows ) {
        const slip = d.crossSlip;
        const isDebit = ( d.debitAccount === KARIBARAI_CODE );
        const counterAccount = isDebit ? d.creditAccount : d.debitAccount;
        const counterSub = isDebit ? d.creditSubAccount : d.debitSubAccount;
        const counter = accountMap[counterAccount];
        let kind = '経費精算';
        if ( ( d.application1 || '' ).includes('仮払精算') ) {
          kind = d.application1.includes('返す') ? '精算（返す）' : '精算（もらう）';
        }
        history.push({
          year: slip.year,
          month: slip.month,
          day: slip.day,
          no: slip.no,
          approved: !!slip.approvedAt,
          subName: subNameMap[isDebit ? d.debitSubAccount : d.creditSubAccount] || '',
          kind: kind,
          amount: Number(isDebit ? d.debitAmount : d.creditAmount),
          counterName: counter ? counter.name : counterAccount,
          counterSubName: ( counter && counterSub && counter.subs[counterSub] ) ? counter.subs[counterSub] : ''
        });
      }
      res.json({ values: values, history: history });
    } catch (e) {
      next(e);
    }
  }
};
