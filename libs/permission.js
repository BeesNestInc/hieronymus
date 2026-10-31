const ANY = 'any';

const PUBLIC_PATHS = [
  { match: /^\/user\/login$/, method: 'POST' },
  { match: /^\/user\/signup$/, method: 'POST' },
  { match: /^\/setup$/, method: 'POST' },
  { match: /^\/version$/, method: 'GET' }
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
  { match: /^\/cross_slip\/\d+\/\d+\/\d+$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/cross_slips\/.+$/, methods: ['GET'], access: ANY },
  { match: /^\/cross_slip$/, methods: ['POST'], access: ANY },
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
  { match: /^\/bank_statement(\/\d+)?$/, methods: ['GET'], access: ANY },
  { match: /^\/bank_statement\/file\/\d+$/, methods: ['GET'], access: ANY },
  { match: /^\/bank_statement\/(preview|upload)$/, methods: ['POST'], access: ANY },
  { match: /^\/bank_statement\/\d+\/(match|book|rebook)$/, methods: ['POST'], access: ['accounting'] },
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
  { match: /^\/term\/\d+\/unlock$/, methods: ['PUT'], access: ['administrable'] },
  { match: /^\/term\/\d+\/lock$/, methods: ['PUT'], access: ['accounting', 'administrable'] },
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
  { match: /^\/users/, access: ['administrable', 'personnelManagement'] },
  { match: /^\/user/, access: ['administrable'] },

  { match: /^\/member/, methods: ['GET'], access: ['administrable', 'personnelManagement'] },
  { match: /^\/member/, methods: ['POST', 'PUT', 'DELETE'], access: ['administrable', 'personnelManagement'] },
  { match: /^\/menu/, access: ['administrable'] },
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

export default {
  guard: guard
};