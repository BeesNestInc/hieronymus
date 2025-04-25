import axios from 'axios';
import {numeric, burstPage } from './utils.js';
import {setAccounts, findAccount, findSubAccountByCode} from '../front/javascripts/cross-slip.js';
import myCompany from './my-company.js';

let fy = {};
let dates;
let company = {};

const LINES = 25;

const setupDates = async (term) => {
  let result = await axios.get(`/api/term/${term}`);
  dates = [];
  fy = result.data;
  for ( let mon = new Date(fy.startDate); mon < new Date(fy.endDate); ) {
    let year = mon.getFullYear();
    let month = mon.getMonth() + 1;
    let result = await axios.get(`/api/journal/${year}/${month}`)
    const ret = ready(result.data);

    let pages = burstPage(ret.lines, LINES);
    dates.push({
      year: year,
      month: month,
      pages: pages,
      sums: ret.sums
    });
    mon.setMonth(mon.getMonth() + 1);
    //mon = new Date(fy.endDate);
  }
}
const setupAccount = () => {
  axios.get(`/api/accounts`).then((res) => {
    let accounts = res.data;
    setAccounts(accounts);
  });
}
const ready = (slips) => {
  let _lines = [];
  let _sums = {
    debitAmount: 0,
    debitTax: 0,
    creditAmount: 0,
    creditTax: 0
  }
  for ( let i = 0; i < slips.length; i ++ ) {
    let slip = slips[i];
    slip.approvedAt = slip.approvedAt ? new Date(slip.approvedAt) : null;
    for ( let j = 0; j < slip.lines.length; j ++ ) {
      let line = slip.lines[j];
      let debitTax = line.debitTax ? numeric(line.debitTax) : 0
      let creditTax = line.creditTax ? numeric(line.creditTax) : 0

      _sums.debitAmount += line.debitAmount ? numeric(line.debitAmount) : 0;
      _sums.debitTax += debitTax;
      _sums.creditAmount += line.creditAmount ? numeric(line.creditAmount) : 0;
      _sums.creditTax += creditTax;

      _lines.push({
        id: line.id,
        month: slip.month,
        day: slip.day,
        no: slip.no,
        approvedAt: slip.approvedAt,
        lineNo: line.lineNo,

        debitAmount: line.debitAmount ? numeric(line.debitAmount).toLocaleString() : '',
        debitTax: debitTax !== 0 ? debitTax.toLocaleString() : '&nbsp;',
        creditAmount: line.creditAmount ? numeric(line.creditAmount).toLocaleString() : '',
        creditTax: creditTax !== 0 ? creditTax.toLocaleString() : '&nbsp;',
           
        debitAccount: findAccount(line.debitAccount).name,
        debitSubAccount: findSubAccountByCode(line.debitAccount, line.debitSubAccount).name,

        creditAccount: findAccount(line.creditAccount).name,
        creditSubAccount: findSubAccountByCode(line.creditAccount, line.creditSubAccount).name,

        debitVoucher: line.debitVoucher,
        debitVoucherId: line.debitVoucherId,
        creditVoucher: line.creditVoucher,
        creditVoucherId: line.creditVoucherId,

        application1: line.application1 || '',
        application2: line.application2 || ''
      });
    }
  }
  return	({
    lines:_lines,
  	sums:_sums
  });
}

export default async (term) => {
  setupAccount();  
  await setupDates(term);
  return  ({
    fy: fy,
    dates: dates
  });
}