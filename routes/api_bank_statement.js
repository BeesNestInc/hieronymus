import models from '../models/index.js';
const Op = models.Sequelize.Op;
import fs from 'fs';
import Mime from 'mime';
import * as parser from '../libs/bank-statement.js';
import * as reconcile from '../libs/bank-reconcile.js';

// 取込は会計権限、個人カードの取込と精算への選択は本人も可
const canManage = (user) => {
  return Boolean(user.accounting);
};

// 閲覧: 会計/閲覧権限は全明細、それ以外は自分が取り込んだ個人カード明細のみ
// （銀行・社用カードの明細は機微な財務情報のため一般ユーザーには出さない）
const canSeeAll = (user) => {
  return Boolean(user.accounting || user.fiscalBrowsing);
};

const visibleFilter = (user) => {
  if ( canSeeAll(user) ) {
    return null;
  }
  return { kind: 'personal_card', createdBy: user.id };
};

// 明細行をフロント用に整形する（照合先伝票の情報を添える）
const lineToJSON = (line) => {
  const plain = line.toJSON();
  const detail = plain.crossSlipDetail || null;
  return {
    ...plain,
    slip: detail ? detail.crossSlip : null
  };
};

const getStatement = (id) => {
  return models.BankStatement.findByPk(id, {
    include: [{
      model: models.BankStatementLine, as: 'lines',
      include: [{
        model: models.CrossSlipDetail, as: 'crossSlipDetail',
        include: [{ model: models.CrossSlip, as: 'crossSlip' }]
      }]
    }],
    order: [[ { model: models.BankStatementLine, as: 'lines' }, 'lineNo', 'ASC' ]]
  });
};

// アップロードされたファイルの読み取り。multipartのfileまたはJSON
const readUpload = (req) => {
  if ( ( req.files ) && ( req.files.file ) ) {
    return {
      buffer: fs.readFileSync(req.files.file.path),
      fileName: req.files.file.originalFilename || req.files.file.name || 'statement',
      mimeType: req.files.file.type || Mime.getType(req.files.file.path)
    };
  }
  return null;
};

// 取込パラメータの組み立て（previewとuploadで共通）
const statementParams = (body, user) => {
  return {
    kind: body.kind || 'bank',
    account: body.account || null,
    subAccount: body.subAccount ? parseInt(body.subAccount) : null,
    cardName: body.cardName || null,
    memberId: ( body.kind === 'personal_card' ) ? parseInt(body.memberId || user.memberId) || null : null,
    note: body.note || null
  };
};

// 明細行を保存する（uploadから使う）
const saveLines = async (statement, parsed) => {
  const lines = [];
  for ( let i = 0; i < parsed.lines.length; i ++ ) {
    const line = parsed.lines[ i ];
    lines.push(await models.BankStatementLine.create({
      statementId: statement.id,
      lineNo: i + 1,
      date: line.date || null,
      rawDescription: line.rawDescription || null,
      description: line.description || line.rawDescription || line.merchant || null,
      amountIn: line.amountIn,
      amountOut: line.amountOut,
      balance: line.balance,
      amount: line.amount,
      merchant: line.merchant,
      foreignAmount: line.foreignAmount,
      foreignCurrency: line.foreignCurrency,
      category: line.category || 'normal',
      status: 'unmatched',
      memo: line.memo
    }));
  }
  return lines;
};

