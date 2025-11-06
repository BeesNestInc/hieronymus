import models from '../models/index.js';
const Op = models.Sequelize.Op;
import Accounts from './accounts.js';
import {numeric, dc} from './parse_account_code.js';

export default async (term, endDate, options) => {
  let lines = [];
  let index = [];

  let fy = await models.FiscalYear.findOne({
    where: {
      term: term
    }
  });

  let accounts = await Accounts.all3(term);
  for ( let i = 0; i < accounts.length; i += 1)   {
    let acc = accounts[i];
    let balance = numeric(acc.balance);     //  don't forget!!!
    if  ( acc.subAccounts > 0 )  {
      //console.log(acc);
      for ( let j = 0 ; j < acc.subAccounts.length; j += 1)   {
        let sub = acc.subAccounts[j];
        balance += sub.balance ? sub.balance : 0;
      }
    }
    lines.push({
      major_name: acc.major_name,
      middle_name: acc.middle_name,
      minor_name: acc.minor_name,
      acl_code: acc.acl_code,
      name: acc.name,
      code: acc.code,
      pickup: balance,
      debit: 0,
      credit: 0,
      balance: 0
    });
    index[acc.code] = i;
  }
  if  ( !endDate )    {
    endDate = fy.endDate;
  }
  let startDate;
  if (options && options.monthly) {
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  } else {
    startDate = new Date(fy.startDate);
  }
  for ( let mon = startDate; mon < endDate; ) {
    let cross_slips = await models.CrossSlip.findAll({
      where: {
        [Op.and]: {
          year: mon.getFullYear(),
          month: mon.getMonth() + 1
        }
      },
      include: [{
        model: models.CrossSlipDetail,
        as: 'lines'
      }]
    });
    for ( let i = 0; i < cross_slips.length; i ++ ) {
      let cross_slip = cross_slips[i];
      if  (  cross_slip.approvedAt )  {
        for ( let j = 0; j < cross_slip.lines.length; j ++ ) {
          let detail = cross_slip.lines[j];
          if ( detail.debitAccount ) {
            let ix = index[detail.debitAccount];
            lines[ix].debit += numeric(detail.debitAmount);
          }
          if ( detail.creditAccount ) {
            let ix = index[detail.creditAccount];
            lines[ix].credit += numeric(detail.creditAmount);
          }
        }
      }
    }
    mon.setMonth(mon.getMonth() + 1);
  }
  for ( let line of lines )   {
    if  ( line.code )   {
      if ( dc(line.code) == 'D' ) {
        line.balance = line.pickup + line.debit - line.credit;
      } else {
        line.balance = line.pickup - line.debit + line.credit;
      }
    }
  }
  return  ({
    lines: lines,
    accounts: accounts
  });
}
