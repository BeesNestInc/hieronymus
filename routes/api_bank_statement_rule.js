import models from '../models/index.js';
const Op = models.Sequelize.Op;
import { makePattern, isTempAccount, suggestRuleCandidates } from '../libs/bank-reconcile.js';
// suggestRuleAccounts は動的importで使う(AI SDKのロードを起動時に広げない)
import { loadMergeDescriptions, saveMergeDescriptions, loadMatchDescriptions, saveMatchDescriptions } from '../libs/bank-statement.js';

// 学習ルール（BankStatementRule）の管理。明細取込で相手方仕訳を決める唯一の
// 正規ルール置き場（YAML等の外部定義はしない）。操作は会計権限。
// 合流摘要（前の行と同じ伝票に載せる摘要。config/banks/merge-rules.yaml）の
// 加除もここから行う。
const canManage = (user) => {
  return Boolean(user.accounting);
};

// directionの受け皿。'out'(出金)/'in'(入金)/null(指定なし=両方向)以外はnull
const cleanDirection = (value) => {
  return ( value === 'out' || value === 'in' ) ? value : null;
};

// 補助科目の解決に使うアカウント辞書（口座→補助。セルフの科目名は帳面側で
// /api/accounts から引くため、ここでは科目コードしか返さない）
export default {
  // 一覧。口座（Financial）単位
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) && !req.session.user.fiscalBrowsing ) {
      res.json({ code: -10 });
      return;
    }
    const where = {};
    if ( req.query.financialId ) {
      where.financialId = parseInt(req.query.financialId, 10);
    }
    const rules = await models.BankStatementRule.findAll({
      where: where,
      include: [{ model: models.Financial, as: 'financial' }],
      order: [[ 'financialId', 'ASC' ], [ 'usageCount', 'DESC' ]]
    });
    res.json({
      code: 0,
      values: rules.map((rule) => ({
        id: rule.id,
        financialId: rule.financialId,
        financialName: ( rule.financial ) ? rule.financial.name : null,
        direction: rule.direction,
        pattern: rule.pattern,
        oppositeAccount: rule.oppositeAccount,
        oppositeSubAccount: rule.oppositeSubAccount,
        creditAccount: rule.creditAccount,
        creditSubAccount: rule.creditSubAccount,
        merge: rule.merge,
        match: rule.match,
        usageCount: rule.usageCount
      }))
    });
  },

  // 新規登録（手動）。pattern は正規化済み摘要の完全一致で保存する
  create: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const body = req.body || {};
    const financialId = body.financialId ? parseInt(body.financialId, 10) : null;
    const pattern = makePattern(body.pattern);
    // 合流専用ルール（merge=true）は相手方を持たない（仮入科目で載る）
    if ( !financialId || !pattern || ( !body.oppositeAccount && !body.merge ) ) {
      res.status(422).json({ code: -2, message: '口座・摘要・相手方科目が未指定です。' });
      return;
    }
    if ( body.oppositeAccount && isTempAccount(body.oppositeAccount) ) {
      res.status(422).json({ code: -2, message: '仮入科目はルールの相手方に指定できません。' });
      return;
    }
    try {
      const direction = cleanDirection(body.direction);
      const [ rule, created ] = await models.BankStatementRule.findOrCreate({
        where: {
          financialId: financialId,
          pattern: pattern,
          direction: direction
        },
        defaults: {
          oppositeAccount: body.oppositeAccount || null,
          oppositeSubAccount: body.oppositeSubAccount ? parseInt(body.oppositeSubAccount) : null,
          creditAccount: body.creditAccount || null,
          creditSubAccount: body.creditSubAccount ? parseInt(body.creditSubAccount) : null,
          merge: Boolean(body.merge),
          match: Boolean(body.match),
          usageCount: 1
        }
      });
      if ( !created ) {
        // 既に同じキーのルールがあれば内容を上書きする
        rule.oppositeAccount = body.oppositeAccount || null;
        rule.oppositeSubAccount = body.oppositeSubAccount ? parseInt(body.oppositeSubAccount) : null;
        rule.creditAccount = body.creditAccount || null;
        rule.creditSubAccount = body.creditSubAccount ? parseInt(body.creditSubAccount) : null;
        rule.merge = Boolean(body.merge);
        rule.match = Boolean(body.match);
        await rule.save();
      }
      res.json({ code: 0, id: rule.id, created: created });
    } catch (e) {
      console.error(e);
      res.status(422).json({ code: -1, message: e.message || '登録に失敗しました。' });
    }
  },

  // 更新（相手方の変更など）
  update: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const rule = await models.BankStatementRule.findByPk(parseInt(req.params.id));
    if ( !rule ) {
      res.json({ code: -1 });
      return;
    }
    const body = req.body || {};
    if ( body.pattern !== undefined ) {
      const pattern = makePattern(body.pattern);
      if ( !pattern ) {
        res.status(422).json({ code: -2, message: '摘要が未指定です。' });
        return;
      }
      rule.pattern = pattern;
    }
    if ( body.account !== undefined ) {
      rule.account = body.account || rule.account;
    }
    if ( body.subAccount !== undefined ) {
      rule.subAccount = body.subAccount ? parseInt(body.subAccount) : null;
    }
    if ( body.oppositeAccount !== undefined ) {
      if ( isTempAccount(body.oppositeAccount) ) {
        res.status(422).json({ code: -2, message: '仮入科目はルールの相手方に指定できません。' });
        return;
      }
      rule.oppositeAccount = body.oppositeAccount;
      rule.oppositeSubAccount = body.oppositeSubAccount ? parseInt(body.oppositeSubAccount) : null;
    }
    if ( body.direction !== undefined ) {
      rule.direction = cleanDirection(body.direction);
    }
    if ( body.creditAccount !== undefined ) {
      rule.creditAccount = body.creditAccount || null;
      rule.creditSubAccount = body.creditSubAccount ? parseInt(body.creditSubAccount) : null;
    }
    if ( body.merge !== undefined ) {
      rule.merge = Boolean(body.merge);
    }
    if ( body.match !== undefined ) {
      rule.match = Boolean(body.match);
    }
    await rule.save();
    res.json({ code: 0 });
  },

  // 削除
  delete: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const rule = await models.BankStatementRule.findByPk(parseInt(req.params.id));
    if ( !rule ) {
      res.json({ code: -1 });
      return;
    }
    await rule.destroy();
    res.json({ code: 0 });
  },

  // 合流摘要の取得（前の行と同じ伝票に載せる摘要。口座共通）
  mergeRulesGet: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) && !req.session.user.fiscalBrowsing ) {
      res.json({ code: -10 });
      return;
    }
    res.json({ code: 0, values: loadMergeDescriptions() });
  },

  // 合流摘要の保存（リスト全体を差し替える）
  mergeRulesPut: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const values = ( req.body && Array.isArray(req.body.values) ) ? req.body.values : null;
    if ( !values ) {
      res.status(422).json({ code: -2, message: 'values（摘要の配列）が未指定です。' });
      return;
    }
    try {
      const saved = saveMergeDescriptions(values);
      res.json({ code: 0, values: saved });
    } catch (e) {
      console.error(e);
      res.status(422).json({ code: -1, message: e.message || '保存に失敗しました。' });
    }
  },

  // ルール候補（承認制）。この取り込の未ルール摘要を、過去の仕訳実績の
  // 相手方候補つきで返す
  candidates: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) && !req.session.user.fiscalBrowsing ) {
      res.json({ code: -10 });
      return;
    }
    const statement = await models.BankStatement.findByPk(parseInt(req.query.statementId, 10));
    if ( !statement ) {
      res.json({ code: 0, values: [] });
      return;
    }
    const values = await suggestRuleCandidates(statement);
    res.json({ code: 0, values: values });
  },

  // AIでルール候補の相手方を提案する（明示的な操作で発火。金がかかる）。
  // 実績提案（過去の仕訳）のある候補はそのまま（実績 > AI）。AIが対象にするのは
  // 出金の提案なし候補だけ（売上原価系のカタログで分類する。入金の借方は
  // 経費ではないので対象にしない）。登録は人の確認（既存の登録経路）を経る。
  aiCandidates: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const statementId = parseInt(( req.body && req.body.statementId ) || 0, 10);
    const statement = await models.BankStatement.findByPk(statementId);
    if ( !statement ) {
      res.json({ code: 0, values: [] });
      return;
    }
    const vision = await import('../libs/vision.js');
    if ( !vision.isAvailable() ) {
      res.status(422).json({ code: -1, message: 'AIの設定がありません（config/llms.yaml）。' });
      return;
    }
    const values = await suggestRuleCandidates(statement);
    const needAI = values.filter((v) => ( v.direction === 'out' && !v.suggestAccount ));
    if ( needAI.length > 0 ) {
      // カタログは売上原価系（7番台）+ 補助。提案の選択肢をここに限定する
      const accounts = await models.Account.findAll({
        where: { accountCode: { [Op.like]: '7%' } },
        include: [{ model: models.SubAccount, as: 'subAccounts' }]
      });
      const catalog = accounts.map((a) => ({
        accountCode: a.accountCode,
        name: a.name,
        subAccounts: ( a.subAccounts || [] ).map((sub) => ({
          subAccountCode: sub.subAccountCode,
          name: sub.name
        }))
      }));
      // 同じ口座の既存ルールを仕分け例にする（分類の慣行を踏襲させる）
      const rules = await models.BankStatementRule.findAll({
        where: {
          financialId: statement.financialId,
          oppositeAccount: { [Op.ne]: null }
        }
      });
      const examples = rules.map((r) => ({
        pattern: r.pattern,
        account: r.oppositeAccount,
        sub: r.oppositeSubAccount
      }));
      try {
        const proposals = await vision.suggestRuleAccounts(needAI, {
          catalog: catalog,
          examples: examples,
          financialName: statement.financial ? statement.financial.name : null
        });
        for ( const proposal of proposals ) {
          for ( const candidate of needAI ) {
            if ( candidate.pattern !== proposal.pattern ) {
              continue;
            }
            candidate.suggestAccount = proposal.account;
            candidate.suggestSubAccount = proposal.subAccount;
            candidate.ai = true;
            candidate.aiReason = proposal.reason;
          }
        }
      } catch (e) {
        console.error('ai candidates failed', e);
        res.status(422).json({ code: -3, message: ( e && e.message ) || 'AIで候補を生成できませんでした。' });
        return;
      }
    }
    res.json({ code: 0, values: values });
  },

  // 突合許可摘要の取得（既存仕訳との突合・後の処理が自動で結び付けてよい摘要）
  matchRulesGet: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) && !req.session.user.fiscalBrowsing ) {
      res.json({ code: -10 });
      return;
    }
    res.json({ code: 0, values: loadMatchDescriptions() });
  },

  // 突合許可摘要の保存（リスト全体を差し替える）
  matchRulesPut: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const values = ( req.body && Array.isArray(req.body.values) ) ? req.body.values : null;
    if ( !values ) {
      res.status(422).json({ code: -2, message: 'values（摘要の配列）が未指定です。' });
      return;
    }
    try {
      const saved = saveMatchDescriptions(values);
      res.json({ code: 0, values: saved });
    } catch (e) {
      console.error(e);
      res.status(422).json({ code: -1, message: e.message || '保存に失敗しました。' });
    }
  },
};
