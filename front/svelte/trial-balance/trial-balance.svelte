<div class="list">
  <div class="page-title d-flex justify-content-between">
  	<h1>残高試算表</h1>
  	<a href="/forms/trial_balance/{status.fy.term}/{status.month}" download="残高試算表.xlsx" class="btn btn-primary">
    	残高試算表&nbsp;をダウンロード&nbsp;<i class="bi bi-download"></i>
  	</a>
	</div>
	<ul class="page-subtitle nav me-auto">
  	<li class="nav-item">
    	{#if ( !status.month  )}
    	<button type="button" class="btn btn-primary disabled me-2"
      	on:click={() => {
          openMonth("");
        }}>
      	年度
    	</button>
    	{:else}
    	<button type="button" class="btn btn-outline-primary me-2"
      	on:click={() => {
        	openMonth("");
      	}}>
      	年度
    	</button>
    	{/if}
  	</li>
  	{#each dates as date}
  	<li class="nav-item">
    	{#if (date.ym == status.month)}
    	<button type="button" class="btn btn-primary disabled me-2"
      	on:click={() => {
          openMonth(`${date.year}-${date.month}`);
        }}>
  	    {date.month}&nbsp;月
    	</button>
	    {:else}
  	  <button type="button" class="btn btn-outline-primary me-2"
      on:click={() => {
        openMonth(`${date.year}-${date.month}`);
      }}>
      {date.month}&nbsp;月
  	  </button>
    	{/if}
	  </li>
  	{/each}
	</ul>
	<div class="row body-height">
  	<TrialBalanceList
    	bind:status={status}
	    lines={lines}>
  	</TrialBalanceList>
	</div>
</div>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import TrialBalanceList from './trial-balance-list.svelte';
import {numeric} from '../../../libs/utils.js';
import {dc} from '../../../libs/parse_account_code';

export let status;
export let alert;
export let alert_level;

let lines = [];
let dates = [];

const openMonth = (month) => {
  let href;
  status.month = month;
  if	( status.month )	{
    href = `/trial-balance/${status.fy.term}/${status.month}`;
  } else {
    href = `/trial-balance/${status.fy.term}`;
  }
  status.pathname = href;
  updateLines();
  window.history.pushState(status, "", href);
}

const updateLines = async () => {
  let _lines = [];
  let url;
  if  ( status.month ) {
    url = `/api/trial-balance/${status.fy.term}/${status.month}`;
  } else {
    url = `/api/trial-balance/${status.fy.term}`;
  }
  const result = await axios.get(url);
  let data = result.data;
  //console.log('trial-balance update', data);
  let trial_balance = data;
  let last_account = {};
  for ( let i = 0; i < trial_balance.length; i ++ ) {
    let account = trial_balance[i];
    if	( !account.code ) continue;
    if	( account.code.length > 7 ) continue;
    let new_line = {
      name: account.name,
      pickup: numeric(account.pickup),
      debit: numeric(account.debit),
      credit: numeric(account.credit),
      code: account.code
    };
    //console.log('new_line', new_line);
    if ( dc(account.code) == 'D' ) {
      new_line.balance = new_line.pickup + new_line.debit - new_line.credit;
    } else {
      new_line.balance = new_line.pickup - new_line.debit + new_line.credit;
    }

    if ( last_account.middle_name != account.middle_name ) {
      _lines.push({
        name: `【${account.middle_name}】`
      });
    }
    if ( last_account.minor_name != account.minor_name ) {
      _lines.push({
        name: account.minor_name
      });
    }
    if	(( new_line.pickup != 0 ) ||
       ( new_line.debit  != 0 ) ||
       ( new_line.credit != 0 ) ||
       ( new_line.balance != 0 )) {
      _lines.push(new_line);
    }
    last_account = account;	 
  }
  //console.log('lines', _lines);
  lines = _lines;
}

const updateDates = () => {
  let _dates = [];
  console.log('updateDates', status.fy);
  let mon = status.fy.startDate;
  for ( let i = 0 ; i < 12 ; i += 1)  {
    _dates.push({
      year: mon.getFullYear(),
      month: mon.getMonth()+1,
      ym: `${mon.getFullYear()}-${mon.getMonth()+1}`
    });
    mon.setMonth(mon.getMonth() + 1);
  }
  console.log({_dates});
  dates = _dates;
}

const checkPage = async () => {
  let args = status.pathname.split('/');
  status.current = args[1];
  let term = parseInt(args[2]);
  const result = await axios(`/api/term/${term}`);
  let fy = result.data;
  status.fy = fy;
  status.fy.startDate = new Date(fy.startDate);
  status.fy.endDate = new Date(fy.endDate);
  console.log('got', status);
  status.month = args[3];
  updateDates();
  await updateLines();
}

let _status;
beforeUpdate(async ()	=> {
  console.log('trial-balance beforeUpdate', status);
  if  (( status.change ) ||
       ( _status !== status ))  {
    status.change = false;
    _status = status;
    console.log('run checkPage');
    await checkPage();
  }
});

onMount(async () => {
  dates = [];
  const fy = status.fy;
  console.log('onMount', {status});
  await checkPage();
})

</script>
