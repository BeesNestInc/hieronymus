import axios from 'axios';
import {numeric, burstPage} from './utils.js';
import SumTable from '../forms/sum-table.js';
import {field} from './parse_account_code.js';

let fy;
let assetPages;
let liabilitiesAndCapitalPages;
let incomeStatementPages;
let retainedEarnings;
let lines;

const LINES = 46;

const print = (lineOut, suppress, outClasses) => {
  let pickup = new SumTable(3);
  let debit = new SumTable(3);
  let credit = new SumTable(3);
  let balance = new SumTable(3);
  let classes = [];

  for ( let line of lines ) {
    //console.log(line)
    if  ( !line.code )  continue;
    if  (( outClasses.length === 1 ) &&
         ( outClasses[0] === '資産' ) &&
         ( line.code === '1140000' ))    continue;
    if  (( outClasses.length === 1 ) &&
         ( outClasses[0] === '負債' ) &&
         ( line.code === '3080000' ))    continue;
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
  cap[3] = retainedEarnings;
  //print(liabilitiesAndCapitalPage, false, [ "純資産",	"株主資本",	"利益剰余金" ]);
  liabilitiesAndCapitalPage.push({
    name: "&nbsp;&nbsp;利益剰余金",
    pickup: retainedEarnings.pickup,
    debit: retainedEarnings.debit,
    credit: retainedEarnings.credit,
    balance: retainedEarnings.balance
  })
  liabilitiesAndCapitalPage.push({
    name: '【自己株式】'
  });
  cap[4] = print(liabilitiesAndCapitalPage, false, [ "純資産", "自己株式", "自己株式" ]);
  const shareholderEquity = {
    pickup: cap[1].pickup + cap[2].pickup + cap[3].pickup - cap[4].pickup,
    debit: cap[1].debit + cap[2].debit + cap[3].debit + cap[4].debit,
    credit: cap[1].credit + cap[2].credit + cap[3].credit + cap[4].credit,
    balance: cap[1].balance + cap[2].balance + cap[3].balance - cap[4].balance
  };

  liabilitiesAndCapitalPage.push({
    name: '  株主資本合計',
    ...shareholderEquity
  });
  liabilitiesAndCapitalPage.push({
    name: '  純資産合計',
    ...shareholderEquity
  });
  liabilitiesAndCapitalPage.push({
    name: '  負債・純資産合計',
    pickup: cap[0].pickup + shareholderEquity.pickup,
    debit: cap[0].debit + shareholderEquity.debit,
    credit: cap[0].credit + shareholderEquity.credit,
    balance: cap[0].balance + shareholderEquity.balance
  });
  liabilitiesAndCapitalPages = burstPage(liabilitiesAndCapitalPage, LINES);
}

const printIncomeStatementPage = () => {
  const incomeStatementPage = [];

  const sumByCode = (regex) => lines.reduce((acc, line) => {
    if ((line.debit || line.credit || line.balance) && new RegExp(regex).test(line.code)) {
        acc += line.balance;
      }
      return acc;
    }, 0);

  const collectItems = (regex, title) => {
    incomeStatementPage.push({ name: `【${title}】` });
    let total = 0;
    for (const line of lines) {
      if ((line.debit || line.credit || line.balance) && new RegExp(regex).test(line.acl_code)) {
        incomeStatementPage.push({ name: `&nbsp;&nbsp;${line.name}`, balance: line.balance });
        total += line.balance;
      }
    }
    incomeStatementPage.push({ name: `&nbsp;&nbsp;${title}計`, balance: total, total: true });
    return total;
  };

  // --- 損益計算開始 (init-financial-statement.js のロジックを移植) ---
  const grossMargin = sumByCode(/^600/); // 売上高
  incomeStatementPage.push({ name: '売上高', balance: grossMargin, total: true });

  incomeStatementPage.push({ name: '【売上原価】' });
  const purchase = sumByCode(/^700/); // 仕入高
  const subcontract = sumByCode(/^701/); // 外注費
  const openingInv = sumByCode(/7020000/); // 期首商品棚卸高
  const closingInvRaw = lines.find(l => l.code === '7020010');
  const closingInv = closingInvRaw ? closingInvRaw.credit : 0;
  const cogs = openingInv + purchase + subcontract;
  const salesCost = cogs - closingInv; // 売上原価
  incomeStatementPage.push({ name: '&nbsp;&nbsp;期首商品棚卸高', balance: openingInv });
  incomeStatementPage.push({ name: '&nbsp;&nbsp;仕入高', balance: purchase });
  incomeStatementPage.push({ name: '&nbsp;&nbsp;外注費', balance: subcontract });
  incomeStatementPage.push({ name: '&nbsp;&nbsp;売上原価計', balance: cogs, total: true });
  incomeStatementPage.push({ name: '&nbsp;&nbsp;期末商品棚卸高', balance: -closingInv, total: true });
  incomeStatementPage.push({ name: '売上原価', balance: salesCost, total: true });

  const grossProfit = grossMargin - salesCost; // 売上総利益
  incomeStatementPage.push({ name: '売上総利益', balance: grossProfit, total: true });

  const sga = sumByCode(/^703/); // 販管費
  incomeStatementPage.push({ name: '販売費及び一般管理費', balance: sga, total: true });

  const operatingIncome = grossProfit - sga; // 営業利益
  incomeStatementPage.push({ name: '営業利益', balance: operatingIncome, total: true });

  const nonOpIncome = collectItems(/^8/, '営業外収益'); // 営業外収益
  const nonOpExpenses = collectItems(/^900/, '営業外費用'); // 営業外費用

  const recurringProfit = operatingIncome + nonOpIncome - nonOpExpenses; // 経常利益
  incomeStatementPage.push({ name: '経常利益', balance: recurringProfit, total: true });

  const extraGain = collectItems(/^901/, '特別利益'); // 特別利益
  const extraLoss = collectItems(/^902/, '特別損失'); // 特別損失

  const preTaxIncome = recurringProfit + extraGain - extraLoss; // 税引前当期利益
  incomeStatementPage.push({ name: '税引前当期利益', balance: preTaxIncome, total: true });

  const tax = sumByCode(/^903/); // 法人税等
  incomeStatementPage.push({ name: '法人税等', balance: tax });

  const current_net_income = preTaxIncome - tax; // 当期純利益
  incomeStatementPage.push({ name: '当期純利益', balance: current_net_income, total: true });

  // --- 利益剰余金の計算 ---
  let line = accountLine('繰越利益剰余金');
  retainedEarnings = {
    pickup: line.pickup,
    debit: 0,
    credit: current_net_income,
    balance: line.pickup + current_net_income
  }
  incomeStatementPage.push({ name: '前期繰越利益', balance: line.balance });
  incomeStatementPage.push({ name: '繰越利益剰余金', ...retainedEarnings, total: true });

  incomeStatementPages = burstPage(incomeStatementPage, LINES);
}


export default async (term) => {
  let res = await axios.get(`/api/trial-balance/${term}`);
  lines = res.data;
  let result = await axios.get(`/api/term/${term}`);
  fy = result.data;

  printAssetPage();
  printIncomeStatementPage();
  printLiabilitiesAndCapicalPage();

  return  ({
    fy: fy,
    assetPages: assetPages,
    liabilitiesAndCapitalPages: liabilitiesAndCapitalPages,
    incomeStatementPages: incomeStatementPages
  });
}