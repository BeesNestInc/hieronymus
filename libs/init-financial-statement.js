import {field} from './parse_account_code.js';
import SumTable from '../forms/sum-table.js';
import {formatMoney} from './utils.js';
import axios from 'axios';

let trialBalanceLines;

let asset;
let liabilities;
let networth;
let bsLines;
let plOut;
let netIncome;
let assetPage;
let liabilitiesPage;
let netWorthPage;
let sgaPage;
let sgaSum;

const GAP = 2;

const accountLine = (name) => {
  return  trialBalanceLines.find((item) => {
    return  (item.name === name)
  });
}


/*  損益計算書 */
export const printPL = (lines) => {
  const sumByCode = (regex) => lines.reduce((acc, line) => {
    if ((line.debit || line.credit || line.balance) && regex.test(line.code)) {
        acc.debit += line.debit;
        acc.credit += line.credit;
        acc.balance += line.balance;
      }
      return acc;
    }, { debit: 0, credit: 0, balance: 0 });
  
  const collectItems = (regex) => {
    const result = { debit: 0, credit: 0, balance: 0 };
    for (const line of lines) {
      if ((line.debit || line.credit || line.balance) && regex.test(line.acl_code)) {
        plOut.push({ left_title: line.name, left_value: line.balance });
        result.debit += line.debit;
        result.credit += line.credit;
        result.balance += line.balance;
      }
    }
    return result;
  };

  plOut = [];
  const grossMargin = sumByCode(/^600/).balance;
  plOut.push({ left_title: '【売上高】' });
  plOut.push({ left_title: '売上高', left_value: grossMargin, right_value: grossMargin, left_line: true });
  
  plOut.push({ left_title: '【売上原価】' });
  const purchase = sumByCode(/^700/).balance;
  const subcontract = sumByCode(/^701/).balance;
  const openingInv = sumByCode(/7020000/).balance;
  const closingInv = sumByCode(/7020010/).credit;
  const cogs = openingInv + purchase + subcontract;
  
  plOut.push({ left_title: '    期首商品棚卸高', left_value: openingInv });
  plOut.push({ left_title: '    仕入高', left_value: purchase });
  plOut.push({ left_title: '    外注費', left_value: subcontract });
  plOut.push({ left_title: '    売上原価計', left_value: cogs, left_line: true });
  plOut.push({ left_title: '    期末商品棚卸高', left_value: closingInv, right_value: cogs - closingInv, left_line: true, right_line: true });
  
  const grossProfit = grossMargin - (cogs - closingInv);
  plOut.push({ right_title: '売上総利益', right_value: grossProfit });
  
  const sga = sumByCode(/^703/).balance;
  plOut.push({ left_title: '【販売費及び一般管理費】', right_value: sga, right_line: true });
  
  const operatingProfit = grossProfit - sga;
  plOut.push({ right_title: '営業利益', right_value: operatingProfit });
  
  plOut.push({ left_title: '【営業外収益】' });
  const nonOpIncome = collectItems(/^8/).balance;
  plOut.push({ left_title: '    営業外収益計', right_value: nonOpIncome, left_line: true, right_line: true });
  
  plOut.push({ left_title: '【営業外費用】' });
  const nonOpExpenses = collectItems(/^900|^902/).balance;
  plOut.push({ left_title: '    営業外費用計', right_value: nonOpExpenses, left_line: true, right_line: true });
  
  const extraGain = sumByCode(/^901/).balance;
  if (extraGain !== 0) plOut.push({ left_title: '特別利益計', left_value: extraGain, left_line: true });
  
  const extraLoss = sumByCode(/^902/).balance;
  if (extraLoss !== 0) plOut.push({ left_title: '特別損失計', right_value: extraLoss, left_line: true, right_line: true });
  
  plOut.push({ left_title: '【当期損益】' });
  
  const recurringProfit = operatingProfit + nonOpIncome - nonOpExpenses;
  const currentIncome = recurringProfit + extraGain;
  
  plOut.push({ right_title: '経常利益', right_value: recurringProfit, left_line: true, right_line: true });
  plOut.push({ right_title: '税引前当期利益', right_value: currentIncome, right_line: true });
  
  const tax = sumByCode(/^903/).balance;
  plOut.push({ right_title: '法人税住民税等', right_value: tax });
  
  const netIncome = currentIncome - tax;
  plOut.push({ right_title: '当期純利益', right_value: netIncome, right_line: true });
  
  //console.log(plOut);
  return netIncome;
};

