{#if ( status.state === 'list' )}
<div class="d-flex justify-content-between mb-3 mt-3">
  <h1 class="fs-3">証票一覧</h1>
  <button type="button" class="btn btn-primary"
  	on:click={() => {
    	openEntry(null);
  	}}
		id="voucher-info">証票入力&nbsp;<i class="bi bi-pencil-square"></i></button>
</div>
<ul class="nav me-auto mb-2">
  {#each dates as date}
    <li class="nav-item">
      {#if ( status.params && (date.ym == status.params.get('month')) )}
      <button type="button" class="btn btn-primary disabled me-2"
        on:click={openMonth}
        data-month="{date.year}-{date.month}">
        {date.month}&nbsp;月
      </button>
      {:else}
      <button type="button" class="btn btn-outline-primary me-2"
        on:click={openMonth}
        data-month="{date.year}-{date.month}">
        {date.month}&nbsp;月
      </button>
      {/if}
    </li>
  {/each}
  <li class="nav-item">
    {#if ( !status.params || !status.params.get('month') )}
    <button type="button" class="btn btn-primary disabled me-2"
      data-month=""
      on:click={openMonth}>
      ALL
    </button>
    {:else}
    <button type="button" class="btn btn-outline-primary me-2"
      data-month=""
      on:click={openMonth}>
      ALL
    </button>
    {/if}
  </li>
</ul>
<VoucherList
  bind:status={status}
  vouchers={vouchers}
  on:open={openEntry}
  on:openSlip={openSlip}
  on:selectVoucherType={selectVoucherType}
  on:selectCustomerId={selectCustomer}
  on:selectAmount={selectAmount}
  ></VoucherList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
<VoucherEntry
  bind:status={status}
  bind:voucher={voucher}
  on:close={closeEntry}>
</VoucherEntry>
{/if}
<CrossSlipModal
  slip={slip}
  bind:modal={slipModal}
  term={status.term}
  user={user}
  accounts={accounts}
  bind:init={init}
  on:close={updateVouchers}></CrossSlipModal>

<style>
</style>

<script>
import axios from 'axios';
import Modal from 'bootstrap/js/dist/modal';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import VoucherEntry from './voucher-entry.svelte';
import VoucherList from './voucher-list.svelte';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {set_accounts} from '../../javascripts/cross-slip';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentVoucher, getStore} from '../../javascripts/current-record.js'

export let user;
export let status;

let	voucher;
let slipModal;
let init;
let vouchers = [];
let accounts = [];
let slip = {
  year: 0,
  month: 0,
  lines: []
};
let dates = [];

const selectVoucherType = (event) => {
  updateVouchers({});
}
const selectCustomer = (event) => {
  let	customerId = event.detail;
  //console.log({customerId});
  updateVouchers({
    customer: customerId
  });
}
const selectAmount = (event) => {
  let amounts = event.detail;
  //console.log({amounts});
  updateVouchers({
    upper: numeric(amounts.upperAmount),
    lower: numeric(amounts.lowerAmount)
  });
}

const updateVouchers = (_params) => {
  if	( !status.params )	{
    status.params = new Map();
  }
  if	( _params )	{
    Object.keys(_params).map((key) => {
      if	( !_params[key] )	{
        status.params.delete(key);
      } else {
        status.params.set(key,_params[key]);
      }
    });
  }
  console.log('current_params', status.params);
  let _array = [];
  status.params.forEach((value, key) => {
    //console.log('key, value', key, value);
    _array.push(encodeURI(`${key}=${value}`));
  });
  let param = _array.join('&');
  //console.log('param', param);
  axios.get(`/api/voucher?${param}`).then((result) => {
    vouchers = result.data.vouchers;
    //console.log('vouchers', vouchers);
  });
  if	( _params )	{
    window.history.pushState(
        status, "", `${location.pathname}?${param}`);
  }
};

const openMonth = (event) => {
    event.preventDefault();
  let month = event.currentTarget.dataset.month;
  gotoMonth(month);
}
const gotoMonth = (month) => {
  //console.log('month', month);
  updateVouchers({
    month: month
  });
}

const	openSlip = (event)	=> {
  //console.log('openSlip', event.detail);
  slip = event.detail;
  init = true;
  //console.log('slip', slip)
  slipModal.show();
};

const	openEntry = (event)	=> {
  //console.log('open', event.detail);
  if	( !event )	{
		voucher = null;
    status.state = 'new';
    window.history.pushState(
      status, "", `/voucher/${status.term}/new`);
  } else {
  	voucher = event.detail;
  	if ( !voucher.id )	{
    	voucher = null;
    	status.state = 'new';
    	window.history.pushState(
      	null, "", `/voucher/${status.term}/new`);
  	} else {
    	status.state = 'entry';
    	window.history.pushState(
      	null, "", `/voucher/${status.term}/entry/${voucher.id}`);
  	}
  	//console.log('voucher', voucher)
  }
};

const closeEntry = (event) => {
  status.state = 'list';
  updateVouchers();
}

const checkPage = () => {
  let args = location.pathname.split('/');
  console.log({args});
  if  ( ( args[3] === 'entry' ) ||
			  ( args[3] === 'new'   )) {
    status.state = args[3];
    if  ( !voucher ) {
      voucher = {
      	issueDate: formatDate(new Date()),
      	paymentDate: null,
      	amount: 0,
      	taxClass: -1,
      	tax: 0,
      	type: -1
    	};
      let value = getStore(currentVoucher);
      if	( value )	{
        voucher = value;
      } else {
        if	( status.state === 'entry' )	{
          axios(`/api/voucher/${args[4]}`).then((result) => {
        		voucher = result.data.voucher;
        		//console.log({voucher});
            currentVoucher.set(voucher);
      		});
        } else {
          currentVoucher.set(voucher);
        }
      }
    }
  } else {
    status.state = 'list';
  }
  status.term = parseInt(args[2]);
}

onMount(async () => {
  console.log('voucher onMount', voucher);
  checkPage()
  if	( !status.params )	{
    status.params = new Map();
  }
  let _params = location.search.substring(1); // for leading '?'
  if  ( _params )	{
    _params.split('&').map((item) => {
      let kv = item.split('=');
      status.params.set(decodeURI(kv[0]), decodeURI(kv[1]));
    });
  }
  axios.get(`/api/term/${status.term}`).then((result) => {
    let fy = result.data;
    status.term = fy.term;
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
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    set_accounts(accounts);
  });
  updateVouchers();
  window.onpopstate = (event) => {
    if	( window.history.state )	{
      state = window.history.state;
      //console.log({current_params});
      updateVouchers();
    }
  }
  slipModal = new Modal(document.getElementById('cross-slip-modal'));
})

beforeUpdate(()	=> {
  //console.log('voucher beforeUpdate');
  checkPage();
});
afterUpdate(() => {
  //console.log('voucher afterUpdate');
})
</script>
