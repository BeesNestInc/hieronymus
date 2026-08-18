import models from '../models/index.js';
import {getCompanyInfo, numeric} from './utils.js';
import {field} from './parse_account_code.js';

const Op = models.Sequelize.Op;

const round = (val, method) => {
  switch (method) {
    case 0:
      return Math.floor(val);
    case 1:
      return Math.ceil(val);
    default:
      return Math.round(val);
  }
};

const computeTax = (amount, rule, roundingMethod) => {
  let tax = 0;
  if ( rule ) {
    switch (rule.taxClass) {
      case 0:
        tax = 0;
        break;
      case 1:
        tax = amount - (amount * 100) / (rule.rate + 100);
        break;
      case 2:
        tax = (amount * rule.rate) / 100;
        break;
    }
    tax = round(tax, roundingMethod);
  }
  return tax;
};

const findTaxRule = (id, taxRules) => {
  if ( !id ) return undefined;
  return taxRules.find((r) => {
    return ( parseInt(r.id) === parseInt(id) );
  });
};

const findAccount = (accounts, code) => {
  if ( !code ) return undefined;
  return accounts.find((a) => {
    return ( a.code === code );
  });
};

const findTaxClass = (accounts, accountCode, subCode) => {
  let tax = 0;
  const account = findAccount(accounts, accountCode);
  if ( !account ) return tax;
  if ( account.subAccounts && account.subAccounts.length > 0 ) {
    const sub = account.subAccounts.find((s) => {
      return ( String(s.code) === String(subCode) );
    });
    if ( sub ) {
      tax = sub.taxClass;
    }
  } else {
    tax = account.taxClass;
  }
  return tax;
};

const isTaxAccount = (code) => {
  if ( !code ) return false;
  return ( Boolean(code.match(/^114|^308/)) );
};

export const normalizeLines = (lines) => {
  return (lines || []).map((line) => {
    const l = { ...line };
    if ( l.debitAccount === 'sundries' ) {
      l.debitAccount = null;
    }
    if ( l.creditAccount === 'sundries' ) {
      l.creditAccount = null;
    }
    l.debitAmount = numeric(l.debitAmount);
    l.creditAmount = numeric(l.creditAmount);
    l.debitTax = numeric(l.debitTax);
    l.creditTax = numeric(l.creditTax);
    return l;
  });
};

export const loadTaxContext = async (year, month) => {
  const info = await getCompanyInfo();
  const fromDate = new Date(year, month - 1, 2);
  const fy = await models.FiscalYear.findOne({
    where: {
      startDate: { [Op.lte]: fromDate },
      endDate: { [Op.gte]: fromDate }
    }
  });
  const date = `${year}-${String(month).padStart(2, '0')}-01`;
  const accounts = await models.Account.findAll({
    include: [
      { model: models.SubAccount, as: 'subAccounts' }
    ]
  });
  const taxRules = await models.TaxRule.findAll({
    where: {
      [Op.and]: [
        { [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: date } }] },
        { [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: date } }] }
      ]
    }
  });
  const normAccounts = accounts.map((acc) => {
    return {
      code: acc.accountCode,
      taxClass: acc.taxClass || 0,
      subAccounts: (acc.subAccounts || []).map((sub) => {
        return {
          code: sub.subAccountCode,
          taxClass: sub.taxClass || 0
        };
      })
    };
  });
  return {
    fy: fy,
    accounts: normAccounts,
    taxRules: taxRules,
    roundingMethod: info.roundingMethod
  };
};

const computeSideTax = (amount, taxRuleId, oppositeAccount, ctx, fy) => {
  const rule = findTaxRule(taxRuleId, ctx.taxRules);
  if ( isTaxAccount(oppositeAccount) ) {
    return 0;
  }
  if ( fy.taxIncluded ) {
    return 0;
  }
  if ( rule && (rule.taxClass !== 9) ) {
    return computeTax(amount, rule, ctx.roundingMethod);
  }
  return 0;
};

export const computeLineTaxes = (lines, ctx) => {
  const fy = ctx.fy;
  return lines.map((line) => {
    const l = { ...line };
    if ( l.creditAmount === '=' ) {
      l.creditAmount = l.debitAmount;
    }
    if ( l.creditAmount === '-' ) {
      const debit = lines.reduce((s, x) => s + numeric(x.debitAmount), 0);
      const credit = lines.reduce((s, x) => s + numeric(x.creditAmount), 0);
      l.creditAmount = debit - credit;
    }
    l.debitTax = computeSideTax(l.debitAmount, l.debitTaxRuleId, l.creditAccount, ctx, fy);
    l.creditTax = computeSideTax(l.creditAmount, l.creditTaxRuleId, l.debitAccount, ctx, fy);
    return l;
  });
};

