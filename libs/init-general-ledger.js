import axios from 'axios';
import {burstPage} from './utils.js';
import {ledgerLines} from './ledger.js';

const ledgerPages = async (term, account) => {
  const LINES = 17;

  let pages = [];
  let remaining;
  let details;
  let ledger;
  let result = await axios.get(`/api/ledger/${term}/${account.code}`);
  details = result.data;
  ledger = ledgerLines(account.code, null, account, details);
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
    pages: pages,
    sums: sums,
    pickup: pickup.balance
  });
}

export default async (term) => {
  let result = await axios.get(`/api/term/${term}`);
  let fy = result.data;

  let res = await axios.get(`/api/accounts2/${term}`);
  let accounts = res.data;
  let accountLines = [];
  let ledgerLines = [];
  for ( let account of accounts ) {
    let ledger = await ledgerPages(term, account);
    //console.log({ledger});
    if  (( ledger.sums.debit ) ||
         ( ledger.sums.credit ) ||
         ( ledger.sums.balance )) {
      accountLines.push({
        code: account.code,
        name: account.name,
        taxClass: account.taxClass,
        debit: ledger.sums.debitAmount,
        credit: ledger.sums.creditAmount,
        balance: ledger.sums.balance
      });
      ledgerLines.push(ledger);
    }
  }

  let account_pages = burstPage(accountLines, 46);

  return  ({
    fy: fy,
    accountPages: account_pages,
    ledgerPages: ledgerLines
  })
}