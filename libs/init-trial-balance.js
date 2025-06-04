import axios from 'axios';
import {numeric, burstPage} from './utils.js';
import SumTable from '../forms/sum-table.js';
import {field} from './parse_account_code.js';

let fy;
let assetPages;
let liabilitiesAndCapitalPages;
let incomeStatementPages;
const LINES = 46;

const print = (lineOut, suppress, outClasses) => {
  let pickup = new SumTable(3);
  let debit = new SumTable(3);
  let credit = new SumTable(3);
  let balance = new SumTable(3)
  let classes = [];

  for ( let line of lines ) {
    //console.log(line)
    if  ( !line.code )  continue;
    if  (( outClasses.length === 1 ) &&
         ( outClasses[0] === '資産' ) &&
         ( line.code === '1140000' ))    continue;
    if  ((( !suppress ) ||
          ( line.pickup !== 0 ) ||
          ( line.debit !== 0 ) ||
          ( line.credit !== 0 ) ||
          ( line.balance !== 0 )) &&
         ( parseInt(field(line.code)) !== 10 ) &&
         (( !outClasses[0] ) ||
          ( line.major_name === outClasses[0] )) &&
         (( !outClasses[1] ) ||
          ( line.middle_name === outClasses[1] )) &&
         (( !outClasses[2] ) ||
          ( line.minor_name === outClasses[2] )))   {
      //console.log(outClasses);
      if  (( classes[2] ) &&
           ( classes[2] !== line.minor_name )) {
        lineOut.push({
          name: `&nbsp;&nbsp;${classes[2]}計`,
          pickup: numeric(pickup.sum(2)),
          debit: debit.sum(2),
          credit: credit.sum(2),
          balance: balance.sum(2),
          total: true
        });
        pickup.clear(2);
        debit.clear(2);
        credit.clear(2);
        balance.clear(2);
      }
      if  ( classes[1] !== line.middle_name ) {
        if  ( classes[1] )  {
          lineOut.push({
            name:`&nbsp;&nbsp;${classes[1]}合計`,
            pickup: pickup.sum(1),
            debit: debit.sum(1),
            credit: credit.sum(1),
            balance: balance.sum(1),
            total: true
          });
          pickup.clear(1);
          debit.clear(1);
          credit.clear(1);
          balance.clear(1);
        }
        if  ( outClasses.length <= 2 )   {
          lineOut.push({
            name: `&nbsp;【${line.middle_name}】`
          });
        }
      }
      if  (( outClasses.length <= 2 ) &&
           ( line.minor_name !== classes[2] ))    {
        lineOut.push({
          name: line.minor_name
        });
      }
      lineOut.push({
        name: `&nbsp;&nbsp;${line.name}`,
        pickup: numeric(line.pickup),
        debit: line.debit,
        credit: line.credit,
        balance: line.balance
      });
      pickup.add(line.pickup);
      debit.add(line.debit);
      credit.add(line.credit);
      balance.add(line.balance)
      classes = [ line.major_name, line.middle_name, line.minor_name];
    }
  }
  if  ( classes[2] )  {
    lineOut.push({
      name: `&nbsp;&nbsp;${classes[2]}計`,
      pickup: pickup.sum(2),
      debit: debit.sum(2),
      credit: credit.sum(2),
      balance: balance.sum(2),
      total: true
    });
  }
  if  ( outClasses.length <= 1 )  {
    lineOut.push({
      name: `&nbsp;&nbsp;${outClasses[0]}合計`,
      pickup: pickup.sum(0),
      debit: debit.sum(0),
      credit: credit.sum(0),
      balance: balance.sum(0),
      total: true
    });
  }
  //console.log(lineOut);
  return  ({
    pickup: pickup.sum(0),
    debit: debit.sum(0),
    credit: credit.sum(0),
    balance: balance.sum(0)
  });
}

const accountLine = (name) => {
  return  lines.find((item) => {
    return  (item.name === name)
  });
}

const printAssetPage = () => {
  let assetPage = [];
  print(assetPage, true, ['資産']);
  assetPages = burstPage(assetPage, LINES);
}

