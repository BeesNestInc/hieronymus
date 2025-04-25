import axios from 'axios';
import {numeric, formatDate, burstPage } from './utils.js';
import {setAccounts, findAccount, findSubAccountByCode} from '../front/javascripts/cross-slip.js';
import {ledgerLines} from './ledger.js';

const ledgerPages = async (term, account, subAccount) => {
  const LINES = 17;

  let pages = [];
  let remaining;
  let details;
  let ledger;
  let result = await axios.get(`/api/ledger/${term}/${account.code}/${subAccount.code}`);
  details = result.data;
  ledger = ledgerLines(account.code, subAccount.code, subAccount, details);
  let {lines, pickup, sums} = ledger;
  let page = [];
  let balance = pickup.balance;
  let line_1;
  for	( let line of lines )	{
    if	( page.length === LINES )	{
      pages.push({
        lines: page,
        balance: balance
      });
      balance = line_1.pureBalance;
      page = [];
    }
    page.push(line);
    line_1 = line;
  }
  pages.push({
    lines: page,
    balance: balance
  });
  return  ({
    name: account.name,
    sub_name: subAccount.name,
    pages: pages,
    sums: sums
  });
}

export default async (term) => {
  let result = await axios.get(`/api/term/${term}`);
  let fy = result.data;

  let res = await axios.get(`/api/accounts2/${term}`);
  let accounts = res.data;

  let ledgerLines = [];
  for ( let account of accounts ) {
    if  ( account.subAccounts ) {
      for ( let subAccount of account.subAccounts ) {
        let ledger = await ledgerPages(term, account, subAccount);
        if  (( ledger.sums.debit ) ||
             ( ledger.sums.credit ) ||
             ( ledger.sums.balance )) {
          ledgerLines.push(ledger);
        }
      }
    }
  }

  return  ({
    fy: fy,
    ledgerPages: ledgerLines
  })
}