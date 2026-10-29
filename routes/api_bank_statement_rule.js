import models from '../models/index.js';
const Op = models.Sequelize.Op;
import { makePattern, isTempAccount } from '../libs/bank-reconcile.js';
import { loadMergeDescriptions, saveMergeDescriptions } from '../libs/bank-statement.js';

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
  // 一覧。口座（勘定科目）単位
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) && !req.session.user.fiscalBrowsing ) {
      res.json({ code: -10 });
      return;
    }
    const where = {};
    if ( req.query.account ) {
      where.account = req.query.account;
    }
    const rules = await models.BankStatementRule.findAll({
      where: where,
      order: [[ 'account', 'ASC' ], [ 'usageCount', 'DESC' ]]
    });
    res.json({ code: 0, values: rules });
  },

  // 新規登録（手動）。pattern は正規化済み摘要の完全一致で保存する
  create: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const body = req.body || {};
    const account = body.account;
    const pattern = makePattern(body.pattern);
    if ( !account || !pattern || !body.oppositeAccount ) {
      res.status(422).json({ code: -2, message: '口座・摘要・相手方科目が未指定です。' });
      return;
    }
    if ( isTempAccount(body.oppositeAccount) || isTempAccount(account) ) {
      res.status(422).json({ code: -2, message: '仮入科目はルールの相手方に指定できません。' });
      return;
    }
    try {
      const direction = cleanDirection(body.direction);
      const [ rule, created ] = await models.BankStatementRule.findOrCreate({
        where: {
          account: account,
          subAccount: body.subAccount ? parseInt(body.subAccount) : null,
          pattern: pattern,
          direction: direction
        },
        defaults: {
          oppositeAccount: body.oppositeAccount,
          oppositeSubAccount: body.oppositeSubAccount ? parseInt(body.oppositeSubAccount) : null,
          usageCount: 1
        }
      });
      if ( !created ) {
        // 既に同じキーのルールがあれば内容を上書きする
        rule.oppositeAccount = body.oppositeAccount;
        rule.oppositeSubAccount = body.oppositeSubAccount ? parseInt(body.oppositeSubAccount) : null;
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
  }
};
