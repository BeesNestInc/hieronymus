import models from '../models/index.js';
const Op = models.Sequelize.Op;

// 精算画面: 精算対象科目（補助科目=立替者）別の現在高。
// 対象科目は**出金元マッピング（立替フラグ付き）の勘定科目**から決める。
// 経費精算の承認時起票はそのマッピングの科目に積み上げるので、
// 積み上げ先と精算画面が必ず一致する（単一の情報源）。
// 期で区切らず**全期間の明細を通算**して現在高を出す:
// 経費精算の積み上げ（fy2）と精算（fy3）が別期にまたがっても
// 正しく相殺されるようにするため（この画面は「今、誰にいくら返すべきか」
// を答えるのが目的。期単位の推移は元帳で確認する）。
// 繰越処理はスナップショットを作るだけで明細を消さないため、
// 全明細の累計がそのまま現在高になる。未承認の伝票も含める
// （銀行元帳と同じ運用）。
// 貸借の用語は画面に出さない。純額を「返す/もらう」の方向で返す:
//   貸方残(貸方>借方) = 会社が立替者に負う → 返すべき額
//   借方残(借方>貸方) = 前渡し/払いすぎ     → もらうべき額
// この向きは対象科目が資産(仮払金)でも負債(立替金)でも同じ
// （決算の繰越処理はこの画面の対象外）。

// 立替フラグ付き出金元マッピングの勘定科目を解決する。
// 複数の科目に分かれている（= 仮払金と立替金の併用等）場合は
// 設定不備として message を返す
const resolveSettlementAccount = async () => {
  const advs = await models.ExpenseMapping.findAll({ where: { advance: true } });
  const codes = [ ...new Set(advs.map((m) => m.account).filter(Boolean)) ];
  if ( codes.length === 0 ) {
    return { code: null, message: '立替フラグ付きの出金元マッピングがありません。経費精算の出金元マッピング設定を確認してください。' };
  }
  if ( codes.length > 1 ) {
    return { code: null, message: `立替フラグ付きの出金元マッピングの勘定科目が複数あります（${codes.join('、')}）。精算対象は1科目に統一してください。` };
  }
  return { code: codes[0], message: null };
};

export default {
  get: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const { code, message } = await resolveSettlementAccount();
      if ( !code ) {
        res.json({ account: null, values: [], history: [], message: message });
        return;
      }
      const karibarai = await models.Account.findOne({
        where: { accountCode: code },
        include: [
          { model: models.SubAccount, as: 'subAccounts' },
          { model: models.AccountClass, as: 'accountClass' }
        ]
      });
      if ( !karibarai || !karibarai.subAccounts ) {
        res.json({ values: [], history: [] });
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
            debitAccount: code,
            debitSubAccount: sub.subAccountCode
          },
          raw: true
        });
        const creditRow = await models.CrossSlipDetail.findOne({
          attributes: [
            [ models.sequelize.fn('SUM', models.sequelize.col('CrossSlipDetail.creditAmount')), 'credit' ]
          ],
          where: {
            creditAccount: code,
            creditSubAccount: sub.subAccountCode
          },
          raw: true
        });
        const debit = Number(debitRow ? ( debitRow.debit || 0 ) : 0);
        const credit = Number(creditRow ? ( creditRow.credit || 0 ) : 0);
        const net = credit - debit;
        values.push({
          name: sub.name,
          code: sub.subAccountCode,
          // 正=会社が立替者に返すべき額 / 負=立替者からもらうべき額
          net: net
        });
      }
      // 精算履歴: 対象科目に触れた明細（新着順。直近30明細）。
      // 期をまたぐ運用なので全期間対象。補助科目・相手科目名も付けて返す
      const subNameMap = {};
      for ( const sub of karibarai.subAccounts ) {
        subNameMap[sub.subAccountCode] = sub.name;
      }
      const detailRows = await models.CrossSlipDetail.findAll({
        where: {
          [Op.or]: [
            { debitAccount: code },
            { creditAccount: code }
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
        const counter = ( d.debitAccount === code ) ? d.creditAccount : d.debitAccount;
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
        const isDebit = ( d.debitAccount === code );
        const counterAccount = isDebit ? d.creditAccount : d.debitAccount;
        const counterSub = isDebit ? d.creditSubAccount : d.debitSubAccount;
        const counter = accountMap[counterAccount];
        // 種別は摘要の「精算（返す/もらう）」で判定（旧「仮払精算（…）」行も
        // 同じロジックで拾う）。それ以外は経費精算による積み上げ
        let kind = '経費精算';
        const app1 = d.application1 || '';
        if ( app1.includes('精算（返す') ) {
          kind = '精算（返す）';
        } else if ( app1.includes('精算（もらう') ) {
          kind = '精算（もらう）';
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
      res.json({
        account: {
          code: karibarai.accountCode,
          name: karibarai.name,
          major: karibarai.accountClass ? karibarai.accountClass.major : ''
        },
        values: values,
        history: history
      });
    } catch (e) {
      next(e);
    }
  }
};
