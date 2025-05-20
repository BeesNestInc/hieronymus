import {dc, numeric} from './parse_account_code.js';
import {findAccount, findSubAccountByCode, taxClass} from '../front/javascripts/cross-slip.js';

export const ledgerLines = (account_code, sub_account_code, remaining, details) => {
  //console.log({remaining});
  let lines = [];
  let sums;
  if  ( !remaining )  {
    remaining = {
      debit: 0,
      credit: 0,
      balance: 0
      }
  }
  if  ( dc(account_code) == 'D' )    {
    sums = {
      debitAmount: numeric(remaining.balance),
      debitTax: 0,
      creditAmount: 0, 
      creditTax: 0,
      balance: numeric(remaining.balance)
    };
  } else {
    sums = {
      debitAmount: 0,
      debitTax: 0,
      creditAmount: numeric(remaining.balance),
      creditTax: 0,
      balance: numeric(remaining.balance)
    };
  }
  let pickup = {
    balance: sums.balance
  };

  for (let i = 0; i < details.length; i++) {
    let detail = details[i];

    let debitAmount;
    let creditAmount;
    let debitTax;
    let creditTax;
    let otherAccount;
    let otherSubAccount;
    let thisAccount;
    let thisSubAccount;
    let thisTaxRule;
    let otherTaxRule;
    let pureDebitAmount;
    let pureCreditAmount;
    let pureDebitTax;
    let pureCreditTax;
    let showDebit;
    let showCredit;

    //  本体と税の正規化
    pureDebitTax = numeric(detail.debitTax);
    debitAmount = numeric(detail.debitamount);
    if  ( detail.debitAccount ) {
      pureDebitAmount = debitAmount;              //  元帳を税込で作る
    } else {
      debitAmount = 0;
      pureDebitAmount = 0;
    }
    pureCreditTax = numeric(detail.creditTax);
    creditAmount = numeric(detail.creditAmount)
    if  ( detail.creditAccount ) {
      pureCreditAmount = creditAmount;
    } else {
      creditAmount = 0;
      pureCreditAmount = 0;
    }

    if  (((sub_account_code) &&
          (sub_account_code == detail.debitSubAccount) &&
          (account_code == detail.debitAccount)) ||
         ((!sub_account_code) &&
          (account_code == detail.debitAccount))) {
      //  借方が帳簿の科目と一致している
      thisAccount = detail.debitAccount;
      thisSubAccount = detail.debitSubAccount;
      thisTaxRule = detail.debitTaxRule;
      otherAccount = detail.creditAccount;
      otherSubAccount = detail.creditSubAccount;
      otherTaxRule = detail.creditTaxRule;

      sums.debitAmount += pureDebitAmount;
      sums.debitTax += pureDebitTax;
      showDebit = true;
      if  (((sub_account_code) &&
            (sub_account_code == detail.creditSubAccount) &&
            (account_code == detail.creditAccount)) ||
           ((!sub_account_code) &&
            (account_code == detail.creditAccount)))  {
        //  同じ勘定科目で補助科目が異なる場合の振替は、双方表示する。
        showCredit = true;
        sums.creditAmount += pureCreditAmount;
        sums.creditTax += pureCreditTax;
        if (dc(account_code) == 'D') {
          sums.balance += pureDebitAmount - pureCreditAmount;
        } else {
          sums.balance -= pureDebitAmount - pureCreditAmount;
        }
      } else {
        showCredit = false;
        creditAmount = '';
        creditTax = '';
        if (dc(account_code) == 'D') {
          sums.balance += pureDebitAmount;
        } else {
          sums.balance -= pureDebitAmount;
        }
      }
    } else {
      //  貸方が帳簿の科目と一致している
      thisAccount = detail.creditAccount;
      thisSubAccount = detail.creditSubAccount;
      thisTaxRule = detail.creditTaxRule;
      otherAccount = detail.debitAccount;
      otherSubAccount = detail.debitSubAccount;
      otherTaxRule = detail.debitTaxRule;
      //console.log(otherAccount);

      sums.creditAmount += pureCreditAmount;
      sums.creditTax += pureCreditTax;
      showCredit = true;
      if  (((sub_account_code) &&
            (sub_account_code == detail.debitSubAccount) &&
            (account_code == detail.debitAccount)) ||
           ((!sub_account_code) &&
            (account_code == detail.debitAccount)))   {
        showDebit = true;
        sums.debitAmount += pureDebitAmount;
        sums.debitTax += pureDebitTax;
        if (dc(account_code) == 'D') {
          sums.balance -= pureCreditAmount - pureDebitAmount;
        } else {
          sums.balance += pureCreditAmount - pureDbitAmount;
        }
      } else {
        showDebit = false;
        debitAmount = '';
        debitTax = '';
        if (dc(account_code) == 'D') {
          sums.balance -= pureCreditAmount;
        } else {
          sums.balance += pureCreditAmount;
        }
      }
    }
    lines.push({
      year: detail.crossSlip.year,
      month: detail.crossSlip.month,
      day: detail.crossSlip.day,
      approvedAt: detail.crossSlip.approvedAt,
      no: detail.crossSlip.no,

      accountCode: account_code,
      subAccountCode: thisSubAccount,

      subAccount: findSubAccountByCode(account_code, thisSubAccount).name,
      otherAccount: (findAccount(otherAccount).name == '') ? '諸口' : findAccount(otherAccount).name,
      otherSubAccount: findSubAccountByCode(otherAccount, otherSubAccount).name,

      thisTaxRule: thisTaxRule ? thisTaxRule.label : '',
      otherTaxRule: otherTaxRule ? otherTaxRule.label : '',
      debitTaxRule: detail.debitTaxRule ? detail.debitTaxRule.label : '',
      creditTaxRule: detail.creditTaxRule ? detail.creditTaxRule.label : '',

      application1: detail.application1,
      application2: detail.application2,

      debitVoucher: detail.debitVoucher,
      creditVoucher: detail.creditVoucher,

      otherAccountCode: otherAccount,
      otherSubAccountCode: otherSubAccount,
      pureDebitAmount: pureDebitAmount,
      pureDebitTax: pureDebitTax,
      pureCreditAmount: pureCreditAmount,
      pureCreditTax: pureCreditTax,
      pureBalance: sums.balance,
      debitAmount: debitAmount,
      creditAmount: creditAmount,
      showDebit: showDebit,
      showCredit: showCredit
    });
  }
/*
  if  ( dc(account_code) == 'D' )    {
    sums.creditAmount += sums.balance;
  } else {
    sums.debitAmount += sums.balance;
  }
*/
  return ({
    lines: lines,
    sums: sums,
    pickup: pickup
  });
};
