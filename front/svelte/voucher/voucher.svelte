{#if ( status.state === 'list' )}
<VoucherList
  bind:status={status}
  bind:vouchers={vouchers}
  on:open={openEntry}
  on:slip={openSlip}
  on:update={updateVouchers}
  ></VoucherList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
<VoucherEntry
  bind:status={status}
  bind:voucher={voucher}
  on:open={openSlip}
  on:close={closeEntry}>
</VoucherEntry>
{/if}
{#if popUp}
{#key modalCount}
<CrossSlipModal
  accounts={accounts}
  slip={slip}
  status={status}
  bind:popUp={popUp}
  on:close={updateVouchers}></CrossSlipModal>
{/key}
{/if}

<style>
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import VoucherEntry from './voucher-entry.svelte';
import VoucherList from './voucher-list.svelte';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentVoucher, getStore} from '../../javascripts/current-record.js'
import {setAccounts} from '../../javascripts/cross-slip';
import {parseParams, buildParam} from '../../javascripts/params.js';

let slip = {
  year: 0,
  month: 0,
  lines: []
};
let modalCount = 0;
let popUp;

export let status;

let	voucher;
let vouchers = [];
let accounts = [];

const openSlip = (event) => {
  const slipNo = event.detail;
  if	( slipNo.no )	{
    axios.get(`/api/cross_slip/${slipNo.year}/${slipNo.month}/${slipNo.no}`).then((result) => {
      slip = result.data;
      slip.approvedAt = slip.approvedAt ? new Date(slip.approvedAt) : null;
      console.log('slip', slip);
      popUp = true;
    })
  } else {
    slip = {
      year: parseInt(slipNo.year),
      month: parseInt(slipNo.month),
      day: parseInt(slipNo.day),
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
    popUp = true;
  }
};

const	openEntry = (event)	=> {
  //console.log('open', event.detail);
  voucher = event.detail;
  status.change = true;
  if ( !voucher || !voucher.id )	{
    voucher = null;
    status.state = 'new';
    currentVoucher.set(null);
    window.history.pushState(
      status, "", `/voucher/new`);
  } else {
    status.state = 'entry';
    window.history.pushState(
      status, "", `/voucher/entry/${voucher.id}`);
  }
};

const closeEntry = (event) => {
  status.state = 'list';
}

const updateVouchers = (event) => {
  let param;
  if  ( event ) {
    param = buildParam(status, event.detail);
  } else {
    param = status.params;
  }
  console.log('param', param);
  axios.get(`/api/voucher?${param}`).then((result) => {
    vouchers = result.data.vouchers;
    //console.log('vouchers', vouchers);
  });
  if	( event )	{
    window.history.pushState(
        status, "", `${location.pathname}?${param}`);
  }
};


const checkPage = () => {
  let args = location.pathname.split('/');
  console.log({args});
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
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
          axios.get(`/api/voucher/${args[3]}`).then((result) => {
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
}

onMount(async () => {
  status.params = parseParams();
  console.log('voucher onMount', voucher);
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    setAccounts(accounts);
    updateVouchers();
  });
  window.onpopstate = (event) => {
    if	( window.history.state )	{
      status = window.history.state;
      //console.log({current_params});
      updateVouchers();
    }
  }
})

beforeUpdate(()	=> {
  //console.log('voucher beforeUpdate');
  checkPage();
});
afterUpdate(() => {
  //console.log('voucher afterUpdate');
  if  (!popUp)  {
    modalCount += 1;
  }
})
</script>
