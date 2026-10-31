import models from '../models/index.js';
const Op = models.Sequelize.Op;

// 口座（Financial）。取り込（通帳・カード明細）の集積体で次年度以降も使い回す。
// name/kind/accountCode/subAccountCode/memberId/profileName/closedAt。
// 一覧は「口座単位の行」: 未取込の口座も見える（取り込忘れの備忘）。
// 「もう使わない」はclosedAt（削除ではなく非活性化。取込が紐付く口座は消せない）
const canManage = ( user ) => ( Boolean(user.accounting) );

const KINDS = [ 'bank', 'corporate_card', 'personal_card' ];

// 部分更新に耐える入力整形（未指定=undefined は触らない。「もう使わない」
// のclosedだけのPUTで種別/科目が消えないようにする）
const cleanInput = ( body ) => {
  const kind = ( body.kind === undefined ) ? undefined :
    ( ( KINDS.includes(body.kind) ) ? body.kind : null );
  const accountCode = ( body.accountCode === undefined ) ? undefined :
    ( body.accountCode ? String(body.accountCode) : null );
  const subAccountCode = ( body.subAccountCode !== undefined ) ?
    ( body.subAccountCode ? parseInt(body.subAccountCode, 10) : null ) : undefined;
  return {
    name: ( body.name !== undefined ) ? ( body.name ? String(body.name) : null ) : undefined,
    kind: ( kind === undefined ) ? undefined : kind,
    accountCode: ( accountCode === undefined ) ? undefined : accountCode,
    subAccountCode: subAccountCode,
    memberId: ( body.memberId !== undefined ) ? ( body.memberId ? parseInt(body.memberId, 10) : null ) : undefined,
    profileName: ( body.profileName !== undefined ) ? ( body.profileName ? String(body.profileName) : null ) : undefined,
    memo: ( body.memo !== undefined ) ? ( body.memo ? String(body.memo) : null ) : undefined
  };
};

// 口座の一覧（使用中のみ。closedAtは「もう使わない」非活性を意味する）
export default {
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) && !req.session.user.fiscalBrowsing ) {
      res.json({ code: -10 });
      return;
    }
    const financials = await models.Financial.findAll({
      // closed=1 で「もう使わない」の口座も出す（戻す操作用）
      where: ( req.query.closed ) ? {} : { closedAt: null },
      order: [[ 'id', 'ASC' ]],
      include: [{ model: models.BankStatement, as: 'statements' }]
    });
    // 口座行の表示に使う「最新取り込」の情報を添える
    const values = [];
    for ( const financial of financials ) {
      const statements = financial.statements || [];
      const latest = statements.slice().sort(( a, b ) => ( b.id - a.id ))[ 0 ] || null;
      const lineCount = statements.reduce(( sum, s ) => ( sum + ( s.lineCount || 0 ) ), 0);
      values.push({
        id: financial.id,
        name: financial.name,
        kind: financial.kind,
        accountCode: financial.accountCode,
        subAccountCode: financial.subAccountCode,
        memberId: financial.memberId,
        profileName: financial.profileName,
        statementId: latest ? latest.id : null,
        fileName: latest ? latest.fileName : null,
        periodFrom: latest ? latest.periodFrom : null,
        periodTo: latest ? latest.periodTo : null,
        lineCount: lineCount,
        statementCount: statements.length
      });
    }
    res.json({ code: 0, values: values });
  },

  // 口座を追加する（on-demand）。勘定科目+補助は必須
  create: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const body = req.body || {};
    const clean = cleanInput(body);
    if ( !clean.name || !clean.kind || !clean.accountCode ) {
      res.status(422).json({ code: -2, message: '通帳名・種別・勘定科目は必須です。' });
      return;
    }
    try {
      const [ financial, created ] = await models.Financial.findOrCreate({
        where: {
          accountCode: clean.accountCode,
          subAccountCode: ( clean.subAccountCode === undefined ) ? null : clean.subAccountCode
        },
        defaults: {
          name: clean.name,
          kind: clean.kind,
          memberId: clean.memberId || null,
          profileName: clean.profileName || null,
          memo: clean.memo || null
        }
      });
      if ( !created ) {
        // 同じ口座が既にある（closedAtを解除して使えるように戻す）
        financial.name = clean.name;
        financial.closedAt = null;
        await financial.save();
      }
      res.json({ code: 0, id: financial.id, created: created });
    } catch (e) {
      console.error(e);
      res.status(422).json({ code: -1, message: e.message || '登録に失敗しました。' });
    }
  },

  update: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const financial = await models.Financial.findByPk(parseInt(req.params.id));
    if ( !financial ) {
      res.status(404).json({ code: -1 });
      return;
    }
    const body = req.body || {};
    const clean = cleanInput(body);
    for ( const field of [ 'name', 'kind', 'accountCode', 'subAccountCode', 'memberId', 'profileName', 'memo' ] ) {
      if ( clean[ field ] !== undefined ) {
        financial[ field ] = ( clean[ field ] === '' ) ? null : clean[ field ];
      }
    }
    // 「もう使わない」はclosedAtで扱う（closed: true/falseの指定）
    if ( body.closed !== undefined ) {
      financial.closedAt = body.closed ? new Date() : null;
    }
    await financial.save();
    res.json({ code: 0, id: financial.id });
  },

  // 削除は取り込の紐付いていない口座だけ（誤登録の掃除用）。
  // 取込が紐付いている口座は「もう使わない」(closedAt)を使う。
  // ルールが紐付いている場合も消さない（ルールは口座単位の施行データ）
  delete: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const financial = await models.Financial.findByPk(parseInt(req.params.id));
    if ( !financial ) {
      res.status(404).json({ code: -1 });
      return;
    }
    const statementCount = await models.BankStatement.count({
      where: { financialId: financial.id }
    });
    if ( statementCount > 0 ) {
      res.status(422).json({ code: -2, message: '取り込みのある口座は削除できません。「もう使わない」を使ってください。' });
      return;
    }
    const ruleCount = await models.BankStatementRule.count({
      where: { financialId: financial.id }
    });
    if ( ruleCount > 0 ) {
      res.status(422).json({ code: -2, message: '学習ルールのある口座は削除できません。ルールを削除してからにしてください。' });
      return;
    }
    await financial.destroy();
    res.json({ code: 0 });
  }
};
