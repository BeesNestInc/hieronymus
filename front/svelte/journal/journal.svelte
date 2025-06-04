<div class="list">
  <div class="page-title d-flex justify-content-between">
  	<h1>仕訳日記帳</h1>
  	<a href="/forms/explanatory_journal/{status.fy.term}?format=pdf" download="仕訳日記帳-{today}.pdf" class="btn btn-primary">
    	仕訳日記帳をダウンロード&nbsp;<i class="bi bi-download"></i>
  	</a>
	</div>
	<ul class="page-subtitle nav">
  	{#each dates as date}
    	<li class="nav-item">
      	{#if (date.month == month)}
      	<button type="button" class="btn btn-primary disabled me-2"
        	on:click={() => {
          	openMonth(date.year, date.month)
        	}}>
        	{date.month}月
      	</button>
      	{:else}
      	<button type="button" class="btn btn-outline-primary me-2"
      		on:click={() => {
        		openMonth(date.year, date.month)
      		}}>
        	{date.month}月
      	</button>
      	{/if}
    	</li>
  	{/each}
	</ul>
	<div class="page-subtitle d-flex justify-content-between">
  	<h2>{year}年 {month}月</h2>
  	<div>
    	<button type="button" class="btn btn-primary" id="open-cross-slip"
    		on:click={openSlip}>
        伝票入力&nbsp;<i class="bi bi-pencil-square"></i>
      </button>
  	</div>
	</div>
	<JournalList
    fy={fy}
  	slips={slips}
  	lines={lines}
  	sums={sums}
  	on:open={openSlip}></JournalList>
</div>
{#if popUp}
{#key modalCount}
<CrossSlipModal
  accounts={accounts}
  slip={slip}
  status={status}
  bind:popUp={popUp}
  on:close={close_}></CrossSlipModal>
{/key}
{/if}
<style>
</style>

  <script>
import axios from 'axios';
import Icon from '@iconify/svelte';

import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import JournalList from './journal-list.svelte';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {setAccounts, findAccount, findSubAccountByCode} from '../../javascripts/cross-slip';
import {numeric, dateStr} from '../../../libs/utils.js';

export let status;

let year;
let month;
let fy = {};
let slip = { lines: []};
let dates = [];
let accounts;
let	sums;
let	lines = [];
let slips;
let modalCount = 0;
let popUp;
let today;

const openMonth = (_year, _month) => {
  year = _year;
  month = _month;
  let href = `/journal/${year}/${month}`
  status.pathname = href;
  update();
  window.history.pushState(status, "", href);
}

const close_ = (event) => {
  updateList();
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

      _sums.debitAmount += line.debitAmount != null ? numeric(line.debitAmount) : 0;
      _sums.debitTax += line.debitTax != null ? numeric(line.debitTax) : 0
      _sums.creditAmount += line.creditAmount != null ? numeric(line.creditAmount) : 0;
      _sums.creditTax += line.creditTax != null ? numeric(line.creditTax) : 0;

      _lines.push({
        id: line.id,
        month: slip.month,
        day: slip.day,
        no: slip.no,
        approvedAt: slip.approvedAt,
        lineNo: line.lineNo,

        debitAmount: line.debitAmount !== null ? numeric(line.debitAmount).toLocaleString() : '',
        debitTax: line.debitTax != null ? numeric(line.debitTax).toLocaleString() : '',
        debitTaxRule: line.debitTaxRule ? line.debitTaxRule.label : '',
        creditAmount: line.creditAmount !== null ? numeric(line.creditAmount).toLocaleString() : '',
        creditTax: line.creditTax != null ? numeric(line.creditTax).toLocaleString() : '',
        creditTaxRule: line.creditTaxRule ? line.creditTaxRule.label : '',
           
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
  lines = _lines;
  sums = _sums;
  console.log('lines', lines);
}

const updateList = () => {
  console.log('updateList', year, month);
  axios.get(`/api/journal/${year}/${month}`).then((result) => {
    slips = result.data.journal;
    //console.log(slips);
    ready(slips);
  });
}

const setupDates = () => {
  dates = [];
  axios.get(`/api/term/${year}/${month}`).then((result) => {
    fy = result.data;
    //status.fy= fy;
    for ( let mon = new Date(fy.startDate); mon < new Date(fy.endDate); ) {
      dates.push({
        year: mon.getFullYear(),
        month: mon.getMonth()+1
      });
      mon.setMonth(mon.getMonth() + 1);
    }
    dates = dates;
    console.log('dates', dates);
  });
}

const setupAccount = () => {
  accounts = [];
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    setAccounts(accounts);
  }).then(() => {
    axios.get(`/api/journal/${year}/${month}`).then((result) => {
      slips = result.data.journal;
      //console.log(slips);
      ready(slips);
    });
  });
}

const update = () => {
	updateList();
}
const checkPage = () => {
  update();
}

let _status;
beforeUpdate(()	=> {
  let args = status.pathname.split('/');
  status.current = args[1];
  year = args[2];
  month = args[3];
  console.log('journal beforeUpdate', status.change, year, month);
  if  (( year < 10000 ) &&
       (( status.change ) ||
        ( _status !== status )))  {
    status.change = false;
    _status = status;
    console.log('run checkPage');
    checkPage();
  }
});
afterUpdate(() => {
  if  (!popUp)  {
    modalCount += 1;
  }
})
onMount(async () => {
  console.log('journal onMount');
  if  ( !status.pathname ) {
    status.pathname = location.pathname;
  }
  let args = status.pathname.split('/');
  year = args[2];
  month = args[3];
  setupDates();
  setupAccount();
  let now = new Date();
  today = `${now.getUTCFullYear()}${("00"+(now.getMonth()+1).toString()).slice(-2)}${("00"+now.getDate().toString()).slice(-2)}`;
  slip = {
      year: year,
      month: month,
      lines: []
  };
})

const openSlip = (event) => {
  slip = event.detail;
  if	( !slip.no )	{
    slip = {
      year: parseInt(year),
      month: parseInt(month),
      lines: [{
        debitAccount: "",
        debitSubAccount: 0,
        debitAmount: "",
        debitTax: "",
        creditAccount: "",
        creditSubAccount: 0,
        creditAmount: "",
        creditTax: "",
      }]
    };
  }
  popUp = true;
}
</script>