/* 貸借対照表 */
const printBS = (lineOut, outClasses) => {
  let pickup = new SumTable(3);
  let debit = new SumTable(3);
  let credit = new SumTable(3);
  let balance = new SumTable(3)
  let classes = [];
  let mark;

  for ( let line of trialBalanceLines ) {
    //console.log(line)
    if  ( !line.code )  continue;
    if  (( outClasses.length === 1 ) &&
         ( outClasses[0] === '資産' ) &&
         ( line.code === '1140000' ))    continue;
    if  (( outClasses.length === 1 ) &&
         ( outClasses[0] === '負債' ) &&
         ( line.code === '3080000' ))    continue;
    if  ((( line.pickup !== 0 ) ||
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
      //console.log(classes);
      if  (( classes[2] ) &&
           ( classes[2] !== line.minor_name )) {
        if  ( balance.sum(2) !== 0 ) {
          lineOut.push({
            level: 3,
            name: classes[2],
            amount: balance.sum(2)
          });
        }
        pickup.clear(2);
        debit.clear(2);
        credit.clear(2);
        balance.clear(2);
      }
      if  ( classes[1] !== line.middle_name ) {
        if  ( classes[1] )  {
          if  ( mark )  {
            lineOut[mark] = {
              level: 1,
              name: classes[1],
              amount: balance.sum(1)
            };
          }
          pickup.clear(1);
          debit.clear(1);
          credit.clear(1);
          balance.clear(1);
          assetPage.push({});
          mark = lineOut.length - 1;
        }
      }
      pickup.add(line.pickup);
      debit.add(line.debit);
      credit.add(line.credit);
      balance.add(line.balance)
      classes = [ line.major_name, line.middle_name, line.minor_name];
    }
  }
  if  ( classes[2] )  {
    if  ( balance.sum(2) !== 0 )  {
      lineOut.push({
        level: 3,
        name: classes[2],
        amount: balance.sum(2)
      })
    }
  }
  if  ( mark )  {
    lineOut[mark] = {
      level: 1,
      name: `${classes[1]}`,
      amount: balance.sum(1)
    }
  }
  return  ({
    pickup: pickup.sum(0),
    debit: debit.sum(0),
    credit: credit.sum(0),
    balance: balance.sum(0)
  });
}

const printAssetPage = () => {
  let sum = [];
  let mark;
  assetPage = [];
  assetPage.push({});
  mark = assetPage.length - 1;
  sum[0] = printBS(assetPage, ['資産', '流動資産']);
  assetPage[mark] = {
    level: 1,
    name: '流動資産',
    amount: sum[0].balance
  }
  assetPage.push({});
  let fix = assetPage.length - 1;
  assetPage.push({});
  mark = assetPage.length - 1;
  sum[1] = printBS(assetPage, ['資産', '有形固定資産']);
  if  ( sum[1].balance ) {
    assetPage[mark] = {
      level: 2,
      name: '有形固定資産',
      amount: sum[1].balance
    };
  } else {
    assetPage.pop();
  }
  assetPage.push({});
  mark = assetPage.length - 1;
  sum[2] = printBS(assetPage, ['資産', '無形固定資産']);
  if  ( sum[2].balance )  {
    assetPage[mark] = {
      level: 2,
      name: '無形固定資産',
      amount: sum[2].balance
    }
  } else {
    assetPage.pop();
  }
  assetPage.push({});
  mark = assetPage.length - 1;
  sum[3] = printBS(assetPage, ['資産', '投資等']);
  assetPage[mark] = {
    level: 2,
    name: '投資その他資産',
    amount: sum[3].balance
  }
  assetPage.push({});
  mark = assetPage.length - 1;
  sum[4] = printBS(assetPage, ['資産', '繰延資産']);
  assetPage[mark] = {
    level: 2,
    name: '繰延資産',
    amount: sum[4].balance
  }
  assetPage[fix] = {
    level: 1,
    name: '固定資産',
    amount: sum[1].balance + sum[2].balance + sum[3].balance + sum[4].balance
  }
  //console.log(assetPage);
  return  (sum[0].balance + sum[1].balance + sum[2].balance + sum[3].balance + sum[4].balance);
}

const printLiabilitiesPage = () => {
  let mark;
  let sum = [];

  liabilitiesPage = [];
  liabilitiesPage.push({})
  mark = liabilitiesPage.length - 1;
  sum[0] = printBS(liabilitiesPage, ['負債', '流動負債']);
  //console.log('負債 流動負債', liabilitiesPage);
  if  ( sum[0].balance )  {
    liabilitiesPage[mark] = {
      level: 1,
      name: '流動負債',
      amount: sum[0].balance
    }
  } else {
    liabilitiesPage.pop();
  }
  liabilitiesPage.push({})
  mark = liabilitiesPage.length - 1;
  sum[1] = printBS(liabilitiesPage, ['負債', '固定負債']);
  if  ( sum[1].balance )  {
    liabilitiesPage[mark] = {
      level: 1,
      name: '固定負債',
      amount: sum[1].balance
    }
  } else {
    liabilitiesPage.pop();
  }
  //console.log('負債の部', liabilitiesPage);
  return  (sum[0].balance + sum[1].balance)
}

const printNetWorthPage = () => {
  let sum = [];
  let mark;

  let retainedEarnings = accountLine('繰越利益剰余金');
  retainedEarnings.credit = netIncome;
  retainedEarnings.balance += netIncome;
  netWorthPage = [];
  netWorthPage.push({});
  mark = netWorthPage.length - 1;
  sum[0] = printBS(netWorthPage, ['純資産', '株主資本', '資本金']);
  netWorthPage.push({
    level: 3,
    name: '繰越利益剰余金',
    amount: retainedEarnings.balance
  });
  const netWorth = sum[0].balance + retainedEarnings.balance;
  netWorthPage[mark] = {
    level: 1,
    name: '資本',
    amount: netWorth
  };
  //console.log(netWorthPage);
  return  (netWorth)
}

const formatLevel = (level, name) => {
  switch  (level) {
    case  1:
      return  (`【${name}】`);
    case  2:
      return  (`(${name})`);
    case  3:
      return  `&nbsp;&nbsp;&nbsp;${name}`;
  }
}

const BS = () => {
  asset = printAssetPage();
  liabilities = printLiabilitiesPage();
  networth = printNetWorthPage();

  const leftLines = assetPage.length;
  const rightLines = liabilitiesPage.length + netWorthPage.length + 4;
  const realGap = leftLines > rightLines ? GAP + ( leftLines - rightLines ) : GAP;
  //console.log('lines', leftLines, rightLines, realGap);
  bsLines = [];
  let i = 0;
  let rightPage = [...liabilitiesPage];
  let sum = 0;
  while (true) {
    let left = assetPage.shift();
    let right;
    let line;
    if  ( left )  {
      line = `<td class="no-border">${formatLevel(left.level, left.name)}</td><td class="number left-border">${formatMoney(left.amount)}</td>`;
    } else {
      line = `<td class="no-border"></td><td class="left-border"></td>`;
    }
    if ( i < liabilitiesPage.length ) {
      right = rightPage.shift();
      bsLines.push(line.concat(`<td class="left-border">${formatLevel(right.level, right.name)}</td><td class="number no-border">${formatMoney(right.amount)}</td>`));
    } else
    if ( liabilitiesPage.length === i ) {
      bsLines.push(line.concat(`<td class="total">負債合計</td><td class="number total">${formatMoney(liabilities)}</td>`));
      rightPage = [...netWorthPage];
    } else {
      if  ( sum < realGap )  {
        bsLines.push(line.concat(`<td class="left-border" colspan="2">&nbsp;</td>`));
        sum += 1;
      } else
      if  ( sum ===  realGap )  {
        bsLines.push(line.concat(`<th class="" colspan="2">純資産の部</th>`));
        sum += 1;
      } else {
        right = rightPage.shift();
        if  ( right ) {
          bsLines.push(
            line.concat(`<td class="left-border">${formatLevel(right.level, right.name)}</td><td class="number no-border">${formatMoney(right.amount)}</td>`)
          );
        } else {
          if  ( left )  {
            bsLines.push(line.concat(`<td class="left-border" colspan="2">&nbsp;</td>`));
            sum += 1;
          } else {
            bsLines.push(
              line.concat(`<td class="total">純資産合計</td><td class="number total">${formatMoney(networth)}</td>`)
            );
            break;
          }
        }
      }
    }
    i += 1;
  }
  bsLines = bsLines;
}

const printSGA = (outClasses)	=> {
  let pickup = new SumTable(3);
  let debit = new SumTable(3);
  let credit = new SumTable(3);
  let balance = new SumTable(3)
  let classes = [];

  for ( let line of trialBalanceLines ) {
    //console.log(line)
    if  ( !line.code )  continue;
    if  ( !line.code )  continue;
    if  (( outClasses[0] === '資産' ) &&
         ( line.code === '1140000' ))    continue;
    if  (( outClasses[0] === '負債' ) &&
         ( line.code === '3080000' ))    continue;
    if  ((( line.pickup !== 0 ) ||
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

      if  (( classes[2] ) &&
           ( classes[2] != line.minor_name )) {
        if  ( pickup.sum(2) !== 0 ) {
          sgaPage.push({
            level: 3,
            name: classes[2],
            amount: pickup.sum(2)
          });
        }
        pickup.clear(2);
        debit.clear(2);
        credit.clear(2);
        balance.clear(2);
      }
      sgaPage.push({
        level: 3,
        name: line.name,
        amount: line.balance
      });
      pickup.add(line.pickup);
      debit.add(line.debit);
      credit.add(line.credit);
      balance.add(line.balance)
      classes = [ line.major_name, line.middle_name, line.minor_name];
    } else {
      classes = [];
    }
  }
  return  ({
    pickup: pickup.sum(0),
    debit: debit.sum(0),
    credit: credit.sum(0),
    balance: balance.sum(0)
  });
}

const SGA = () => {
  sgaPage = [];
  let sum = printSGA( [ "経常損益", "売上原価", "販売費一般管理費" ]);
  sgaSum = sum.balance;
}


export default async(term) => {
  let result = await axios.get(`/api/term/${term}`);
  let fy = result.data;
  let res = await axios.get(`/api/trial-balance/${term}`);
  trialBalanceLines = res.data;
  trialBalanceLines.forEach((line) => {
    if  ( parseInt(line.acl_code) < 400 ) {
      //console.log(line);
    }
  })
  //console.log(trialBalanceLines);
  netIncome = printPL(trialBalanceLines);

  BS();
  SGA();
  return  ({
    fy: fy,
    bsLines: bsLines,
    plOut: plOut,
    sgaPage: sgaPage,
    asset: asset,
    liabilities: liabilities,
    networth: networth,
    sgaSum: sgaSum
  })
}
