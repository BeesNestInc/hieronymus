import {numeric, round} from './utils.js';

export const findTaxRule = (id, taxRules) => {
  let rule = taxRules.find((r) => {
    return  (r.id === parseInt(id) )
  });
  return  (rule);
}

export const computeTax = (_amount, rule) => {
  let amount = numeric(_amount);
  let tax = 0;
  if  ( rule )  {
    switch	(rule.taxClass)	{
      case	0:
        tax = 0;
        break;
      case	1:
        tax = amount - (amount * 100 ) / ( rule.rate + 100 );
        break;
      case	2:
        tax = ( amount * rule.rate ) / 100 ;
        break;
    }
    tax = round(tax);
  }
  return  (tax);
}