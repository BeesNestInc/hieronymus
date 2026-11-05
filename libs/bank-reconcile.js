// 取り込んだ明細の突合と起票。
// - autoMatch: 銀行明細の行を既存の仕訳明細（銀行元帳の元データ）と突合する
// - suggestCardPayments: カード引落行を法人カード明細（支払総額+支払日）と照合する
// - bookLines: 未照合行から仕訳伝票を一括起票する（利息行はテンプレ仕訳）
// - selectForExpense: 個人カード明細の行を精算書の明細に変換する
// 起票される伝票は既存の精算フローと同じく未承認（承認待ち）で作成する。

import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {create as createCrossSlip} from './cross_slip.js';
import {deriveTaxRuleId} from './expense.js';
import {isLocked} from './fiscal-lock.js';
import {normalizeText} from './bank-statement.js';

// 利息仕訳テンプレの既定値（config/banks/*.yaml の interest 設定で上書きできる）
// incomeAccount: 受取利息。withholding: 源泉所得税（借方）。rate: 源泉徴収率
const INTEREST_DEFAULTS = {
  incomeAccount: '8000000',
  rate: 0.15315
};

// システム都合の仮入科目（x9xxxxx）。ルールに該当しない取込行は
// 一旦この科目で起票し、「後の処理」で実科目に差し替える。
// OUT: 出金行（借方でたてる）。IN: 入金行（貸方でうける）
export const TEMP_ACCOUNTS = { OUT: '1900000', IN: '3900000' };
export const isTempAccount = (account) => (
  ( account === TEMP_ACCOUNTS.OUT ) || ( account === TEMP_ACCOUNTS.IN )
);

// 重複取込の検出（通帳の断片重複運用向け）。
// 「期首から現在」「前回から月末」のように重複ありで複数回取り込む運用では、
// 同じトランザクションが複数の取込に分岐して載る。何もしないと二重起票に
// なるため、通帳は「残高」が行の識別子として一意であることを利用して
// 同一トランザクションを検出する（残高カラムのない形式は正規化摘要で代替）。
// 検出された行は「duplicate」として起票の対象から外す（行は挿入しておく。
// 取込ファイルを保全し、誤検出のときに手で戻せるようにするため）。
export const duplicateKeyFor = (line) => {
  const norm = normalizeText(line.rawDescription || line.description || '');
  const balance = ( line.balance !== undefined && line.balance !== null ) ? String(line.balance) : null;
  // nullとundefinedを纏めて空にする（生のSELECTとmodelのcreateで来方が違う）
  const amountOut = ( line.amountOut !== undefined && line.amountOut !== null ) ? String(line.amountOut) : '';
  const amountIn = ( line.amountIn !== undefined && line.amountIn !== null ) ? String(line.amountIn) : '';
  if ( balance ) {
    return `${line.date}|${amountOut}|${amountIn}|B${balance}`;
  }
  return `${line.date}|${amountOut}|${amountIn}|N${norm}`;
};

export const findExistingDuplicateKeys = async (statement) => {
  // 同じ口座（Financial）の取込行が保有するキーの集合。同口座間で
  // 重複する行（断片取り込の兼ね合い由来）を検出する
  if ( !statement.financialId ) {
    return new Set();
  }
  const statements = await models.BankStatement.findAll({
    where: {
      financialId: statement.financialId
    },
    attributes: [ 'id' ],
    raw: true
  });
  const ids = statements.map((s) => s.id);
  const rows = await models.BankStatementLine.findAll({
    where: { statementId: { [Op.in]: ids } },
    raw: true
  });
  const keys = new Set();
  for ( const row of rows ) {
    keys.add(duplicateKeyFor(row));
  }
  return keys;
};
export const isDuplicateLine = (key, keySet) => keySet.has(key);

// 取込明細の「年度内フィルタ」。画像OCRは通帳の撮影範囲が広く取り込め、
// Excelは全期一括の物が来る。処理できるのは就業中の年度に限るので、
// 期の範囲外の行は警告として落として残さない（過年度は確定済み、
// 未来は処理対象にならない）。fy{startDate, endDate}が無ければフィルタしない
export const fiscalYearFilter = (lines, fy) => {
  if ( ( !fy ) || ( !fy.startDate ) || ( !fy.endDate ) ) {
    return { kept: lines, dropped: 0, range: null };
  }
  const fmt = ( value ) => {
    if ( value instanceof Date ) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return String( value ).slice( 0, 10 );
  };
  const start = fmt( fy.startDate );
  const end = fmt( fy.endDate );
  const kept = lines.filter((line) => (
    line.date &&
    ( line.date.slice( 0, 10 ) >= start ) &&
    ( line.date.slice( 0, 10 ) <= end )
  ));
  return { kept: kept, dropped: ( lines.length - kept.length ), range: `${start}〜${end}` };
};

// 「前の行（同じ日）の伝票に合流させる」摘要はこの口座のルール（merge=true）
// で定義する（明細取込のルールモーダルで管理。mergeRules.yamlは廃止）
const isMergeable = (line, mergePatterns) => {
  const desc = normalizeText(line.description || line.rawDescription);
  if ( !desc ) {
    return false;
  }
  return mergePatterns.has(desc);
};

const dayDiff = (dateA, dateB) => {
  // DATEONLY（YYYY-MM-DD文字列）とDateの両方を受けられるようにする
  const toUTC = (date) => {
    if ( typeof date === 'string' ) {
      const [ y, m, d ] = date.slice(0, 10).split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    }
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  return Math.abs(toUTC(dateA) - toUTC(dateB)) / 86400000;
};

const toDateString = (date) => {
  // YYYY-MM-DD文字列はそのまま使う（Date化によるタイムゾーンずれを避ける）
  if ( typeof date === 'string' ) {
    return date.slice(0, 10);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const normalizeDescription = (text) => {
  return String(text || '').normalize('NFKC');
};

// 摘要から学習ルール照合用の正規化文字列を作る。
// 「デビット」のような銀行の体裁語は経理的に鍵にならないため、テンプレート
// （数字の'#'置換）は使わない。NFKC正規化＋空白潰しの完全一致で覚える
// （店名や番号の違いで別取引になるべきものが別扱いになる）
export const makePattern = (text) => {
  return normalizeDescription(text).replace(/[\s\u3000]+/g, '') || '';
};

// 学習ルールを作成・更新する（upsert）。同じ口座×摘要パターンのルールが
// あれば適用回数を進め、なければ作る。学習は伝票起票の副作用として行い、
// 失敗しても起票自体は失敗させない。
// financialId: ルールの紐付先 口座（Financial）。口座が登録されていない
// 取り込みは学習しない（ルールは口座単位の施行データだが、Financialは
// 次年度以降も使う「現役ルール」として口座に紐づく）
// direction: 'out'(出金)/'in'(入金)。同じ摘要でも入金と出金で相手方が
// 異なることがある（代理店的な取引先）ため、ルールは方向単位で作る。
// direction省略は指定なし(null)=両方向に照合する旧来の書き方
export const learnOpposite = async (financialId, application1, oppositeSide, direction = null) => {
  try {
    const pattern = makePattern(application1);
    if ( ( !pattern ) || ( !financialId ) ||
      ( !oppositeSide ) || ( !oppositeSide.account ) ||
      // 仮入科目は実科目として扱えない（仮で起票した仕訳は学習しない）
      isTempAccount(oppositeSide.account) ) {
      return;
    }
    // opposite側の書き方差（sub / subAccount）を吸収する（key不一致だと
    // subAccount条件がundefinedになり、補助違いの兄弟ルールを
    // 踏む事故になる）
    const oppositeSub = ( oppositeSide.sub !== undefined ) ? oppositeSide.sub : ( oppositeSide.subAccount || null );
    // directionの受け皿。想定外の値はnullに落とす
    const dir = ( direction === 'out' || direction === 'in' ) ? direction : null;
    const where = {
      financialId: financialId,
      pattern: pattern,
      // 旧ルール(direction null。任意方向)はこのlevelでは照合しない:
      // 学習の更新は「同方向のルール」に向ける（もしなければ新規作成。
      // 旧ルールはfindLearnedRuleからだけで参照される）
      direction: dir
    };
    const existing = await models.BankStatementRule.findOne({ where: where });
    if ( existing ) {
      existing.oppositeAccount = oppositeSide.account;
      // 補助の「下げ」（既存のルールが補助を持っていて、新しい事実が補助なし）
      // は学習しない。再実行で起票した補助なし伝票の学習が、手修正で入れた
      // 補助付きの学習を消してしまうのを防ぐ（値の変更・追加は上書きする）
      if ( oppositeSub || !existing.oppositeSubAccount ) {
        existing.oppositeSubAccount = oppositeSub || null;
      }
      existing.usageCount += 1;
      await existing.save();
    } else {
      await models.BankStatementRule.create({
        ...where,
        oppositeAccount: oppositeSide.account,
        oppositeSubAccount: oppositeSub || null,
        usageCount: 1
      });
    }
  } catch (e) {
    console.log('learnOpposite failed', e.message);
  }
};

// 伝票入力からの学習。銀行科目（預金系101xxx）を含む伝票行の摘要と
// 相手方科目からルールを蓄積する（createCrossSlip/updateCrossSlipから呼ぶ）
// 学習ルールの紐付先口座を(科目+補助)から引く（法的な解決は1か所）。
// 学習は口座単位なので、伝票の銀行側科目から通帳(Financial)を突き止める
const findFinancialBySide = async (account, subAccount) => {
  return models.Financial.findOne({
    where: {
      accountCode: account,
      subAccountCode: subAccount || null
    }
  });
};

export const learnFromSlip = async (slip) => {
  try {
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id }
    });
    for ( const detail of details ) {
      let bankSide = null;
      let oppositeSide = null;
      let direction = null;
      if ( /^101/.test(detail.debitAccount || '') ) {
        // 銀行が借方=入金
        bankSide = { account: detail.debitAccount, sub: detail.debitSubAccount };
        oppositeSide = { account: detail.creditAccount, sub: detail.creditSubAccount };
        direction = 'in';
      } else if ( /^101/.test(detail.creditAccount || '') ) {
        // 銀行が貸方=出金
        bankSide = { account: detail.creditAccount, sub: detail.creditSubAccount };
        oppositeSide = { account: detail.debitAccount, sub: detail.debitSubAccount };
        direction = 'out';
      }
      if ( !oppositeSide ) continue;
      const financial = await findFinancialBySide(bankSide.account, bankSide.sub);
      if ( !financial ) {
        // 口座登録のない科目からの起票は学習しない（ルールは口座単位）
        continue;
      }
      await learnOpposite(financial.id, detail.application1, oppositeSide, direction);
    }
  } catch (e) {
    console.log('learnFromSlip failed', e.message);
  }
};