export const makeTaxLine = (lines, ctx) => {
  const fy = ctx.fy;
  if ( fy.taxIncluded ) {
    return lines.map((l) => ({ ...l }));
  }
  const out = lines.map((l) => ({ ...l }));
  for ( const line of out ) {
    if ( isTaxAccount(line.creditAccount) || isTaxAccount(line.debitAccount) ) {
      line.debitAmount = 0;
      line.creditAmount = 0;
      line.debitTax = 0;
      line.creditTax = 0;
    }
  }
  for ( let i = 0; i < out.length; i += 1 ) {
    if ( out[i].debitTax > 0 ) {
      const debit = ( field(out[i].debitAccount) === '6' )
        ? '3080000'
        : ( field(out[i].debitAccount) === '7' ) ? '1140000' : undefined;
      let gap;
      for ( let j = i + 1; j < out.length; j += 1 ) {
        const line = out[j];
        if ( ( line.debitAccount === debit ) &&
             ( line.creditAccount === out[i].debitAccount ) &&
             ( line.creditSubAccount === out[i].debitSubAccount ) ) {
          gap = j;
        }
      }
      if ( gap === undefined ) {
        gap = out.length;
        out.push({ debitAmount: 0, debitTax: 0, creditAmount: 0, creditTax: 0 });
      }
      out[gap].debitAccount = debit;
      out[gap].debitAmount += numeric(out[i].debitTax);
      const rule = findTaxRule(out[i].debitTaxRuleId, ctx.taxRules);
      if ( rule && rule.taxClass !== 2 ) {
        out[gap].creditAccount = out[i].debitAccount;
        out[gap].creditSubAccount = out[i].debitSubAccount;
        out[gap].creditAmount += numeric(out[i].debitTax);
      }
    }
    if ( out[i].creditTax > 0 ) {
      const credit = ( field(out[i].creditAccount) === '6' )
        ? '3080000'
        : ( field(out[i].creditAccount) === '7' ) ? '1140000' : undefined;
      let gap;
      for ( let j = i + 1; j < out.length; j += 1 ) {
        const line = out[j];
        if ( ( line.creditAccount === credit ) &&
             ( line.debitAccount === out[i].creditAccount ) &&
             ( line.debitSubAccount === out[i].creditSubAccount ) ) {
          gap = j;
        }
      }
      if ( gap === undefined ) {
        gap = out.length;
        out.push({ debitAmount: 0, debitTax: 0, creditAmount: 0, creditTax: 0 });
      }
      out[gap].creditAccount = credit;
      out[gap].creditAmount += numeric(out[i].creditTax);
      const rule = findTaxRule(out[i].creditTaxRuleId, ctx.taxRules);
      if ( rule && rule.taxClass !== 2 ) {
        out[gap].debitAccount = out[i].creditAccount;
        out[gap].debitSubAccount = out[i].creditSubAccount;
        out[gap].debitAmount += numeric(out[i].creditTax);
      }
    }
  }
  return out;
};

export const recalcSlipLines = (lines, ctx) => {
  let normalized = normalizeLines(lines);
  normalized = computeLineTaxes(normalized, ctx);
  normalized = makeTaxLine(normalized, ctx);
  return normalized;
};

export const validateDay = (year, month, day) => {
  if ( ( !day ) || ( day < 1 ) || ( day > 31 ) ) {
    return '日付が正しくありません。';
  }
  return null;
};

export const validateLines = (lines, ctx) => {
  for ( let i = 0; i < lines.length; i += 1 ) {
    const line = lines[i];
    if ( ( line.debitAmount !== 0 ) && ( line.debitAmount ) ) {
      if ( !line.debitAccount ) {
        return `${i + 1}行目 : 借方科目が未入力です。`;
      }
      if ( !isTaxAccount(line.debitAccount) && !findAccount(ctx.accounts, line.debitAccount) ) {
        return `${i + 1}行目 : 借方科目に未登録の勘定科目が入力されています。`;
      }
    }
    if ( ( line.creditAmount !== 0 ) && ( line.creditAmount ) ) {
      if ( !line.creditAccount ) {
        return `${i + 1}行目 : 貸方科目が未入力です。`;
      }
      if ( !isTaxAccount(line.creditAccount) && !findAccount(ctx.accounts, line.creditAccount) ) {
        return `${i + 1}行目 : 貸方科目に未登録の勘定科目が入力されています。`;
      }
    }
  }
  return null;
};

export const validateBalanced = (lines) => {
  let debit = 0;
  let credit = 0;
  for ( const line of lines ) {
    debit += numeric(line.debitAmount);
    credit += numeric(line.creditAmount);
  }
  if ( debit !== credit ) {
    return '借方の金額と貸方の合計金額が不一致です。';
  }
  return null;
};

export const computeVoucherTax = (amount, taxRuleId, ctx) => {
  const rule = findTaxRule(taxRuleId, ctx.taxRules);
  if ( !rule ) {
    return 0;
  }
  return computeTax(numeric(amount), rule, ctx.roundingMethod);
};

export default {
  normalizeLines: normalizeLines,
  loadTaxContext: loadTaxContext,
  recalcSlipLines: recalcSlipLines,
  validateDay: validateDay,
  validateLines: validateLines,
  validateBalanced: validateBalanced,
  computeVoucherTax: computeVoucherTax
};