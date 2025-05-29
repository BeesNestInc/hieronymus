<div class="page-title d-flex justify-content-between">
  <h1>推移表</h1>
</div>
<AccountSelect
  on:select={(event) => {
    accountSelect(event.detail);
  }}
  fields={fields}/>
<nav class="page-subtitle navbar">
  {#if (account)}
  <button class="btn btn-link fs-4"
    on:click={() => {
      accountSelect({
        code: account.accountCode
      })
    }}>
    { account ? account.name : ''}
  </button>
  {/if}
</nav>
{#if (account && (account.subAccounts.length > 0))}
<div class="row page-subtitle">
  <div class="col-9">
    <SubAccountSelect
    	on:select={(event) => {
      	accountSelect(event.detail);
    	}}
      account={account}
      sub_account_code={status.subAccountCode}/>
  </div>
  <div class="col-3" style="text-align:right;">
    {#if status.subAccountCode}
      <button type="button"
        on:click={() => {
          link(`/ledger/${status.accountCode}/${status.subAccountCode}`)
        }} class="btn btn-info">
      補助元帳を見る
    </button>
    {:else}
    <button type="button"
      on:click={() => {
        link(`/ledger/${status.accountCode}`);
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
<ChangesList
  lines={lines}/>
<style>
</style>

<script>

import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate} from 'svelte';

import {Line} from "svelte-chartjs";
import AccountSelect from '../components/account-select.svelte';
import SubAccountSelect from '../components/subaccount-select.svelte';
import ChangesList from './changes-list.svelte';
import {dc, numeric} from '../../../libs/parse_account_code.js';
import {setAccounts, findAccount, findSubAccountByCode} from '../../javascripts/cross-slip';
import parse_account_code from '../../../libs/parse_account_code';

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

const link = (href) => {
  let args = href.split('/');
  window.history.pushState(status, "", href);
  status.change = true;
}

const accountSelect = (code) => {
  console.log('accountSelect', code);
  let href;
  if  ( code.sub )  {
    href = `/changes/${status.term}/${code.code}/${code.sub}`;
  } else {
    href = `/changes/${status.term}/${code.code}`;
  }
  status.pathname = href;
  status.accountCode = code.code;
  status.subAccountCode = code.sub;
  changeAccount(true);
  window.history.pushState(status, "", href);
}

const termChange = () => {
  console.log({allYears})
  if ( sameMonth )	{
    Balance = false;
  }
  changeAccount(true);
}

const changeAccount = (update) => {
  axios.get(`/api/account/${status.accountCode}`).then((result) => {
    account = result.data;
    console.log('account', account);
    remaining = {};
    let pr;
    let thisTerm;
    if	( allYears )	{
      thisTerm = 0;
    } else {
      thisTerm = status.term;
    }
    if ( status.subAccountCode ) {
      pr = axios.get(`/api/remaining/${thisTerm}/${status.accountCode}/${status.subAccountCode}`);
    } else {
      pr = axios.get(`/api/remaining/${thisTerm}/${status.accountCode}`);
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

onMount(() => {
  console.log('changes onMount');
  let args = location.pathname.split('/');
  status.pathname = location.pathname;
  status.term = args[2];
  status.accountCode = args[3];
  status.subAccountCode = args[4] ? parseInt(args[4]) : undefined;
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
  update();

  changeAccount(false);
});

const makeLines = (accountCode, subAccountCode, remaining, details) => {
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
  if  ( status.subAccountCode > 0 )      {
    tax_class = findSubAccountByCode(accountCode, status.subAccountCode).taxClass;
  } else {
    tax_class = findAccount(accountCode).taxClass;
  }
  for (let i = 0; i < details.length; i++) {
    let detail = details[i];
    //console.log(detail)
    if (dc(accountCode) == 'C') {
      pureTax = detail.creditTax;
      if	( tax_class === 1 )	{
        pureAmount = detail.creditAmount - pureTax;
      } else {
        pureAmount = detail.creditAmount;
      }
    } else {
      pureTax = detail.debitTax;
      if	( tax_class === 1 )	{
        pureAmount = detail.debitAmount - pureTax;
      } else {
        pureAmount = detail.debitAmount;
      }
    }
    pureBalance += pureAmount;
    changes.push({
      year: detail.year,
      month: detail.month,
      pureAmount: pureAmount,
      pureTax: pureTax,
      pureBalance: pureBalance,
      texClass: tax_class
    });
  }
  return	(changes);
}

const update = () => {
  let args = status.pathname.split('/');
  status.current = args[1];
  status.accountCode = args[2];
  status.subAccountCode = args[3] ? parseInt(args[3]) : undefined;
  changeAccount(true);
}
const checkPage = () => {
  status.pathname = location.pathname;
  update();
}

let _status;
beforeUpdate(()	=> {
  console.log('changes beforeUpdate', status.change);
  if  (( status.change ) ||
       ( _status !== status ))  {
    status.change = false;
    _status = status;
    console.log('run checkPage');
    checkPage();
  }
});
afterUpdate(() => {
  console.log('changes afterUpdate');
})
const updateList = () => {
  console.log('updateList', status.term, status.accountCode, status.subAccountCode);
  let pr;
  let thisTerm;
  if	( allYears )	{
    thisTerm = 0;
  } else {
    thisTerm = status.term;
  }
  if ( status.subAccountCode ) {
    console.log('with sub_account');
    pr = axios.get(`/api/changes/${thisTerm}/${status.accountCode}/${status.subAccountCode}`);
  } else {
    pr = axios.get(`/api/changes/${thisTerm}/${status.accountCode}`);
  }
  pr.then((result) => {
    details = result.data;
    //console.log('**details', details);
    //console.log(dc(status.accountCode));
    lines = makeLines(status.accountCode, status.subAccountCode,
        remaining, details);
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