const field = (code) => {
  const c = String(code);
  return c.substring(c.length - 8, c.length - 6);
};

const round = (val, method) => {
  switch ( method ) {
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
    switch ( rule.taxClass ) {
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
  return taxRules.find((r) => parseInt(r.id) === parseInt(id));
};

const findTaxClass = (accounts, accountCode, subCode) => {
  let tax = 0;
  const account = accounts.find((a) => a.code === accountCode);
  if ( !account ) return tax;
  if ( account.subAccounts && account.subAccounts.length > 0 ) {
    const sub = account.subAccounts.find((s) => String(s.code) === String(subCode));
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
  return Boolean(String(code).match(/^114|^308/));
};

const numeric = (s) => {
  if ( typeof s === 'number' ) return s;
  if ( !s ) return 0;
  return parseInt(String(s).replace(/[^\d-]/g, ''), 10) || 0;
};

const computeLineTaxes = (lines, ctx) => {
  return lines.map((line) => {
    const l = { ...line };
    const computeSide = (amount, taxRuleId, oppositeAccount) => {
      const rule = findTaxRule(taxRuleId, ctx.taxRules);
      if ( isTaxAccount(oppositeAccount) ) return 0;
      if ( ctx.fy.taxIncluded ) return 0;
      if ( rule && (rule.taxClass !== 9) ) {
        return computeTax(numeric(amount), rule, ctx.roundingMethod);
      }
      return 0;
    };
    l.debitAmount = numeric(l.debitAmount);
    l.creditAmount = numeric(l.creditAmount);
    l.debitTax = computeSide(l.debitAmount, l.debitTaxRuleId, l.creditAccount);
    l.creditTax = computeSide(l.creditAmount, l.creditTaxRuleId, l.debitAccount);
    return l;
  });
};

const makeTaxLine = (lines, ctx) => {
  const out = lines.map((l) => ({ ...l }));
  if ( ctx.fy.taxIncluded ) {
    return out;
  }
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
        out.push({ debitAccount: null, debitAmount: 0, debitTax: 0, creditAccount: null, creditAmount: 0, creditTax: 0 });
      }
      out[gap].debitAccount = debit;
      out[gap].debitAmount += out[i].debitTax;
      const rule = findTaxRule(out[i].debitTaxRuleId, ctx.taxRules);
      if ( rule && rule.taxClass !== 2 ) {
        out[gap].creditAccount = out[i].debitAccount;
        out[gap].creditSubAccount = out[i].debitSubAccount;
        out[gap].creditAmount += out[i].debitTax;
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
        out.push({ debitAccount: null, debitAmount: 0, debitTax: 0, creditAccount: null, creditAmount: 0, creditTax: 0 });
      }
      out[gap].creditAccount = credit;
      out[gap].creditAmount += out[i].creditTax;
      const rule = findTaxRule(out[i].creditTaxRuleId, ctx.taxRules);
      if ( rule && rule.taxClass !== 2 ) {
        out[gap].debitAccount = out[i].creditAccount;
        out[gap].debitSubAccount = out[i].creditSubAccount;
        out[gap].debitAmount += out[i].creditTax;
      }
    }
  }
  return out;
};

export const previewSlip = (lines, ctx) => {
  let result = computeLineTaxes(lines, ctx);
  result = makeTaxLine(result, ctx);
  return result;
};

export default {
  previewSlip: previewSlip
};