export default {
  // 取り込む前にパース結果を確認する（DBには書き込まない）
  preview: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const upload = readUpload(req);
    if ( !upload ) {
      res.status(422).json({ code: -2, message: 'ファイルがありません。' });
      return;
    }
    try {
      const parsed = await parser.parseStatement(upload.buffer, upload.mimeType);
      res.json({
        code: 0,
        kind: parsed.kind,
        profileName: parsed.profileName,
        periodFrom: parsed.periodFrom,
        periodTo: parsed.periodTo,
        total: parsed.total,
        payDate: parsed.payDate,
        warnings: parsed.warnings,
        lineCount: parsed.lines.length,
        lines: parsed.lines.map((line) => ({
          ...line,
          date: line.date || null
        }))
      });
    } catch (e) {
      console.log(e);
      res.status(422).json({ code: -1, message: e.message || '読み取りに失敗しました。' });
    }
  },

  // 明細の取り込み（DBに登録する）
  upload: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    const params = statementParams(req.body, user);
    const isPersonal = ( params.kind === 'personal_card' );
    if ( !canManage(user) && !isPersonal ) {
      res.json({ code: -10 });
      return;
    }
    const upload = readUpload(req);
    if ( !upload ) {
      res.status(422).json({ code: -2, message: 'ファイルがありません。' });
      return;
    }
    try {
      const parsed = await parser.parseStatement(upload.buffer, upload.mimeType);
      const statement = await models.BankStatement.create({
        ...params,
        kind: isPersonal ? 'personal_card' : parsed.kind,
        profileName: parsed.profileName,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        fileBody: upload.buffer,
        periodFrom: parsed.periodFrom,
        periodTo: parsed.periodTo,
        lineCount: parsed.lines.length,
        total: parsed.total,
        payDate: parsed.payDate,
        createdBy: user.id,
        updatedBy: user.id
      });
      const lines = await saveLines(statement, parsed);
      res.json({ code: 0, id: statement.id, warnings: parsed.warnings, lineCount: lines.length });
    } catch (e) {
      console.log(e);
      res.status(422).json({ code: -1, message: e.message || '取り込みに失敗しました。' });
    }
  },

  // 一覧（ファイル本体は除く）。非会計ユーザーは自分の個人カード明細のみ
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const where = visibleFilter(req.session.user) || {};
    const statements = await models.BankStatement.findAll({
      where: where,
      attributes: { exclude: [ 'fileBody' ] },
      order: [[ 'id', 'DESC' ]]
    });
    res.json({ code: 0, values: statements });
  },

  // 単一取得（明細行と照合結果付き）
  get: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const statement = await getStatement(parseInt(req.params.id));
    if ( !statement ) {
      res.json({ code: -1 });
      return;
    }
    const filter = visibleFilter(req.session.user);
    if ( filter && ( statement.kind !== filter.kind || statement.createdBy !== req.session.user.id ) ) {
      res.json({ code: -10 });
      return;
    }
    // 支払先候補（摘要→マッピングのルール/key一致）。詳細表示の初回から提示する
    const payeeSuggestions = ( statement.kind === 'bank' ) ?
      await reconcile.suggestPayees(statement) : [];
    res.json({
      code: 0,
      statement: {
        ...statement.toJSON(),
        fileBody: undefined,
        lines: statement.lines.map(lineToJSON)
      },
      payeeSuggestions: payeeSuggestions
    });
  },

  // 取込ファイルのダウンロード（画面参照用）
  file: async (req, res, next) => {
    const statement = await models.BankStatement.findByPk(parseInt(req.params.id));
    if ( ( !statement ) || ( !statement.fileBody ) ) {
      res.status(404).end();
      return;
    }
    const filter = visibleFilter(req.session.user);
    if ( filter && ( statement.kind !== filter.kind || statement.createdBy !== req.session.user.id ) ) {
      res.status(403).end();
      return;
    }
    res.set('Content-Type', statement.mimeType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(statement.fileName || 'statement')}`);
    res.send(statement.fileBody);
  },

  // 突合の実行（既存仕訳との自動照合+カード引落候補の提示）
  match: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    if ( !canManage(user) ) {
      res.json({ code: -10 });
      return;
    }
    const statement = await models.BankStatement.findByPk(parseInt(req.params.id));
    if ( !statement ) {
      res.json({ code: -1 });
      return;
    }
    const result = await reconcile.autoMatch(statement);
    const suggestions = await reconcile.suggestCardPayments(statement);
    const payeeSuggestions = await reconcile.suggestPayees(statement);
    const fresh = await getStatement(statement.id);
    res.json({
      code: 0,
      matched: result.matched,
      suggestions: suggestions,
      payeeSuggestions: payeeSuggestions,
      lines: fresh.lines.map(lineToJSON)
    });
  },

  // 未照合行の一括起票。bookings: [{lineId, payeeMappingId?, debitAccount?, debitSubAccount?}]
  book: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    if ( !canManage(user) ) {
      res.json({ code: -10 });
      return;
    }
    const statement = await models.BankStatement.findByPk(parseInt(req.params.id));
    if ( !statement ) {
      res.json({ code: -1 });
      return;
    }
    try {
      const result = await reconcile.bookLines(statement, req.body.bookings || [], user);
      const fresh = await getStatement(statement.id);
      res.json({
        code: 0,
        slips: result.slips.map((slip) => ({ id: slip.id, year: slip.year, month: slip.month, no: slip.no })),
        lines: fresh.lines.map(lineToJSON)
      });
    } catch (e) {
      console.log(e);
      res.status(422).json({ code: -1, message: e.message });
    }
  },

  // 個人カード明細の選択行を精算書の明細にする
  // selections: [{lineId, payeeMappingId?}]
  select: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    const statement = await models.BankStatement.findByPk(parseInt(req.params.id));
    if ( !statement ) {
      res.json({ code: -1 });
      return;
    }
    const report = await models.ExpenseReport.findByPk(parseInt(req.body.expenseReportId));
    if ( !report ) {
      res.status(422).json({ code: -2, message: '精算書が見つかりません。' });
      return;
    }
    // 会計権限がない場合は自分の精算書に限る
    if ( !canManage(user) && report.submittedBy !== user.id ) {
      res.json({ code: -10 });
      return;
    }
    try {
      const result = await reconcile.selectForExpense(statement, req.body.selections || [], report, user);
      res.json({ code: 0, created: result.lines.map((line) => line.id) });
    } catch (e) {
      console.log(e);
      res.status(422).json({ code: -1, message: e.message });
    }
  },

  // 口座の後付け設定（取り込み時に口座を指定しなかった分）
  update: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !canManage(req.session.user) ) {
      res.json({ code: -10 });
      return;
    }
    const statement = await models.BankStatement.findByPk(parseInt(req.params.id));
    if ( !statement ) {
      res.json({ code: -1 });
      return;
    }
    statement.account = req.body.account || null;
    statement.subAccount = req.body.subAccount ? parseInt(req.body.subAccount) : null;
    statement.updatedBy = req.session.user.id;
    await statement.save();
    res.json({ code: 0 });
  },

  // 行単位の更新（除外/除外解除/摘要の修正）
  updateLine: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    if ( !canManage(user) ) {
      res.json({ code: -10 });
      return;
    }
    const line = await models.BankStatementLine.findByPk(parseInt(req.params.id));
    if ( !line ) {
      res.json({ code: -1 });
      return;
    }
    // 起票済みだが紐付伝票が消えている行は「未照合」に戻せる
    if ( req.body.status === 'ignored' || req.body.status === 'unmatched' ) {
      if ( ( line.status === 'booked' ) && line.crossSlipDetailId ) {
        res.status(422).json({ code: -3, message: '起票済みの明細です。伝票を削除してから戻してください。' });
        return;
      }
      line.status = req.body.status;
      line.crossSlipDetailId = null;
    }
    if ( req.body.description !== undefined ) {
      line.description = req.body.description;
    }
    if ( req.body.memo !== undefined ) {
      line.memo = req.body.memo;
    }
    await line.save();
    res.json({ code: 0 });
  },

  // 取込の削除（起票済み行がある場合は取り消せない）
  delete: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    if ( !canManage(user) ) {
      res.json({ code: -10 });
      return;
    }
    const statement = await models.BankStatement.findByPk(parseInt(req.params.id));
    if ( !statement ) {
      res.json({ code: -1 });
      return;
    }
    const booked = await models.BankStatementLine.count({
      where: { statementId: statement.id, status: 'booked' }
    });
    if ( booked > 0 ) {
      res.status(422).json({ code: -3, message: '起票済みの明細があるため削除できません。' });
      return;
    }
    await statement.destroy();
    res.json({ code: 0 });
  }
};
