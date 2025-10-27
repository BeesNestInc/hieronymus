<div class="page-title d-flex justify-content-between align-items-center mt-2">
  <div class="d-flex align-items-center">
    <h1>推移表</h1>
    {#if account}
      <h2 class="ms-3 mb-0 fs-4">{account.name}</h2>
    {/if}
  </div>
</div>
<AccountSelect
  on:select={(event) => {
    accountSelect(event.detail);
  }}
  fields={fields}/>
{#if (account && (account.subAccounts.length > 0))}
<div class="row page-subtitle">
  <div class="col-9 ps-4 border rounded p-2 my-2">
    {#key subAccountCode}
    <SubAccountSelect
    	on:select={(event) => {
      	accountSelect(event.detail);
    	}}
      account={account}
      sub_account_code={subAccountCode}/>
    {/key}
  </div>
  <div class="col-3" style="text-align:right;">
    {#if subAccountCode}
      <button type="button"
        on:click={() => {
          link(`/ledger/${accountCode}/${subAccountCode}`)
        }} class="btn btn-info">
      補助元帳を見る
    </button>
    {:else}
    <button type="button"
      on:click={() => {
        link(`/ledger/${accountCode}`);
      }} class="btn btn-info">
      元帳を見る
    </button>
    {/if}
    <label>
      <input type="checkbox" bind:checked={allYears}
        on:change={termChange}>
      全年度
    </label>
    {#if allYears}
    <label>
      <input type="checkbox" bind:checked={sameMonth}
        on:change={termChange}>
      前年同月比較
    </label>
    {/if}
    </div>
  </div>
{/if}
{#if (lines.length > 0)}
<div class="d-flex justify-content-between">
  <div></div>
  <div>
    <label>
      <input type="checkbox" bind:checked={Amount} disabled={sameMonth}
        on:change={() => { updateChart() }}>
      金額
    </label>
    <label>
      <input type="checkbox" bind:checked={Balance} disabled={sameMonth}
        on:change={() => {updateChart() }}>
      累計
    </label>
  </div>
</div>
<Line data={chartData} options={{}}/>
{/if}
<div class="change-list">
  <ChangesList
    lines={lines}/>
</div>
<style>
</style>

<script>

import axios from 'axios';
import {onMount, afterUpdate} from 'svelte';

import {Line} from "svelte-chartjs";
import AccountSelect from '../components/account-select.svelte';
import SubAccountSelect from '../components/subaccount-select.svelte';
import ChangesList from './changes-list.svelte';
import {dc, numeric} from '../../../libs/parse_account_code.js';
import {setAccounts, findAccount, findSubAccountByCode} from '../../javascripts/cross-slip';
import parse_account_code from '../../../libs/parse_account_code';
import {currentPage, link} from '../../javascripts/router.js';

import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale,
  } from 'chart.js';

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale
  );

export let status;

let accounts;
let account;
let details;
let remaining;
let lines = [];
let allYears = false;
let sameMonth = true;
let Amount = true;
let Balance = false;
let accountCode;
let subAccountCode;

let fields = [
  {
    title: '資産',
    accounts: []
  },{
    title: '負債',
    accounts: []
  },{
    title: '純資産',
    accounts: []
  },{
    title: '売上高',
    accounts: []
  },{
    title: '売上原価',
    accounts: []
  },{
    title: '営業外',
    accounts: []
  }
];

const colors = [
  "#000",
  //"#EEECE1",
  "#1F497D",
  "#4F81BD",
  "#C0504D",
  "#9BBB59",
  "#8064A2",
  "#4BACC6",
  "#F79646",
  "#C00000",
  "#FF0000",
  "#FFC000",
  "#FFFF00",
  "#92D050",
  "#00B050",
  "#00B0F0",
  "#0070C0",
  "#002060",
  "#7030A0"
];

let chartData;

const accountSelect = (code) => {
  let href;
  if (code.sub) {
    href = `/changes/${status.fy.term}/${code.code}/${code.sub}`;
  } else {
    href = `/changes/${status.fy.term}/${code.code}`;
  }
  link(href);
}

const termChange = () => {
  console.log({allYears})
  if ( sameMonth )	{
    Balance = false;
  }
  changeAccount(true);
}

const changeAccount = (update) => {
  if (!accountCode) return;
  axios.get(`/api/account/${accountCode}`).then((result) => {
    account = result.data;
    console.log('account', account);
    remaining = {};
    let pr;
    let thisTerm;
    if	( allYears )	{
      thisTerm = 0;
    } else {
      thisTerm = status.fy.term;
    }
    if ( subAccountCode ) {
      pr = axios.get(`/api/remaining/${thisTerm}/${accountCode}/${subAccountCode}`);
    } else {
      pr = axios.get(`/api/remaining/${thisTerm}/${accountCode}`);
    }
    pr.then((result) => {
      remaining = result.data;
      console.log('remaining', remaining);
      details = [];
      if  ( update )  {
        updateList();
      }
    });
  });
}

const checkPage = (page) => {
  const path = page || location.pathname;
  let args = path.split('/');
  status.fy.term = args[2];
  accountCode = args[3];
  subAccountCode = args[4] ? parseInt(args[4]) : undefined;
  
  changeAccount(true);
}

onMount(() => {
  console.log('changes onMount');
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    setAccounts(accounts);
    for ( let i = 0; i < accounts.length; i ++ ) {
      let account = accounts[i];
      switch (parse_account_code.field(account.code)) {
        case '1':
        case '2':
          fields[0].accounts.push(account);
          break;
        case '3':
        case '4':
          fields[1].accounts.push(account);
          break;
        case '5':
          fields[2].accounts.push(account);
          break;
        case '6':
          fields[3].accounts.push(account);
          break;
        case '7':
          fields[4].accounts.push(account);
          break;
        default:
          fields[5].accounts.push(account);
          break;
      }
    }
    fields = fields;
  });

  checkPage();

  const unsubscribe = currentPage.subscribe((page) => {
    if (page && page.split('/')[1] === 'changes') {
      checkPage(page);
    }
  });

  return () => {
    unsubscribe();
  };
});

const makeLines = (remaining, details) => {
  let pureBalance;
  let pureAmount;
  let pureTax;
  if  ( !remaining )  {
    pureBalance = 0;
  } else {
    pureBalance = numeric(remaining.balance);
  }
  let changes = [{
    pureBalance: pureBalance
  }];
  let tax_class;
  if  ( subAccountCode > 0 )      {
    tax_class = findSubAccountByCode(accountCode, subAccountCode).taxClass;
  } else {
    tax_class = findAccount(accountCode).taxClass;
  }
  for (let i = 0; i < details.length; i++) {
    let detail = details[i];

    let monthlyDebit, monthlyCredit;
    if (tax_class === 1) {
      monthlyDebit = detail.debitAmount - detail.debitTax;
      monthlyCredit = detail.creditAmount - detail.creditTax;
    } else {
      monthlyDebit = detail.debitAmount;
      monthlyCredit = detail.creditAmount;
    }

    if (dc(accountCode) == 'C') { // 貸方科目
      pureAmount = monthlyCredit - monthlyDebit;
      // 表示用の税額は、主要な取引である貸方取引の税額とする（元のロジックを踏襲）
      pureTax = detail.creditTax;
    } else { // 借方科目
      pureAmount = monthlyDebit - monthlyCredit;
      // 表示用の税額は、主要な取引である借方取引の税額とする（元のロジックを踏襲）
      pureTax = detail.debitTax;
    }

    pureBalance += pureAmount;
    changes.push({
      year: detail.year,
      month: detail.month,
      pureAmount: pureAmount,
      pureTax: pureTax,
      pureBalance: pureBalance,
      taxClass: tax_class
    });
  }
  return	(changes);
}

afterUpdate(() => {
  console.log('changes afterUpdate');
})
const updateList = () => {
  console.log('updateList', status.term, accountCode, subAccountCode);
  let pr;
  let thisTerm;
  if	( allYears )	{
    thisTerm = 0;
  } else {
    thisTerm = status.fy.term;
  }
  if ( subAccountCode ) {
    console.log('with sub_account');
    pr = axios.get(`/api/changes/${thisTerm}/${accountCode}/${subAccountCode}`);
  } else {
    pr = axios.get(`/api/changes/${thisTerm}/${accountCode}`);
  }
  pr.then((result) => {
    details = result.data;
    //console.log('**details', details);
    //console.log(dc(accountCode));
    lines = makeLines(remaining, details);
    console.log({lines});
    updateChart();
  });
}
const updateChart = () => {
  chartData = {
    datasets: [],
    labels: []
  };
  let index;
  if	( sameMonth )	{
    for	( let i = 1; i < 13; i += 1 )	{
      let line = lines[i];
      chartData.labels.push(`${line.month}`);
    }
    index = -1;
    for	( let i = 1; i < lines.length; i += 1 )	{
      let line = lines[i];
      if	( i % 12 === 1 )	{
        index += 1;
        chartData.datasets[index] = {
          label: `${line.year}度`,
          fill: false,
          borderColor: colors[index],
          data: []
        }
      }
      chartData.datasets[index].data.push(line.pureAmount);
    }
  } else {
    for	( let i = 1; i < lines.length; i += 1 )	{
      let line = lines[i];
      chartData.labels.push(`${line.year}/${line.month}`);
    }
    index = 0;
    if	( Amount )	{
      chartData.datasets[index] = {
        label: '金額',
        fill: false,
        borderColor: colors[index],
        data: []
      };
      for	( let i = 1; i < lines.length; i += 1 )	{
        let line = lines[i];
        chartData.datasets[index].data.push(line.pureAmount);
      }
      index += 1;
    }
    if	( Balance )	{
      chartData.datasets[index] =  {
        label: '累計',
        fill: false,
        borderColor: colors[index],
        data: []
      };
      for	( let i = 1; i < lines.length; i += 1 )	{
        let line = lines[i];
        chartData.datasets[index].data.push(line.pureBalance);
      }
    }
  }
}
</script>