import {numeric} from '../../libs/utils.js';

export const elementIndex = (element) => {
  return parseInt(element.id.match(/.*\[(\d+)\]/)[1]);
}
export const elementDc = (element) => {
  return element.id.split('-')[0];
}

let accounts;

export const findAccount = (code) => {
  //console.log(`account [${code}]`);
  let account = { name: '', key: ''};
  if ( accounts ) {
    for ( let i = 0; i < accounts.length; i ++ ) {
      if ( accounts[i].code == code ) {
        account = accounts[i];
        break;
      }
    }
  }
  return account;
}
export const findSubAccount = (account, code) => {
  let sub_account = { name: '', key: ''};
  
  if	( ( account ) &&
      ( account.subAccounts ) ) {
    for ( let i = 0; i < account.subAccounts.length; i ++ ) {
      if ( account.subAccounts[i].code == code ) {
        sub_account = account.subAccounts[i];
        break;
      }
    }
  }
  return sub_account;
}

export const findSubAccountByCode = (account_code, code) => {
  let sub_account = { name: '', key: ''};

  let account = findAccount(account_code);

  if ( account.subAccounts ) {
    for ( let i = 0; i < account.subAccounts.length; i ++ ) {
      if ( account.subAccounts[i].code == code ) {
        sub_account = account.subAccounts[i];
        break;
      }
    }
  }
  return sub_account;
}

export const findTaxClass = (ac, sub) => {
  let tax = 0;
  //console.log(ac, sub);
  for ( let i = 0; i < accounts.length; i ++ ) {
    let account = accounts[i];
    if ( account.code == ac ) {
      if ( account.subAccounts ) {
        for ( let j = 0 ; j < account.subAccounts.length; j ++ ) {
          let sub_account = account.subAccounts[j];
          if ( sub_account.code == sub ) {
            tax = sub_account.taxClass;
            break;
          }
        }
      } else {
        tax = account.taxClass;
      }
      break;
    }
  }
  return tax;
}

export const setAccounts = (arg) => {
  accounts = arg;
}

export const invoiceStatus = (code) => {
  if  ( code )  {
    switch  (code)  {
      case  11:
        return  ('見積');
        break;
      case  21:
        return  ('受注');
        break;
      case  31:
        return  ('請求');
        break;
      case  32:
        return  ('回収');
        break;
      default:
        return  ('その他');
        break;
    }
  }else{
    return  ('未設定');
  }
}

export const salesTax = (tax_class, _amount) => {
  let amount = numeric(_amount);
  let tax;
  switch ( parseInt(tax_class) ) {
    case 1:
    tax = Math.round(amount - amount / 110 * 100);
    break;
    case 2:
    tax = Math.round(amount * 0.1);
    break;
    default:
    tax = '';
    break;
  }
  //console.log('tax', tax);
  return	(tax)
}

export const taxClass = (taxClass) => {
  switch(taxClass) {
    case 0:
      return ("");
    case 1:
      return ('内税');
    case 2:
      return ('外税');
    case 9:
      return ('別計算');
  }
  return ('');
}
export default {
  setAccounts: setAccounts,
  findAccount: findAccount,
  findSubAccount: findSubAccount,
  findSubAccount_by_code: findSubAccountByCode,
  findTaxClass: findTaxClass,
  elementIndex: elementIndex,
  elementDc: elementDc,
  invoiceStatus: invoiceStatus,
  salesTax: salesTax,
  taxClass: taxClass,
}

