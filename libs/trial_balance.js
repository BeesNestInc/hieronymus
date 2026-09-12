import models from '../models/index.js';
const Op = models.Sequelize.Op;
import Accounts from './accounts.js';
import {numeric, dc} from './parse_account_code.js';

export default async (term, endDate, options) => {
  let lines = [];
  let index = Object.create(null);

  let fy = await models.FiscalYear.findOne({
    where: {
      term: term
    }
  });
  if  ( !fy ) {
    throw new Error(`Fiscal year for term ${term} not found.`);
  }

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
    if  ( acc.code ) {
      index[acc.code] = i;
    }
  }
  if  ( !endDate )    {
    endDate = new Date(fy.endDate);
  }
  let startDate;
  if (options && options.monthly) {
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  } else {
    startDate = new Date(fy.startDate);
  }
  // 検出→承認解除→集計の二段階で処理する。
  // 解除した伝票の既知科目行も集計に残さないため、先に全伝票を集める。
  let allSlips = [];
  for ( let mon = new Date(startDate); mon < endDate; ) {
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
    for ( let s of cross_slips ) {
      allSlips.push(s);
    }
    mon.setMonth(mon.getMonth() + 1);
  }
  // 検出: 勘定マスタに存在しない科目コードを含む承認済み伝票を集める（借方・貸方とも、一律対象）。
  let suspects = new Map();
  for ( let cross_slip of allSlips ) {
    if  ( !cross_slip.approvedAt ) continue;
    let details = cross_slip.lines || [];
    for ( let j = 0; j < details.length; j ++ ) {
      let detail = details[j];
      for ( let side of ['debit', 'credit'] ) {
        let code = (side === 'debit') ? detail.debitAccount : detail.creditAccount;
        if ( code && index[code] === undefined ) {
          if  ( !suspects.has(cross_slip.id) ) {
            suspects.set(cross_slip.id, cross_slip);
          }
          console.warn(`[trial-balance] unknown ${side} account: slip id=${cross_slip.id} ${cross_slip.year}-${cross_slip.month} no=${cross_slip.no} line=${j} code=${code}`);
        }
      }
    }
  }
  // 承認解除: 承認権限者の操作時のみ実行し、承認待ち一覧に上げて修正可能にする。
  let actor = options && options.actor;
  let disapprovedIds = new Set();
  if  ( suspects.size > 0 && options && options.autoDisapprove && actor && actor.approvable && actor.id ) {
    for ( let cross_slip of suspects.values() ) {
      cross_slip.approvedAt = null;
      cross_slip.approvedBy = null;
      cross_slip.updatedBy = actor.id;
      await cross_slip.save();
      disapprovedIds.add(cross_slip.id);
      console.warn(`[trial-balance] disapproved: slip id=${cross_slip.id} ${cross_slip.year}-${cross_slip.month} no=${cross_slip.no} by user id=${actor.id}`);
    }
  }
  // 集計: 解除済み・未承認は除外し、未知コードはスキップする（500にしない）。
  for ( let cross_slip of allSlips ) {
    if  ( disapprovedIds.has(cross_slip.id) ) continue;
    if  (  cross_slip.approvedAt )  {
      let details = cross_slip.lines || [];
      for ( let j = 0; j < details.length; j ++ ) {
        let detail = details[j];
        if ( detail.debitAccount ) {
          let ix = index[detail.debitAccount];
          if ( ix !== undefined ) {
            lines[ix].debit += numeric(detail.debitAmount);
          }
        }
        if ( detail.creditAccount ) {
          let ix = index[detail.creditAccount];
          if ( ix !== undefined ) {
            lines[ix].credit += numeric(detail.creditAmount);
          }
        }
      }
    }
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
    accounts: accounts,
    disapproved: [...disapprovedIds]
  });
}