// 銀行明細の行を既存の仕訳明細と突合する。
// 口座（勘定科目+補助科目）の仕訳明細のうち、金額が一致し伝票日付が
// ±days 日以内のものを対応付ける（すでに別行の突合先になっている明細は除く）。
export const autoMatch = async (statement, options = {}) => {
  const days = ( options.days === undefined ) ? 3 : options.days;
  // 自動突合は「許可された摘要」だけが対象（口座のルール match=true の
  // 完全一致ホワイトリスト。リストに無い摘要は手動で扱う。定額請求などで
  // 同一金額が乱造される世界で、緩い自動結合が誤結合を起こさないように）
  const allowedPatterns = ( statement.financialId ) ?
    new Set(( await models.BankStatementRule.findAll({
      where: { financialId: statement.financialId, match: true },
      raw: true
    }) ).map((r) => r.pattern)) : new Set();
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, status: 'unmatched' }
  });
  if ( lines.length === 0 ) {
    return { matched: 0 };
  }
  // 突合先として既に使われている仕訳明細は対象外
  const used = await models.BankStatementLine.findAll({
    where: { crossSlipDetailId: { [Op.ne]: null } },
    attributes: [ 'crossSlipDetailId' ]
  });
  const usedIds = new Set(used.map((l) => l.crossSlipDetailId));
  const account = statement.account;
  const subAccount = statement.subAccount;
  const details = await models.CrossSlipDetail.findAll({
    include: [{ model: models.CrossSlip, as: 'crossSlip' }],
    where: {
      [Op.or]: [
        { creditAccount: account, creditSubAccount: subAccount || null },
        { debitAccount: account, debitSubAccount: subAccount || null }
      ]
    }
  });
  let matched = 0;
  for ( const line of lines ) {
    // 銀行から見て出金（貸方側に銀行が立つ明細）か入金（借方側）かで照合面を変える
    const isOut = ( line.amountOut !== null && line.amountOut !== undefined );
    const targetAmount = isOut ? line.amountOut : line.amountIn;
    if ( targetAmount === null || targetAmount === undefined || !line.date ) {
      continue;
    }
    // 許可リストに無い摘要は自動突合の対象にしない
    if ( !allowedPatterns.has(makePattern(line.rawDescription)) ) {
      continue;
    }
    const candidates = details.filter((detail) => {
      if ( usedIds.has(detail.id) ) return false;
      const amount = isOut ? detail.creditAmount : detail.debitAmount;
      if ( Number(amount) !== Number(targetAmount) ) return false;
      const sideAccount = isOut ? detail.creditAccount : detail.debitAccount;
      const sideSub = isOut ? detail.creditSubAccount : detail.debitSubAccount;
      if ( sideAccount !== account || ( sideSub || null ) !== ( subAccount || null ) ) return false;
      const slip = detail.crossSlip;
      if ( !slip ) return false;
      const slipDate = new Date(slip.year, slip.month - 1, slip.day);
      return dayDiff(slipDate, line.date) <= days;
    });
    if ( candidates.length === 0 ) {
      continue;
    }
    // 日付が最も近い明細を採用する
    candidates.sort((a, b) => {
      const da = dayDiff(new Date(a.crossSlip.year, a.crossSlip.month - 1, a.crossSlip.day), line.date);
      const db = dayDiff(new Date(b.crossSlip.year, b.crossSlip.month - 1, b.crossSlip.day), line.date);
      return da - db;
    });
    line.status = 'matched';
    line.crossSlipDetailId = candidates[0].id;
    await line.save();
    usedIds.add(candidates[0].id);
    matched ++;
  }
  return { matched: matched };
};

// 銀行明細のうちカード引落と思われる行を、法人カード明細（支払総額・支払日）と照合する。
// 総額一致+支払日が行日付の±days以内で候補とする。起票に必要な未払金の
// 科目はカード明細のプロファイル（paymentAccount/paymentSubAccount）から取る。
export const suggestCardPayments = async (statement, profiles = null) => {
  const {loadProfiles} = await import('./bank-statement.js');
  const allProfiles = profiles || loadProfiles();
  const cards = await models.BankStatement.findAll({
    where: { kind: 'corporate_card' }
  });
  if ( cards.length === 0 ) {
    return [];
  }
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, status: 'unmatched' }
  });
  const suggestions = [];
  for ( const line of lines ) {
    const desc = normalizeDescription(line.rawDescription);
    for ( const card of cards ) {
      const cardName = ( card.cardName || '' ).normalize('NFKC');
      if ( !cardName || !desc.includes(cardName) ) {
        continue;
      }
      const diff = card.payDate ? dayDiff(new Date(card.payDate), line.date) : 999;
      if ( Number(card.total) === Number(line.amountOut) && diff <= 3 ) {
        const profile = allProfiles.find((p) => ( p.name === cardName || ( p.cardName || '' ).includes(cardName) ));
        suggestions.push({
          lineId: line.id,
          cardStatementId: card.id,
          payDate: card.payDate,
          total: card.total,
          debitAccount: ( profile && profile.paymentAccount ) || null,
          debitSubAccount: ( profile && profile.paymentSubAccount ) || null
        });
      }
    }
  }
  return suggestions;
};

// 利息行の仕訳（受取利息+源泉所得税+普通預金）。
// 源泉徴収額の決め方:
// - 同じ日の「国税」明細行（category=tax。国税=源泉徴収額が別行として載る
//   通帳向け）があればその出金額を源泉額にする。このとき利息行の金額は
//   税込（総額）として扱うので、普通預金の借方は「利息額−源泉額」になる
// - 国税行がなければ利息行の金額を税引後とみなし、源泉率から税抜額を逆算する
// 源泉額が丸めて0になる場合は受取利息のみの1行（2側）にする。
const buildInterestDetails = async (line, statement, profile, taxLine = null) => {
  const conf = { ...INTEREST_DEFAULTS, ...( ( profile && profile.interest ) || {} ) };
  const amountIn = Number(( line.amountIn !== null && line.amountIn !== undefined ) ? line.amountIn : line.amountOut);
  let gross;
  let withheld;
  if ( taxLine ) {
    gross = amountIn;
    withheld = Number(taxLine.amountOut) || 0;
  } else {
    // 国税行がなければ明細の利息額を税引後とみなし、源泉率から税抜額を逆算する
    const rate = conf.rate;
    gross = rate > 0 ? Math.round(amountIn / ( 1 - rate )) : amountIn;
    withheld = gross - amountIn;
  }
  const net = gross - withheld;
  const date = line.date || toDateString(new Date());
  // 源泉所得税の科目は補助科目「源泉」（key=gensen）を既定とする。
  // プロファイルに withholding.account/subAccount があればそれを使う
  let withholdingAccount = conf.account || null;
  let withholdingSubAccount = conf.subAccount || null;
  if ( !withholdingAccount ) {
    const sub = await models.SubAccount.findOne({ where: { key: 'gensen' } });
    if ( sub ) {
      const account = await models.Account.findByPk(sub.accountId);
      withholdingAccount = account ? account.accountCode : null;
      withholdingSubAccount = sub.subAccountCode;
    }
  }
  const bankSide = {
    debitAccount: statement.account,
    debitSubAccount: statement.subAccount,
    debitAmount: net,
    debitTax: 0,
    creditAccount: conf.incomeAccount,
    creditAmount: net
  };
  const details = [ bankSide ];
  if ( withheld > 0 && withholdingAccount ) {
    // 伝票は借貸ペアで構成するため、源泉分を「借方 源泉所得税 / 貸方 受取利息」
    // の独立行にする（受取利息の貸方合計が税抜額になる）
    const gensenDetail = {
      debitAccount: withholdingAccount,
      debitSubAccount: withholdingSubAccount,
      debitAmount: withheld,
      debitTax: 0,
      creditAccount: conf.incomeAccount,
      creditAmount: withheld
    };
    // 国税行がソースならその行をこの明細に対応させる
    if ( taxLine ) {
      gensenDetail.statementLineId = taxLine.id;
    }
    details.push(gensenDetail);
  }
  for ( const detail of details ) {
    if ( detail.statementLineId === undefined ) {
      detail.statementLineId = line.id;
    }
    detail.creditTax = 0;
    detail.creditTaxRuleId = null;
    detail.creditSubAccount = null;
    detail.debitTaxRuleId = null;
    detail.application1 = line.description || '利息';
    detail._date = date;
  }
  return details;
};

// 学習ルールを摘要パターンで引く（bookLinesの相手方指定が無い行向け）。
// 正規化後の完全一致。口座単位（subAccountはnull許容）＋方向（'in'/'out'。
// direction null の旧ルールは両方向に照合する）。
// 口座補助（住信SBIなど）が一致するルールを最優先にする。補助なしの
// 口座のルールから、摘要に一致するものを引く（メモリ内選択）。
// 方向なしの旧ルール（両方向に照合する）があれば同方向の次に優先。
// 補助の分離は口座（Financial）が担うのでルール側の判定はここまで
const findLearnedRule = (rules, application1, direction = null) => {
  const pattern = makePattern(application1);
  if ( !pattern ) {
    return null;
  }
  const candidates = rules
    .filter((r) => ( r.pattern === pattern ))
    .filter((r) => ( !r.direction || r.direction === direction ))
    .sort((a, b) => ( ( b.usageCount || 0 ) - ( a.usageCount || 0 ) ));
  return candidates[ 0 ] || null;
};

