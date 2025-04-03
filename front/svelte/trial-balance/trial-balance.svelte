<div class="list">
  <div class="page-title d-flex justify-content-between">
  	<h1>残高試算表</h1>
  	<a href="/forms/trial_balance/{status.term}/{status.month}" download="残高試算表.xlsx" class="btn btn-primary">
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
    href = `/trial-balance/${status.term}/${status.month}`;
  } else {
    href = `/trial-balance/${status.term}`;
  }
  status.pathname = href;
  updateLines();
  window.history.pushState(status, "", href);
}

const updateLines = () => {
  lines = [];
  let url;
  if  ( status.month ) {
    url = `/api/trial-balance/${status.term}/${status.month}`;
  } else {
    url = `/api/trial-balance/${status.term}`;
  }
  axios.get(url).then((result) => {
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
        lines.push({
          name: `【${account.middle_name}】`
        });
      }
      if ( last_account.minor_name != account.minor_name ) {
        lines.push({
          name: account.minor_name
        });
      }
      if	(( new_line.pickup != 0 ) ||
         ( new_line.debit  != 0 ) ||
         ( new_line.credit != 0 ) ||
         ( new_line.balance != 0 )) {
        lines.push(new_line);
      }
      last_account = account;	 
    }
    //console.log('lines', lines);
    lines = lines;
  });
}

const update = () => {
  let args = status.pathname.split('/');
  status.current = args[1];
  status.term = args[2];
  status.month = args[3];
  updateLines();
}

const checkPage = () => {
  update();
}

let _status;
beforeUpdate(()	=> {
  console.log('trial-balance beforeUpdate', status);
  if  (( status.change ) ||
       ( _status !== status ))  {
    status.change = false;
    _status = status;
    console.log('run checkPage');
    checkPage();
  }
});

onMount(() => {
  dates = [];
  axios.get(`/api/term/${status.term}`).then((result) => {
    let fy = result.data;
    for ( let mon = new Date(fy.startDate); mon < new Date(fy.endDate); ) {
      dates.push({
        year: mon.getFullYear(),
        month: mon.getMonth()+1,
        ym: `${mon.getFullYear()}-${mon.getMonth()+1}`
      });
      mon.setMonth(mon.getMonth() + 1);
    }
    dates = dates;
  });
  updateLines();
})

</script>
