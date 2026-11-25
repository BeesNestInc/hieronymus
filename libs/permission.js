const ANY = 'any';

const PUBLIC_PATHS = [
  { match: /^\/user\/login$/, method: 'POST' },
  { match: /^\/user\/signup$/, method: 'POST' },
  { match: /^\/setup$/, method: 'POST' },
  { match: /^\/version$/, method: 'GET' },
  // 予定表のICSフィード。購読クライアント（Googleカレンダー等）はセッション
  // Cookieを持てないためトークン付きURLで認証する（ハンドラ内でtoken照合。
  // 存在しないトークンは404）。guard は未登録パスをデフォルト拒否するので
  // ここへの登録が必須
  { match: /^\/schedule\/feed$/, method: 'GET' }
];

const RULES = [
  { match: /^\/accounts\/?$/, methods: ['GET'], access: ANY },
  { match: /^\/accounts2\/.+$/, methods: ['GET'], access: ANY },
  { match: /^\/accounts4\/.+$/, methods: ['GET'], access: ANY },
  { match: /^\/accounts3\/.+$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/account\/.+$/, methods: ['GET'], access: ANY },
  { match: /^\/account-class\/.+$/, methods: ['GET'], access: ANY },
  { match: /^\/account-class\/?$/, methods: ['POST'], access: ['accounting'] },
  { match: /^\/account-class\/.+$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/account\/.+$/, methods: ['POST', 'PUT', 'DELETE'], access: ['accounting'] },
  { match: /^\/sub_account\/.+$/, methods: ['POST', 'PUT', 'DELETE'], access: ['accounting'] },

  { match: /^\/company\/info$/, methods: ['GET'], access: ANY },
  { match: /^\/company\/info$/, methods: ['PUT'], access: ['companyManagement', 'accounting'] },
  { match: /^\/company\/kinds$/, methods: ['GET'], access: ANY },
  { match: /^\/company\/kinds$/, methods: ['PUT'], access: ['companyManagement', 'accounting'] },
  { match: /^\/company(\/\d+)?\/?$/, methods: ['GET'], access: ANY },
  { match: /^\/company/, methods: ['POST', 'PUT', 'DELETE'], access: ['companyManagement', 'accounting'] },

  { match: /^\/voucher\/classes\/?$/, methods: ['GET'], access: ANY },
  { match: /^\/voucher\/classes\/?$/, methods: ['PUT'], access: ['administrable', 'accounting', 'companyManagement'] },
  { match: /^\/voucher\/files\/\d+\/?$/, methods: ['GET'], access: ANY },
  { match: /^\/voucher\/upload/, methods: ['POST'], access: ANY },
  { match: /^\/voucher\/bind\/?$/, methods: ['PUT'], access: ANY },
  { match: /^\/voucher(\/\d+)?\/?$/, methods: ['GET'], access: ANY },
  { match: /^\/voucher(\/\d+)?\/?$/, methods: ['POST'], access: ANY },
  { match: /^\/voucher(\/\d+)?\/?$/, methods: ['PUT'], access: ANY },
  { match: /^\/voucher(\/\d+)?\/?$/, methods: ['DELETE'], access: ANY },
  { match: /^\/voucher\/file\/?$/, methods: ['DELETE'], access: ANY },

  { match: /^\/cross_slip\/approve$/, methods: ['PUT'], access: ['approvable'] },
  // 伝票の読み取りは承認権限にも開ける（承認のために中身を見る必要が
  // ある。ホームの承認待ちカードはここへリンクするので、上長・
  // チームリーダーなど会計権限のない承認者も読めないと承認ができない）
  { match: /^\/cross_slip\/\d+\/\d+\/\d+$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing', 'approvable'] },
  { match: /^\/cross_slips\/.+$/, methods: ['GET'], access: ANY },
  // 伝票の新規作成は会計・承認権限に限定する（一般ユーザーがAPIから直接
  // 伝票を起票しない。作成された伝票は承認状態管理の対象）
  { match: /^\/cross_slip$/, methods: ['POST'], access: ['accounting', 'approvable'] },
  { match: /^\/cross_slip$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/cross_slip$/, methods: ['DELETE'], access: ANY },

  { match: /^\/cross-slip-detail\/\d+$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/cross-slip-detail$/, methods: ['PUT'], access: ['accounting'] },

  { match: /^\/expense_report\/approve$/, methods: ['PUT'], access: ['approvable'] },
  { match: /^\/expense_report\/slip\/\d+$/, methods: ['GET'], access: ANY },
  { match: /^\/expense_report\/slip$/, methods: ['DELETE'], access: ['approvable'] },
  { match: /^\/expense_reports(\/.*)?$/, methods: ['GET'], access: ANY },
  { match: /^\/expense_report\/ai_available$/, methods: ['GET'], access: ANY },
  { match: /^\/expense_report\/tasks$/, methods: ['GET'], access: ANY },
  // 出金仮統合の手動突合（マージ候補の一覧と実行）。e0554aaで追加時に許可表が
  // 追随しておらず403石碑になっていた（一般ユーザーにはhandler側の
  // canAccessAll（会計/承認権限）で絞り込むため表はANY）
  { match: /^\/expense_report\/merge_candidates$/, methods: ['GET'], access: ANY },
  { match: /^\/expense_report\/\d+\/merge_spend$/, methods: ['POST'], access: ANY },
  // 未整理証憑のまるっとアップロード（精算書単位/浮遊のどちらも一般ユーザーから）
  { match: /^\/expense_report\/vouchers(\/\d+)?$/, methods: ['POST'], access: ANY },
  // 未整理証憑の分離（AI不使用の幾何検出。証憑作成者か会計が対象者なら誰でも）
  { match: /^\/expense_report\/voucher_split$/, methods: ['POST'], access: ANY },
  // 証憑画像の90°回転（手動補正）
  { match: /^\/expense_report\/voucher_rotate$/, methods: ['POST'], access: ANY },
  { match: /^\/expense_report(\/\d+)?$/, methods: ['GET'], access: ANY },
  { match: /^\/expense_report$/, methods: ['POST'], access: ANY },
  { match: /^\/expense_report$/, methods: ['PUT'], access: ANY },
  { match: /^\/expense_report$/, methods: ['DELETE'], access: ANY },
  { match: /^\/expense_report\/ocr$/, methods: ['POST'], access: ANY },
  { match: /^\/expense_mapping$/, methods: ['GET'], access: ANY },
  { match: /^\/expense_mapping$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/expense_mapping\/.+$/, methods: ['GET'], access: ANY },
  { match: /^\/expense_mapping\/.+$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/karibarai\/\d+$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },

  // 明細取込。GET/upload/select は ANY だが、routes/api_bank_statement.js 側で
  // 銀行・カード明細は会計権限、個人カード明細は本人のみに絞り込む。
  // 突合・起票・行更新・削除は会計権限のみ
  // ホームの「通帳の対応待ち」一覧（未照合と仮起票の行）。会計権限のみ
  { match: /^\/bank_statement\/pending$/, methods: ['GET'], access: ['accounting'] },
  { match: /^\/bank_statement\/versions$/, methods: ['GET'], access: ANY },
  { match: /^\/bank_statement(\/\d+)?$/, methods: ['GET'], access: ANY },
  { match: /^\/bank_statement\/file\/\d+$/, methods: ['GET'], access: ANY },
  { match: /^\/bank_statement\/(preview|upload)$/, methods: ['POST'], access: ANY },
  // プロファイル起草と保存は会計権限（config/banksへの書き込みを伴う）
  { match: /^\/bank_statement\/profile$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/bank_statement\/profile_draft$/, methods: ['POST'], access: ['accounting'] },
  { match: /^\/bank_statement\/\d+\/(match|book|rebook)$/, methods: ['POST'], access: ['accounting'] },
  // 統合候補の参照と実行（計算書ビューの「入金仮伝票と統合」）
  { match: /^\/bank_statement\/\d+\/merge_candidates$/, methods: ['GET'], access: ['accounting'] },
  { match: /^\/bank_statement\/\d+\/merge_settlement$/, methods: ['POST'], access: ['accounting'] },
  // settle は計算書（kind: settlement）の1伝票化起票。link_settlement は
  // 通帳の入金行を計算書伝票の預金明細へ紐付ける。どちらも起票に準ずる
  // 会計操作（この2つは追加時に許可表が追従しておらず403石碑になっていた）
  { match: /^\/bank_statement\/\d+\/(settle|link_settlement|unsettle)$/, methods: ['POST'], access: ['accounting'] },
  { match: /^\/bank_statement\/\d+\/select$/, methods: ['POST'], access: ANY },
  { match: /^\/bank_statement\/\d+$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/bank_statement\/line\/\d+$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/bank_statement(\/\d+)?$/, methods: ['DELETE'], access: ['accounting'] },

  // 学習ルール（明細取込の相手方仕訳を決める正規ルール）。閲覧は閲覧権限も、
  // 変更は会計権限のみ
  { match: /^\/financial$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/financial$/, methods: ['POST'], access: ['accounting'] },
  { match: /^\/financial\/\d+$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/financial\/\d+$/, methods: ['DELETE'], access: ['accounting'] },
  { match: /^\/bank_statement_rule$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/bank_statement_rule$/, methods: ['POST'], access: ['accounting'] },
  { match: /^\/bank_statement_rule\/candidates$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/bank_statement_rule\/ai_candidates$/, methods: ['POST'], access: ['accounting'] },
  { match: /^\/bank_statement_rule\/merge_rules$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/bank_statement_rule\/merge_rules$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/bank_statement_rule\/match_rules$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/bank_statement_rule\/match_rules$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/bank_statement_rule\/\d+$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/bank_statement_rule\/\d+$/, methods: ['DELETE'], access: ['accounting'] },

  { match: /^\/journal/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/ledger/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/remaining/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/trial-balance/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/changes/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/closing/, access: ['accounting', 'fiscalBrowsing'] },

  { match: /^\/tax-rule/, methods: ['GET'], access: ANY },
  { match: /^\/tax-rule/, methods: ['PUT'], access: ['accounting'] },
  // 年度の確定と取り消しは管理権限のみ。確定は全データを不変にする
  // コミット操作（確定後は管理権限でも通常編集不可）で、会計権限の
  // 経理部員が押せるものではない（取消しと対称にする）
  { match: /^\/term\/\d+\/unlock$/, methods: ['PUT'], access: ['administrable'] },
  { match: /^\/term\/\d+\/lock$/, methods: ['PUT'], access: ['administrable'] },
  { match: /^\/term\/\d+$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/term/, methods: ['GET'], access: ANY },

  { match: /^\/transaction/, access: ['companyManagement'] },
  { match: /^\/task/, access: ['companyManagement'] },
  { match: /^\/document/, access: ['companyManagement', 'accounting'] },
  { match: /^\/item/, methods: ['GET'], access: ANY },
  { match: /^\/item/, methods: ['POST', 'PUT', 'DELETE'], access: ['companyManagement', 'accounting'] },

  { match: /^\/projects$/, methods: ['GET'], access: ANY },
  { match: /^\/project/, access: ['companyManagement', 'accounting'] },
  { match: /^\/labels/, access: ['companyManagement', 'accounting'] },
  { match: /^\/label/, access: ['companyManagement', 'accounting'] },
  { match: /^\/project-summary/, access: ['companyManagement', 'accounting'] },

  { match: /^\/user\/password$/, methods: ['PUT'], access: ANY },
  { match: /^\/user$/, methods: ['GET'], access: ANY },
  { match: /^\/user\/\d+$/, methods: ['GET'], access: ANY },
  // 担当者候補（案件・取引の「担当」選択用）。handlerは社員の{id,名前}しか
  // 返さない（連絡先・権限フラグ等は出ない）ので、GET /userのid+名前と同じ
  // 理由で全員に開ける。開けないと営業（顧客管理）が担当を入れられない
  // （案件・取引管理ページがこのリストを引いている）
  { match: /^\/users\/member$/, methods: ['GET'], access: ANY },
  { match: /^\/users/, methods: ['GET'], access: ['administrable', 'personnelManagement', 'personnelBrowsing'] },
  { match: /^\/users/, methods: ['POST', 'PUT', 'DELETE'], access: ['administrable', 'personnelManagement'] },
  { match: /^\/user/, access: ['administrable'] },

  // 人事データ。参照は人事管理権限・人事閲覧権のみ（管理者でも直接は
  // できない。管理者はユーザー権限の操作だけ。役職員をいじるときは
  // 人事管理権限を（自分に）与える）。書き込みは人事管理権限のみ
  { match: /^\/member/, methods: ['GET'], access: ['personnelManagement', 'personnelBrowsing'] },
  { match: /^\/member/, methods: ['POST', 'PUT', 'DELETE'], access: ['personnelManagement'] },
  // Sticky（付箋・申し送り）。付箋は特定権限を要求しない（ログイン済み全員が
  // 「画面に付箋を貼る」感覚で使う。guard は未登録パスをデフォルト拒否するため
  // 明示的に ANY を置く必要がある）
  { match: /^\/sticky/, access: ANY },

  // 予定表（資金繰り予定）。入出金予定自体はそこまで機微ではないため、
  // 会計閲覧権（偉い人用の閲覧権限）に開ける。編集は会計・管理者。
  // フィードはトークン認証（PUBLIC_PATHSでguard回避、ハンドラでtoken照合）
  { match: /^\/schedule\/token$/, methods: ['POST'], access: ['accounting', 'fiscalBrowsing', 'administrable'] },
  { match: /^\/schedule(\/year\/\d+|\/\d+\/\d+)?$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing', 'administrable'] },
  { match: /^\/schedule/, methods: ['POST', 'PUT', 'DELETE'], access: ['accounting', 'administrable'] },

  // マイページ（カスタムメニュー）。全ユーザーが自分のページを作成・編集できる
  // （所有権の判定は api_menu.js 側。他人やテンプレートの変更は不可）。
  // テンプレート一覧の閲覧は全員。テンプレートへの公開は管理者
  { match: /^\/menu\/templates$/, methods: ['GET'], access: ANY },
  { match: /^\/menu\/publish/, methods: ['POST'], access: ['administrable'] },
  { match: /^\/menu(\/\d+)?$/, methods: ['GET', 'POST', 'PUT', 'DELETE'], access: ANY },

  // AI管理権限（aiManage）: プロンプトの世代管理とAI設定（llms群）。
  // /admin/llms は /admin 汎用ルール（administrable）より先に当てる
  { match: /^\/admin\/llms$/, methods: ['GET', 'PUT'], access: ['aiManage'] },
  { match: /^\/prompts/, methods: ['GET', 'PUT', 'POST', 'DELETE'], access: ['aiManage'] },

  { match: /^\/admin/, access: ['administrable'] }
];

const isPublic = (req) => {
  return PUBLIC_PATHS.some((p) => p.match.test(req.path) && (p.method === req.method));
};

const apiAuth = (req, res, next) => {
  if ( req.session && req.session.user ) {
    return next();
  }
  res.status(401).json({ code: -10, message: 'not authenticated' });
};

const hasRole = (user, access) => {
  return access.some((role) => user[role]);
};

const authorize = (req, res, next) => {
  const user = req.session.user;
  for ( const rule of RULES ) {
    if ( rule.methods && (rule.methods.indexOf(req.method) < 0) ) {
      continue;
    }
    if ( !rule.match.test(req.path) ) {
      continue;
    }
    if ( rule.access === ANY ) {
      return next();
    }
    if ( hasRole(user, rule.access) ) {
      return next();
    }
    return res.status(403).json({ code: -10, message: 'permission denied' });
  }
  res.status(403).json({ code: -10, message: 'permission denied' });
};

export const guard = (req, res, next) => {
  if ( isPublic(req) ) {
    return next();
  }
  apiAuth(req, res, (err) => {
    if ( err ) {
      return next(err);
    }
    authorize(req, res, next);
  });
};

// ---- 403石碑の検知（起動時lint） ----
// guardは未登録パスをデフォルト拒否する。この安全装置の裏返しとして、
// エンドポイントを追加して許可表（RULES/PUBLIC_PATHS）へ登録し忘れると、
// その機能は誰にも403で使えなくなる（「403石碑」。実史: merge_candidates、
// settle、link_settlement）。ここではexpressルータのスタックから実登録
// されている(メソッド, パス)を取り出し、表に載っていないものを列挙する。
// app.jsの起動時に実行して警告し、test/permission.test.jsで未登録ゼロを
// 断言することで、追加忘れをコミット前に潰す。

// :param を具体値に置き換えてguardと同じ照合ができる形にする
export const concretePath = (path) => {
  return path.replace(/:(\w+)/g, (m, key) => {
    if ( key === 'term' || key === 'year' ) return '2026';
    if ( key === 'month' ) return '10';
    if ( key === 'no' ) return '1';
    return '5';
  });
};

// guardと同じ判定で(メソッド, パス)が表に載っているか
export const isRegistered = (method, path) => {
  if ( PUBLIC_PATHS.some((p) => p.match.test(path) && p.method === method) ) {
    return true;
  }
  for ( const rule of RULES ) {
    if ( rule.methods && (rule.methods.indexOf(method) < 0) ) {
      continue;
    }
    if ( !rule.match.test(path) ) {
      continue;
    }
    return true;
  }
  return false;
};

// ルータ（app.use('/api', router)に渡したもの）から未登録エンドポイントを列挙
export const lintRoutes = (router) => {
  const misses = [];
  if ( !router || !router.stack ) {
    return misses;
  }
  for ( const layer of router.stack ) {
    if ( !layer.route ) {
      continue;
    }
    const path = concretePath(layer.route.path);
    for ( const method of Object.keys(layer.route.methods) ) {
      // expressはHEADをGET扱いで登録してくるので除外する
      if ( method === 'head' ) {
        continue;
      }
      if ( !isRegistered(method.toUpperCase(), path) ) {
        misses.push(`${method.toUpperCase()} /api${layer.route.path}`);
      }
    }
  }
  return misses;
};

export default {
  guard: guard
};