// 通常の経費行の仕訳。借方=支払先マッピングの科目、貸方=明細の口座。
// bookings で debitAccount/debitSubAccount の直指定もできる（カード引落の決済等）。
// 通常の明細行の仕訳。借貸の向きは行の入出金で決まる:
// 出金行（amountOut）= 借方 相手方 / 貸方 明細の口座（経費支出）
// 入金行（amountIn）  = 借方 明細の口座 / 貸方 相手方（売上等の収入）
// 相手方は booking.oppositeAccount（+oppositeSubAccount）か、旧形式の
// payeeMappingId/debitAccount で指定する。指定がなければ学習ルールを引く。
// それでも決まらなければ仮入科目（出金仮/入金仮）で起票し、後の処理で
// 他の証憑との突合によって差し替える（仮科目の仕訳は学習しない）。
// detail に statementLineId を入れて、起票済み伝票の更新で紐付けを復元できるようにする
const buildLineDetails = async (line, statement, booking, options = {}) => {
  // 適用して保存: ユーザーが選んだルールがあればusageCountに頼らずそれを使う
  const forcedRule = options.forcedRule || null;
  // カード系の行は利用額(amount)のみ。個人カードも同じ扱い
  // （貸方=口座の科目=立替を表す勘定。借方は学習ルール→仮入科目）
  const isCard = ( statement.kind === 'corporate_card' ) || ( statement.kind === 'personal_card' );
  const isOut = ( line.amountOut !== null && line.amountOut !== undefined ) ||
    ( isCard && line.amount !== null && line.amount !== undefined );
  const amount = Number(isOut ? ( ( line.amountOut !== null && line.amountOut !== undefined ) ? line.amountOut : line.amount ) : line.amountIn);
  let oppositeAccount = booking.oppositeAccount || booking.debitAccount || null;
  let oppositeSubAccount = ( booking.oppositeSubAccount !== undefined ) ?
    booking.oppositeSubAccount : booking.debitSubAccount || null;
  let application1 = line.description || line.rawDescription;
  if ( booking.payeeMappingId ) {
    const mapping = await models.ExpenseMapping.findByPk(booking.payeeMappingId);
    if ( !mapping || !mapping.account ) {
      const err = new Error(`支払先マッピング(id=${booking.payeeMappingId})に勘定科目が設定されていません。`);
      err.name = 'BankReconcileError';
      throw err;
    }
    oppositeAccount = mapping.account;
    oppositeSubAccount = mapping.subAccount || null;
    application1 = line.description || mapping.name;
  }
  // 口座の勘定科目は、statementの写し（account）が無ければ口座(Financial)から引く
  const bankAccount = statement.account || ( ( statement.financial ) ? statement.financial.accountCode : null );
  if ( !bankAccount ) {
    const err = new Error(`${line.lineNo}行目の明細に通帳（勘定科目）が設定されていません。`);
    err.name = 'BankReconcileError';
    throw err;
  }
  const bankSide = {
    account: bankAccount,
    subAccount: statement.subAccount
  };
  // この行の貸方。ルールに貸方の指定があればそれ、なければ口座の科目
  let creditAccount = null;
  let creditSubAccount = null;
  // この口座のルール（bookLinesから一括で渡る）
  const financialRules = options.financialRules || [];
  let oppositeSide = null;
  if ( !oppositeAccount ) {
    // ルールも指定もない → 学習ルールを引き、それも無ければ仮入科目で起票する
    const rule = ( forcedRule && makePattern(forcedRule.pattern) === makePattern(application1) ) ?
      forcedRule : findLearnedRule(financialRules, application1, isOut ? 'out' : 'in');
    if ( rule && !isTempAccount(rule.oppositeAccount) ) {
      oppositeAccount = rule.oppositeAccount;
      oppositeSubAccount = rule.oppositeSubAccount || null;
      // ルールに貸方の指定があれば口座の科目の代わりにそれを使う
      // （キャッシングリボ→短期借入金など。指定なしなら口座の科目）
      if ( rule.creditAccount ) {
        creditAccount = rule.creditAccount;
        creditSubAccount = rule.creditSubAccount || null;
      }
      if ( options.onRule ) {
        options.onRule(rule);
      }
    }
  }
  if ( !oppositeAccount ) {
    oppositeAccount = isOut ? TEMP_ACCOUNTS.OUT : TEMP_ACCOUNTS.IN;
    oppositeSubAccount = null;
  }
  oppositeSide = {
    account: oppositeAccount,
    subAccount: oppositeSubAccount
  };
  // 税ルールは出金（経費）側だけ導出する（内税科目のみ。外税は税0で経理が調整）。
  // 仮入科目でのお預かりは税.Rulesを付けない（後の処理での差し替えに任せる）
  const taxRuleId = ( isOut && !isTempAccount(oppositeAccount) ) ?
    await deriveTaxRuleId(oppositeAccount, line.date || new Date()) : null;
  // 実科目で起票するときは学習する（仮入科目は学習対象にしない）。
  // 学習は口座（Financial）単位。口座が登録されている取り込みのみが対象
  if ( statement.financialId && !isTempAccount(oppositeAccount) ) {
    await learnOpposite(statement.financialId, application1, oppositeSide, isOut ? 'out' : 'in');
  }
  // 貸方の指定が未定なら口座の科目。税ルールは貸方の指定があっても借方（経費側）基準
  if ( !creditAccount ) {
    creditAccount = bankSide.account;
    creditSubAccount = bankSide.subAccount;
  }
  const detail = isOut ? {
    debitAccount: oppositeAccount,
    debitSubAccount: oppositeSubAccount,
    debitAmount: amount,
    debitTax: 0,
    debitTaxRuleId: taxRuleId,
    creditAccount: creditAccount,
    creditSubAccount: creditSubAccount,
    creditAmount: amount,
    creditTax: 0,
    creditTaxRuleId: null,
    application1: application1,
    application2: line.memo || null
  } : {
    debitAccount: bankSide.account,
    debitSubAccount: bankSide.subAccount,
    debitAmount: amount,
    debitTax: 0,
    debitTaxRuleId: null,
    creditAccount: oppositeAccount,
    creditSubAccount: oppositeSubAccount,
    creditAmount: amount,
    creditTax: 0,
    creditTaxRuleId: null,
    application1: application1,
    application2: line.memo || null
  };
  detail._date = line.date || null;
  detail.statementLineId = line.id;
  return [ detail ];
};

// 未照合行を一括起票する。
// bookings は null でいい（相手方の決定はルール→仮入科目に落ちる）。
// 合流摘要（merge-rules.yamlに完全一致。手数料など）の行は「前の行と同じ伝票」
// （同じ日が条件）に合流する。該当しない行は行ごとに個別の伝票になる
// （後の処理で行単位に差し替え可能にするため）。
// 利息行（category='interest'）はテンプレ仕訳になる（booking指定は不要）。
// 利息行の次の行が国税（category='tax'。源泉徴収額が別行として載る通帳向け）
// なら、その行を源泉分として飲み込む（自分の伝票にはしない）。
// 伝票は未承認（承認待ち）で作成する。
export const bookLines = async (statement, bookings, user, options = {}) => {
  const profiles = options.profiles || null;
  // 「適用して保存」で選ばれたルール。usageCountに頼らずこれを強制適用する
  // （再実行経由ではoptions.forcedRuleに渡ってくる）
  const forcedRule = options.forcedRule || ( options.applyRuleId ?
    await models.BankStatementRule.findByPk(parseInt(options.applyRuleId, 10)) : null );
  // この口座のルールを一括で読む（合流判定/相手方解決はメモリ内で行う）
  const financialRules = statement.financialId ?
    await models.BankStatementRule.findAll({ where: { financialId: statement.financialId } }) : [];
  const mergePatterns = new Set(financialRules
    .filter((r) => r.merge)
    .map((r) => normalizeText(r.pattern)));
  const profileName = statement.cardName || statement.account;
  const bookingMap = new Map(( bookings || [] ).map((b) => [ Number(b.lineId), b ]));
  const where = { statementId: statement.id };
  let targetIds = ( bookings || [] ).map((b) => Number(b.lineId));
  if ( targetIds.length > 0 ) {
    // 「摘要から適用」(options.includeMergeAfter): 指定行の直後に続く
    // 合流摘要行（同じ日の手数料など）も一緒に起票の対象にする
    // （主取引行だけ載せると、手数料が別伝票で仮起票になってしまう）
    if ( options.includeMergeAfter ) {
      const allLines = await models.BankStatementLine.findAll({
        where: { statementId: statement.id },
        order: [[ 'lineNo', 'ASC' ]]
      });
      for ( const targetId of [ ...targetIds ] ) {
        const target = allLines.find((l) => ( l.id === targetId ));
        if ( !target ) {
          continue;
        }
        const index = allLines.indexOf(target);
        for ( let i = index + 1; i < allLines.length; i ++ ) {
          const follower = allLines[ i ];
          if ( toDateString(follower.date || '') !== toDateString(target.date || '') ) {
            break;
          }
          if ( !isMergeable(follower, mergePatterns) || follower.status !== 'unmatched' ) {
            break;
          }
          if ( !targetIds.includes(follower.id) ) {
            targetIds.push(follower.id);
          }
        }
      }
    }
    where.id = { [Op.in]: targetIds };
  } else {
    // bookings 未指定は全未照合（+伝票削除で迷子になった起票済み）を対象にする
    where[Op.or] = [
      { status: 'unmatched' },
      { status: 'booked', crossSlipDetailId: null }
    ];
  }
  const lines = await models.BankStatementLine.findAll({
    where: where,
    order: [[ 'lineNo', 'ASC' ]]
  });
  if ( lines.length === 0 ) {
    return { slips: [] };
  }
  const profile = profiles && profiles.find((p) => p.name === profileName);
  // 合流摘要の行は「前の行（同じ日）の伝票」に合流する。
  // 前の行がなければ/日付が違えば自分の伝票になる
  const groups = [];
  const bookedIds = [];
  // 利息行の次の行の「国税」（category=tax。源泉徴収額）を飲み込む通帳向け。
  // 飲み込まれた国税行は利息仕訳の源泉明細になり、自分の伝票にはならない
  const consumed = new Set();
  // 国税行のサニティ: 納税の振替が誤って源泉として扱われないよう、
  // 利息額比の小额に限定する（2 x 利息額（下限100円）、上限1万円）
  const pickTaxLine = (interestLine, nextLine) => {
    if ( !nextLine || ( nextLine.category !== 'tax' ) || ( Number(nextLine.amountOut) <= 0 ) ) {
      return null;
    }
    if ( toDateString(interestLine.date || new Date()) !== toDateString(nextLine.date || new Date()) ) {
      return null;
    }
    const net = Number(( interestLine.amountIn !== null && interestLine.amountIn !== undefined ) ?
      interestLine.amountIn : interestLine.amountOut);
    if ( ( Number(nextLine.amountOut) > Math.max(2 * net, 100) ) || ( Number(nextLine.amountOut) >= 10000 ) ) {
      return null;
    }
    return nextLine;
  };
  let prevGroup = null;
  let prevDate = null;
  for ( let idx = 0; idx < lines.length; idx ++ ) {
    const line = lines[ idx ];
    if ( consumed.has(line.id) ) {
      continue;
    }
    const booking = bookingMap.get(line.id) || {};
    let detailEntries = [];
    if ( line.category === 'interest' ) {
      const taxLine = pickTaxLine(line, lines[ idx + 1 ] || null);
      const details = await buildInterestDetails(line, statement, profile, taxLine);
      // 国税行を源泉明細に結び付けられたときだけ、その行を飲み込む
      if ( taxLine && details.some((detail) => ( Number( detail.statementLineId ) === Number( taxLine.id ) )) ) {
        consumed.add(taxLine.id);
        detailEntries = details.map((detail) => (
          { detail: detail, line: ( Number(detail.statementLineId) === Number(taxLine.id) ) ? taxLine : line }
        ));
      } else {
        detailEntries = details.map((detail) => ({ detail: detail, line: line }));
      }
    } else {
      detailEntries = ( await buildLineDetails(line, statement, booking, { forcedRule: forcedRule, financialRules: financialRules }) ).map((detail) => ({ detail: detail, line: line }));
    }
    const key = toDateString(line.date || detailEntries[ 0 ].detail._date || new Date());
    // 完全一致の合流摘要なら前の行（同じ日）の伝票に合流する
    let group = null;
    if ( isMergeable(line, mergePatterns) && prevGroup && ( prevDate === key ) ) {
      group = prevGroup;
    } else {
      group = { date: key, entries: [] };
      groups.push(group);
    }
    for ( const entry of detailEntries ) {
      group.entries.push(entry);
    }
    prevGroup = group;
    prevDate = key;
    if ( !consumed.has(line.id) ) {
      bookedIds.push(line.id);
    }
  }
  const created = [];
  for ( const group of groups ) {
    const [ year, month, day ] = group.date.split('-').map(Number);
    const slip = await createCrossSlip({
      year: year,
      month: month,
      day: day,
      lines: group.entries.map((e) => e.detail)
    }, user, { forceUnapproved: true });
    // 起票した明細を statementLineId で行に対応付ける
    // （1行から2明細になる利息行は同じ行に対応する。1行1明細を優先するため、
    // 同じ行への2つ目以降の対応は上書きしない）
    const processed = new Set();
    const details = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      order: [[ 'lineNo', 'ASC' ]]
    });
    for ( const detail of details ) {
      if ( !detail.statementLineId || processed.has(Number(detail.statementLineId)) ) {
        continue;
      }
      processed.add(Number(detail.statementLineId));
      await models.BankStatementLine.update({
        status: 'booked',
        crossSlipDetailId: detail.id
      }, { where: { id: detail.statementLineId } });
    }
    created.push(slip);
  }
  return { slips: created, bookedIds: bookedIds };
};