const printLiabilitiesAndCapicalPage = () => {
  let cap = [];
  let liabilitiesAndCapitalPage = [];
  cap[0] = print(liabilitiesAndCapitalPage, true, ['負債']);
  liabilitiesAndCapitalPage.push({
    name: '【株主資本】'
  });
  liabilitiesAndCapitalPage.push({
    name: '【資本金】'
  });
  cap[1] = print(liabilitiesAndCapitalPage, false, [ "純資産", "株主資本",	"資本金" ]);
  liabilitiesAndCapitalPage.push({
    name: '【資本剰余金】'
  });
  cap[2] = print(liabilitiesAndCapitalPage, false, [ "純資産",	"株主資本",	"資本剰余金" ]);
  liabilitiesAndCapitalPage.push({
    name: '【利益剰余金】'
  });
  cap[3] = print(liabilitiesAndCapitalPage, false, [ "純資産",	"株主資本",	"利益剰余金" ]);
  liabilitiesAndCapitalPage.push({
    name: '【自己株式】'
  });
  cap[4] = print(liabilitiesAndCapitalPage, false, [ "純資産", "自己株式", "自己株式" ]);
  liabilitiesAndCapitalPage.push({
    name: '  株主資本合計',
    pickup: cap[1].pickup + cap[2].pickup + cap[3].pickup,
    debit: cap[1].debit + cap[2].debit + cap[3].debit,
    credit: cap[1].credit + cap[2].credit + cap[3].credit,
    balance: cap[1].balance + cap[2].balance + cap[3].balance
  });
  liabilitiesAndCapitalPage.push({
    name: '  純資産合計',
    pickup: cap[1].pickup + cap[2].pickup + cap[3].pickup + cap[4].pickup,
    debit: cap[1].debit + cap[2].debit + cap[3].debit + cap[4].debit,
    credit: cap[1].credit + cap[2].credit + cap[3].credit + cap[4].credit,
    balance: cap[1].balance + cap[2].balance + cap[3].balance + cap[4].balance
  });
  liabilitiesAndCapitalPage.push({
    name: '  負債・純資産合計',
    pickup: cap[0].pickup + cap[1].pickup + cap[2].pickup + cap[3].pickup + cap[4].pickup,
    debit: cap[0].debit + cap[1].debit + cap[2].debit + cap[3].debit + cap[4].debit,
    credit: cap[0].credit + cap[1].credit + cap[2].credit + cap[3].credit + cap[4].credit,
    balance: cap[0].balance + cap[1].balance + cap[2].balance + cap[3].balance + cap[4].balance
  });
  liabilitiesAndCapitalPages = burstPage(liabilitiesAndCapitalPage, LINES);
}

const printIncomeStatementPage = () => {
  let sum = [];
  let incomeStatementPage = [];
  sum[0] = print(incomeStatementPage, true, [ "経常損益", "売上高" ]);
  incomeStatementPage.push({
    name: '売上原価'
  });
  sum[1] = print(incomeStatementPage, true,[ "経常損益", "売上原価", "仕入高" ]);
  sum[2] = print(incomeStatementPage, true,[ "経常損益", "売上原価", "外注費" ]);
  sum[3] = print(incomeStatementPage, true,[ "経常損益", "売上原価", "棚卸高" ]);
  incomeStatementPage.push({
    name: '  売上総利益',
    balace: sum[0].balance - ( sum[1].balance + sum[2].balance + sum[3].balance)
  });
  incomeStatementPage.push({
    name: '販売費一般管理費'
  });
  sum[4] = print(incomeStatementPage, true,[ "経常損益", "売上原価", "販売費一般管理費" ]);
  incomeStatementPage.push({
    name: '  営業利益',
    balance: sum[0].balance - ( sum[1].balance + sum[2].balance + sum[3].balance + sum[4].balance)
  });
  sum[5] = print(incomeStatementPage, true, [ "経常損益",	"営業外収益" ]);
  incomeStatementPage.push({
    name: '【営業外費用】'
  });
  sum[6] = print(incomeStatementPage, true, [ "経常損益",	"営業外費用", "支払利息" ]);
  sum[7] = print(incomeStatementPage, true, [ "経常損益",	"営業外費用", "特別利益" ]);
  sum[8] = print(incomeStatementPage, true, [ "経常損益",	"営業外費用", "特別損失" ]);
  incomeStatementPage.push({
    name: '  経常利益',
    balance: sum[0].balance - ( sum[1].balance + sum[2].balance + sum[3].balance + sum[4].balance )
    + sum[5].balance - sum[6].balance - sum[7].balance - sum[8].balance
  });
  incomeStatementPage.push({
    name: '【当期損益】'
  });
  incomeStatementPage.push({
    name: '  税引前当期利益',
    balance: ( sum[0].balance + sum[5].balance + sum[7].balance )
    - ( sum[1].balance + sum[2].balance + sum[3].balance + sum[4].balance + sum[6].balance + sum[8].balance )
  });
  sum[9] = accountLine("法人税住民税等");
  incomeStatementPage.push(sum[9]);

  let current_net_income = ( sum[0].balance + sum[5].balance + sum[7].balance )
                         - ( sum[1].balance + sum[2].balance + sum[3].balance 
                            + sum[4].balance + sum[6].balance + sum[8].balance
                            + sum[9].balance);
  incomeStatementPage.push({
    name: '  当期純利益',
    credit: current_net_income,
    balance: current_net_income
  });
  let line = accountLine('繰越利益剰余金');
  incomeStatementPage.push({
    name: '  前期繰越利益',
    pickup: line.pickup,
    debit: line.debit,
    credit: line.credit,
    balance: line.balance
  });
  incomeStatementPage.push({
    name: '繰越利益剰余金',
    pickup: line.pickup,
    credit: current_net_income,
    balance: line.pickup + current_net_income
  });
  incomeStatementPages = burstPage(incomeStatementPage, LINES);
}

let lines;

export default async (term) => {
  let res = await axios.get(`/api/trial-balance/${term}`);
  lines = res.data;
  let result = await axios.get(`/api/term/${term}`);
  fy = result.data;

  printAssetPage();
  printLiabilitiesAndCapicalPage();
  printIncomeStatementPage();

  return  ({
    fy: fy,
    assetPages: assetPages,
    liabilitiesAndCapitalPages: liabilitiesAndCapitalPages,
    incomeStatementPages: incomeStatementPages
  });
}