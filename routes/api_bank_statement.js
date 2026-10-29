import models from '../models/index.js';
const Op = models.Sequelize.Op;
import fs from 'fs';
import Mime from 'mime';
import * as parser from '../libs/bank-statement.js';
import * as reconcile from '../libs/bank-reconcile.js';
import { isLocked, findFiscalYearForDate } from '../libs/fiscal-lock.js';

// 取込は会計権限、個人カードの取込と精算への選択は本人も可
const canManage = (user) => {
  return Boolean(user.accounting);
};

// 取込期間が含まれる期が確定済みなら、起票の再実行はできない
const lockedStatementMessage = async (statement) => {
  const anchor = statement.periodTo || statement.periodFrom;
  if ( !anchor ) {
    return null;
  }
  const fy = await findFiscalYearForDate(anchor);
  return isLocked(fy) ? fy : null;
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
// 取込の警告はJSON文字列で保持する。APIは配列で返す（破損時は空）
const warningsOf = (text) => {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
};

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
// 同じ口座の既存取込への追加。重複行は挿入せず、期間・行数・ファイル本体を
// 更新する（取込は「通帳」の集積。ファイル本体は最新の物を基準にする。
// 取込の来歴はnoteに積んで残す）。追加がゼロ行でも取込自体は生きる
// （同じファイルの再投入=「何も変わらない」で正しい）
const attachToStatement = async (existing, parsed, upload, user, params, res) => {
  const saved = await saveLines(existing, parsed);
  // 期間は取込全体の包絡を取る（「前回から今月末」の重複断片でも正しくなる）
  const periodFrom = [ existing.periodFrom, parsed.periodFrom ]
    .filter(Boolean).map(String).sort()[ 0 ] || null;
  const periodTo = [ existing.periodTo, parsed.periodTo ]
    .filter(Boolean).map(String).sort().slice(-1)[ 0 ] || null;
  const appended = saved.lines.length;
  const skippedDup = saved.skippedDup;
  // 応答にも残す警告。取込の追加はこの内容で差し替える（追加取込の物が載る）
  const warnings = [ ...( parsed.warnings || [] ) ];
  if ( appended === 0 ) {
    warnings.push('新しい行はありませんでした（既に取り込み済みの取込です）。');
  } else {
    warnings.unshift(`既存の取込（${existing.id}）に${appended}行を追加しました。`);
  }
  if ( skippedDup > 0 ) {
    warnings.push(`重複する${skippedDup}行は取り込みませんでした`);
  }
  const note = [
    existing.note,
    `追加取込 ${upload.fileName}: +${appended}行${( skippedDup > 0 ) ? `、重複${skippedDup}行は除く` : ''}（${new Date().toLocaleDateString('ja-JP')}）`
  ].filter(Boolean).join('\n');
  // 行数は「この取込の実行数」増える度に数え直す（saved.linesは
  // 「今回追加した行」なので重複込み取込の結果実行を壊してしまう）
  const totalLines = await models.BankStatementLine.count({
    where: { statementId: existing.id }
  });
  await existing.update({
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    fileBody: upload.buffer,
    periodFrom: periodFrom,
    periodTo: periodTo,
    lineCount: totalLines,
    note: note,
    profileName: parsed.profileName || existing.profileName,
    warnings: JSON.stringify(warnings),
    updatedBy: user.id
  });
  const fresh = await getStatement(existing.id);
  res.json({
    code: 0,
    id: existing.id,
    lineCount: fresh.lineCount,
    warnings: warnings
  });
};

const saveLines = async (statement, parsed) => {  // 通帳の断片重複運用（「前回から今月末」等の重複込み取込）向け。
  // 同じ口座の既存取込行と同じ（日付+金額、残高つき形式なら残高）の行は
  // 挿入しない（1項目は1項目。重複を記録するステータスは設けない）。
  // 予案数は取り込み結果の警告に乗せる
  const dupKeys = await reconcile.findExistingDuplicateKeys(statement);
  // 追加取込（既存取込へのattach）では lineNo を既存の続きから振る
  const baseLineNo = await models.BankStatementLine.max('lineNo', {
    where: { statementId: statement.id }
  }) || 0;
  const lines = [];
  let skippedDup = 0;
  for ( let i = 0; i < parsed.lines.length; i ++ ) {
    const line = parsed.lines[ i ];
    const key = reconcile.duplicateKeyFor(line);
    if ( dupKeys.has(key) ) {
      skippedDup ++;
      continue;
    }
    lines.push(await models.BankStatementLine.create({
      statementId: statement.id,
      lineNo: baseLineNo + i + 1,
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
    // このファイル内の重複も拾えるように、作った行のキーを集合に足す
    dupKeys.add(key);
  }
  return { lines: lines, skippedDup: skippedDup };
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

  // 明細の取り込み（DBに登録する）。銀行口座ごとの取込は「通帳」の集積と
  // みなす: 同じ口座（勘定科目+補助）への取込は既存の最新の取込に追加し、
  // 重複する行は挿入しない（「前回から前月末」の重複あterm断片も安全）。
  // 口座が未指定（取込から口座を後で設定する運用）やカード系は従来どおり
  // ファイル単位で独立した取込になる
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
      // 同じ口座の既存取込があればそこに追加する（カード系は対象外:
      // 1つのファイルが1つの支払総額/支払日を表すため）
      const existing = ( !isPersonal && params.account && ( parsed.kind === 'bank' ) ) ?
        await models.BankStatement.findOne({
          where: {
            kind: 'bank',
            account: params.account,
            subAccount: ( params.subAccount || null )
          },
          order: [[ 'id', 'DESC' ]]
        }) : null;
      if ( existing ) {
        return await attachToStatement(existing, parsed, upload, user, params, res);
      }
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
      const saved = await saveLines(statement, parsed);
      const storeWarnings = [ ...( parsed.warnings || [] ) ];
      if ( saved.skippedDup > 0 ) {
        storeWarnings.push(`同口座の既存取込と重複する${saved.skippedDup}行は取り込みませんでした`);
      }
      await models.BankStatement.update({
        lineCount: saved.lines.length,
        warnings: JSON.stringify(storeWarnings)
      }, { where: { id: statement.id } });
      const warnings = [ ...( parsed.warnings || [] ) ];
      if ( saved.skippedDup > 0 ) {
        // 重複は挿入しない運用（1項目は1項目）。取り込めた行数だけが事実
        warnings.push(`同口座の既存取込と重複する${saved.skippedDup}行は取り込みませんでした`);
      }
      res.json({ code: 0, id: statement.id, warnings: warnings, lineCount: saved.lines.length });
    } catch (e) {
      console.log(e);
      res.status(422).json({ code: -1, message: e.message || '取り込みに失敗しました。' });
    }
  },

  // 一覧（ファイル本体は除く）。非会計ユーザーは自分の個人カード明細のみ
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    const where = visibleFilter(user) || {};
    const statements = await models.BankStatement.findAll({
      where: where,
      attributes: { exclude: [ 'fileBody' ] },
      order: [[ 'id', 'DESC' ]]
    });
    // 口座の取り込み忘れを防ぐ: 銀行系の全ての口座（科目+補助）について
    // 取込のないものは「未取込」の合成行も返す（各口座には必ず通帳の行が
    // 存在することになる。取り込むまでの間は行数/期間がunknownで見える）
    const values = [ ...statements ];
    if ( canSeeAll(user) ) {
      const usedKeys = new Set(statements
        .filter((s) => ( s.kind === 'bank' && s.account ))
        .map((s) => ( `${s.account}|${s.subAccount || ''}` )));
      const banks = await models.Account.findAll({
        where: { accountCode: { [Op.like]: '101%' } },
        include: [{ model: models.SubAccount, as: 'subAccounts' }],
        order: [[ 'accountCode', 'ASC' ]]
      });
      for ( const bank of banks ) {
        // 補助科目ごとに通帳の行を作る。補助を持たない銀行科目のときだけ
        // 取通帳（補助なし）を1行にする（補助ありなのに「補助なし」の行が
        // 落ちる、という未取り込み漏れを避けるため）
        const variants = ( bank.subAccounts && bank.subAccounts.length > 0 ) ?
          bank.subAccounts.map((sub) => ({ subAccount: sub.subAccountCode })) :
          [ { subAccount: null } ];
        for ( const variant of variants ) {
          const key = `${bank.accountCode}|${variant.subAccount || ''}`;
          if ( usedKeys.has(key) ) {
            continue;
          }
          values.push({
            synthetic: true,
            kind: 'bank',
            account: bank.accountCode,
            subAccount: variant.subAccount,
            fileName: null,
            periodFrom: null,
            periodTo: null,
            lineCount: null
          });
        }
      }
    }
    res.json({ code: 0, values: values });
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
    const oppositeSuggestions = ( statement.kind === 'bank' ) ?
      await reconcile.suggestOpposites(statement) : [];
    res.json({
      code: 0,
      statement: {
        ...statement.toJSON(),
        fileBody: undefined,
        warnings: warningsOf(statement.warnings),
        lines: statement.lines.map(lineToJSON)
      },
      oppositeSuggestions: oppositeSuggestions
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

  // 突合の実行（既存仕訳との自動照合+カード引落候補の提示+仮起票の後突合）
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
    // 「後の処理」。仮入科目で起票した伝票が実科目の伝票と突合できる形に
    // なっているかもしれないので、先に差し替えを試みる
    try {
      await reconcile.reconcilePlaceholders();
    } catch (e) {
      console.error('reconcilePlaceholders failed', e);
    }
    const result = await reconcile.autoMatch(statement);
    const suggestions = await reconcile.suggestCardPayments(statement);
    const oppositeSuggestions = await reconcile.suggestOpposites(statement);
    const fresh = await getStatement(statement.id);
    res.json({
      code: 0,
      matched: result.matched,
      suggestions: suggestions,
      oppositeSuggestions: oppositeSuggestions,
      lines: fresh.lines.map(lineToJSON)
    });
  },

  // 未照合行の一括起票。bookings は空でいい（ルール→仮入科目に落ちる）
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
      // 指定行（摘要から適用や単行の起票）のときは、その直後に続く合流
      // 予備行（手数料など）も一緒に起票する（全部解除で起票すると手数料が
      // 仮起票に落ちるのを防ぐ）
      const result = await reconcile.bookLines(statement, req.body.bookings || [], user, {
        includeMergeAfter: ( req.body.bookings || [] ).length > 0
      });
      const fresh = await getStatement(statement.id);
      res.json({
        code: 0,
        slips: result.slips.map((slip) => ({ id: slip.id, year: slip.year, month: slip.month, no: slip.no })),
        lines: fresh.lines.map(lineToJSON)
      });
    } catch (e) {
      console.error(e);
      res.status(422).json({ code: -1, message: e.message });
    }
  },

  // 再実行。ルール追加・手作業修正の後に、取込から起票した未承認伝票を
  // 解放して現行ルール（合流含む）で起票し直す。確定（承認済み）
  // 伝票・精算書由来伝票・会計年度確定中の伝票には触らない
  rebook: async (req, res, next) => {
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
    const lockFy = await lockedStatementMessage(statement);
    if ( lockFy ) {
      res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: lockFy.term });
      return;
    }
    try {
      // 先に仮起票の後突合を流しておく（手作業や他証憑の処理を拾う）。
      // 行単位の「適用」（body.lineId / body.lineIds）では流さない（驚き最小）
      const lineIds = ( req.body && Array.isArray(req.body.lineIds) ) ? req.body.lineIds :
        ( ( req.body && req.body.lineId ) ? [ req.body.lineId ] : null );
      if ( !lineIds ) {
        try {
          await reconcile.reconcilePlaceholders();
        } catch (e) {
          console.error('reconcilePlaceholders failed', e);
        }
      }
      const result = await reconcile.rebookStatement(statement, user,
        lineIds ? { lineIds: lineIds } : {});
      const fresh = await getStatement(statement.id);
      res.json({
        code: 0,
        rebooked: result.rebooked,
        skipped: result.skipped,
        lines: fresh.lines.map(lineToJSON)
      });
    } catch (e) {
      console.error(e);
      res.status(422).json({ code: -1, message: e.message || '起票の再実行に失敗しました。' });
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
    // 通帳のメモ（取り込の来歴はnoteに積まれるので、こちらは入力用メモ）
    if ( req.body.memo !== undefined ) {
      statement.memo = ( req.body.memo === null ) ? null : String(req.body.memo);
    }
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