// 個人カード明細の選択行を精算書の明細に変換する。
// 科目（payeeMappingId）は選択時に確定していれば添える（未確定なら精算画面で選ぶ）。
export const selectForExpense = async (statement, selections, report, user) => {
  const lineIds = selections.map((s) => Number(s.lineId));
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, id: { [Op.in]: lineIds } }
  });
  const created = [];
  for ( const line of lines ) {
    const selection = selections.find((s) => ( Number(s.lineId) === line.id ));
    if ( line.status === 'booked' || line.status === 'selected' ) {
      continue;
    }
    const reportLine = await models.ExpenseReportLine.create({
      expenseReportId: report.id,
      lineNo: 0,
      paymentDate: line.date || null,
      payeeMappingId: ( selection && selection.payeeMappingId ) || null,
      description: line.description || line.merchant || line.rawDescription,
      amount: Number(line.amount),
      note: `個人カード明細より(${statement.cardName || statement.fileName})`
    });
    // 明細番号を詰め直す（既存の明細の末尾に追加する）
    const count = await models.ExpenseReportLine.count({
      where: { expenseReportId: report.id }
    });
    reportLine.lineNo = count;
    await reportLine.save();
    line.status = 'selected';
    line.expenseReportLineId = reportLine.id;
    await line.save();
    created.push(reportLine);
  }
  return { lines: created };
};

// 仕訳明細が削除・再構築されたときに、それを突合先/起票先としていた
// 取込明細の状態を「未照合」に戻す（伝票を消したのに「起票済」が残るのを防ぐ）
export const releaseStatementLines = async (detailIds) => {
  const ids = ( detailIds || [] ).map(Number).filter((id) => id);
  if ( ids.length === 0 ) {
    return;
  }
  await models.BankStatementLine.update({
    status: 'unmatched',
    crossSlipDetailId: null
  }, {
    where: { crossSlipDetailId: { [Op.in]: ids } }
  });
};

// === 計算書（ECモール等。kind: settlement）の取り込み ===
// 1計算書 = 1複合伝票。借方: 入金先預金（振込額）+ 費用各行 / 買方: 売上高（売上側合算）。
// 税は全行0（計算書の仕訳は税込合算をそのまま載せる運用向け。消費税の分離が
// 必要な書式が出てきたらプロファイル側で拡張する）。
// 学習: 費用行のラベル→科目はこの計算書の口座（Financial）の学習ルールに蓄積する。
// 伝票化のポイント:
// - 費用行の科目は必須（仮科目では値が立たないので承認制でユーザーに確定させる）
// - 検算（売上合計 = 振込 + 費用合計）が合わないときは起票しない
// - 既に起票済みの行がある計算書は二重起票しない
// body:
//   day: 伝票日付（YYYY-MM-DD。省略時は振込行の日付）
//   received: { account, subAccount }   借方の入金先預金
//   sale:     { account, subAccount }   貸方の売上高
//   lines:    [{ lineId, account, subAccount }] 費用行の科目（まとめて指定）
const resolveSide = (side, profileKey, profile) => {
  if ( side && side.account ) {
    return { account: String(side.account), subAccount: ( side.subAccount !== undefined && side.subAccount !== null && side.subAccount !== '' ) ? Number(side.subAccount) : null };
  }
  if ( profile && profile[ profileKey ] ) {
    return { account: String(profile[ profileKey ]), subAccount: profile[ profileKey + 'SubAccount' ] ?? null };
  }
  return null;
};

export const settleStatement = async (statement, body, user, options = {}) => {
  if ( statement.kind !== 'settlement' ) {
    const err = new Error('計算書の取り込みではありません。');
    err.name = 'BankReconcileError';
    throw err;
  }
  const parser = await import('./bank-statement.js');
  const profiles = options.profiles || parser.loadProfiles();
  const profile = profiles.find((p) => ( p.name === statement.cardName ) && ( p.type === 'settlement' )) || null;
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id },
    order: [[ 'lineNo', 'ASC' ]]
  });
  // 二重起票の抑止（既に起票済みの行がある計算書は組み直さない）
  const bookedCount = lines.filter((l) => ( l.status === 'booked' ) || ( l.status === 'matched' )).length;
  if ( bookedCount > 0 ) {
    const err = new Error(`この計算書はすでに起票済みです（${bookedCount}行）。`);
    err.name = 'BankReconcileError';
    throw err;
  }
  // 伝票ビューの下書き（pick & place で組んだもの）をそのまま受理する。
  // draft.lines の各要素は { label?, debit: {rows:[lineId], account, sub},
  // credit: {rows:[lineId], account, sub} }。行に割り付けた摘要（取込行）の
  // 金額の合計がその側の金額になる（借貸合計は伝票全体で一致を検算）
  const draft = ( body.draft && Array.isArray(body.draft.lines) ) ? body.draft : null;
  if  ( !draft || draft.lines.length === 0 )  {
    const err = new Error('伝票が空です。計算書の行を pick & place して構成してください。');
    err.name = 'BankReconcileError';
    throw err;
  }
  const lineById = new Map(linesOf(lines).map((l) => [ String(l.id), l ]));
  const usedRows = new Set();
  // 1つの側: 取込行（lines）から金額・摘要を集め、科目を確定する
  const composeSide = (side, lineLabel, role) => {
    const rows = ( side.rows || [] ).map((id) => lineById.get(String(id))).filter(Boolean);
    for  ( const raw of rows )  {
      if  ( usedRows.has(String(raw.id)) )  {
        const err = new Error(`同じ取込行が複数の箇所に使われています（${raw.rawDescription || raw.description || raw.merchant || raw.id}）。取り直してください。`);
        err.name = 'BankReconcileError';
        throw err;
      }
    }
    const amount = rows.reduce((a, r) => a + Number(r.amountOut || r.amountIn || r.amount || 0), 0);
    const account = side.account ? String(side.account) : null;
    const subAccount = ( side.sub != null && side.sub !== '' ) ? Number(side.sub) : null;
    if  ( rows.length > 0 )  {
      if  ( !account )  {
        const err = new Error(`${role}側の科目が未指定です（${lineLabel || rows[0].rawDescription || ''}）。`);
        err.name = 'BankReconcileError';
        throw err;
      }
      if  ( isTempAccount(account) )  {
        const err = new Error(`${role}側に仮入科目は指定できません（${account}）。`);
        err.name = 'BankReconcileError';
        throw err;
      }
    }
    for  ( const raw of rows )  {
      usedRows.add(String(raw.id));
    }
    return { rows: rows, amount: amount, account: account, subAccount: subAccount,
      patterns: rows.map((r) => makePattern(r.rawDescription || r.description || r.merchant || '')) };
  };
  const slipLines = [];
  const layoutLines = [];
  const lineRowIds = [];   // slipLines と並行。各行に割り付けた取込行 id
  let dayStr = body.day || null;
  for  ( const [ i, dl ] of draft.lines.entries() )  {
    const debitSide = composeSide(dl.debit || {}, dl.label || '', '借方');
    const creditSide = composeSide(dl.credit || {}, dl.label || '', '貸方');
    if  ( debitSide.amount === 0 && creditSide.amount === 0 )  {
      continue;   // 双方が空の行は組み込まない（操作の途中の空行）
    }
    const label = String(dl.label || '').trim() ||
      ( debitSide.rows[0] ? ( debitSide.rows[0].rawDescription || debitSide.rows[0].description || '' ) :
        creditSide.rows[0] ? ( creditSide.rows[0].rawDescription || creditSide.rows[0].description || '' ) : '' );
    const firstRow = debitSide.rows[0] || creditSide.rows[0] || null;
    if  ( firstRow && firstRow.date && !dayStr )  {
      dayStr = firstRow.date;
    }
    slipLines.push({
      debitAccount: debitSide.account,
      debitSubAccount: debitSide.subAccount,
      debitAmount: debitSide.amount,
      debitTax: 0,
      debitTaxRuleId: null,
      creditAccount: creditSide.account,
      creditSubAccount: creditSide.subAccount,
      creditAmount: creditSide.amount,
      creditTax: 0,
      creditTaxRuleId: null,
      application1: label,
      application2: ( firstRow && firstRow.memo ) || null,
      statementLineId: firstRow ? firstRow.id : null
    });
    layoutLines.push({
      label: label,
      debit: { patterns: debitSide.patterns, account: debitSide.account, sub: debitSide.subAccount },
      credit: { patterns: creditSide.patterns, account: creditSide.account, sub: creditSide.subAccount }
    });
    // この行に割り付けた取込行は、同じ伝票明細に紐付ける
    lineRowIds.push(( ( dl.debit && dl.debit.rows ) || [] ).concat(( dl.credit && dl.credit.rows ) || []));
  }
  if  ( slipLines.length === 0 )  {
    const err = new Error('伝票が空です。計算書の行を割り付けてください。');
    err.name = 'BankReconcileError';
    throw err;
  }
  // 伝票全体の貸借一致
  const debitTotal = slipLines.reduce((a, l) => a + Number(l.debitAmount || 0), 0);
  const creditTotal = slipLines.reduce((a, l) => a + Number(l.creditAmount || 0), 0);
  if  ( Math.round(debitTotal) !== Math.round(creditTotal) )  {
    const err = new Error(`貸借が合いません（借方 ${debitTotal.toLocaleString()} vs 貸方 ${creditTotal.toLocaleString()}）。割り付けを見直してください。`);
    err.name = 'BankReconcileError';
    throw err;
  }
  // 伝票日付
  dayStr = body.day || dayStr || statement.periodFrom;
  const m = String(dayStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if  ( !m )  {
    const err = new Error('伝票日付が特定できません。');
    err.name = 'BankReconcileError';
    throw err;
  }
  const slip = await createCrossSlip({
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    lines: slipLines
  }, user, { forceUnapproved: true });
  // 割り付けた取込行は「起票済み」にして、データに結び付ける
  const details = await models.CrossSlipDetail.findAll({
    where: { crossSlipId: slip.id },
    order: [[ 'lineNo', 'ASC' ]]
  });
  for  ( const [ i, d ] of details.entries() )  {
    for  ( const id of ( lineRowIds[ i ] || [] ) )  {
      await models.BankStatementLine.update({
        status: 'booked',
        crossSlipDetailId: d.id
      }, { where: { id: Number(id), crossSlipDetailId: null } });
    }
  }
  // 起票が成功したので、この構成（どの摘要を貸借のどこに置いたか）を
  // 口座に学習する。次回取込では同じ構成の下書きが自動生成される
  try {
    const financial = statement.financial || await models.Financial.findByPk(statement.financialId);
    if  ( financial )  {
      financial.settleLayout = JSON.stringify({ lines: layoutLines });
      await financial.save();
    }
  } catch (e) {
    console.log('settleLayout save failed', e.message);
  }
  // 通帳側に仮登録された伝票（借: 銀行 / 貸: 入金仮）がちょうど1つ合致するなら
  // 統合する（同じ取引を2つの伝票にせず、通帳側の番号・日付・紐付けを生かす）。
  // 候補が無い/複数のときは計算書側の伝票をそのまま残す（計算書ビューの
  // 「統合」から手動で扱う）
  try {
    const merge = await mergeSettlementIntoDeposit(slip, user, {});
    if ( merge && merge.merged ) {
      // slip=統合後の通帳側伝票、discarded=破棄した計算書側の伝票
      return { slip: merge.slip, merged: true, discarded: merge.discarded };
    }
  } catch (e) {
    console.log('deposit merge skipped:', e.message || e);
  }
  return { slip: slip };
};


