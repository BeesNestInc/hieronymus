import models from '../models/index.js';
const Op = models.Sequelize.Op;
import fs from 'fs';
import Mime from 'mime';
import * as parser from '../libs/bank-statement.js';
import * as reconcile from '../libs/bank-reconcile.js';
import { findFiscalYearForTerm } from '../libs/fiscal-lock.js';
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
    include: [
      {
        model: models.Financial, as: 'financial'
      },
      {
        model: models.BankStatementLine, as: 'lines',
        include: [{
          model: models.CrossSlipDetail, as: 'crossSlipDetail',
          include: [{ model: models.CrossSlip, as: 'crossSlip' }]
        }]
      }
    ],
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
const attachToStatement = async (existing, parsed, upload, user, res) => {
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

// 画像取り込みはAI読取なので解析に時間がかかる。プレビューと取り込みで
// 同じ画像を2度読むのを避けるため、プレビューの解析結果を短時間キャッシュ
// してuploadに再利用させる
const previewCache = new Map();
const PREVIEW_TTL = 10 * 60 * 1000;
const previewCachePut = (parsed) => {
  // 期限切れの掃除をしてから置く（置きすぎ防止をかねる）
  for ( const [ key, entry ] of previewCache ) {
    if ( Date.now() - entry.at > PREVIEW_TTL ) {
      previewCache.delete(key);
    }
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  previewCache.set(id, { parsed: parsed, at: Date.now() });
  return id;
};
const previewCacheGet = (id) => {
  const entry = ( id && previewCache.get(String(id)) ) || null;
  if ( !entry || ( Date.now() - entry.at > PREVIEW_TTL ) ) {
    if ( entry ) {
      previewCache.delete(String(id));
    }
    return null;
  }
  previewCache.delete(String(id));
  return entry.parsed;
};

// 取込明細を就業中の年度内に限定する（過年度・未来の行は処理できないので
// 警告に落とす）。年度は「今処理している年度」=ユーザーが選んでいる年度
// (formのfy=term)で決める（今日の日付の属する年度ではない: 繰り上げ処理や
// 前年度の締め直しでは暦と処理年度がズレる）。fyが無い場合はフィルタしない
const filterFiscalYear = async (parsed, term) => {
  const fy = await findFiscalYearForTerm(term);
  if ( !fy ) {
    return parsed;
  }
  const result = reconcile.fiscalYearFilter(parsed.lines, fy);
  if ( result.dropped > 0 ) {
    parsed.warnings.push(`年度外（${result.range}の範囲外）の${result.dropped}行は取り込みませんでした`);
  }
  parsed.lines = result.kept;
  // 期間を残った行から組み直す（年度フィルタで端に落ちる事がある）
  const dates = result.kept.map((line) => line.date).filter(Boolean).sort();
  parsed.periodFrom = ( dates.length > 0 ) ? dates[ 0 ] : null;
  parsed.periodTo = ( dates.length > 1 ) ? dates[ dates.length - 1 ] : dates[ 0 ] || null;
  return parsed;
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
      const parsed = await filterFiscalYear(
        await parser.parseStatement(upload.buffer, upload.mimeType),
        req.body.fy
      );
      res.json({
        code: 0,
        // AI読取（画像）の解析結果を取り込み時に再利用させるためのハンドル
        previewId: previewCachePut(parsed),
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

  upload: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    // 取込の紐付先は 口座（Financial）。口座の指定は必須（銀行・カードとも）
    const financial = ( req.body.financialId ) ?
      await models.Financial.findByPk(parseInt(req.body.financialId, 10)) : null;
    if ( !financial ) {
      res.status(422).json({ code: -2, message: '口座（通帳）を選択してください。' });
      return;
    }
    // 取込の種別は口座に従う。会計権限がなければ自分の個人カード（精算用）の
    // 口座への取り込だけを許す
    const isPersonal = ( financial.kind === 'personal_card' );
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
      // プレビューで解析済みならキャッシュを使い、画像の2回読みを避ける
      let parsed = previewCacheGet(req.body && req.body.previewId);
      if ( parsed ) {
        // キャッシュはプレビュー時のfilter済み。年度指定ずれに備えて再filter
        parsed = await filterFiscalYear(parsed, req.body.fy);
      } else {
        parsed = await filterFiscalYear(
          await parser.parseStatement(upload.buffer, upload.mimeType),
          req.body.fy
        );
      }
      // 同じ口座の既存取込に追加する（口座単位の集積。重複行は挿入しない）
      const existing = await models.BankStatement.findOne({
        where: { financialId: financial.id },
        order: [[ 'id', 'DESC' ]]
      });
      if ( existing ) {
        return await attachToStatement(existing, parsed, upload, user, res);
      }
      const statement = await models.BankStatement.create({
        // 口座の写し込み（account/subAccount améliorer 折نىに使えるようにする。
        // 取り込の種別は口座に従う）
        financialId: financial.id,
        kind: financial.kind,
        account: financial.accountCode,
        subAccount: financial.subAccountCode,
        cardName: ( financial.kind !== 'bank' ) ? financial.name : null,
        profileName: financial.profileName || parsed.profileName,
        memberId: financial.memberId,
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
        warnings.push(`同口座の既存取込と重複する${saved.skippedDup}行は取り込みませんでした`);
      }
      res.json({ code: 0, id: statement.id, warnings: warnings, lineCount: saved.lines.length });
    } catch (e) {
      console.log(e);
      res.status(422).json({ code: -1, message: e.message || '取り込みに失敗しました。' });
    }
  },

  // 一覧（ファイル本体は除く）。非会計ユーザーは自分の個人カード明細のみ
  // 一覧は口座（Financial）単位。取込が無い口座も行として出す（取り込忘れの備忘）。
  // 「もう使わない」（closedAt）の口座は出さない。middle: extra filter by user type
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = req.session.user;
    // 会計権限のないユーザーは自分の個人カード口座の取り込だけを読める
    const mineOnly = ( !canSeeAll(user) );
    const personalFinancialIds = mineOnly ?
      ( await models.Financial.findAll({
        where: { kind: 'personal_card', memberId: ( user.member ? user.member.id : null ) },
        attributes: [ 'id' ],
        raw: true
      }) ).map(( f ) => f.id) : [];
    const financials = await models.Financial.findAll({
      where: ( mineOnly ) ?
        { closedAt: null, id: { [Op.in]: personalFinancialIds } } :
        { closedAt: null },
      order: [[ 'id', 'ASC' ]],
      include: [{ model: models.BankStatement, as: 'statements' }]
    });
    const values = [];
    for ( const financial of financials ) {
      const statements = financial.statements || [];
      const latest = statements.slice().sort(( a, b ) => ( b.id - a.id ))[ 0 ] || null;
      const lineCount = statements.reduce(( sum, s2 ) => ( sum + ( s2.lineCount || 0 ) ), 0);
      values.push({
        id: financial.id,
        name: financial.name,
        kind: financial.kind,
        accountCode: financial.accountCode,
        subAccountCode: financial.subAccountCode,
        memberId: financial.memberId,
        // 詳細表示/取り込予定はこの口座の最新取り込
        statementId: latest ? latest.id : null,
        fileName: latest ? latest.fileName : null,
        periodFrom: latest ? latest.periodFrom : null,
        periodTo: latest ? latest.periodTo : null,
        lineCount: lineCount
      });
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
    const statement = await getStatement(parseInt(req.params.id));
    if ( !statement ) {
      res.json({ code: -1 });
      return;
    }
    try {
      // 指定行（摘要から適用や単行の起票）のときは、その直後に続く合流
      // 予備行（手数料など）も一緒に起票する（全部解除で起票すると手数料が
      // 仮起票に落ちるのを防ぐ）
      const result = await reconcile.bookLines(statement, req.body.bookings || [], user, {
        includeMergeAfter: ( req.body.bookings || [] ).length > 0,
        // 「適用して保存」で選ばれたルールがあればusageCountに頼らず強制適用
        applyRuleId: ( req.body && req.body.applyRuleId ) ? req.body.applyRuleId : null
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
    const statement = await getStatement(parseInt(req.params.id));
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
        Object.assign(
          lineIds ? { lineIds: lineIds } : {},
          ( req.body && req.body.applyRuleId ) ? { applyRuleId: req.body.applyRuleId } : {}
        ));
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
    // 通帳のメモ（取り込の来歴はnoteに積まれるので、こちらは入力用メモ）。
    // 口座の変更は口座側（/financial）で行う（取り込を消さずに付け替える必要
    // ができたら考える）
    if ( req.body.memo !== undefined ) {
      statement.memo = ( req.body.memo === null ) ? null : String(req.body.memo);
    }
    // 通帳の警告。閲覧者が閉じたときはクリア（空配列/null→'[]'）
    if ( req.body.warnings !== undefined ) {
      statement.warnings = JSON.stringify(Array.isArray(req.body.warnings) ? req.body.warnings : []);
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
