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
  { match: /^\/account\/.+$/, methods: ['POST', 'PUT', 'DELETE'], access: ['accounting'] },
  { match: /^\/sub_account\/.+$/, methods: ['POST', 'PUT', 'DELETE'], access: ['accounting'] },

  { match: /^\/company\/info$/, methods: ['GET'], access: ANY },
  { match: /^\/company\/info$/, methods: ['PUT'], access: ['companyManagement', 'accounting'] },
  { match: /^\/company\/kinds$/, methods: ['GET'], access: ANY },
  { match: /^\/company\/kinds$/, methods: ['PUT'], access: ['companyManagement', 'accounting'] },
  { match: /^\/company(\/\d+)?$/, methods: ['GET'], access: ANY },
  { match: /^\/company/, methods: ['POST', 'PUT', 'DELETE'], access: ['companyManagement', 'accounting'] },

  { match: /^\/voucher\/classes$/, methods: ['GET'], access: ANY },
  { match: /^\/voucher\/files\/\d+$/, methods: ['GET'], access: ANY },
  { match: /^\/voucher\/upload/, methods: ['POST'], access: ANY },
  { match: /^\/voucher\/bind$/, methods: ['PUT'], access: ANY },
  { match: /^\/voucher(\/\d+)?$/, methods: ['GET'], access: ANY },
  { match: /^\/voucher(\/\d+)?$/, methods: ['POST'], access: ANY },
  { match: /^\/voucher(\/\d+)?$/, methods: ['PUT'], access: ANY },
  { match: /^\/voucher(\/\d+)?$/, methods: ['DELETE'], access: ANY },
  { match: /^\/voucher\/file$/, methods: ['DELETE'], access: ANY },

  { match: /^\/cross_slip\/approve$/, methods: ['PUT'], access: ['approvable'] },
  { match: /^\/cross_slip\/\d+\/\d+\/\d+$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/cross_slips\/.+$/, methods: ['GET'], access: ANY },
  { match: /^\/cross_slip$/, methods: ['POST'], access: ANY },
  { match: /^\/cross_slip$/, methods: ['PUT'], access: ['accounting'] },
  { match: /^\/cross_slip$/, methods: ['DELETE'], access: ['approvable'] },

  { match: /^\/cross-slip-detail\/\d+$/, methods: ['GET'], access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/cross-slip-detail$/, methods: ['PUT'], access: ['accounting'] },

  { match: /^\/journal/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/ledger/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/remaining/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/trial-balance/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/changes/, access: ['accounting', 'fiscalBrowsing'] },
  { match: /^\/closing/, access: ['accounting', 'fiscalBrowsing'] },

  { match: /^\/tax-rule/, methods: ['GET'], access: ANY },
  { match: /^\/tax-rule/, methods: ['PUT'], access: ['accounting'] },
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