// 計算書取込のプレビュー（GET用）。分類の集計+費用行の科目候補（学習ルール）
// + プロファイルの約束科目（received/sale。未設定なら null）

// 計算書の起票時に、そのとき使った「摘要→借方・貸方」を丸ごと覚える。
// 貸方の指定がない行は credit を null にして（=口座の科目側）覚える。
// 学習失敗しても起票自体は失敗させない（learnOpposite と同じ方針）
const learnSettleRule = async (financialId, entry) => {
  try {
    const label = entry.line.rawDescription || entry.line.description || entry.line.merchant || '';
    if  ( !financialId || !entry.account || isTempAccount(entry.account) )  return;
    const pattern = makePattern(label);
    if  ( !pattern )  return;
    const [ rule, created ] = await models.BankStatementRule.findOrCreate({
      where: {
        financialId: financialId,
        pattern: pattern,
        direction: 'out'
      },
      defaults: {
        oppositeAccount: entry.account,
        oppositeSubAccount: entry.subAccount || null,
        creditAccount: ( entry.credit && entry.credit.account ) ? entry.credit.account : null,
        creditSubAccount: ( entry.credit && entry.credit.subAccount ) ? entry.credit.subAccount : null,
        usageCount: 1
      }
    });
    if  ( !created )  {
      // 起票されたときの内容を最優先で覚え直す
      rule.oppositeAccount = entry.account;
      rule.oppositeSubAccount = entry.subAccount || null;
      rule.creditAccount = ( entry.credit && entry.credit.account ) ? entry.credit.account : null;
      rule.creditSubAccount = ( entry.credit && entry.credit.subAccount ) ? entry.credit.subAccount : null;
    }
    rule.usageCount = ( rule.usageCount || 0 ) + 1;
    await rule.save();
  } catch (e) {
    console.log('learnSettleRule failed', e.message);
  }
};

export const settlementPreview = async (statement) => {
  if ( statement.kind !== 'settlement' ) {
    return null;
  }
  const parser = await import('./bank-statement.js');
  const profiles = parser.loadProfiles();
  const profile = profiles.find((p) => ( p.name === statement.cardName ) && ( p.type === 'settlement' )) || null;
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id },
    order: [[ 'lineNo', 'ASC' ]]
  });
  const breakdown = parser.settlementBreakdown(lines, profile);
  const financialRules = statement.financialId ?
    await models.BankStatementRule.findAll({ where: { financialId: statement.financialId } }) : [];
  const subTitle = (line) => ( line.rawDescription || line.description || line.merchant || '' );
  // 1行=貸借の伝票ビュー: 借方(相手方)と貸方(任意指定)をあわせて候補として
  // 返す。起票時に覚えた内容そのものが次回に来る
  const suggestions = breakdown.expenseLines.map((line) => {
    const label = subTitle(line);
    const rule = findLearnedRule(financialRules, label, 'out');
    return {
      lineId: line.id,
      label: label,
      amount: Number(line.amountOut || 0),
      account: rule ? rule.oppositeAccount : null,
      subAccount: rule ? ( rule.oppositeSubAccount ?? null ) : null,
      creditAccount: rule ? ( rule.creditAccount ?? null ) : null,
      creditSubAccount: rule ? ( rule.creditSubAccount ?? null ) : null
    };
  });
  // 全取込行の目録（伝票ビューの行）。各行に「出し方」の既定役割を付け、
  // front で変更できる（OCR が「売上」を出していない等は行側で直せる）。
  // received=振込行（借:入金先・貸:売上高の行）/ sale=売上行（貸:売上高の
  // 源泉）/ expense=費用行（借:費用）/ none=使わない行
  const expenseIds = new Set(breakdown.expenseLines.map((l) => l.id));
  const saleIds = new Set(breakdown.saleLines.map((l) => l.id));
  const roleOf = (raw) => {
    if  ( breakdown.transferLine && raw.id === breakdown.transferLine.id )  return  'received';
    if  ( saleIds.has(raw.id) )  return  'sale';
    if  ( expenseIds.has(raw.id) )  return  'expense';
    return  'none';
  };
  const lineViews = linesOf(lines).map((raw) => ( {
    lineId: raw.id,
    label: subTitle(raw),
    amountIn: Number(raw.amountIn || 0),
    amountOut: Number(raw.amountOut || 0),
    amount: Number(raw.amount || 0),
    status: raw.status,
    defaultRole: roleOf(raw)
  } ));
  // 学習済みレイアウトから下書きを生成する（digest: どの摘要を貸借のどこに
  // 置くかの前回構成）。メンバの正規化パターンで現在の取込行を照合して
  // テン候補組み立てる。フロント側の未保存下書きが無い場合だけ使う
  const seedDraft = await seedDraftFromLayout(statement, breakdown, linesOf(lines).map((l) => l), profile);
  return {
    profileName: profile ? profile.name : null,
    received: { account: ( profile && profile.receivedAccount ) || null, subAccount: ( profile && profile.receivedSubAccount ) ?? null },
    sale: { account: ( profile && profile.saleAccount ) || null, subAccount: ( profile && profile.saleSubAccount ) ?? null },
    saleTotal: breakdown.saleTotal,
    expenseTotal: breakdown.expenseTotal,
    transferAmount: breakdown.transferAmount,
    transferDate: ( breakdown.transferLine && breakdown.transferLine.date ) || null,
    warnings: breakdown.warnings,
    suggestions: suggestions,
    lines: lineViews,
    seedDraft: seedDraft
  };
};

// 学習済み layout から伝票下書きを組み立てる。pattern が当たった取込行だけを
// 割り当て、当たらなかったパターンは捨てる（部分一致は seed として提示する）
const seedDraftFromLayout = async (statement, breakdown, lineRows, profile) => {
  try {
    if  ( !statement.financialId )  {
      return null;
    }
    const financial = statement.financial || await models.Financial.findByPk(statement.financialId);
    if  ( !financial || !financial.settleLayout )  {
      return null;
    }
    const layout = JSON.parse(financial.settleLayout) || {};
    if  ( !Array.isArray(layout.lines) || layout.lines.length === 0 )  {
      return null;
    }
    const byPattern = new Map();
    for  ( const raw of lineRows )  {
      const pattern = makePattern(raw.rawDescription || raw.description || raw.merchant || '');
      if  ( !byPattern.has(pattern) )  {
        byPattern.set(pattern, { raw: raw, used: false });
      }
    }
    const draftLines = [];
    const unusedPatterns = new Map(byPattern);
    for  ( const layoutLine of layout.lines )  {
      const side = (spec) => {
        const out = { rows: [], account: spec && spec.account || '', sub: spec && spec.sub != null ? spec.sub : null };
        for  ( const pattern of ( ( spec && spec.patterns ) || [] ) )  {
          const hit = unusedPatterns.get(pattern);
          if  ( hit && !hit.used )  {
            hit.used = true;
            out.rows.push(hit.raw.id);
          } else  {
            unusedPatterns.delete(pattern);
          }
        }
        return out;
      };
      const debit = side(layoutLine.debit);
      const credit = side(layoutLine.credit);
      if  ( debit.rows.length === 0 && credit.rows.length === 0 )  {
        continue;
      }
      draftLines.push({
        label: layoutLine.label || '',
        debit: debit,
        credit: credit
      });
    }
    if  ( draftLines.length === 0 )  {
      return null;
    }
    return { lines: draftLines };
  } catch (e) {
    console.log('seedDraft failed', e.message);
    return null;
  }
};

// 取込明細行の配列（sequelize）を plain object にする（settlementPreview 用）。
// fileBody は重いので落とす
const linesOf = (lineRows) => {
  return ( lineRows || [] ).map((l) => {
    const raw = ( l.toJSON ) ? l.toJSON() : l;
    raw.fileBody = undefined;
    return raw;
  });
};

// 未照合行の相手方仕訳の候補を表示用に返す（起票時の仮入科目に置かれる前の
// 判断材料。学習ルールに完全一致する行だけを対象にする）
// 戻り値は {lineId, oppositeAccount, oppositeSubAccount, learned:true} の配列
// ルール候補の生成（承認制）。
// この取り込の行を正規化摘要+方向でグルーピングし、まだルールの無い
// 摘要を候補として返す。相手方の提案は「同じ口座側に載る過去の仕訳明細
// （application1の正規化一致）の最も新しいもの」から引く（判じものではなく
// 候補提示。ユーザーが確認して登録する）
export const suggestRuleCandidates = async (statement) => {
  if ( !statement.financialId ) {
    return [];
  }
  const financial = statement.financial ||
    await models.Financial.findByPk(statement.financialId);
  if ( !financial ) {
    return [];
  }
  const rules = await models.BankStatementRule.findAll({
    where: { financialId: statement.financialId }
  });
  const ruledPatterns = new Set(rules.map((r) => ( r.pattern )));
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id }
  });
  // 未処理の行（未照合・仮起票）だけが候補のネタになる
  const groups = new Map();
  for ( const line of lines ) {
    if ( line.status === 'matched' || line.status === 'ignored' || line.status === 'selected' ) {
      continue;
    }
    const pattern = makePattern(line.rawDescription || line.description);
    if ( !pattern || ruledPatterns.has(pattern) ) {
      continue;
    }
    const isOut = ( line.amountOut !== null && line.amountOut !== undefined ) ||
      ( statement.kind !== 'bank' && line.amount !== null && line.amount !== undefined );
    const key = `${pattern}|${isOut ? 'out' : 'in'}`;
    if ( !groups.has(key) ) {
      groups.set(key, { pattern: pattern, direction: isOut ? 'out' : 'in', count: 0 });
    }
    groups.get(key).count += 1;
  }
  // 提案元: この口座側の科目で載っている過去の仕訳明細（直近300件）。
  // 出金行なら貸方が口座、入金行なら借方が口座
  const recentDetails = await models.CrossSlipDetail.findAll({
    where: {
      [Op.or]: [
        { creditAccount: financial.accountCode },
        { debitAccount: financial.accountCode }
      ]
    },
    order: [[ 'id', 'DESC' ]],
    limit: 300
  });
  const candidates = [];
  for ( const group of groups.values() ) {
    const isOut = ( group.direction === 'out' );
    const sideAccountAttribute = isOut ? 'creditAccount' : 'debitAccount';
    const counterpartAttribute = isOut ? 'debitAccount' : 'creditAccount';
    const counterpartSub = isOut ? 'debitSubAccount' : 'creditSubAccount';
    // 過去の仕訳に同じ摘要があるか（正規化一致）。あればその相手方を提案。
    // **仮起票（仮入科目で載っている未確定の明細）は実績として使わない**
    // （仮を相手方に学習すると、そのルールで永遠に仮のままになる）
    const history = recentDetails.find((detail) => (
      ( detail[sideAccountAttribute] === financial.accountCode ) &&
      makePattern(detail.application1) === group.pattern &&
      detail[counterpartAttribute] &&
      !isTempAccount(detail[counterpartAttribute])
    ));
    candidates.push({
      pattern: group.pattern,
      direction: group.direction,
      count: group.count,
      suggestAccount: history ? history[counterpartAttribute] : null,
      suggestSubAccount: history ? ( history[counterpartSub] || null ) : null
    });
  }
  return candidates;
};

export const suggestOpposites = async (statement, profiles = null) => {
  const learnedRules = statement.financialId ? await models.BankStatementRule.findAll({
    where: {
      financialId: statement.financialId
    },
    order: [[ 'usageCount', 'DESC' ]]
  }) : [];
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, status: 'unmatched' }
  });
  const suggestions = [];
  for ( const line of lines ) {
    const desc = normalizeDescription(line.rawDescription);
    if ( !desc ) continue;
    const pattern = makePattern(desc);
    // 学習候補は方向も一致させる（同摘要でも入金と出金で相手方が違う）
    const lineDirection = ( line.amountOut !== null && line.amountOut !== undefined ) ? 'out' : 'in';
    const learned = learnedRules.find((r) => (
      r.pattern === pattern &&
      ( ( !r.direction ) || ( r.direction === lineDirection ) )
    ));
    if ( learned ) {
      suggestions.push({
        lineId: line.id,
        oppositeAccount: learned.oppositeAccount,
        oppositeSubAccount: learned.oppositeSubAccount,
        learned: true
      });
    }
  }
  return suggestions;
};

// 「後の処理」。仮入科目（出金仮/入金仮）で起票した未承認伝票を、
// 後から入力された実科目の仕訳（請求書・領収書等の経理処理由来）と突合して
// 仮科目を差し替える。デビット・振込は必ず対応する他証憑があるという前提。
// 条件: 金額一致 + 伝票日付が ±days 以内。自動で適用する（完全自動運用）。
// 差し替えたときに「隙あらば学習」する（次回から同じ摘要は正科目で起票できる）。
// 確定（承認済み）伝票・精算書由来伝票は触らない。
export const reconcilePlaceholders = async (options = {}) => {
  const days = ( options.days === undefined ) ? 3 : options.days;
  // 「後の処理」も許可された摘要だけが対象（口座のルール match=true。
  // 「金額一致+±3日」は緩い条件なので、予定外の摘要では誤って結び付けて
  // 別の取引を食う恐れがある。載っていない摘要は手動に回す）。
  // 仮の銀行側（out=credit/in=debit）から口座を解決し、その口座の許可摘要で絞る
  // 仮科目を含む仕訳明細（未承認・精算書由来は除く）
  const tempCandidates = await models.CrossSlipDetail.findAll({
    include: [{ model: models.CrossSlip, as: 'crossSlip' }],
    where: {
      [Op.or]: [
        { debitAccount: TEMP_ACCOUNTS.OUT },
        { creditAccount: TEMP_ACCOUNTS.IN }
      ]
    }
  });
  const temps = [];
  const matchPatternsByFinancial = new Map();
  for ( const detail of tempCandidates ) {
    if ( ( !detail.crossSlip ) || detail.crossSlip.approvedAt || detail.crossSlip.expenseReportId ) {
      continue;
    }
    const isOut = ( detail.debitAccount === TEMP_ACCOUNTS.OUT );
    const financial = await findFinancialBySide(
      isOut ? detail.creditAccount : detail.debitAccount,
      isOut ? detail.creditSubAccount : detail.debitSubAccount
    );
    if ( !financial ) {
      continue;
    }
    if ( !matchPatternsByFinancial.has(financial.id) ) {
      matchPatternsByFinancial.set(financial.id, new Set(
        ( await models.BankStatementRule.findAll({
          where: { financialId: financial.id, match: true },
          raw: true
        }) ).map((r) => r.pattern)
      ));
    }
    if ( matchPatternsByFinancial.get(financial.id).has(makePattern(detail.application1)) ) {
      temps.push(detail);
    }
  }
  if ( temps.length === 0 ) {
    return { replaced: 0 };
  }
  // 差し替えの「来源明細」。既に取込行の突合先・起票先になっている明細は除外する
  // （その明細はすでに銀行側の伝票として存在するため、重複して役目を負わせない）
  const used = await models.BankStatementLine.findAll({
    where: { crossSlipDetailId: { [Op.ne]: null } },
    attributes: [ 'crossSlipDetailId' ]
  });
  const usedIds = new Set(used.map((l) => l.crossSlipDetailId));
  const allDetails = await models.CrossSlipDetail.findAll({
    include: [{ model: models.CrossSlip, as: 'crossSlip' }]
  });
  let replaced = 0;
  for ( const temp of temps ) {
    const isOut = ( temp.debitAccount === TEMP_ACCOUNTS.OUT );
    const amount = Number(isOut ? temp.debitAmount : temp.creditAmount);
    if ( !amount || !temp.crossSlip ) continue;
    const candidates = allDetails.filter((detail) => {
      if ( detail.crossSlip === undefined || detail.crossSlip === null ) return false;
      if ( usedIds.has(detail.id) ) return false;
      if ( isTempAccount(detail.debitAccount) || isTempAccount(detail.creditAccount) ) {
        return false;
      }
      const side = isOut ? 'debit' : 'credit';
      if ( Number(detail[`${side}Amount`]) !== amount ) return false;
      const account = detail[`${side}Account`];
      // 銀行科目や仮科目そのもの、預金系は「実科目」ではない
      if ( !account || isTempAccount(account) || /^101/.test(account) ) return false;
      const slip = detail.crossSlip;
      if ( slip.expenseReportId ) return false;
      const slipDate = new Date(slip.year, slip.month - 1, slip.day);
      const tempDate = new Date(temp.crossSlip.year, temp.crossSlip.month - 1, temp.crossSlip.day);
      return dayDiff(slipDate, tempDate) <= days;
    });
    if ( candidates.length === 0 ) {
      continue;
    }
    // 日付が最も近い明細を採用する
    candidates.sort((a, b) => {
      const da = dayDiff(new Date(a.crossSlip.year, a.crossSlip.month - 1, a.crossSlip.day),
        new Date(temp.crossSlip.year, temp.crossSlip.month - 1, temp.crossSlip.day));
      const db = dayDiff(new Date(b.crossSlip.year, b.crossSlip.month - 1, b.crossSlip.day),
        new Date(temp.crossSlip.year, temp.crossSlip.month - 1, temp.crossSlip.day));
      return da - db;
    });
    const source = candidates[0];
    const side = isOut ? 'debit' : 'credit';
    temp[`${side}Account`] = source[`${side}Account`];
    temp[`${side}SubAccount`] = source[`${side}SubAccount`] || null;
    // 証憑が紐付いた明細であれば、仮起票伝票側にも証憑を残す
    const voucherId = source[`${side}VoucherId`];
    if ( voucherId ) {
      temp[`${side}VoucherId`] = voucherId;
    }
    await temp.save();
    usedIds.add(source.id);
    replaced ++;
    // このままでは学習が効かない（learnFromSlip は伝票作成/更新時フック）ので、
    // 差し替えた時点で摘要→相手方を覚える。学習は口座単位:
    // 仮側の反対（銀行側=101）で口座を引く（カードは203側が口座）
    const sideFinancial = await findFinancialBySide(
      isOut ? temp.creditAccount : temp.debitAccount,
      isOut ? temp.creditSubAccount : temp.debitSubAccount
    );
    if ( sideFinancial ) {
      await learnOpposite(
        sideFinancial.id,
        temp.application1,
        isOut ? { account: source.debitAccount, sub: source.debitSubAccount }
              : { account: source.creditAccount, sub: source.creditSubAccount },
        isOut ? 'out' : 'in'
      );
    }
  }
  return { replaced: replaced };
};

// === 計算書伝票 → 入金仮伝票の統合（deposit merge） ===
// 通帳取り込みで仮登録された伝票（借: 銀行科目 / 貸: 入金仮）と、計算書から
// 起票した複合伝票は同じ取引（送金のタイムラグで日付が数日ずれる）。
// 計算書側の中身を通帳側の伝票に移してひとつにする。伝票番号・日付・
// 通帳行の紐付けは通帳側を生かす（実際の入金日が正しい日付）。

const BANK_ACCOUNT_RE = /^101/;

// 統合候補の「入金仮伝票」を探す。settlementSlip は計算書から起票した伝票
// （未承認。全明細が計算書の取込行に紐付いている）。戻り値:
// [{ slip: 入金仮伝票, detail: 仮明細(貸: 入金仮/借: 銀行), diff: 日付差 }]
export const findDepositMergeCandidates = async (settlementSlip, options = {}) => {
  const days = ( options.days === undefined ) ? 3 : options.days;
  if ( !settlementSlip || settlementSlip.approvedAt || settlementSlip.expenseReportId ) {
    return [];
  }
  const fy = await models.FiscalYear.findOne({ where: { term: settlementSlip.term } });
  if ( fy && isLocked(fy) ) {
    return [];
  }
  const settleDetails = await models.CrossSlipDetail.findAll({
    where: { crossSlipId: settlementSlip.id },
    order: [[ 'lineNo', 'ASC' ]]
  });
  if ( settleDetails.length === 0 ) {
    return [];
  }
  // 計算書側に仮科目が混ざっているなら統合しない（保険）
  if ( settleDetails.some((d) => ( isTempAccount(d.debitAccount) || isTempAccount(d.creditAccount) )) ) {
    return [];
  }
  // 計算書伝票の銀行借方明細はちょうど1つ。その銀行科目・金額が合致票に必要
  const bankDetails = settleDetails.filter((d) => BANK_ACCOUNT_RE.test(String(d.debitAccount || '')));
  if ( bankDetails.length !== 1 ) {
    return [];
  }
  const bankDetail = bankDetails[0];
  const amount = Number(bankDetail.debitAmount);
  if ( !amount ) {
    return [];
  }
  // 全明細が計算書（kind: settlement）の取込行に紐付いていること。実通帳由来の
  // 行が混ざる伝票は「計算書側の伝票」ではない（あるいはすでに統合済み）
  const sourceLines = await models.BankStatementLine.findAll({
    where: { crossSlipDetailId: { [Op.in]: settleDetails.map((d) => d.id) } }
  });
  const boundDetailIds = new Set(sourceLines.map((l) => Number(l.crossSlipDetailId)));
  if ( settleDetails.some((d) => !boundDetailIds.has(Number(d.id))) ) {
    return [];
  }
  const owners = await models.BankStatement.findAll({
    where: { id: { [Op.in]: [ ...new Set(sourceLines.map((l) => l.statementId)) ] } },
    raw: true
  });
  if ( owners.some((o) => ( o.kind !== 'settlement' )) ) {
    return [];
  }
  // 口座（計算書側の銀行科目と同じ financial の預金）の入金仮を集める
  const settleFinancial = await findFinancialBySide(bankDetail.debitAccount, bankDetail.debitSubAccount);
  if ( !settleFinancial ) {
    return [];
  }
  const tempDetails = await models.CrossSlipDetail.findAll({
    where: {
      creditAccount: TEMP_ACCOUNTS.IN,
      debitAmount: amount
    },
    include: [{ model: models.CrossSlip, as: 'crossSlip' }]
  });
  const settleDate = new Date(settlementSlip.year, settlementSlip.month - 1, settlementSlip.day).getTime();
  const candidates = [];
  for ( const td of tempDetails ) {
    const slip = td.crossSlip;
    if ( !slip || slip.approvedAt || slip.expenseReportId ) continue;
    if ( Number(slip.id) === Number(settlementSlip.id) ) continue;
    // 仮明細の借方＝銀行科目で同額に立っていること（bookLines 標準の1行形）
    if ( Number(td.debitAmount) !== amount ) continue;
    if ( !BANK_ACCOUNT_RE.test(String(td.debitAccount || '')) ) continue;
    // 口座が同じこと（通帳の financial = 計算書側の銀行科目の financial）
    const depositFinancial = await findFinancialBySide(td.debitAccount, td.debitSubAccount);
    if ( !depositFinancial || ( Number(depositFinancial.id) !== Number(settleFinancial.id) ) ) continue;
    // 実通帳（kind: bank）の入金行に紐付いていること。計算書同士の突合はしない
    const binders = await models.BankStatementLine.findAll({ where: { crossSlipDetailId: td.id } });
    let bankBound = false;
    for ( const binder of binders ) {
      const owner = await models.BankStatement.findByPk(binder.statementId, { raw: true });
      if ( owner && ( owner.kind !== 'settlement' ) ) {
        bankBound = true;
      }
    }
    if ( !bankBound ) continue;
    const diff = Math.abs(
      ( new Date(slip.year, slip.month - 1, slip.day).getTime() - settleDate ) / 86400000
    );
    if ( diff > days ) continue;
    candidates.push({ slip: slip, detail: td, diff: diff });
  }
  // 番号が新しい順に安定化（同額の伝票が複数ある場合の再現性）
  candidates.sort((a, b) => ( ( a.diff - b.diff ) || ( b.slip.id - a.slip.id ) ));
  return candidates;
};

// 統合の実行。candidates は事前検算済みのもの（routes のフォールバックでは
// 再検索して渡す）。戻り値: { merged, slip(統合後の通帳側伝票), discarded }
export const mergeSettlementIntoDeposit = async (settlementSlip, user, options = {}) => {
  const candidates = ( options.candidate ) ? [ options.candidate ] :
    await findDepositMergeCandidates(settlementSlip, options);
  if ( candidates.length !== 1 ) {
    const reason = ( candidates.length === 0 ) ? '候補がありません' :
      '候補が複数あります（計算書ビューから選んでください）';
    const err = new Error(`統合できません: ${reason}`);
    err.name = 'BankReconcileError';
    err.candidates = candidates;
    throw err;
  }
  const candidate = candidates[0];
  const depositSlip = candidate.slip;
  const depositDetail = candidate.detail;
  const t = await models.sequelize.transaction();
  try {
    // 二重確認（候補生成後の変化に備える。承認状態とロックの再検査）
    const nowSlip = await models.CrossSlip.findByPk(depositSlip.id, { transaction: t });
    if ( !nowSlip || nowSlip.approvedAt || nowSlip.expenseReportId ) {
      throw new Error('統合先の伝票が使えなくなりました');
    }
    const settleDetails = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: settlementSlip.id },
      order: [[ 'lineNo', 'ASC' ]],
      transaction: t
    });
    const bankDetail = settleDetails.find((d) => BANK_ACCOUNT_RE.test(String(d.debitAccount || '')));
    if ( !bankDetail ) {
      throw new Error('計算書側の伝票に銀行明細がありません');
    }
    // 貸借の組替え計算。
    // - 統合先の仮明細: 借方（銀行）を保持し、貸方の入金仮を外す。
    //   計算書側の銀行明細に貸方（売上高等）が付いているならそれを引き受ける
    // - 計算書側の銀行明細は統合先に吸収される（新規明細は作らない）
    // - それ以外の明細（費用・売上側）は統合先に新規明細として移設する
    let nextLineNo = ( await models.CrossSlipDetail.max('lineNo', {
      where: { crossSlipId: depositSlip.id },
      transaction: t
    }) ) || 0;
    const movedSourceIds = new Map();  // sourceDetail.id -> newDetail.id
    const detailFields = [
      'debitAccount', 'debitSubAccount', 'debitAmount', 'debitTax',
      'debitVoucherId', 'debitTaxRuleId',
      'creditAccount', 'creditSubAccount', 'creditAmount', 'creditTax',
      'creditVoucherId', 'creditTaxRuleId',
      'projectId', 'application1', 'application2', 'statementLineId'
    ];
    let absorbCredit = null;
    for ( const source of settleDetails ) {
      if ( Number(source.id) === Number(bankDetail.id) ) {
        if ( source.creditAccount && !isTempAccount(source.creditAccount) ) {
          absorbCredit = {
            creditAccount: source.creditAccount,
            creditSubAccount: source.creditSubAccount,
            creditAmount: source.creditAmount,
            creditTax: source.creditTax,
            creditVoucherId: source.creditVoucherId,
            creditTaxRuleId: source.creditTaxRuleId
          };
        }
        movedSourceIds.set(Number(source.id), Number(depositDetail.id));
        continue;
      }
      nextLineNo += 1;
      const values = { crossSlipId: depositSlip.id, lineNo: nextLineNo };
      for ( const field of detailFields ) {
        if ( source[ field ] !== null && source[ field ] !== undefined ) {
          values[ field ] = source[ field ];
        }
      }
      const moved = await models.CrossSlipDetail.create(values, { transaction: t });
      movedSourceIds.set(Number(source.id), moved.id);
    }
    // 仮明細を書き換える（入金仮を外し、計算書側の貸方を引き受ける）
    depositDetail.creditAccount = absorbCredit ? absorbCredit.creditAccount : null;
    depositDetail.creditSubAccount = absorbCredit ? absorbCredit.creditSubAccount : null;
    depositDetail.creditAmount = absorbCredit ? absorbCredit.creditAmount : null;
    depositDetail.creditTax = absorbCredit ? absorbCredit.creditTax : null;
    depositDetail.creditVoucherId = absorbCredit ? absorbCredit.creditVoucherId : null;
    depositDetail.creditTaxRuleId = absorbCredit ? absorbCredit.creditTaxRuleId : null;
    await depositDetail.save({ transaction: t });
    // 検算（貸借が合わなくなる組替えは許さない。念のため）
    const finalDetails = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: depositSlip.id },
      transaction: t
    });
    const debitTotal = finalDetails.reduce((a, d) => a + Number(d.debitAmount || 0), 0);
    const creditTotal = finalDetails.reduce((a, d) => a + Number(d.creditAmount || 0), 0);
    if ( Math.round(debitTotal) !== Math.round(creditTotal) ) {
      throw new Error(`統合後の貸借が合いません（借方 ${debitTotal} vs 貸方 ${creditTotal}）`);
    }
    // 取込行の紐付けを新しい明細へ付け替える（計算書側の取込行は通帳側伝票に
    // 結び付いて維持される。振込行は通帳側の銀行明細に統合される）
    for ( const [ sourceId, targetId ] of movedSourceIds.entries() ) {
      await models.BankStatementLine.update({
        crossSlipDetailId: targetId
      }, {
        where: { crossSlipDetailId: sourceId },
        transaction: t
      });
    }
    // 計算書側の伝票: 明細と伝票を捨てる（未承認なので痕跡は残らない）
    await models.CrossSlipDetail.destroy({
      where: { crossSlipId: settlementSlip.id },
      transaction: t
    });
    const detailCount = await models.CrossSlipDetail.count({
      where: { crossSlipId: depositSlip.id },
      transaction: t
    });
    depositSlip.lineCount = detailCount;
    depositSlip.updatedBy = ( user && user.id ) || depositSlip.updatedBy;
    await depositSlip.save({ transaction: t });
    await models.CrossSlip.destroy({
      where: { id: settlementSlip.id },
      transaction: t
    });
    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }
  // 学習: 統合後の伝票から「摘要→相手方」を覚え直す（伝票作成/更新フックと同じ方針）
  try {
    await learnFromSlip(depositSlip);
  } catch (e) {
    console.log('deposit merge learn failed', e.message);
  }
  console.log(`[settlement] merged slip ${settlementSlip.id} into deposit slip ${depositSlip.id} (no ${depositSlip.no})`);
  return { merged: true, slip: depositSlip, discarded: settlementSlip.id };
};

// 「再実行」。ルール追加や手作業修正の後に、取込から起票した未承認伝票を
// 解放して現行ルールで起票し直す。承認済み（確定）伝票・精算書由来伝票・
// 佩戴中（会計年度ロック中）の伝票は決して触らない
export const rebookStatement = async (statement, user, options = {}) => {
  // options.lineId / options.lineIds: 「摘要から適用」用。指定行だけを
  // 解放して再起票する（驚き最小。全文再実行との違い: 「後の処理」を
  // 前置で走らせない）
  const lineIds = ( options.lineIds && Array.isArray(options.lineIds) ) ?
    options.lineIds.map(Number) :
    ( options.lineId ? [ Number(options.lineId) ] : null );
  const where = {
    statementId: statement.id,
    crossSlipDetailId: { [Op.ne]: null },
    status: 'booked'
  };
  if ( lineIds ) {
    where.id = { [Op.in]: lineIds };
  }
  const lines = await models.BankStatementLine.findAll({
    where: where
  });
  const result = { rebooked: 0, skipped: 0 };
  // 解放した行（同一伝票に紐づく他の行=合流仲間もともに解放する）
  const released = new Set();
  for ( const line of lines ) {
    const detail = await models.CrossSlipDetail.findByPk(line.crossSlipDetailId);
    const slip = detail ? await models.CrossSlip.findByPk(detail.crossSlipId) : null;
    if ( !slip ) {
      // 伝票が消えていれば解放だけする
      line.status = 'unmatched';
      line.crossSlipDetailId = null;
      await line.save();
      released.add(line.id);
      continue;
    }
    if ( slip.approvedAt || slip.expenseReportId ) {
      result.skipped ++;
      continue;
    }
    const fy = await models.FiscalYear.findOne({ where: { term: slip.term } });
    if ( fy && isLocked(fy) ) {
      result.skipped ++;
      continue;
    }
    // この伝票に紐づく行をすべて解放する（伝票を消すので、合流された行も
    // 未照合に戻す。指定行と同一伝票の行=合流仲間を含む）
    const slipDetails = await models.CrossSlipDetail.findAll({
      where: { crossSlipId: slip.id },
      attributes: [ 'id' ],
      raw: true
    });
    const slipDetailIds = slipDetails.map((d) => d.id);
    // 紐付けをnull化する前に、伝票に紐づく行を採っておく（解放後は引けない）
    const slipLines = await models.BankStatementLine.findAll({
      where: { crossSlipDetailId: { [Op.in]: slipDetailIds } },
      raw: true
    });
    await releaseStatementLines(slipDetailIds);
    for ( const slipLine of slipLines ) {
      released.add(slipLine.id);
    }
    released.add(line.id);
    // 伝票を消す
    await models.CrossSlipDetail.destroy({ where: { crossSlipId: slip.id } });
    await slip.destroy();
    result.rebooked ++;
  }
  // 現行ルールで再起票する（合流も施行される）。行単位のときは解放した行だけ
  // （他の行の伝票に触れない。「後の処理」もここでも前置で走らせない）。
  // 「適用して保存」(options.applyRuleId)では、選ばれたルールを強制適用する
  await bookLines(statement, lineIds ? [ ...released ].map((lineId) => ({ lineId: lineId })) : null, user,
    options.applyRuleId ? { forcedRule: await models.BankStatementRule.findByPk(parseInt(options.applyRuleId, 10)) } : {});
  return result;
};

// === 通帳の入金行と計算書の複合伝票の紐付け（Amazon振込等） ===
// 計算書（kind: settlement）の複合伝票は借方に入金先預金を立てている。通帳に
// 振込で入る行は「新たな伝票」ではなく、**この伝票の預金明細に紐付ける**
// （二重計上の防止。照合=matched紐付けなので伝票は増えない）。
// 候補の特定は計算書の振込行（rawDescriptionにtransferPattern='振込'を含む行）
// が持つ預金明細に対して、金額一致+伝票日付±3日で行う（学習ルールの
// ホワイトリストは計算書側の起票経路に効かないので、ここは候補提示+人の承認
// （明示クリック）でつなぐ）
export const suggestSettlementDeposits = async (statement) => {
  if ( ( statement.kind !== 'bank' ) || !statement.account ) {
    return [];
  }
  const lines = await models.BankStatementLine.findAll({
    where: { statementId: statement.id, status: 'unmatched' },
    order: [[ 'lineNo', 'ASC' ]]
  });
  if ( lines.length === 0 ) {
    return [];
  }
  // 計算書取り込みの振込行が持つ預金明細（複合伝票の借方の行）を集める
  const settlementStatements = await models.BankStatement.findAll({ where: { kind: 'settlement' } });
  if ( settlementStatements.length === 0 ) {
    return [];
  }
  // 振込行の特定は計算書側と同じ既定語（AI読取の揺れ「純利益」を見る）
  const { DEFAULT_TRANSFER_PATTERN } = await import('./bank-statement.js');
  const transferPattern = new RegExp(DEFAULT_TRANSFER_PATTERN);
  const detailIds = new Set();
  for ( const s of settlementStatements ) {
    const slines = await models.BankStatementLine.findAll({
      where: { statementId: s.id, crossSlipDetailId: { [Op.ne]: null } }
    });
    for ( const line of slines ) {
      if ( ( line.amountIn !== null && line.amountIn !== undefined ) &&
           transferPattern.test( normalizeText(line.rawDescription || line.description || '') ) ) {
        detailIds.add(line.crossSlipDetailId);
      }
    }
  }
  if ( detailIds.size === 0 ) {
    return [];
  }
  const details = await models.CrossSlipDetail.findAll({
    include: [{ model: models.CrossSlip, as: 'crossSlip' }],
    where: { id: { [Op.in]: [ ...detailIds ] } }
  });
  const suggestions = [];
  for ( const line of lines ) {
    if ( line.amountIn === null || line.amountIn === undefined || !line.date ) {
      continue;
    }
    // 行ごともっとも良い候補（日付が近く、伝票番号が新しいもの）を1つ選ぶ
    const matches = [];
    for ( const detail of details ) {
      const slip = detail.crossSlip;
      if ( !slip ) {
        continue;
      }
      if ( Number(detail.debitAmount) !== Number(line.amountIn) ) {
        continue;
      }
      const diff = Math.abs(new Date(slip.year, slip.month - 1, slip.day)
        .getTime() - new Date(line.date).getTime()) / 86400000;
      if ( diff > 3 ) {
        continue;
      }
      // この預金明細に、すでに「bank側の行」が紐付いていたら候補から外す
      // （二重運用の防止。計算書側の行の紐付けは残す）
      const binders = await models.BankStatementLine.findAll({
        where: { crossSlipDetailId: detail.id }, raw: true
      });
      let bankBound = false;
      for ( const binder of binders ) {
        const owner = await models.BankStatement.findByPk(binder.statementId, { raw: true });
        if ( owner && owner.kind !== 'settlement' ) {
          bankBound = true;
          break;
        }
      }
      if ( bankBound ) {
        continue;
      }
      matches.push({ detail: detail, slip: slip, diff: diff });
    }
    if ( matches.length === 0 ) {
      continue;
    }
    matches.sort((a, b) => ( ( a.diff - b.diff ) || ( b.slip.id - a.slip.id ) ));
    const best = matches[ 0 ];
    suggestions.push({
      lineId: line.id,
      crossSlipDetailId: best.detail.id,
      slip: { id: best.slip.id, year: best.slip.year, month: best.slip.month, no: best.slip.no },
      amount: Number(line.amountIn),
      date: line.date,
      label: String(best.detail.application1 || '計算書')
    });
  }
  return suggestions;
};

// 通帳の入金行を、計算書の複合伝票の預金明細に紐付ける（照合=matched。
// 伝票は作らない）。投げられた候補（suggestSettlementDeposits）から呼ぶ。
// 二重紐付け（別のbank側の行が既に付いている）と一致しない金額は拒む
export const linkDepositToSettlement = async (statement, lineId, crossSlipDetailId) => {
  if ( statement.kind !== 'bank' ) {
    const err = new Error('通帳の明細ではありません。');
    err.name = 'BankReconcileError';
    throw err;
  }
  const line = await models.BankStatementLine.findByPk(parseInt(lineId, 10));
  if ( !line || Number(line.statementId) !== Number(statement.id) ) {
    const err = new Error('明細行がありません。');
    err.name = 'BankReconcileError';
    throw err;
  }
  if ( line.status !== 'unmatched' ) {
    const err = new Error('この行はすでに処理済みです。');
    err.name = 'BankReconcileError';
    throw err;
  }
  const detail = await models.CrossSlipDetail.findByPk(parseInt(crossSlipDetailId, 10), {
    include: [{ model: models.CrossSlip, as: 'crossSlip' }]
  });
  if ( !detail || !detail.crossSlip ) {
    const err = new Error('紐付先の伝票明細がありません。');
    err.name = 'BankReconcileError';
    throw err;
  }
  if ( Number(detail.debitAmount) !== Number(line.amountIn) ) {
    const err = new Error('金額が一致しません。');
    err.name = 'BankReconcileError';
    throw err;
  }
  // 別のbank側の行が既に付いていないか（計算書側のコ連結 screening の重複を防ぐ）
  const binders = await models.BankStatementLine.findAll({
    where: { crossSlipDetailId: detail.id }
  });
  for ( const binder of binders ) {
    if ( Number(binder.id) === Number(line.id) ) {
      continue;
    }
    const owner = await models.BankStatement.findByPk(binder.statementId);
    if ( owner && owner.kind !== 'settlement' ) {
      const err = new Error('この伝票明細にはすでに通帳の行が紐付いています。');
      err.name = 'BankReconcileError';
      throw err;
    }
  }
  line.status = 'matched';
  line.crossSlipDetailId = detail.id;
  await line.save();
  return line;
};

export default {
  autoMatch: autoMatch,
  suggestCardPayments: suggestCardPayments,
  suggestOpposites: suggestOpposites,
  makePattern: makePattern,
  learnOpposite: learnOpposite,
  learnFromSlip: learnFromSlip,
  bookLines: bookLines,
  selectForExpense: selectForExpense,
  settleStatement: settleStatement,
  settlementPreview: settlementPreview,
  findDepositMergeCandidates: findDepositMergeCandidates,
  mergeSettlementIntoDeposit: mergeSettlementIntoDeposit,
  suggestSettlementDeposits: suggestSettlementDeposits,
  linkDepositToSettlement: linkDepositToSettlement,
  reconcilePlaceholders: reconcilePlaceholders,
  rebookStatement: rebookStatement,
  TEMP_ACCOUNTS: TEMP_ACCOUNTS,
  isTempAccount: isTempAccount
};
